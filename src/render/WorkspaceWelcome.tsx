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
    <div className="welcome-container">
      <h1 className="welcome-title">Welcome to Claude Cowork</h1>
      <p className="welcome-subtitle">
        Open a folder to start your workspace session
      </p>

      <button
        type="button"
        onClick={handleOpenFolder}
        className="welcome-button"
      >
        <FolderOpen size={20} />
        Open Folder
      </button>
    </div>
  );

};

export default WorkspaceWelcome;
