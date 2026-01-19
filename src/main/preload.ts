import { contextBridge, ipcRenderer } from "electron";

const versions = process.versions;

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, subscription);
    // Return a cleanup function
    return () => {
        ipcRenderer.removeListener(channel, subscription);
    };
  },
  version: {
    electron: versions.electron,
    chrome: versions.chrome,
    node: versions.node
  }
});
