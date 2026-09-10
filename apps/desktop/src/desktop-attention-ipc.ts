import { bbDesktopAttentionRequestSchema } from "@bb/desktop-contract";

interface DesktopAttentionEvent {
  sender: { id: number; mainFrame: { url: string } };
  senderFrame: { url: string } | null;
}

interface DesktopAttentionHandlerOptions {
  getApplicationUrl(): string | null;
  isApplicationWindow(webContentsId: number): boolean;
  notify(id: string): void;
}

export function createDesktopAttentionHandler({
  getApplicationUrl,
  isApplicationWindow,
  notify,
}: DesktopAttentionHandlerOptions) {
  return (event: DesktopAttentionEvent, payload: unknown): void => {
    if (
      !isApplicationWindow(event.sender.id) ||
      event.senderFrame === null ||
      event.senderFrame !== event.sender.mainFrame
    )
      return;
    const parsed = bbDesktopAttentionRequestSchema.safeParse(payload);
    const applicationUrl = getApplicationUrl();
    if (!parsed.success || applicationUrl === null) return;
    let source: URL;
    let application: URL;
    try {
      source = new URL(event.senderFrame.url);
      application = new URL(applicationUrl);
    } catch {
      return;
    }
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.origin !== application.origin
    )
      return;
    notify(`${source.origin}:${parsed.data.id}`);
  };
}
