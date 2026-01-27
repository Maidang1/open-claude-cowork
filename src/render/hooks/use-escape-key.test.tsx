import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEscapeKey } from "./useEscapeKey";

describe("useEscapeKey", () => {
  it("calls handler on Escape when enabled", () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler when disabled", () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, false));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(0);
  });
});
