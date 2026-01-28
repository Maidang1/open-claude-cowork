import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks";

interface ThemeSettingsProps {
  theme: "light" | "dark" | "auto";
  onThemeChange: (theme: "light" | "dark" | "auto") => void;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ theme, onThemeChange }) => {
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(themeDropdownRef, () => setIsThemeDropdownOpen(false));

  return (
    <div className="modal-section">
      <label className="modal-label">Theme</label>
      <span className="modal-input-hint mb-3">Choose the app theme.</span>
      <div
        className="custom-select-container"
        style={{ maxWidth: "240px" }}
        ref={themeDropdownRef}
      >
        <button
          type="button"
          className="custom-select-trigger"
          onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
        >
          <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          <ChevronDown
            size={16}
            className={`select-arrow ${isThemeDropdownOpen ? "open" : ""}`}
          />
        </button>
        {isThemeDropdownOpen && (
          <div className="custom-select-dropdown" style={{ zIndex: 200 }}>
            {(["light", "dark", "auto"] as const).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                className={`custom-select-option ${theme === themeOption ? "selected" : ""}`}
                onClick={() => {
                  onThemeChange(themeOption);
                  setIsThemeDropdownOpen(false);
                }}
              >
                {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                {theme === themeOption && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
