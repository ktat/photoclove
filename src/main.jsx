import './wdyr';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import AppProviders from "./providers/AppProviders.jsx";
import './i18n'; // Initialize i18n

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
