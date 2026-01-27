import { describe, expect, it } from "vitest";
import type { TMessage } from "../types/messageTypes";
import { composeMessage } from "./messageComposer";

describe("composeMessage", () => {
  it("appends new message by default", () => {
    const list: TMessage[] = [];
    const msg: TMessage = {
      id: "1",
      msg_id: "m1",
      conversation_id: "c1",
      type: "text",
      content: { text: "hi", sender: "user" },
      position: "right",
    };

    const next = composeMessage(list, msg);
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual(msg);
  });

  it("merges streaming text by msg_id", () => {
    const base: TMessage = {
      id: "1",
      msg_id: "m1",
      conversation_id: "c1",
      type: "text",
      content: { text: "Hel", sender: "agent" },
      position: "left",
    };
    const chunk: TMessage = {
      ...base,
      id: "2",
      content: { text: "lo", sender: "agent" },
    };

    const next = composeMessage([base], chunk);
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe("text");
    if (next[0].type === "text") {
      expect(next[0].content.text).toBe("Hello");
    }
  });
});
