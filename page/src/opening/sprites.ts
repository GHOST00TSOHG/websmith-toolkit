// Pre-rendered sprites for the opening: a builder cursor (an arrow holding a pen or a brush) and a soft
// spark. Drawn once per theme into small canvases, then stamped with drawImage every frame.

/** Sprite box (css px) and where the arrow tip sits inside it. */
export const SPRITE = 84;
export const TIP_X = 14;
export const TIP_Y = 12;

function drawCursor(g: CanvasRenderingContext2D, tool: 0 | 1, dark: boolean): void {
  const glow = dark ? "rgba(77,227,255,0.95)" : "rgba(23,71,201,0.6)";
  const edge = dark ? "#1d3fb8" : "#123aa8";
  const ink = dark ? "#4de3ff" : "#2f6bff";
  const deep = dark ? "#2f5be0" : "#1747c9";
  // The tool, from the tip out to the upper right.
  g.save();
  g.translate(TIP_X + 2, TIP_Y + 2);
  g.rotate(-Math.PI / 5.2);
  g.shadowColor = glow;
  g.shadowBlur = 12;
  g.lineJoin = "round";
  g.lineWidth = 1.6;
  g.strokeStyle = edge;
  const body = g.createLinearGradient(0, -6, 0, 6);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(1, dark ? "#9fefff" : "#c9dcff");
  if (tool === 0) {
    // Pen: nib, grip, barrel.
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(11, -4.6);
    g.lineTo(11, 4.6);
    g.closePath();
    g.fillStyle = ink;
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(11, -5.2, 8, 10.4, 2);
    g.fillStyle = deep;
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(19, -5.2, 30, 10.4, [1, 5, 5, 1]);
    g.fillStyle = body;
    g.fill();
    g.stroke();
  } else {
    // Brush: tuft, ferrule, handle.
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(6, -6.2, 13, -4.4);
    g.lineTo(13, 4.4);
    g.quadraticCurveTo(6, 6.2, 0, 0);
    g.fillStyle = ink;
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(13, -4.6, 8, 9.2, 1.5);
    g.fillStyle = dark ? "#dff8ff" : "#e8efff";
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(21, -3, 30, 6, [1, 3, 3, 1]);
    g.fillStyle = deep;
    g.fill();
    g.stroke();
  }
  g.restore();
  // The arrow, over the tool.
  g.save();
  g.translate(TIP_X, TIP_Y);
  g.scale(1.25, 1.25);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 21);
  g.lineTo(5.2, 16.2);
  g.lineTo(8.8, 24.4);
  g.lineTo(12.2, 22.9);
  g.lineTo(8.7, 15);
  g.lineTo(15.4, 15);
  g.closePath();
  const grad = g.createLinearGradient(0, 0, 12, 24);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, dark ? "#b8f3ff" : "#dbe8ff");
  g.shadowColor = glow;
  g.shadowBlur = 10;
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  g.lineJoin = "round";
  g.lineWidth = 1.3;
  g.strokeStyle = edge;
  g.stroke();
  g.restore();
}

export interface Sprites {
  readonly cursors: readonly [HTMLCanvasElement, HTMLCanvasElement];
  readonly spark: HTMLCanvasElement;
}

export function makeSprites(dpr: number, dark: boolean): Sprites {
  const make = (size: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext("2d");
    if (g !== null) {
      g.scale(dpr, dpr);
      paint(g);
    }
    return c;
  };
  const pen = make(SPRITE, (g) => drawCursor(g, 0, dark));
  const brush = make(SPRITE, (g) => drawCursor(g, 1, dark));
  const spark = make(16, (g) => {
    const r = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    r.addColorStop(0, dark ? "rgba(255,255,255,1)" : "rgba(40,110,255,1)");
    r.addColorStop(0.35, dark ? "rgba(120,235,255,0.9)" : "rgba(23,71,201,0.7)");
    r.addColorStop(1, "rgba(77,227,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 16, 16);
  });
  return { cursors: [pen, brush], spark };
}
