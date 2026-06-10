import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NotionConfig, LlmConfig } from "../types";
import { STORAGE_KEYS } from "../constants";
import { secureGet, secureSet, secureClear, SECURE_KEYS } from "../services/secureStorage";

interface CurrentUser {
  email: string;
  name: string;
}

interface SettingsState {
  theme: "light" | "dark";
  currentUser: CurrentUser | null;
  notionConfig: NotionConfig;
  llmConfig: LlmConfig;
  setTheme: (theme: "light" | "dark") => void;
  setCurrentUser: (user: CurrentUser) => void;
  logOut: () => void;
  setNotionConfig: (config: NotionConfig) => void;
  setLlmConfig: (config: LlmConfig) => void;
}

const DEFAULT_NOTION_CONFIG: NotionConfig = {
  notionToken: "",
  notionDatabaseId: "",
  autoSync: false,
};

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      currentUser: null,
      notionConfig: DEFAULT_NOTION_CONFIG,
      llmConfig: DEFAULT_LLM_CONFIG,

      setTheme: (theme) => set({ theme }),

      setCurrentUser: (user) => set({ currentUser: user }),

      logOut: () => {
        secureClear();
        set({ currentUser: null });
      },

      setNotionConfig: (config) => {
        // Persist sensitive token to secure storage; never to localStorage
        secureSet(SECURE_KEYS.NOTION_TOKEN, config.notionToken);
        set({ notionConfig: config });
      },

      setLlmConfig: (config) => {
        // Persist sensitive API key to secure storage; never to localStorage
        secureSet(SECURE_KEYS.LLM_API_KEY, config.apiKey);
        set({ llmConfig: config });
      },
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      storage: createJSONStorage(() => localStorage),
      // Strip sensitive fields before writing to localStorage
      partialize: (state) => ({
        theme: state.theme,
        currentUser: state.currentUser,
        notionConfig: {
          notionDatabaseId: state.notionConfig.notionDatabaseId,
          autoSync: state.notionConfig.autoSync,
          databaseTitle: state.notionConfig.databaseTitle,
          notionToken: "", // never persisted to localStorage
        },
        llmConfig: {
          provider: state.llmConfig.provider,
          model: state.llmConfig.model,
          apiKey: "", // never persisted to localStorage
        },
      }),
      // Restore sensitive fields from secure storage on rehydration
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const notionToken = secureGet(SECURE_KEYS.NOTION_TOKEN);
        const llmApiKey = secureGet(SECURE_KEYS.LLM_API_KEY);
        state.notionConfig = { ...state.notionConfig, notionToken };
        state.llmConfig = { ...state.llmConfig, apiKey: llmApiKey };
        // Migrate legacy persisted model name (gemini-3.5-flash never existed)
        if (state.llmConfig.model === "gemini-3.5-flash") {
          state.llmConfig = { ...state.llmConfig, model: "gemini-2.5-flash" };
        }
      },
    }
  )
);
