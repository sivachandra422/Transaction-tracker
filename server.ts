import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini API client on the server
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Wraps fetch with a 15-second AbortController timeout so Notion API hangs
// never outlast Cloud Run's request timeout and return non-JSON HTML to the client.
async function notionFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "15mb" }));

  // API Route - Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route - Parse transaction details with Gemini, OpenRouter, or OpenAI
  app.post("/api/gemini/parse", async (req, res) => {
    const { text, image, imageType, provider, apiKey, model } = req.body;

    const currentProvider = provider || "gemini";
    const currentModel = model || (currentProvider === "openrouter" ? "google/gemini-2.5-flash:free" : currentProvider === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");
    const currentDateString = new Date().toISOString().split('T')[0];

    // If the provider is OpenRouter or OpenAI
    if (currentProvider === "openrouter" || currentProvider === "openai") {
      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ error: `Please provide your ${currentProvider === "openrouter" ? "OpenRouter" : "OpenAI"} API Key in AI Provider Settings.` });
      }

      try {
        const baseURL = currentProvider === "openrouter" 
          ? "https://openrouter.ai/api/v1/chat/completions" 
          : "https://api.openai.com/v1/chat/completions";

        const systemInstruction = 
          "You are an expert financial transaction extraction system localized for Indian users. " +
          "Parse the user's input text (including Rupee values ₹, INR, Rs., rupees) or Indian billing receipts/grocery screenshots (from Swiggy, Zomato, Blinkit, Zepto, BigBasket, PhonePe, Paytm, etc.) and extract structured transaction details. " +
          "Always categorize accurately. Choose from categories: Food, Groceries, Transport, Utilities, Shopping, Entertainment, Housing, Income, Other. " +
          "Under context clues, map to the most specific category (e.g., Blinkit, Instamart, paneer, veggies, supermarket items -> Groceries; Swiggy, Zomato, cafes, dhabas -> Food; Ola, Uber Auto, metro, train, petrol -> Transport). " +
          "Specify the transaction type as either 'expense' or 'income'. " +
          "Format date as YYYY-MM-DD. " +
          "If date is not specified, use today's date: " + currentDateString + ". " +
          "Extract merchant name cleanly (e.g. 'Swiggy' instead of 'SWIGGY ORDER INSTANT' or 'Rameshwaram Cafe' instead of 'THE RAMESHWARAM CAFE INDIRANAGAR'). " +
          "Break keywords, tags, or concepts into a few distinct singular labels or tags (e.g. ['dosa', 'breakfast', 'southindian'])." +
          "\n\nCRITICAL: You MUST respond ONLY with a valid JSON object matching this schema. Avoid any wrapping like ```json or trailing explanation text:\n" +
          JSON.stringify({
            amount: 350.00,
            description: "Detail of what is purchased",
            merchant: "Clean merchant name",
            category: "Food",
            type: "expense",
            date: "2026-06-09",
            labels: ["tag1", "tag2"]
          });

        const messages: any[] = [
          { role: "system", content: systemInstruction }
        ];

        let userContent: any[] = [];
        if (text) {
          userContent.push({ type: "text", text });
        }
        if (image && imageType) {
          const formattedBase64 = image.startsWith("data:") ? image : `data:${imageType};base64,${image}`;
          userContent.push({
            type: "image_url",
            image_url: {
              url: formattedBase64
            }
          });
        } else if (!text) {
          return res.status(400).json({ error: "Missing both text and image input." });
        }
        
        messages.push({ role: "user", content: userContent });

        const headers: Record<string, string> = {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        };
        if (currentProvider === "openrouter") {
          headers["HTTP-Referer"] = "https://ai.studio/build";
          headers["X-Title"] = "FinSnap Ledger Smart Tracker";
        }

        const openAIResponse = await fetch(baseURL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: currentModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.1
          })
        });

        if (!openAIResponse.ok) {
          const errorText = await openAIResponse.text();
          let parsedError;
          try { parsedError = JSON.parse(errorText); } catch(e) {}
          const errorMessage = parsedError?.error?.message || parsedError?.message || errorText || "API call failed.";
          throw new Error(`[${currentProvider}] ${errorMessage}`);
        }

        const data = await openAIResponse.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("No response output from selected AI model.");
        }

        let cleanJsonStr = content.trim();
        if (cleanJsonStr.startsWith("```")) {
          cleanJsonStr = cleanJsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        const parsedResponse = JSON.parse(cleanJsonStr);
        return res.json({ 
          amount: parseFloat(parsedResponse.amount) || 0,
          description: parsedResponse.description || "Parsed Transaction",
          merchant: parsedResponse.merchant || "Unknown Merchant",
          category: parsedResponse.category || "Other",
          type: parsedResponse.type === "income" ? "income" : "expense",
          date: parsedResponse.date || currentDateString,
          labels: Array.isArray(parsedResponse.labels) ? parsedResponse.labels : [],
          isFallback: false,
          usingProvider: currentProvider,
          usingModel: currentModel
        });

      } catch (err: any) {
        console.error(`${currentProvider} Error:`, err);
        
        let cleanErrMessage = err?.message || String(err);
        if (typeof cleanErrMessage === "string" && cleanErrMessage.trim().startsWith("{")) {
          try {
            const parsedErr = JSON.parse(cleanErrMessage);
            if (parsedErr?.error?.message) {
              cleanErrMessage = parsedErr.error.message;
            } else if (parsedErr?.message) {
              cleanErrMessage = parsedErr.message;
            }
          } catch (e) {}
        }

        let parsed;
        if (text && typeof text === "string" && text.trim().length > 0) {
          try {
            parsed = heuristicParse(text);
          } catch (fallbackErr) {}
        }

        if (!parsed) {
          parsed = {
            amount: 505.00,
            description: "Receipt scanned (Offline Fallback - manually adjust)",
            merchant: "Pending Merchant Details",
            category: "Shopping",
            type: "expense",
            date: currentDateString,
            labels: ["offline-fallback", "receipt"]
          };
        }

        return res.json({ 
          ...parsed, 
          isFallback: true, 
          fallbackReason: cleanErrMessage,
          usingProvider: currentProvider,
          usingModel: currentModel
        });
      }
    }

    // Default to Gemini API provider
    try {
      let ai;
      if (apiKey && apiKey.trim()) {
        ai = new GoogleGenAI({
          apiKey: apiKey.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      } else {
        ai = getGeminiClient();
      }

      let contents: any[] = [];
      const systemInstruction = 
        "You are an expert financial transaction extraction system localized for Indian users. " +
        "Parse the user's input text (including Rupee values ₹, INR, Rs., rupees) or Indian billing receipts/grocery screenshots (from Swiggy, Zomato, Blinkit, Zepto, BigBasket, PhonePe, Paytm, etc.) and extract structured transaction details. " +
        "Always categorize accurately. Choose from categories: Food, Groceries, Transport, Utilities, Shopping, Entertainment, Housing, Income, Other. " +
        "Under context clues, map to the most specific category (e.g., Blinkit, Instamart, paneer, veggies, supermarket items -> Groceries; Swiggy, Zomato, cafes, dhabas -> Food; Ola, Uber Auto, metro, train, petrol -> Transport). " +
        "Specify the transaction type as either 'expense' or 'income'. " +
        "Format date as YYYY-MM-DD. " +
        "If date is not specified, use today's date: " + currentDateString + ". " +
        "Extract merchant name cleanly (e.g. 'Swiggy' instead of 'SWIGGY ORDER INSTANT' or 'Rameshwaram Cafe' instead of 'THE RAMESHWARAM CAFE INDIRANAGAR'). " +
        "Break keywords, tags, or concepts into a few distinct singular labels or tags (e.g. ['dosa', 'breakfast', 'southindian']).";

      if (image && imageType) {
        // Strip data URL scheme prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        contents.push({
          inlineData: {
            mimeType: imageType,
            data: base64Data
          }
        });
        if (text) {
          contents.push({ text: `Context/User Memo: ${text}. Extract from receipt image.` });
        } else {
          contents.push({ text: "Please extract the transaction details from this receipt image." });
        }
      } else if (text) {
        contents.push({ text });
      } else {
        return res.status(400).json({ error: "Missing both text and image input." });
      }

      const response = await ai.models.generateContent({
        model: currentModel === "gemini-3.5-flash" ? "gemini-3.5-flash" : currentModel,
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: {
                type: Type.NUMBER,
                description: "The total transaction amount in numeric format in Indian Rupees (INR) (e.g. 350 or 1240.50). Must be positive."
              },
              description: {
                type: Type.STRING,
                description: "Detailed description of what was purchased or earned (e.g., Butter Masala Dosa, Weekly groceries, Monthly salary)."
              },
              merchant: {
                type: Type.STRING,
                description: "The name of the merchant, venue, or employer cleanly capitalized (e.g., Swiggy, Zomato, Blinkit, Uber, Google)."
              },
              category: {
                type: Type.STRING,
                description: "Category category. Must be one of: Food, Groceries, Transport, Utilities, Shopping, Entertainment, Housing, Income, Other."
              },
              type: {
                type: Type.STRING,
                description: "Either 'expense' or 'income'."
              },
              date: {
                type: Type.STRING,
                description: "Transaction completion date in YYYY-MM-DD format."
              },
              labels: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Up to 4 singular words or tags describing the checkout (e.g., ['coffee', 'beverage', 'break'])."
              }
            },
            required: ["amount", "description", "merchant", "category", "type", "date", "labels"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini yielded an empty structured response.");
      }

      const parsedResponse = JSON.parse(responseText.trim());
      res.json({ ...parsedResponse, isFallback: false, usingProvider: "gemini", usingModel: currentModel });

    } catch (err: any) {
      console.log("Gemini API is temporarily busy or failed. Activating local on-device heuristic parser fallback.", err?.message);
      
      let cleanErrMessage = err?.message || String(err);
      if (typeof cleanErrMessage === "string" && cleanErrMessage.trim().startsWith("{")) {
        try {
          const parsedErr = JSON.parse(cleanErrMessage);
          if (parsedErr?.error?.message) {
            cleanErrMessage = parsedErr.error.message;
          } else if (parsedErr?.message) {
            cleanErrMessage = parsedErr.message;
          }
        } catch (e) {}
      }

      let parsed;
      if (text && typeof text === "string" && text.trim().length > 0) {
        try {
          parsed = heuristicParse(text);
        } catch (fallbackErr: any) {
          console.log("Local fallback match engine error.");
        }
      }

      if (!parsed) {
        parsed = {
          amount: 505.00,
          description: "Receipt scanned (Offline Fallback - manually adjust)",
          merchant: "Pending Merchant Details",
          category: "Shopping",
          type: "expense" as const,
          date: currentDateString,
          labels: ["offline-fallback", "receipt"]
        };
      }

      console.log("On-device fallback successfully resolved.");
      return res.json({ 
        ...parsed, 
        isFallback: true, 
        fallbackReason: cleanErrMessage,
        usingProvider: "gemini",
        usingModel: currentModel
      });
    }
  });

  // Local regex-based heuristic parsing engine for Indian banking alert SMS text
  function heuristicParse(text: string) {
    const norm = text.toLowerCase();
    const currentDateString = new Date().toISOString().split('T')[0];
    
    let amount = 0;
    let description = "Transaction Alert Decoded";
    let merchant = "Unknown Merchant";
    let category = "Other";
    let type: "expense" | "income" = "expense";
    let date = currentDateString;
    let labels: string[] = ["sms-auto", "local-parse"];

    // 1. Extract Amount (matches ₹, Rs., Rs, INR, followed by decimal)
    const amountRegexes = [
      /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i,
      /debited\s*(?:for)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /spent\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /credited\s*(?:for|with)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs)/i
    ];

    for (const regex of amountRegexes) {
      const match = norm.match(regex);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }

    // 2. Identify transaction type (Income vs Expense)
    if (
      norm.includes("credited") || 
      norm.includes("received") || 
      norm.includes("refunded") || 
      norm.includes("salary") || 
      norm.includes("payout") || 
      norm.includes("cashback")
    ) {
      type = "income";
    }

    // 3. Indian Merchant & Category Heuristics
    const merchantMapping = [
      { keyword: "swiggy", name: "Swiggy", category: "Food", label: "food-delivery" },
      { keyword: "zomato", name: "Zomato", category: "Food", label: "food-delivery" },
      { keyword: "blinkit", name: "Blinkit", category: "Groceries", label: "quick-commerce" },
      { keyword: "zepto", name: "Zepto", category: "Groceries", label: "quick-commerce" },
      { keyword: "instamart", name: "Blinkit Instamart", category: "Groceries", label: "quick-commerce" },
      { keyword: "bigbasket", name: "BigBasket", category: "Groceries", label: "groceries" },
      { keyword: "jiomart", name: "JioMart", category: "Groceries", label: "groceries" },
      { keyword: "uber", name: "Uber", category: "Transport", label: "cab" },
      { keyword: "ola", name: "Ola", category: "Transport", label: "cab" },
      { keyword: "rapido", name: "Rapido", category: "Transport", label: "auto-bike" },
      { keyword: "namma yatri", name: "Namma Yatri", category: "Transport", label: "cab-booking" },
      { keyword: "metro", name: "Namma Metro", category: "Transport", label: "metro" },
      { keyword: "railway", name: "IRCTC", category: "Transport", label: "train" },
      { keyword: "irctc", name: "IRCTC", category: "Transport", label: "train" },
      { keyword: "jio", name: "Jio", category: "Utilities", label: "recharge" },
      { keyword: "airtel", name: "Airtel", category: "Utilities", label: "recharge" },
      { keyword: "bescom", name: "BESCOM", category: "Utilities", label: "electricity" },
      { keyword: "act fibernet", name: "ACT Fibernet", category: "Utilities", label: "isps" },
      { keyword: "amazon", name: "Amazon", category: "Shopping", label: "online" },
      { keyword: "flipkart", name: "Flipkart", category: "Shopping", label: "online" },
      { keyword: "myntra", name: "Myntra", category: "Shopping", label: "fashion" },
      { keyword: "netflix", name: "Netflix", category: "Entertainment", label: "streaming" },
      { keyword: "spotify", name: "Spotify", category: "Entertainment", label: "music" },
      { keyword: "bookmyshow", name: "BookMyShow", category: "Entertainment", label: "movies" },
      { keyword: "bms", name: "BookMyShow", category: "Entertainment", label: "movies" },
      { keyword: "rent", name: "House Rent", category: "Housing", label: "rent" },
      { keyword: "maid", name: "Maid Services", category: "Housing", label: "helper" },
      { keyword: "salary", name: "Monthly Salary", category: "Income", label: "salary" }
    ];

    for (const mapping of merchantMapping) {
      if (norm.includes(mapping.keyword)) {
        merchant = mapping.name;
        category = mapping.category;
        labels.push(mapping.label);
        break;
      }
    }

    if (merchant === "Unknown Merchant") {
      // Try extracting phrase following 'to' or 'at'
      const toMatch = text.match(/(?:to|at)\s+([A-Za-z0-9\s&']{3,25})(?:\s+Ref|\s+on|\s+via|\.|$)/i);
      if (toMatch && toMatch[1]) {
        merchant = toMatch[1].trim();
      }
    }

    description = `${type === "expense" ? "Spent ₹" : "Received ₹"}${amount} via SMS: ${merchant}`;

    // 4. Extract standard Indian date patterns
    const dateRegexes = [
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{2})-(\d{2})-(\d{4})/,
      /(\d{2})\/(\d{2})\/(\d{4})/
    ];

    for (const dRegex of dateRegexes) {
      const dMatch = text.match(dRegex);
      if (dMatch) {
         if (dMatch[1].length === 4) {
           date = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
           break;
         } else {
           date = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
           break;
         }
      }
    }

    return {
      amount,
      description,
      merchant,
      category,
      type,
      date,
      labels
    };
  }

  // API Route - Search Available Notion Pages (to find parent pages shared with integration)
  app.post("/api/notion/search-pages", async (req, res) => {
    try {
      const { notionToken } = req.body;
      if (!notionToken) {
        return res.status(400).json({ error: "notionToken is required." });
      }

      const response = await notionFetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filter: {
            property: "object",
            value: "page"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errMsg = "Failed to search Notion workspace.";
        try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
        return res.status(response.status).json({ error: errMsg });
      }

      const data = await response.json();
      const pages = (data.results || []).map((page: any) => {
        let title = "Untitled Page";
        const titlePropObj = Object.values(page.properties || {}).find((prop: any) => prop.type === "title") as any;
        if (titlePropObj && titlePropObj.title && titlePropObj.title.length > 0) {
          title = titlePropObj.title.map((t: any) => t.plain_text).join("");
        }
        return {
          id: page.id,
          title: title || "Untitled Page",
          url: page.url
        };
      });

      res.json({ success: true, pages });
    } catch (err: any) {
      console.error("Notion Search Error:", err);
      if (err.name === "AbortError") {
        return res.status(504).json({ error: "Notion API did not respond in time. Please check your network and try again." });
      }
      res.status(500).json({ error: err.message || "Failed to contact Notion Workspace search API." });
    }
  });

  // API Route - Automatically Create Tracker Database in Notion
  app.post("/api/notion/create-database", async (req, res) => {
    try {
      const { notionToken, parentPageId, title } = req.body;
      if (!notionToken || !parentPageId) {
        return res.status(400).json({ error: "notionToken and parentPageId are required." });
      }

      const dbTitle = title || "FinSnap Smart Ledger";

      const response = await notionFetch("https://api.notion.com/v1/databases", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parent: {
            type: "page_id",
            page_id: parentPageId
          },
          title: [
            {
              type: "text",
              text: {
                content: dbTitle
              }
            }
          ],
          properties: {
            "Name": {
              "title": {}
            },
            "Amount": {
              "number": {
                "format": "rupee"
              }
            },
            "Category": {
              "select": {
                "options": [
                  { "name": "Food", "color": "orange" },
                  { "name": "Groceries", "color": "green" },
                  { "name": "Transport", "color": "blue" },
                  { "name": "Utilities", "color": "purple" },
                  { "name": "Shopping", "color": "yellow" },
                  { "name": "Entertainment", "color": "pink" },
                  { "name": "Housing", "color": "red" },
                  { "name": "Income", "color": "green" },
                  { "name": "Other", "color": "default" }
                ]
              }
            },
            "Type": {
              "select": {
                "options": [
                  { "name": "Income", "color": "green" },
                  { "name": "Expense", "color": "red" }
                ]
              }
            },
            "Merchant": {
              "rich_text": {}
            },
            "Date": {
              "date": {}
            },
            "Labels": {
              "multi_select": {}
            }
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errMsg = "Failed to auto-create Notion database schema.";
        try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
        return res.status(response.status).json({ error: errMsg });
      }

      const dbData = await response.json();
      res.json({
        success: true,
        databaseId: dbData.id,
        title: dbTitle,
        url: dbData.url
      });
    } catch (err: any) {
      console.error("Notion Create Database Error:", err);
      if (err.name === "AbortError") {
        return res.status(504).json({ error: "Notion API did not respond in time. Please check your network and try again." });
      }
      res.status(500).json({ error: err.message || "Failed to generate Notion database." });
    }
  });

  // API Route - Verify Notion Database Connection
  app.post("/api/notion/verify", async (req, res) => {
    try {
      const { notionToken, notionDatabaseId } = req.body;
      if (!notionToken || !notionDatabaseId) {
        return res.status(400).json({ error: "notionToken and notionDatabaseId are required inside the session." });
      }

      const response = await notionFetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errMsg = "Invalid database connection";
        try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
        return res.status(response.status).json({ error: errMsg });
      }

      const info = await response.json();
      res.json({
        success: true,
        title: info.title?.[0]?.plain_text || "Notion Database",
        properties: Object.keys(info.properties)
      });
    } catch (err: any) {
      console.error("Notion Verify Error:", err);
      if (err.name === "AbortError") {
        return res.status(504).json({ error: "Notion API did not respond in time. Please check your network and try again." });
      }
      res.status(500).json({ error: err.message || "Failed to contact Notion API." });
    }
  });

  // API Route - Sync single transaction to Notion Database
  app.post("/api/notion/sync", async (req, res) => {
    try {
      const { notionToken, notionDatabaseId, transaction } = req.body;
      if (!notionToken || !notionDatabaseId || !transaction) {
        return res.status(400).json({ error: "Missing required inputs for Notion sync." });
      }

      const { amount, description, merchant, category, type, date, labels } = transaction;

      // Construct properties mapping to Notion schema
      // We assume standard columns which we guide the user to configure
      const properties: any = {
        "Name": {
          "title": [
            { "text": { "content": description || "Unnamed Transaction" } }
          ]
        },
        "Amount": {
          "number": Number(amount) || 0
        },
        "Category": {
          "select": { "name": category || "Other" }
        },
        "Type": {
          "select": { "name": type === "income" ? "Income" : "Expense" }
        },
        "Merchant": {
          "rich_text": [
            { "text": { "content": merchant || "" } }
          ]
        },
        "Date": {
          "date": { "start": date || new Date().toISOString().split('T')[0] }
        }
      };

      // Add Labels as multi-select tags if they exist and are non-empty
      const rawLabels = labels || [];
      const filteredLabels = rawLabels
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      if (filteredLabels.length > 0) {
        properties["Labels"] = {
          "multi_select": filteredLabels.map((l: string) => ({ "name": l }))
        };
      }

      const payload = {
        parent: { database_id: notionDatabaseId },
        properties
      };

      const response = await notionFetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errMsg = "Failed to insert record into Notion.";
        try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
        return res.status(response.status).json({ error: errMsg });
      }

      const data = await response.json();
      res.json({ success: true, id: data.id, url: data.url });
    } catch (err: any) {
      console.error("Notion Sync Error:", err);
      if (err.name === "AbortError") {
        return res.status(504).json({ error: "Notion API did not respond in time. Please check your network and try again." });
      }
      res.status(500).json({ error: err.message || "Failed to synchronize to Notion." });
    }
  });

  // Vite static file server and HMR routing for Express + React development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();
