import { X } from "lucide-react";

interface AionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  height?: string;
  isLoading?: boolean;
  closeOnBackdrop?: boolean;
}

export const AionModal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = "600px",
  height,
  isLoading = false,
  closeOnBackdrop = true,
}: AionModalProps) => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-surface border border-color rounded-xl shadow-2xl overflow-hidden"
        style={{ width, height }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-color">
          {title && <h2 className="text-lg font-semibold text-text-primary">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-color">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
