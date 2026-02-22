import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";

/*
  Why service worker registration is here:
  - `main.jsx` is the Vite app entry point.
  - Registering the SW once at bootstrap enables PWA install support.
  - Registration is limited to production so local development remains predictable.
*/
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // Use Vite base URL so SW registration works in root or sub-path deployments.
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Keep app behavior unchanged if SW registration fails.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: "14px"
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
