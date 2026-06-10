import { describe, expect, it } from "vitest";
import { buildFallback, heuristicParse } from "./aiService";

describe("heuristicParse", () => {
  it("extracts amount from ₹ prefix", () => {
    const result = heuristicParse("Your a/c debited ₹350.00 at Swiggy on 2025-01-10");
    expect(result.amount).toBe(350);
  });

  it("extracts amount from Rs. prefix", () => {
    const result = heuristicParse("Rs. 1,200 debited from your account.");
    expect(result.amount).toBe(1200);
  });

  it("extracts amount from 'debited for' pattern", () => {
    const result = heuristicParse("Account debited for Rs.500 via UPI");
    expect(result.amount).toBe(500);
  });

  it("sets type to income when message contains 'credited'", () => {
    const result = heuristicParse("₹5000 credited to your account.");
    expect(result.type).toBe("income");
  });

  it("sets type to income when message contains 'salary'", () => {
    const result = heuristicParse("Monthly salary of ₹80000 credited.");
    expect(result.type).toBe("income");
  });

  it("sets type to expense by default", () => {
    const result = heuristicParse("You spent ₹200 at Zomato.");
    expect(result.type).toBe("expense");
  });

  it("identifies Swiggy as Food merchant", () => {
    const result = heuristicParse("₹350 debited. Swiggy order placed.");
    expect(result.merchant).toBe("Swiggy");
    expect(result.category).toBe("Food");
    expect(result.labels).toContain("food-delivery");
  });

  it("identifies Blinkit as Groceries merchant", () => {
    const result = heuristicParse("₹680 paid to Blinkit for groceries.");
    expect(result.merchant).toBe("Blinkit");
    expect(result.category).toBe("Groceries");
  });

  it("identifies Netflix as Entertainment merchant", () => {
    const result = heuristicParse("₹649 charged by Netflix for subscription.");
    expect(result.merchant).toBe("Netflix");
    expect(result.category).toBe("Entertainment");
  });

  it("identifies Amazon as Shopping merchant", () => {
    const result = heuristicParse("₹1299 debited for Amazon order.");
    expect(result.merchant).toBe("Amazon");
    expect(result.category).toBe("Shopping");
  });

  it("extracts date in YYYY-MM-DD format from message", () => {
    const result = heuristicParse("₹200 debited on 2025-06-10 at Uber.");
    expect(result.date).toBe("2025-06-10");
  });

  it("extracts date in DD-MM-YYYY format and converts it", () => {
    const result = heuristicParse("₹200 debited on 10-06-2025 at Uber.");
    expect(result.date).toBe("2025-06-10");
  });

  it("includes sms-auto and local-parse in default labels", () => {
    const result = heuristicParse("Some transaction message ₹100");
    expect(result.labels).toContain("sms-auto");
    expect(result.labels).toContain("local-parse");
  });

  it("defaults category to Other for unknown merchants", () => {
    const result = heuristicParse("₹100 paid to XYZ Store.");
    expect(result.category).toBe("Other");
  });

  it("returns 0 amount when no monetary value found", () => {
    const result = heuristicParse("No amount in this message at all.");
    expect(result.amount).toBe(0);
  });
});

describe("buildFallback", () => {
  it("returns a result with isFallback=true", () => {
    const result = buildFallback("₹100 spent at Swiggy.", "gemini", "gemini-3.5-flash", "API error");
    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe("API error");
  });

  it("uses heuristic data when text is provided", () => {
    const result = buildFallback("₹100 spent at Swiggy.", "gemini", "gemini-3.5-flash", "timeout");
    expect(result.merchant).toBe("Swiggy");
    expect(result.amount).toBe(100);
  });

  it("returns zero-amount placeholder when text is empty", () => {
    const result = buildFallback(undefined, "openai", "gpt-4o-mini", "no input");
    expect(result.amount).toBe(0);
    expect(result.merchant).toBe("Unknown Merchant");
    expect(result.labels).toContain("offline-fallback");
  });

  it("records provider and model correctly", () => {
    const result = buildFallback("₹50", "openrouter", "meta-llama/llama-3.3-70b-instruct:free", "err");
    expect(result.usingProvider).toBe("openrouter");
    expect(result.usingModel).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });
});
