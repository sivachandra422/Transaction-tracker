import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./providers/ErrorBoundary.tsx";
import { initSecureStorage } from "./services/secureStorage.ts";
import "./index.css";

// Warm up Capacitor Preferences on native (no-op on web)
initSecureStorage().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
