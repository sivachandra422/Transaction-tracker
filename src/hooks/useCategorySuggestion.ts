import { useEffect, useState } from "react";
import type { CategoryType, CategorizationRule } from "../types";
import { DEFAULT_HEURISTICS } from "../constants";

export interface CategorySuggestion {
  category: CategoryType | null;
  trigger: string;
}

/**
 * Suggests a category from user rules first, then built-in heuristics,
 * based on the live description + merchant text.
 */
export function useCategorySuggestion(
  description: string,
  merchant: string,
  rules: CategorizationRule[],
  enabled: boolean
): CategorySuggestion & { clear: () => void } {
  const [suggestion, setSuggestion] = useState<CategorySuggestion>({
    category: null,
    trigger: "",
  });

  useEffect(() => {
    if (!enabled) return;

    const searchStr = `${description} ${merchant}`.toLowerCase().trim();
    if (!searchStr) {
      setSuggestion({ category: null, trigger: "" });
      return;
    }

    const matchedRule = rules.find(
      (rule) => rule.keyword && searchStr.includes(rule.keyword.toLowerCase())
    );
    if (matchedRule) {
      setSuggestion({
        category: matchedRule.category,
        trigger: `Rule keyword: "${matchedRule.keyword}"`,
      });
      return;
    }

    for (const group of DEFAULT_HEURISTICS) {
      for (const kw of group.keywords) {
        if (searchStr.includes(kw)) {
          setSuggestion({ category: group.category, trigger: `Keyword: "${kw}"` });
          return;
        }
      }
    }

    setSuggestion({ category: null, trigger: "" });
  }, [description, merchant, rules, enabled]);

  return { ...suggestion, clear: () => setSuggestion({ category: null, trigger: "" }) };
}
