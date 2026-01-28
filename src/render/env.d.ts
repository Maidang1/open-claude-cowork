/// <reference types="@rsbuild/core/types" />
/// <reference types="@tauri-apps/api" />

export {};

declare global {
  interface Window {
    electron: {
      send: (channel: string, ...arg: any[]) => void;
      invoke: (channel: string, ...arg: any[]) => Promise<any>;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
    };
  }
}
