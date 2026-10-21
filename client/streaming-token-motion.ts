export const STREAM_TOKEN_PREROLL_MS = 36;
export const STREAM_TOKEN_FADE_MS = 400;
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
    // A new append makes the previous batch part of the settled stream. Keeping
    // several fade windows alive at once blurs text above the live edge and is
    // especially distracting when Markdown reparses that text into new nodes.
    committed: visible,
    chunks: [{ start: visible.length, text: text.slice(visible.length), startedAtMs: now }],
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
