export const STREAM_TOKEN_PREROLL_MS = 36;
export const STREAM_TOKEN_FADE_MS = 320;
export const STREAM_FADE_DURATION_MS = STREAM_TOKEN_PREROLL_MS + STREAM_TOKEN_FADE_MS;

export interface StreamFadeChunk {
  start: number;
  text: string;
  startedAtMs: number;
}

export interface StreamFadeState {
  committed: string;
  chunks: StreamFadeChunk[];
}

export interface StreamArrivalRegistry {
  /** Claims an unseen live item once. */
  claim(key: string, eligible: boolean): boolean;
  /** Remembers later snapshots of the same mounted item for tab remounts. */
  remember(key: string): void;
}

/** Bounded session memory for live assistant snapshots across tab remounts. */
export function createStreamArrivalRegistry(limit = 2000): StreamArrivalRegistry {
  const seen = new Set<string>();
  const remember = (key: string) => {
    if (seen.has(key)) seen.delete(key);
    seen.add(key);
    while (seen.size > limit) seen.delete(seen.values().next().value!);
  };
  return {
    claim(key, eligible) {
      if (!eligible || seen.has(key)) return false;
      remember(key);
      return true;
    },
    remember,
  };
}

/** The first live snapshot fades once; restored/remounted snapshots start settled. */
export function initialFadeState(
  text: string,
  enabled: boolean,
  animateInitial: boolean,
  now: number,
): StreamFadeState {
  return animateInitial
    ? nextFadeState({ committed: "", chunks: [] }, text, enabled, now)
    : { committed: text, chunks: [] };
}

export function nextFadeState(
  state: StreamFadeState,
  text: string,
  enabled: boolean,
  now: number,
): StreamFadeState {
  if (!enabled) {
    return state.committed === text && state.chunks.length === 0
      ? state
      : { committed: text, chunks: [] };
  }
  const visible = state.committed + state.chunks.map((chunk) => chunk.text).join("");
  if (visible === text) return state;
  if (!text.startsWith(visible)) return { committed: text, chunks: [] };
  return {
    // Keep recent arrivals in their own reveal windows. Their overlapping
    // opacity envelopes form one continuously advancing tail instead of
    // snapping the preceding word to full opacity whenever the next arrives.
    committed: state.committed,
    chunks: [...state.chunks, { start: visible.length, text: text.slice(visible.length), startedAtMs: now }],
  };
}

export function settleFadeState(state: StreamFadeState, now: number): StreamFadeState {
  let count = 0;
  for (const chunk of state.chunks) {
    if (now - chunk.startedAtMs < STREAM_FADE_DURATION_MS) break;
    count += 1;
  }
  if (count === 0) return state;
  return {
    committed: state.committed + state.chunks.slice(0, count).map((chunk) => chunk.text).join(""),
    chunks: state.chunks.slice(count),
  };
}
