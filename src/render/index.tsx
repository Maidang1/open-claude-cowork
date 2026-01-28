import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { tauriBridge } from "./utils/tauri-bridge";

const rootEl = document.getElementById("root");
if (rootEl) {
  window.electron = {
    invoke: (channel: string, ...args: any[]) => tauriBridge.invoke(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => tauriBridge.on(channel, listener),
    send: (channel: string, ...args: any[]) => tauriBridge.send(channel, ...args),
  };

  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
