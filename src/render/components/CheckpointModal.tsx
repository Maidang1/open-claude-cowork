import type { CheckpointEntry } from "../types";
import { AionModal } from "./AionModal";

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoints: CheckpointEntry[];
  loading: boolean;
  error?: string | null;
  taskTitle?: string | null;
  onCreate: () => void;
  onRollback: (checkpointId: string, mode: "force" | "skip") => void;
  onDelete: (checkpointId: string) => void;
}

const formatReason = (reason: CheckpointEntry["reason"]) => {
  if (reason === "pre-write") return "Pre-write";
  if (reason === "manual") return "Manual";
  return "Auto";
};

export const CheckpointModal = ({
  isOpen,
  onClose,
  checkpoints,
  loading,
  error,
  taskTitle,
  onCreate,
  onRollback,
  onDelete,
}: CheckpointModalProps) => {
  return (
    <AionModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Checkpoints${taskTitle ? ` - ${taskTitle}` : ""}`}
      width="720px"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink-600">
            Keep up to 10 checkpoints per task. Use restore to roll back files.
          </div>
          <button
            type="button"
            className="rounded-lg border border-ink-900/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-tertiary"
            onClick={onCreate}
            disabled={loading}
          >
            Create Checkpoint
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-ink-500">Loading checkpoints...</div>
        ) : checkpoints.length === 0 ? (
          <div className="rounded-xl border border-ink-900/5 bg-surface px-4 py-6 text-center text-sm text-muted">
            No checkpoints yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.checkpointId}
                className="flex flex-col gap-2 rounded-xl border border-ink-900/5 bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-ink-800">
                      {new Date(checkpoint.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-ink-500">
                      {formatReason(checkpoint.reason)} - {checkpoint.fileCount} files
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-ink-900/10 bg-surface px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-tertiary"
                      onClick={() => onRollback(checkpoint.checkpointId, "force")}
                    >
                      Restore (overwrite)
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-ink-900/10 bg-surface px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-tertiary"
                      onClick={() => onRollback(checkpoint.checkpointId, "skip")}
                    >
                      Restore (skip conflicts)
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
                      onClick={() => onDelete(checkpoint.checkpointId)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AionModal>
  );
};
