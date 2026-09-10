interface DesktopAttentionOptions {
  dock: {
    bounce(type: "informational"): number;
    cancelBounce(id: number): void;
  } | null;
  isFocused(): boolean;
}

export function createDesktopAttention({
  dock,
  isFocused,
}: DesktopAttentionOptions) {
  const seen = new Set<string>();
  let requestId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastBounce = Number.NEGATIVE_INFINITY;
  let disposed = false;

  function cancel(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (requestId !== null) dock?.cancelBounce(requestId);
    requestId = null;
  }

  return {
    notify(id: string): boolean {
      if (disposed || dock === null || seen.has(id)) return false;
      seen.add(id);
      if (seen.size > 512) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
      const now = Date.now();
      if (isFocused() || now - lastBounce < 1000) return false;
      cancel();
      const nextId = dock.bounce("informational");
      if (nextId < 0) return false;
      requestId = nextId;
      lastBounce = now;
      timer = setTimeout(cancel, 1000);
      timer.unref?.();
      return true;
    },
    cancel,
    dispose(): void {
      disposed = true;
      cancel();
      seen.clear();
    },
  };
}
