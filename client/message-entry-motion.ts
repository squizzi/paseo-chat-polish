export interface MessageEntryContext {
  hasPreviousChatState: boolean;
  wasRunning: boolean;
  running: boolean;
  isUserMessage: boolean;
  suppressHydrationMotion: boolean;
  /** This mutation is part of history restoration, rather than a later live row. */
  isHydrating: boolean;
  isNew: boolean;
  allow: boolean;
  atBottom: boolean;
}

export function shouldQueueMessageEntrance(context: MessageEntryContext): boolean {
  // Row insertion and the Working indicator can commit in either order. User
  // rows are also a live-turn signal; other rows retain the Working gate so
  // history population cannot masquerade as newly arriving output.
  const liveTurn = context.running || context.wasRunning || context.isUserMessage;
  return context.hasPreviousChatState
    && liveTurn
    // Keep restored history still, but do not let its short quiet window eat
    // a new prompt sent immediately after opening a stale tab.
    && (!context.suppressHydrationMotion || (context.isUserMessage && !context.isHydrating))
    && context.isNew
    && context.allow
    && context.atBottom;
}
