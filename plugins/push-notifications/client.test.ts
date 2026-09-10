// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClientDelivery } from "./client.js";

class TestNotification {
  static permission: NotificationPermission = "granted";
  static instances: TestNotification[] = [];
  onclick: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  constructor(
    readonly title: string,
    readonly options: NotificationOptions,
  ) {
    TestNotification.instances.push(this);
  }
}
const message = {
  id: "event-1",
  title: "Finished",
  body: "Ready",
  threadId: "thread-1",
  channels: ["web"],
};

beforeEach(() => {
  TestNotification.permission = "granted";
  TestNotification.instances = [];
  localStorage.clear();
  vi.stubGlobal("Notification", TestNotification);
  vi.stubGlobal("isSecureContext", true);
  vi.spyOn(window, "focus").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("client system notifications", () => {
  it("requests macOS Dock attention without banner permission and deduplicates windows", async () => {
    const requestAttention = vi.fn();
    vi.stubGlobal("bbDesktop", { platform: "macos", requestAttention });
    TestNotification.permission = "denied";
    const first = createClientDelivery(vi.fn());
    const second = createClientDelivery(vi.fn());
    const desktopMessage = { ...message, channels: ["desktop"] };
    await first.deliver(desktopMessage, true);
    await second.deliver(desktopMessage, true);
    expect(requestAttention).toHaveBeenCalledExactlyOnceWith({
      id: message.id,
    });
    expect(TestNotification.instances).toHaveLength(0);
    first.dispose();
    await first.deliver({ ...desktopMessage, id: "after-disposal" }, true);
    await second.deliver({ ...desktopMessage, id: "disabled" }, false);
    await second.deliver(message, true);
    await second.deliver({ ...desktopMessage, threadId: 3 }, true);
    expect(requestAttention).toHaveBeenCalledTimes(1);
    second.dispose();
  });

  it("keeps banners working with older desktop shells and a failing attention bridge", async () => {
    vi.stubGlobal("bbDesktop", { platform: "macos" });
    const delivery = createClientDelivery(vi.fn());
    await delivery.deliver({ ...message, channels: ["desktop"] }, true);
    vi.stubGlobal("bbDesktop", {
      platform: "macos",
      requestAttention: () => {
        throw new Error("Bridge unavailable");
      },
    });
    await delivery.deliver(
      { ...message, id: "two", channels: ["desktop"] },
      true,
    );
    expect(TestNotification.instances).toHaveLength(2);
    delivery.dispose();
  });

  it("does not call Dock attention on Linux", async () => {
    const requestAttention = vi.fn();
    vi.stubGlobal("bbDesktop", { platform: "linux", requestAttention });
    const delivery = createClientDelivery(vi.fn());
    await delivery.deliver({ ...message, channels: ["desktop"] }, true);
    expect(requestAttention).not.toHaveBeenCalled();
    expect(TestNotification.instances).toHaveLength(1);
    delivery.dispose();
  });

  it.each([
    { platform: "macos", icon: undefined },
    { platform: "linux", icon: "http://localhost:3000/icon-192.png" },
    { platform: "web", icon: "http://localhost:3000/icon-192.png" },
  ])(
    "uses the appropriate notification icon on $platform",
    async ({ platform, icon }) => {
      if (platform !== "web") vi.stubGlobal("bbDesktop", { platform });
      const delivery = createClientDelivery(vi.fn());
      await delivery.deliver(
        { ...message, channels: [platform === "web" ? "web" : "desktop"] },
        true,
      );
      expect(TestNotification.instances).toHaveLength(1);
      expect(TestNotification.instances[0]?.options.icon).toBe(icon);
      delivery.dispose();
    },
  );

  it("deduplicates windows, navigates on click, and cleans up on disposal", async () => {
    const navigate = vi.fn();
    const first = createClientDelivery(navigate);
    const second = createClientDelivery(navigate);
    await first.deliver(message, true);
    await second.deliver(message, true);
    expect(TestNotification.instances).toHaveLength(1);
    const notification = TestNotification.instances[0]!;
    expect(notification.options.body).toBe("Ready");
    notification.onclick?.();
    expect(window.focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("thread-1");
    await first.deliver({ ...message, id: "event-2" }, true);
    first.dispose();
    expect(TestNotification.instances[1]?.close).toHaveBeenCalled();
    await first.deliver({ ...message, id: "event-3" }, true);
    expect(TestNotification.instances).toHaveLength(2);
    second.dispose();
  });

  it("respects channel, permission, disabled state, and malformed input", async () => {
    const delivery = createClientDelivery(vi.fn());
    await delivery.deliver(message, false);
    await delivery.deliver({ ...message, channels: ["desktop"] }, true);
    await delivery.deliver({ ...message, threadId: 3 }, true);
    TestNotification.permission = "denied";
    await delivery.deliver(message, true);
    expect(TestNotification.instances).toHaveLength(0);
    vi.stubGlobal("bbDesktop", {});
    TestNotification.permission = "granted";
    await delivery.deliver(message, true);
    await delivery.deliver({ ...message, channels: ["desktop"] }, true);
    expect(TestNotification.instances).toHaveLength(1);
    delivery.dispose();
  });

  it("does not deliver in the mobile WebView and survives unavailable storage", async () => {
    const delivery = createClientDelivery(vi.fn());
    vi.stubGlobal("bb", { native: {} });
    await delivery.deliver(message, true);
    expect(TestNotification.instances).toHaveLength(0);
    vi.stubGlobal("bb", undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    await delivery.deliver(message, true);
    expect(TestNotification.instances).toHaveLength(1);
    delivery.dispose();
  });
});
