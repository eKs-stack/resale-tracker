import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./i18n";

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateServiceWorker(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdates = () => {
      void registration.update();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdates();
    };

    checkForUpdates();
    window.addEventListener("focus", checkForUpdates);
    document.addEventListener("visibilitychange", onVisible);
    window.setInterval(checkForUpdates, 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
