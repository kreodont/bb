import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopAttention } from "../src/desktop-attention.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function fixture() {
  const dock = { bounce: vi.fn(() => 7), cancelBounce: vi.fn() };
  const isFocused = vi.fn(() => false);
  const attention = createDesktopAttention({ dock, isFocused });
  return { attention, dock, isFocused };
}

describe("desktop Dock attention", () => {
  it("bounces briefly in the background and releases the native request", () => {
    const { attention, dock } = fixture();
    expect(attention.notify("finished")).toBe(true);
    expect(dock.bounce).toHaveBeenCalledWith("informational");
    vi.advanceTimersByTime(1000);
    expect(dock.cancelBounce).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
    attention.dispose();
  });

  it("deduplicates windows and consumes notifications suppressed during a burst", () => {
    const { attention, dock } = fixture();
    attention.notify("one");
    expect(attention.notify("one")).toBe(false);
    expect(attention.notify("two")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(attention.notify("two")).toBe(false);
    expect(attention.notify("three")).toBe(true);
    expect(dock.bounce).toHaveBeenCalledTimes(2);
    attention.dispose();
  });

  it("does not replay foreground events after focus moves away", () => {
    const { attention, dock, isFocused } = fixture();
    isFocused.mockReturnValue(true);
    expect(attention.notify("seen-in-bb")).toBe(false);
    isFocused.mockReturnValue(false);
    expect(attention.notify("seen-in-bb")).toBe(false);
    expect(dock.bounce).not.toHaveBeenCalled();
    attention.dispose();
  });

  it("cancels immediately on focus and rejects delivery after shutdown", () => {
    const { attention, dock } = fixture();
    attention.notify("one");
    attention.cancel();
    expect(dock.cancelBounce).toHaveBeenCalledExactlyOnceWith(7);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    attention.notify("two");
    attention.dispose();
    attention.dispose();
    expect(dock.cancelBounce).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(attention.notify("three")).toBe(false);
    expect(dock.bounce).toHaveBeenCalledTimes(2);
  });

  it("handles Electron rejecting a request during a focus race", () => {
    const { attention, dock } = fixture();
    dock.bounce.mockReturnValue(-1);
    expect(attention.notify("one")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    attention.dispose();
    expect(dock.cancelBounce).not.toHaveBeenCalled();
  });

  it("is inert on platforms without a Dock", () => {
    const attention = createDesktopAttention({
      dock: null,
      isFocused: () => false,
    });
    expect(attention.notify("one")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    attention.dispose();
  });
});
