// Types for the vendored thinking-orbs 0.3.2 engine (the engine itself is plain JavaScript; MIT, see LICENSE).
export interface ResolvedPreset {
  readonly mode: string;
  readonly speed: number;
  readonly opts: unknown;
}

export function resolvePreset(state: string, size: number): ResolvedPreset;

export const MODE_DRAWS: Readonly<
  Record<string, (ctx: CanvasRenderingContext2D, size: number, t: number, dark: boolean, opts: unknown) => void>
>;

/** One dot of a frame: position in the frame's own pixel space, radius, depth (z, -1..1), ink (0 is the
 *  strongest ink: white on dark, black on light) and alpha. */
export interface OrbDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly z: number;
  readonly white: number;
  readonly a?: number;
}
export interface OrbLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly w: number;
  readonly white: number;
  readonly a?: number;
}
export interface OrbFrame {
  readonly dots: readonly OrbDot[];
  readonly lines: readonly OrbLine[];
}

export const MODE_FRAMES: Readonly<Record<string, (size: number, t: number, opts: unknown) => OrbFrame>>;
