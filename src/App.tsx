import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./App.css";

interface GradientStop {
  color: string;
  position: { x: number; y: number };
  size: number;
}

interface Palette {
  name: string;
  colors: string[];
  leakColor: string; // warm edge streak between light and dark
}

const PALETTES: Palette[] = [
  {
    name: "Cosmic",
    colors: ["#4f46e5", "#7c3aed", "#0ea5e9", "#06b6d4", "#8b5cf6"],
    leakColor: "rgba(251,146,60,0.55)",
  },
  {
    name: "Sunset",
    colors: ["#be185d", "#9f1239", "#7e22ce", "#dc2626", "#c2410c"],
    leakColor: "rgba(253,186,116,0.6)",
  },
  {
    name: "Aurora",
    colors: ["#065f46", "#0e7490", "#4f46e5", "#047857", "#0369a1"],
    leakColor: "rgba(167,243,208,0.45)",
  },
  {
    name: "Ocean",
    colors: ["#1e3a8a", "#0369a1", "#0891b2", "#1d4ed8", "#075985"],
    leakColor: "rgba(186,230,253,0.5)",
  },
  {
    name: "Rose",
    colors: ["#9d174d", "#7e22ce", "#be185d", "#a21caf", "#831843"],
    leakColor: "rgba(251,207,232,0.55)",
  },
  {
    name: "Ember",
    colors: ["#7c2d12", "#b45309", "#92400e", "#dc2626", "#78350f"],
    leakColor: "rgba(253,224,71,0.55)",
  },
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState({ width: 2560, height: 1440 });
  const [warpSeed, setWarpSeed] = useState(0);
  const [activePalette, setActivePalette] = useState<Palette>(PALETTES[0]);
  const [gradientStops, setGradientStops] = useState<GradientStop[]>(() =>
    makeStops(PALETTES[0].colors)
  );

  function makeStops(colors: string[]): GradientStop[] {
    const positions = [
      { x: 15, y: 25 },
      { x: 85, y: 15 },
      { x: 65, y: 85 },
      { x: 25, y: 75 },
      { x: 50, y: 50 },
    ];
    return colors.slice(0, 5).map((color, i) => ({
      color,
      position: positions[i],
      size: 55 + i * 3,
    }));
  }

  const randomizeStops = useCallback((palette: Palette) => {
    const numStops = 4 + Math.floor(Math.random() * 3);
    const newStops: GradientStop[] = [];
    for (let i = 0; i < numStops; i++) {
      const color =
        palette.colors[Math.floor(Math.random() * palette.colors.length)];
      newStops.push({
        color,
        position: { x: Math.random() * 100, y: Math.random() * 100 },
        size: 45 + Math.random() * 40,
      });
    }
    setGradientStops(newStops);
    setWarpSeed(Math.random() * 100);
  }, []);

  const selectPalette = useCallback((palette: Palette) => {
    setActivePalette(palette);
    setGradientStops(makeStops(palette.colors));
    setWarpSeed(Math.random() * 100);
  }, []);

  const processedStops = useMemo(() => {
    return gradientStops.map((stop) => {
      const hex = stop.color.replace("#", "");
      return {
        ...stop,
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    });
  }, [gradientStops]);

  const renderToCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // ── Phase 1: domain-warped Gaussian RBF gradient (pixel loop) ─────────
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      const s = warpSeed;
      const warpAmt1 = 0.22;
      const warpAmt2 = 0.14;
      const freq1 = Math.PI * 2 * 1.4;
      const freq2 = Math.PI * 2 * 2.3;

      for (let py = 0; py < h; py++) {
        const ny = py / h;
        for (let px = 0; px < w; px++) {
          const nx = px / w;

          // Two-pass domain warp — bends color regions into organic curves
          const wx1 = nx + warpAmt1 * Math.sin(ny * freq1 + s * 0.7 + 0.5);
          const wy1 = ny + warpAmt1 * Math.sin(nx * freq1 + s * 0.5 + 1.2);
          const wx2 = wx1 + warpAmt2 * Math.sin(wy1 * freq2 + s * 1.1 + 2.1);
          const wy2 = wy1 + warpAmt2 * Math.sin(wx1 * freq2 + s * 0.9 + 0.8);

          let r = 0,
            g = 0,
            b = 0,
            totalW = 1e-10;
          for (const stop of processedStops) {
            const dx = wx2 - stop.position.x / 100;
            const dy = wy2 - stop.position.y / 100;
            const spread = (stop.size / 100) * 0.42;
            const w_ = Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread));
            r += stop.r * w_;
            g += stop.g * w_;
            b += stop.b * w_;
            totalW += w_;
          }

          const brightness = Math.min(1, Math.pow(totalW * 1.8, 0.65));
          const idx = (py * w + px) * 4;
          data[idx] = (r / totalW) * brightness;
          data[idx + 1] = (g / totalW) * brightness;
          data[idx + 2] = (b / totalW) * brightness;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // ── Phase 2: radial vignette — deep dark corners ──────────────────────
      ctx.globalCompositeOperation = "multiply";
      const cx = w / 2,
        cy = h / 2;
      const innerR = Math.min(w, h) * 0.18;
      const outerR = Math.sqrt(cx * cx + cy * cy) * 1.05;
      const vignette = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      vignette.addColorStop(0, "rgba(255,255,255,1)");
      vignette.addColorStop(0.4, "rgba(210,210,210,0.97)");
      vignette.addColorStop(0.72, "rgba(80,80,80,0.88)");
      vignette.addColorStop(1, "rgba(0,0,0,0.93)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // ── Phase 4: diagonal dark sweep — cinematic composition ─────────────
      ctx.globalCompositeOperation = "multiply";
      const diag = ctx.createLinearGradient(0, 0, w, h);
      diag.addColorStop(0, "rgba(255,255,255,1)");
      diag.addColorStop(0.52, "rgba(255,255,255,1)");
      diag.addColorStop(1, "rgba(4,4,4,0.82)");
      ctx.fillStyle = diag;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "source-over";
    },
    [processedStops, warpSeed]
  );

  const drawGradient = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.min(dimensions.width, 800);
    const cssH = Math.min(dimensions.height, 450);

    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const offscreen = document.createElement("canvas");
    offscreen.width = cssW;
    offscreen.height = cssH;
    renderToCanvas(offscreen);
    ctx.drawImage(offscreen, 0, 0, cssW, cssH);
  }, [renderToCanvas, dimensions]);

  const downloadWallpaper = useCallback(() => {
    const offscreen = document.createElement("canvas");
    offscreen.width = dimensions.width;
    offscreen.height = dimensions.height;
    renderToCanvas(offscreen);

    const link = document.createElement("a");
    link.download = `gradient-wallpaper-${dimensions.width}x${dimensions.height}.png`;
    link.href = offscreen.toDataURL("image/png");
    link.click();
  }, [renderToCanvas, dimensions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(drawGradient);
    }, 100);
    return () => clearTimeout(timer);
  }, [drawGradient]);

  return (
    <div className="app">
      <div className="header">
        <h1>Gradient Wallpaper Generator</h1>
        <p>
          Create beautiful gradient wallpapers with smooth color transitions
        </p>
      </div>

      <div className="controls">
        <div className="palette-row">
          {PALETTES.map((palette) => (
            <button
              key={palette.name}
              className={`palette-btn ${
                activePalette.name === palette.name ? "active" : ""
              }`}
              onClick={() => selectPalette(palette)}
              title={palette.name}
            >
              <span className="palette-swatches">
                {palette.colors.slice(0, 3).map((c) => (
                  <span key={c} className="swatch" style={{ background: c }} />
                ))}
              </span>
              <span className="palette-label">{palette.name}</span>
            </button>
          ))}
        </div>

        <div className="controls-row">
          <div className="dimension-controls">
            <label>
              Width:
              <select
                value={dimensions.width}
                onChange={(e) =>
                  setDimensions((prev) => ({
                    ...prev,
                    width: parseInt(e.target.value),
                  }))
                }
              >
                <option value={1920}>1920 (HD)</option>
                <option value={2560}>2560 (QHD)</option>
                <option value={3840}>3840 (4K)</option>
              </select>
            </label>
            <label>
              Height:
              <select
                value={dimensions.height}
                onChange={(e) =>
                  setDimensions((prev) => ({
                    ...prev,
                    height: parseInt(e.target.value),
                  }))
                }
              >
                <option value={1080}>1080</option>
                <option value={1440}>1440</option>
                <option value={2160}>2160</option>
              </select>
            </label>
          </div>

          <div className="action-buttons">
            <button
              onClick={() => randomizeStops(activePalette)}
              className="random-btn"
            >
              🎲 Randomize
            </button>
            <button
              onClick={() => setWarpSeed(Math.random() * 100)}
              className="generate-btn"
            >
              🌀 Rewarp
            </button>
            <button onClick={downloadWallpaper} className="download-btn">
              📥 Download
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} className="gradient-canvas" />
      </div>
    </div>
  );
}

export default App;
