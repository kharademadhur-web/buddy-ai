/** Serialized strokes for consultation save + handwriting OCR raster. */
export type HandwritingStrokeBundle = {
  version: 1;
  lines: Array<{ points: [number, number][] }>;
};
