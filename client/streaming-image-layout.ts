export type StreamingImageMode = "native" | "small" | "large";

export interface StreamingImageFrameSize {
  width: number;
  height: number;
  minHeight: number;
}

/** Fixed web thumbnail geometry, when the image preference calls for it. */
export function streamingImageFrameSize(
  platform: string,
  mode: StreamingImageMode,
): StreamingImageFrameSize | undefined {
  if (platform !== "web" || mode === "native") return undefined;
  const { width, height } = mode === "large"
    ? { width: 320, height: 200 }
    : { width: 200, height: 128 };
  return { width, height, minHeight: height };
}
