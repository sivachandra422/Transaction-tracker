import { GoogleGenAI, Type } from "@google/genai";
import { AiParseInput } from "../validators/aiValidators.js";

// ─── Response shape ───────────────────────────────────────────────────────────

export interface ParsedTransaction {
  amount: number;
  description: string;
  merchant: string;
  category: string;
  type: "expense" | "income";
  date: string;
  labels: string[];
  isFallback: boolean;
  fallbackReason?: string;
  usingProvider: string;
  usingModel: string;
}

// ─── System prompt (shared across providers) ──────────────────────────────────

function buildSystemPrompt(todayDate: string): string {
  return (
    "You are an expert financial transaction extraction system localized for Indian users. " +
    "Parse the user's input text (including Rupee values ₹, INR, Rs., rupees) or Indian billing receipts/grocery screenshots (from Swiggy, Zomato, Blinkit, Zepto, BigBasket, PhonePe, Paytm, etc.) and extract structured transaction details. " +
    "Always categorize accurately. Choose from categories: Food, Groceries, Transport, Utilities, Shopping, Entertainment, Housing, Income, Other. " +
    "Under context clues, map to the most specific category (e.g., Blinkit, Instamart, paneer, veggies, supermarket items -> Groceries; Swiggy, Zomato, cafes, dhabas -> Food; Ola, Uber Auto, metro, train, petrol -> Transport). " +
    "Specify the transaction type as either 'expense' or 'income'. " +
    "Format date as YYYY-MM-DD. " +
    `If date is not specified, use today's date: ${todayDate}. ` +
    "Extract merchant name cleanly (e.g. 'Swiggy' instead of 'SWIGGY ORDER INSTANT' or 'Rameshwaram Cafe' instead of 'THE RAMESHWARAM CAFE INDIRANAGAR'). " +
    "Break keywords, tags, or concepts into a few distinct singular labels or tags (e.g. ['dosa', 'breakfast', 'southindian'])."
  );
}

// ─── Main parse entry-point ───────────────────────────────────────────────────

export async function parseTransaction(
  input: AiParseInput,
  serverGeminiKey: string | undefined
): Promise<ParsedTransaction> {
  const today = new Date().toISOString().split("T")[0];

  if (input.provider === "openrouter" || input.provider === "openai") {
    return parseWithOpenCompatible(input, today);
  }
  return parseWithGemini(input, today, serverGeminiKey);
}

// ─── OpenAI-compatible path (OpenRouter / OpenAI) ────────────────────────────

async function parseWithOpenCompatible(
  input: AiParseInput,
  today: string
): Promise<ParsedTransaction> {
  const { provider, apiKey, model, text, image, imageType } = input;

  if (!apiKey?.trim()) {
    throw new Error(
      `Please provide your ${provider === "openrouter" ? "OpenRouter" : "OpenAI"} API key in AI Provider Settings.`
    );
  }

  const currentModel =
    model ||
    (provider === "openrouter" ? "google/gemini-2.5-flash:free" : "gpt-4o-mini");

  const baseURL =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const systemPrompt =
    buildSystemPrompt(today) +
    "\n\nCRITICAL: Respond ONLY with valid JSON. No markdown fences:\n" +
    JSON.stringify({
      amount: 350.0,
      description: "Detail of what is purchased",
      merchant: "Clean merchant name",
      category: "Food",
      type: "expense",
      date: today,
      labels: ["tag1", "tag2"],
    });

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (text?.trim()) userContent.push({ type: "text", text });
  if (image && imageType) {
    const formattedBase64 = image.startsWith("data:") ? image : `data:${imageType};base64,${image}`;
    userContent.push({ type: "image_url", image_url: { url: formattedBase64 } });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ai.studio/build";
    headers["X-Title"] = "FinSnap Ledger Smart Tracker";
  }

  let responseText: string;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30_000);
    const rawRes = await fetch(baseURL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });
    clearTimeout(id);

    if (!rawRes.ok) {
      const errText = await rawRes.text().catch(() => "");
      let errMsg = "";
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string }; message?: string };
        errMsg = parsed.error?.message ?? parsed.message ?? errText;
      } catch {
        errMsg = errText;
      }
      throw new Error(`[${provider}] ${errMsg || "API call failed."}`);
    }

    const data = (await rawRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    responseText = data.choices?.[0]?.message?.content ?? "";
    if (!responseText) throw new Error("No response output from selected AI model.");
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`${provider} request timed out. Please try again.`);
    }
    throw err;
  }

  const clean = responseText.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(clean) as Partial<ParsedTransaction>;
  return normalizeParsed(parsed, provider, currentModel, false);
}

// ─── Gemini path ──────────────────────────────────────────────────────────────

