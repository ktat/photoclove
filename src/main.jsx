import './wdyr';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ErrorProvider } from "./context/ErrorContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ErrorProvider>
  </React.StrictMode>
);
