import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NotionConfig, LlmConfig } from "../types";
import { STORAGE_KEYS } from "../constants";
import { sbSignOut } from "../services/supabase";

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
  logOut: () => Promise<void>;
  setNotionConfig: (config: NotionConfig) => void;
  setLlmConfig: (config: LlmConfig) => void;
}

const DEFAULT_NOTION_CONFIG: NotionConfig = {
  notionDatabaseId: "",
  autoSync: false,
};

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "gemini",
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

      logOut: async () => {
        await sbSignOut();
        set({ currentUser: null });
      },

      setNotionConfig: (config) => set({ notionConfig: config }),

      setLlmConfig: (config) => set({ llmConfig: config }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
