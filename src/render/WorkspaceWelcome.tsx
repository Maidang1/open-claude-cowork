import { FolderOpen } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface WorkspaceWelcomeProps {
  onSelect: (path: string) => void;
}

const WorkspaceWelcome: React.FC<WorkspaceWelcomeProps> = ({ onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#ffffff",
        color: "#374151",
      }}
    >
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
          Welcome to Claude Cowork
        </h1>
        <p style={{ color: "#6b7280", fontSize: "1.1rem" }}>
          Open a folder to start your workspace session
        </p>
      </div>

      <button
        type="button"
        onClick={handleOpenFolder}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: isHovered ? "#ea580c" : "#f97316",
          color: "white",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <FolderOpen size={20} />
        Open Folder
      </button>
    </div>
  );
};

export default WorkspaceWelcome;
