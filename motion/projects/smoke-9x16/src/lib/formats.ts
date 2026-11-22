export type FormatId = '16x9' | '1x1' | '4x5' | '9x16';
export const FORMATS: Record<FormatId, {width: number; height: number; label: string}> = {
  '16x9': {width: 1920, height: 1080, label: 'Widescreen / YouTube / X landscape'},
  '1x1': {width: 1080, height: 1080, label: 'Square feed'},
  '4x5': {width: 1080, height: 1350, label: 'Portrait feed (IG / X)'},
  '9x16': {width: 1080, height: 1920, label: 'Vertical: Reels / TikTok / Shorts'},
};
/** Safe zones as fractions of width/height (platform UI covers the rest). */
export const SAFE: Record<FormatId, {top: number; bottom: number; left: number; right: number}> = {
  '16x9': {top: 0.05, bottom: 0.05, left: 0.05, right: 0.05},   // title-safe 90%
  '1x1': {top: 0.06, bottom: 0.06, left: 0.06, right: 0.06},
  '4x5': {top: 0.06, bottom: 0.08, left: 0.06, right: 0.06},
  '9x16': {top: 0.13, bottom: 0.18, left: 0.06, right: 0.17},   // ~250px top, ~340px bottom captions/CTA, ~180px right rail
};

/** Which format a composition is, from its size (falls back to the closest aspect ratio). */
export const formatOf = (width: number, height: number): FormatId => {
  const exact = (Object.keys(FORMATS) as FormatId[]).find((f) => FORMATS[f].width === width && FORMATS[f].height === height);
  if (exact) return exact;
  const r = width / height;
  return (Object.keys(FORMATS) as FormatId[]).reduce((best, f) =>
    Math.abs(FORMATS[f].width / FORMATS[f].height - r) < Math.abs(FORMATS[best].width / FORMATS[best].height - r) ? f : best, '16x9' as FormatId);
};

/** The safe rectangle in pixels for a composition size: {left, top, right, bottom, width, height}. */
export const safeRect = (width: number, height: number, format: FormatId = formatOf(width, height)) => {
  const s = SAFE[format];
  const left = s.left * width, top = s.top * height, right = width - s.right * width, bottom = height - s.bottom * height;
  return {left, top, right, bottom, width: right - left, height: bottom - top, cx: (left + right) / 2, cy: (top + bottom) / 2};
};
