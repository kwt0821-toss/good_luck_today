import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <TDSMobileAITProvider brandPrimaryColor="#6EC8D4">
        <App />
      </TDSMobileAITProvider>
    </ErrorBoundary>
  </StrictMode>,
);
