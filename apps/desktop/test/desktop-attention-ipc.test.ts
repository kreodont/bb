import { describe, expect, it, vi } from "vitest";
import { createDesktopAttentionHandler } from "../src/desktop-attention-ipc.js";

function fixture(url = "https://bb.example/threads/one") {
  const mainFrame = { url };
  const event = {
    sender: { id: 10, mainFrame },
    senderFrame: mainFrame,
  };
  const notify = vi.fn();
  const getApplicationUrl = vi.fn((): string | null => "https://bb.example");
  const handler = createDesktopAttentionHandler({
    getApplicationUrl,
    isApplicationWindow: (id) => id === 10,
    notify,
  });
  return { event, notify, getApplicationUrl, handler };
}

describe("desktop attention IPC boundary", () => {
  it("accepts the application main frame and scopes event ids to its server", () => {
    const { event, handler, notify, getApplicationUrl } = fixture();
    handler(event, { id: "notice-1" });
    expect(notify).toHaveBeenLastCalledWith("https://bb.example:notice-1");
    getApplicationUrl.mockReturnValue("http://localhost:4000");
    event.senderFrame.url = "http://localhost:4000/threads/two";
    handler(event, { id: "notice-1" });
    expect(notify).toHaveBeenLastCalledWith("http://localhost:4000:notice-1");
  });

  it("rejects embedded views, subframes, and missing frames", () => {
    const { event, handler, notify } = fixture();
    handler({ ...event, sender: { ...event.sender, id: 11 } }, { id: "one" });
    handler({ ...event, senderFrame: { ...event.senderFrame } }, { id: "two" });
    handler({ ...event, senderFrame: null }, { id: "three" });
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([
    "https://other.example/",
    "https://bb.example:444/",
    "file:///tmp/bb.html",
    "about:blank",
    "not-a-url",
  ])("rejects an untrusted frame URL: %s", (url) => {
    const { event, handler, notify } = fixture(url);
    handler(event, { id: "one" });
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([null, "invalid", "file:///tmp/bb.html"])(
    "rejects an unavailable or invalid application URL: %s",
    (url) => {
      const { event, handler, notify, getApplicationUrl } = fixture();
      getApplicationUrl.mockReturnValue(url);
      handler(event, { id: "one" });
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    {},
    { id: " " },
    { id: 4 },
    { id: "a".repeat(257) },
    { id: "one", extra: true },
  ])("rejects malformed attention payload %j", (payload) => {
    const { event, handler, notify } = fixture();
    handler(event, payload);
    expect(notify).not.toHaveBeenCalled();
  });
});
