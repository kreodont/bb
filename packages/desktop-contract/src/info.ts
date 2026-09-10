import { z } from "zod";
import type { BbDesktopBrowserApi } from "./browser.js";
import type { AppCommandId } from "@bb/domain";

const isoUtcDateTimeSchema = z.iso.datetime();

const bbDesktopDownloadStateSchema = z.enum([
  "idle",
  "downloading",
  "downloaded",
  "failed",
]);

export const bbDesktopInfoSchema = z.object({
  downloadState: bbDesktopDownloadStateSchema.optional(),
  lastCheckedAt: isoUtcDateTimeSchema.nullable(),
  latestVersion: z.string().min(1).nullable(),
  pendingVersion: z.string().min(1).nullable(),
  platform: z.enum(["macos", "linux"]),
  serverDaemonLogsAvailable: z.boolean().optional(),
  updateAvailable: z.boolean(),
  updateDownloaded: z.boolean(),
  version: z.string().min(1),
});
export type BbDesktopInfo = z.infer<typeof bbDesktopInfoSchema>;

export const bbDesktopWindowStateSchema = z
  .object({
    isFullScreen: z.boolean(),
  })
  .strict();
export type BbDesktopWindowState = z.infer<typeof bbDesktopWindowStateSchema>;

export const bbDesktopThemeSchema = z.enum(["system", "light", "dark"]);
export type BbDesktopTheme = z.infer<typeof bbDesktopThemeSchema>;

export const bbDesktopAttentionRequestSchema = z
  .object({ id: z.string().trim().min(1).max(256) })
  .strict();
export type BbDesktopAttentionRequest = z.infer<
  typeof bbDesktopAttentionRequestSchema
>;

export type BbDesktopInfoChangeHandler = (info: BbDesktopInfo) => void;
export type BbDesktopInfoUnsubscribe = () => void;
export type BbDesktopWindowStateChangeHandler = (
  state: BbDesktopWindowState,
) => void;
export type BbDesktopOpenNewTabHandler = () => void;
export type BbDesktopAppCommandHandler = (command: AppCommandId) => void;
export type BbDesktopCloseWindowRequestHandler = () => boolean;

export interface BbDesktopApi extends BbDesktopInfo {
  browser: BbDesktopBrowserApi;
  checkForUpdates(): Promise<BbDesktopInfo>;
  getInfo(): Promise<BbDesktopInfo>;
  getWindowState?(): Promise<BbDesktopWindowState>;
  installUpdate(): Promise<void>;
  onChange(listener: BbDesktopInfoChangeHandler): BbDesktopInfoUnsubscribe;
  onWindowStateChange?(
    listener: BbDesktopWindowStateChangeHandler,
  ): BbDesktopInfoUnsubscribe;
  onOpenNewTab?(listener: BbDesktopOpenNewTabHandler): BbDesktopInfoUnsubscribe;
  onAppCommand?(listener: BbDesktopAppCommandHandler): BbDesktopInfoUnsubscribe;
  onCloseWindowRequest?(
    listener: BbDesktopCloseWindowRequestHandler,
  ): BbDesktopInfoUnsubscribe;
  openExternalUrl(url: string): void;
  openServerDaemonLogs?(): Promise<void>;
  requestAttention?(request: BbDesktopAttentionRequest): void;
  setTheme(theme: BbDesktopTheme): void;
}
