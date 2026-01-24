import { Check, X } from "lucide-react";
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
    <div className="bg-surface border border-color rounded-lg p-4">
      {/* 权限请求头部 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center">
          ⚠️
        </div>
        <div>
          <h3 className="font-semibold text-text-primary text-sm">Permission Request</h3>
          {tool && <p className="text-xs text-text-secondary">Tool: {tool}</p>}
        </div>
      </div>

      {/* 权限请求内容 */}
      <p className="text-sm text-text-primary mb-4">
        {content || "Requesting permission to perform this action"}
      </p>

      {/* 命令显示 */}
      {command && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-medium text-text-secondary uppercase mb-1">Command</h4>
          <pre className="text-xs font-mono text-text-primary overflow-x-auto">{command}</pre>
        </div>
      )}

      {/* 选项选择 */}
      {options && options.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-text-secondary uppercase mb-2">Options</h4>
          <div className="space-y-2">
            {options.map((option) => (
              <button
                key={option.optionId}
                type="button"
                onClick={() => handleAccept(option.optionId)}
                className="w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">
                    {option.label || option.name || option.kind || option.optionId}
                  </span>
                  <Check size={16} className="text-green-500" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {options && options.length > 0 ? (
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleAccept(null)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              Allow
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              Deny
            </button>
          </>
        )}
      </div>
    </div>
  );
};
