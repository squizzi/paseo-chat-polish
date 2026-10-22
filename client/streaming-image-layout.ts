import { CHAT_IMAGE_FRAMES } from "./chat-markdown-style";

export type StreamingImageMode = "native" | "small" | "large";

export interface StreamingImageFrameSize {
  width: number;
  height: number;
  minHeight: number;
}

export const IMAGE_ARRIVAL_PROPS = { dataSet: { cpImageArrival: "" } } as object;

export interface ImageArrivalRegistry {
  /** Claims a live image identity once; later tab remounts stay settled. */
  claim(key: string, eligible: boolean): boolean;
}

/** Bounded session memory for image arrivals that survives timeline remounts. */
export function createImageArrivalRegistry(limit = 2000): ImageArrivalRegistry {
  const seen = new Set<string>();
  return {
    claim(key, eligible) {
      if (!eligible || seen.has(key)) return false;
      seen.add(key);
      while (seen.size > limit) seen.delete(seen.values().next().value!);
      return true;
    },
  };
}

/** Fixed web thumbnail geometry, when the image preference calls for it. */
export function streamingImageFrameSize(
  platform: string,
  mode: StreamingImageMode,
): StreamingImageFrameSize | undefined {
  if (platform !== "web" || mode === "native") return undefined;
  const { width, height } = CHAT_IMAGE_FRAMES[mode];
  return { width, height, minHeight: height };
}
