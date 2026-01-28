import type { HTMLAttributes, RefObject } from "react";
import { forwardRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { MessageRenderer, SendBox } from "../components";
import type { ImageAttachment } from "../types";
import type { TMessage } from "../types/messageTypes";
import { filesToImageAttachments } from "../utils/imageUtils";

interface ClaudeChatProps {
  taskId: string;
  virtualMessages: TMessage[];
  virtuosoRef: RefObject<any>;
  autoFollowOutput: boolean;
  onAtBottomStateChange: (atBottom: boolean) => void;
  onAtTopStateChange: (atTop: boolean) => void;
  isWaitingForResponse: boolean;
  onPermissionResponse: (permissionId: string, optionId: string | null, taskId?: string) => void;
  onStop: () => void;
  inputText: string;
  onInputTextChange: (value: string) => void;
  inputImages: ImageAttachment[];
  onInputImagesChange: (images: ImageAttachment[]) => void;
  onInputImagesAppend: (images: ImageAttachment[]) => void;
  onSend: () => void;
}

export const ClaudeChat = ({
  taskId,
  virtualMessages,
  virtuosoRef,
  autoFollowOutput,
  onAtBottomStateChange,
  onAtTopStateChange,
  isWaitingForResponse,
  onPermissionResponse,
  onStop,
  inputText,
  onInputTextChange,
  inputImages,
  onInputImagesChange,
  onInputImagesAppend,
  onSend,
}: ClaudeChatProps) => {
  return (
    <>
      <div className="relative flex-1 bg-surface-cream px-5">
        <Virtuoso
          key={taskId}
          ref={virtuosoRef}
          data={virtualMessages}
          style={{ height: "100%" }}
          followOutput={autoFollowOutput ? "smooth" : false}
          atBottomStateChange={onAtBottomStateChange}
          atTopStateChange={onAtTopStateChange}
          computeItemKey={(index, msg) => msg.id || index}
          increaseViewportBy={{ top: 400, bottom: 800 }}
          components={{
            List: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
              <div
                ref={ref}
                {...props}
                className={`flex w-full flex-col gap-1 px-4 pt-5 ${props.className || ""}`}
              />
            )),
            EmptyPlaceholder: () => (
              <div className="w-full px-4 pt-5 text-center text-muted">
                <div className="mb-2">Beginning of conversation</div>
                <div className="mx-auto h-px w-10 bg-ink-900/10" />
              </div>
            ),
          }}
          itemContent={(_, msg) => (
            <MessageRenderer
              msg={msg}
              onPermissionResponse={onPermissionResponse}
              isLoading={msg.id === "loading" && isWaitingForResponse}
              onStop={msg.id === "loading" ? onStop : undefined}
            />
          )}
        />
      </div>

      <SendBox
        value={inputText}
        onChange={onInputTextChange}
        loading={isWaitingForResponse}
        placeholder="Describe what you want Claude SDK to handle..."
        onStop={onStop}
        onFilesAdded={(files) => {
          filesToImageAttachments(files, onInputImagesAppend);
        }}
        supportedExts={["image/png", "image/jpeg", "image/webp"]}
        onSend={onSend}
        images={inputImages}
        onImagesChange={onInputImagesChange}
      />
    </>
  );
};
