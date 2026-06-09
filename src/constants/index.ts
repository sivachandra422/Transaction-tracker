import { CategoryType, CategorizationRule } from "../types";

export const CATEGORIES: CategoryType[] = [
  "Food", "Groceries", "Transport", "Utilities", "Shopping",
  "Entertainment", "Housing", "Income", "Other",
];

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  Food: "#fb923c",
  Groceries: "#4ade80",
  Transport: "#38bdf8",
  Utilities: "#facc15",
  Shopping: "#ec4899",
  Entertainment: "#a855f7",
  Housing: "#f87171",
  Income: "#10b981",
  Other: "#94a3b8",
};

export const DEFAULT_HEURISTICS: { keywords: string[]; category: CategoryType }[] = [
  { keywords: ["supermarket", "blinkit", "zepto", "instamart", "bigbasket", "reliance fresh", "grocery", "groceries", "market", "more retail", "jiomart", "star bazaar", "nature's basket"], category: "Groceries" },
  { keywords: ["swiggy", "zomato", "restaurant", "cafe", "coffee", "starbucks", "mcdonald", "burger", "pizza", "subway", "dinner", "lunch", "breakfast", "eats", "diner", "blue tokai", "chaayos", "chai point", "biryani", "dhaba"], category: "Food" },
  { keywords: ["uber", "ola", "namma yatri", "rapido", "taxi", "metro", "bus", "train", "transit", "gas", "petrol", "fuel", "shell", "iocl", "hpcl", "bpcl", "auto"], category: "Transport" },
  { keywords: ["bescom", "electricity", "water bill", "utility", "internet", "wifi", "power bill", "jio", "airtel", "vi", "bsnl", "dth", "recharge", "broadband", "act fibernet", "tata play"], category: "Utilities" },
  { keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "shopping", "clothing", "shoes", "mall", "zara", "h&m", "decathlon", "tata cliq"], category: "Shopping" },
  { keywords: ["netflix", "spotify", "bookmyshow", "bms", "ticket", "cinema", "movie", "theater", "gaming", "steam", "youtube premium", "hotstar", "prime video", "sony liv"], category: "Entertainment" },
  { keywords: ["rent", "mortgage", "housing", "landlord", "apartment", "maid", "cook", "society", "maintenance"], category: "Housing" },
  { keywords: ["salary", "paycheck", "freelance", "dividend", "interest", "upi receive", "bonus", "commission", "part-time"], category: "Income" },
];

export const DEFAULT_RULES: CategorizationRule[] = [
  { id: "rule-1", keyword: "swiggy", category: "Food" },
  { id: "rule-2", keyword: "zomato", category: "Food" },
  { id: "rule-3", keyword: "blinkit", category: "Groceries" },
  { id: "rule-4", keyword: "zepto", category: "Groceries" },
  { id: "rule-5", keyword: "bigbasket", category: "Groceries" },
  { id: "rule-6", keyword: "uber", category: "Transport" },
  { id: "rule-7", keyword: "ola", category: "Transport" },
  { id: "rule-8", keyword: "rapido", category: "Transport" },
  { id: "rule-9", keyword: "jio", category: "Utilities" },
  { id: "rule-10", keyword: "airtel", category: "Utilities" },
  { id: "rule-11", keyword: "salary", category: "Income" },
];

export const STORAGE_KEYS = {
  TRANSACTIONS: "tracker-tx-v2",
  SETTINGS: "tracker-settings-v2",
} as const;