async function parseWithGemini(
  input: AiParseInput,
  today: string,
  serverKey: string | undefined
): Promise<ParsedTransaction> {
  const { apiKey, model, text, image, imageType } = input;
  const currentModel = model ?? "gemini-2.5-flash";

  const keyToUse = apiKey?.trim() || serverKey;
  if (!keyToUse) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const ai = new GoogleGenAI({
    apiKey: keyToUse,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const contents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (image && imageType) {
    contents.push({
      inlineData: {
        mimeType: imageType,
        data: image.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
    contents.push({ text: text ? `Context: ${text}. Extract from receipt.` : "Extract transaction details from this receipt image." });
  } else if (text?.trim()) {
    contents.push({ text });
  }

  const response = await ai.models.generateContent({
    model: currentModel,
    contents,
    config: {
      systemInstruction: buildSystemPrompt(today),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER, description: "Transaction amount in INR." },
          description: { type: Type.STRING, description: "Detailed description of the purchase." },
          merchant: { type: Type.STRING, description: "Clean merchant name." },
          category: {
            type: Type.STRING,
            description:
              "One of: Food, Groceries, Transport, Utilities, Shopping, Entertainment, Housing, Income, Other.",
          },
          type: { type: Type.STRING, description: "'expense' or 'income'." },
          date: { type: Type.STRING, description: "YYYY-MM-DD format." },
          labels: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to 4 tags." },
        },
        required: ["amount", "description", "merchant", "category", "type", "date", "labels"],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) throw new Error("Gemini returned an empty response.");
  const parsed = JSON.parse(responseText.trim()) as Partial<ParsedTransaction>;
  return normalizeParsed(parsed, "gemini", currentModel, false);
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────

export function heuristicParse(text: string): Omit<ParsedTransaction, "isFallback" | "usingProvider" | "usingModel"> {
  const norm = text.toLowerCase();
  const today = new Date().toISOString().split("T")[0];

  let amount = 0;
  let description = "Transaction Alert Decoded";
  let merchant = "Unknown Merchant";
  let category = "Other";
  let type: "expense" | "income" = "expense";
  let date = today;
  const labels: string[] = ["sms-auto", "local-parse"];

  const amountRegexes = [
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /debited\s*(?:for)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /spent\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /credited\s*(?:for|with)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs)/i,
  ];
  for (const regex of amountRegexes) {
    const match = norm.match(regex);
    if (match?.[1]) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) { amount = val; break; }
    }
  }

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

  const merchantMapping: Array<{ keyword: string; name: string; category: string; label: string }> =
    [
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
      { keyword: "irctc", name: "IRCTC", category: "Transport", label: "train" },
      { keyword: "railway", name: "IRCTC", category: "Transport", label: "train" },
      { keyword: "jio", name: "Jio", category: "Utilities", label: "recharge" },
      { keyword: "airtel", name: "Airtel", category: "Utilities", label: "recharge" },
      { keyword: "bescom", name: "BESCOM", category: "Utilities", label: "electricity" },
      { keyword: "act fibernet", name: "ACT Fibernet", category: "Utilities", label: "isp" },
      { keyword: "amazon", name: "Amazon", category: "Shopping", label: "online" },
      { keyword: "flipkart", name: "Flipkart", category: "Shopping", label: "online" },
      { keyword: "myntra", name: "Myntra", category: "Shopping", label: "fashion" },
      { keyword: "netflix", name: "Netflix", category: "Entertainment", label: "streaming" },
      { keyword: "spotify", name: "Spotify", category: "Entertainment", label: "music" },
      { keyword: "bookmyshow", name: "BookMyShow", category: "Entertainment", label: "movies" },
      { keyword: "rent", name: "House Rent", category: "Housing", label: "rent" },
      { keyword: "salary", name: "Monthly Salary", category: "Income", label: "salary" },
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
    const toMatch = text.match(/(?:to|at)\s+([A-Za-z0-9\s&']{3,25})(?:\s+Ref|\s+on|\s+via|\.|$)/i);
    if (toMatch?.[1]) merchant = toMatch[1].trim();
  }

  description = `${type === "expense" ? "Spent ₹" : "Received ₹"}${amount} via SMS: ${merchant}`;

  const dateRegexes = [/(\d{4})-(\d{2})-(\d{2})/, /(\d{2})-(\d{2})-(\d{4})/, /(\d{2})\/(\d{2})\/(\d{4})/];
  for (const dr of dateRegexes) {
    const m = text.match(dr);
    if (m) {
      date = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
      break;
    }
  }

  return { amount, description, merchant, category, type, date, labels };
}

// ─── Build fallback result ────────────────────────────────────────────────────

export function buildFallback(
  text: string | undefined,
  provider: string,
  model: string,
  reason: string
): ParsedTransaction {
  const today = new Date().toISOString().split("T")[0];
  let partial: Omit<ParsedTransaction, "isFallback" | "usingProvider" | "usingModel"> | null = null;

  if (text?.trim()) {
    try { partial = heuristicParse(text); } catch { /* ignore */ }
  }

  return {
    ...(partial ?? {
      amount: 0,
      description: "Receipt scanned (offline fallback — please adjust)",
      merchant: "Unknown Merchant",
      category: "Shopping",
      type: "expense",
      date: today,
      labels: ["offline-fallback"],
    }),
    isFallback: true,
    fallbackReason: reason,
    usingProvider: provider,
    usingModel: model,
  };
}

// ─── Normalise AI JSON output ─────────────────────────────────────────────────

function normalizeParsed(
  raw: Partial<ParsedTransaction>,
  provider: string,
  model: string,
  isFallback: boolean
): ParsedTransaction {
  const today = new Date().toISOString().split("T")[0];
  return {
    amount: typeof raw.amount === "number" ? raw.amount : parseFloat(String(raw.amount ?? "0")) || 0,
    description: raw.description ?? "Parsed Transaction",
    merchant: raw.merchant ?? "Unknown Merchant",
    category: raw.category ?? "Other",
    type: raw.type === "income" ? "income" : "expense",
    date: raw.date ?? today,
    labels: Array.isArray(raw.labels) ? raw.labels : [],
    isFallback,
    usingProvider: provider,
    usingModel: model,
  };
}
