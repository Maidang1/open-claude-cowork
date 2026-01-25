import { Check } from "lucide-react";
import type { TAcpPermissionMessage } from "../types/messageTypes";

interface MessageAcpPermissionProps {
  msg: TAcpPermissionMessage;
  onPermissionResponse: (permissionId: string, optionId: string | null) => void;
}

export const MessageAcpPermission = ({ msg, onPermissionResponse }: MessageAcpPermissionProps) => {
  const { id: permissionId, tool, content, options, command } = msg.content;

  const handleAccept = (optionId: string | null) => {
    if (permissionId) {
      onPermissionResponse(permissionId, optionId);
    }
  };

  const handleCancel = () => {
    if (permissionId) {
      onPermissionResponse(permissionId, null);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-secondary px-4 py-3 text-ink-700 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-accent" />
        <h3 className="text-sm font-semibold text-ink-800">Permission Request</h3>
        {tool && <span className="text-xs text-ink-500">({tool})</span>}
      </div>

      <p className="mt-2 text-sm text-ink-700">
        {content || "Requesting permission to perform this action"}
      </p>

      {command && (
        <div className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-ink-700 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Command
          </div>
          <pre className="mt-1 whitespace-pre-wrap font-mono">{command}</pre>
        </div>
      )}

      {options && options.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Options
          </div>
          <div className="mt-2 space-y-2">
            {options.map((option) => (
              <button
                key={option.optionId}
                type="button"
                onClick={() => handleAccept(option.optionId)}
                className="flex w-full items-center justify-between rounded-xl bg-surface px-3 py-2 text-left text-sm text-ink-800 shadow-soft transition-colors hover:bg-surface-tertiary"
              >
                <span>{option.label || option.name || option.kind || option.optionId}</span>
                <Check size={16} className="text-success" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {options && options.length > 0 ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-surface-tertiary"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleAccept(null)}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover"
            >
              Allow
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-surface-tertiary"
            >
              Deny
            </button>
          </>
        )}
      </div>
    </div>
  );
};
