import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

const source = {
  kind: "thread-storage",
  threadId: "thread-editor-test",
  environmentId: "environment-editor-test",
  projectId: null,
};
const storageRootPath = "/remote-storage/thread-editor-test";
const hostId = "remote-editor-host";

async function setup() {
  const storageLocation = vi.fn(() => ({ hostId, storageRootPath }));
  const read = vi.fn(() => ({
    content: "saved text",
    contentEncoding: "utf8",
    sizeBytes: 10,
    sha256: "original",
  }));
  const listPaths = vi.fn(() => ({
    paths: [{ path: "notes/document.txt", kind: "file" }],
    truncated: false,
  }));
  const write = vi.fn<BbPluginApi["sdk"]["files"]["write"]>().mockResolvedValue({ outcome: "written", sha256: "updated", sizeBytes: 11 });
  const { bb, harness } = createFakePluginHost({
    pluginId: "monaco-editor",
    sdk: {
      system: { config: () => ({ dataDir: "/server-data" }) },
      threads: { storageLocation },
      files: { read, listPaths, write },
    },
  });
  await plugin(bb);
  return { harness, storageLocation, read, listPaths, write };
}

describe("thread storage host routing", () => {
  it("reads from the thread's storage host and root", async () => {
    const { harness, read, storageLocation } = await setup();
    const result = await harness.callRpc("read", {
      source,
      path: "notes/document.txt",
    });
    expect(read).toHaveBeenCalledWith({
      hostId,
      rootPath: storageRootPath,
      path: `${storageRootPath}/notes/document.txt`,
    });
    expect(storageLocation).toHaveBeenCalledWith({ threadId: source.threadId });
    expect(result).toMatchObject({
      kind: "text",
      content: "saved text",
      absolutePath: `${storageRootPath}/notes/document.txt`,
    });
  });

  it("lists the thread's storage host and root", async () => {
    const { harness, listPaths } = await setup();
    const result = await harness.callRpc("tree", { source });
    expect(listPaths).toHaveBeenCalledWith({
      hostId,
      path: storageRootPath,
      includeFiles: true,
      includeDirectories: true,
      includeHidden: true,
      limit: 10_000,
    });
    expect(result).toEqual({
      root: storageRootPath,
      entries: [{ path: "notes/document.txt", kind: "file" }],
      truncated: false,
    });
  });

  it("saves to the thread's storage host with the expected version", async () => {
    const { harness, write } = await setup();
    const result = await harness.callRpc("write", {
      source,
      path: "notes/document.txt",
      content: "edited text",
      expectedSha256: "original",
    });
    expect(write).toHaveBeenCalledWith({
      hostId,
      rootPath: storageRootPath,
      path: `${storageRootPath}/notes/document.txt`,
      content: "edited text",
      contentEncoding: "utf8",
      expectedSha256: "original",
    });
    expect(result).toEqual({ outcome: "written", sha256: "updated" });
  });
});


describe("save conflicts", () => {
  it("explicit overwrite does not request create-only semantics", async () => {
    const { harness, write } = await setup();
    write.mockImplementation(async (input) => input.expectedSha256 === undefined
      ? { outcome: "written", sha256: "overwritten", sizeBytes: 11 }
      : { outcome: "conflict", currentSha256: "existing-file" });
    const result = await harness.callRpc("write", {
      source, path: "notes/document.txt", content: "my changes", expectedSha256: null,
    });
    expect(result).toEqual({ outcome: "written", sha256: "overwritten" });
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty("expectedSha256");
  });

  it("accepts an already saved identical buffer without another write", async () => {
    const { harness, write } = await setup();
    const content = "Previously saved text: café\r\n";
    const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
    write.mockResolvedValue({ outcome: "conflict", currentSha256: sha256 });
    const result = await harness.callRpc("write", {
      source, path: "notes/document.txt", content, expectedSha256: "old-version",
    });
    expect(result).toEqual({ outcome: "written", sha256 });
    expect(write).toHaveBeenCalledOnce();
  });

  it.each(["different-version", null])("keeps a real conflict (%s) and never overwrites automatically", async (currentSha256) => {
    const { harness, write } = await setup();
    write.mockResolvedValue({ outcome: "conflict", currentSha256 });
    const result = await harness.callRpc("write", {
      source, path: "notes/document.txt", content: "my changes", expectedSha256: "old-version",
    });
    expect(result).toEqual({ outcome: "conflict", currentSha256 });
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0].expectedSha256).toBe("old-version");
  });
});
