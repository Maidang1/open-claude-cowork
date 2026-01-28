import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

export interface MessageListProps<T> {
  data: T[];
  followOutput: "smooth" | false;
  atBottomStateChange: (atBottom: boolean) => void;
  atTopStateChange: (atTop: boolean) => void;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  itemContent: (index: number, item: T) => React.ReactNode;
  computeItemKey?: (index: number, item: T) => string | number;
  increaseViewportBy?: { top?: number; bottom?: number };
  emptyPlaceholder?: React.ReactNode;
  listClassName?: string;
}

const defaultEmptyPlaceholder = (
  <div className="w-full px-4 pt-5 text-center text-muted">
    <div className="mb-2">Beginning of conversation</div>
    <div className="mx-auto h-px w-10 bg-ink-900/10" />
  </div>
);

export function MessageList<T>({
  data,
  followOutput,
  atBottomStateChange,
  atTopStateChange,
  virtuosoRef,
  itemContent,
  computeItemKey = (_, item: T & { id?: string }) => (item as any)?.id ?? 0,
  increaseViewportBy = { top: 400, bottom: 800 },
  emptyPlaceholder = defaultEmptyPlaceholder,
  listClassName = "",
}: MessageListProps<T>) {
  return (
    <div className="h-full">
      <Virtuoso
        ref={virtuosoRef}
        data={data}
        style={{ height: "100%" }}
        followOutput={followOutput}
        atBottomStateChange={atBottomStateChange}
        atTopStateChange={atTopStateChange}
        computeItemKey={computeItemKey}
        increaseViewportBy={increaseViewportBy}
        components={{
          List: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, listRef) => (
            <div
              ref={listRef}
              {...props}
              className={`flex w-full flex-col gap-1 px-4 pt-5 ${props.className ?? ""} ${listClassName}`.trim()}
            />
          )),
          EmptyPlaceholder: () => <>{emptyPlaceholder}</>,
        }}
        itemContent={itemContent}
      />
    </div>
  );
}
