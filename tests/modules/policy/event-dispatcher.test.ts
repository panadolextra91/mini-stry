import { describe, it, expect, vi } from "vitest";
import { EventDispatcher } from "@/shared/event-dispatcher.js";

type TestEventMap = {
  Ping: { value: number };
  Pong: { message: string };
};

describe("EventDispatcher", () => {
  it("calls handler on emit", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const handler = vi.fn();
    dispatcher.on("Ping", handler);

    await dispatcher.emit("Ping", { value: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it("calls multiple handlers for same event type", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    dispatcher.on("Ping", handler1);
    dispatcher.on("Ping", handler2);

    await dispatcher.emit("Ping", { value: 1 });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("calls handlers in registration order", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const order: number[] = [];
    dispatcher.on("Ping", () => { order.push(1); });
    dispatcher.on("Ping", () => { order.push(2); });
    dispatcher.on("Ping", () => { order.push(3); });

    await dispatcher.emit("Ping", { value: 0 });

    expect(order).toEqual([1, 2, 3]);
  });

  it("awaits async handlers sequentially", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const order: number[] = [];

    dispatcher.on("Ping", async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
    });
    dispatcher.on("Ping", async () => {
      order.push(2);
    });

    await dispatcher.emit("Ping", { value: 0 });

    // Handler 1 (async, 10ms delay) must complete before handler 2
    expect(order).toEqual([1, 2]);
  });

  it("does not error when emitting with no handlers", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();

    // Should not throw
    await dispatcher.emit("Ping", { value: 99 });
  });

  it("does not trigger unrelated event handlers", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const pingHandler = vi.fn();
    const pongHandler = vi.fn();
    dispatcher.on("Ping", pingHandler);
    dispatcher.on("Pong", pongHandler);

    await dispatcher.emit("Ping", { value: 1 });

    expect(pingHandler).toHaveBeenCalledOnce();
    expect(pongHandler).not.toHaveBeenCalled();
  });

  it("isolates throwing handler so sibling handlers still execute", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const siblingHandler = vi.fn();

    dispatcher.on("Ping", () => {
      throw new Error("Broken handler");
    });
    dispatcher.on("Ping", siblingHandler);

    // Should not throw/reject
    await expect(dispatcher.emit("Ping", { value: 1 })).resolves.not.toThrow();
    expect(siblingHandler).toHaveBeenCalledOnce();
  });

  it("triggers onError hook when a handler throws", async () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const errorHook = vi.fn();
    dispatcher.onError = errorHook;

    const testError = new Error("Broken handler");
    dispatcher.on("Ping", () => {
      throw testError;
    });

    await dispatcher.emit("Ping", { value: 1 });

    expect(errorHook).toHaveBeenCalledOnce();
    expect(errorHook).toHaveBeenCalledWith("Ping", testError);
  });
});
