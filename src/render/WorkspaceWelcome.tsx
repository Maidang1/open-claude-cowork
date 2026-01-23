import { FolderOpen } from "lucide-react";
import type React from "react";

interface WorkspaceWelcomeProps {
  onSelect: (path: string) => void;
}

const WorkspaceWelcome: React.FC<WorkspaceWelcomeProps> = ({ onSelect }) => {
  const handleOpenFolder = async () => {
    try {
      const path = await window.electron.invoke("dialog:openFolder");
      if (path) {
        onSelect(path);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  return (
    <div className="bg-app min-h-screen flex flex-col items-center justify-center gap-4 p-12 text-center">
      <h1 className="text-6xl tracking-tighter">Welcome to Claude Cowork</h1>
      <p className="text-text-secondary mt-2 text-base">
        Open a folder to start your workspace session
      </p>

      <button
        type="button"
        onClick={handleOpenFolder}
        className="bg-primary rounded-xl py-3.5 px-7 text-[1.1rem] inline-flex items-center gap-2.5"
      >
        <FolderOpen size={20} />
        Open Folder
      </button>
    </div>
  );
};

export default WorkspaceWelcome;
