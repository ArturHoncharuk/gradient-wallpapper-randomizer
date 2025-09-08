import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./App.css";

interface GradientStop {
  color: string;
  position: { x: number; y: number };
  size: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [gradientStops, setGradientStops] = useState<GradientStop[]>([
    { color: "#4f46e5", position: { x: 15, y: 25 }, size: 50 },
    { color: "#06b6d4", position: { x: 85, y: 15 }, size: 45 },
    { color: "#10b981", position: { x: 65, y: 85 }, size: 55 },
    { color: "#f59e0b", position: { x: 25, y: 75 }, size: 40 },
    { color: "#8b5cf6", position: { x: 50, y: 50 }, size: 35 },
  ]);

  const generateRandomColor = () => {
    const colors = [
      "#4f46e5",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#8b5cf6",
      "#0891b2",
      "#84cc16",
      "#f97316",
      "#6366f1",
      "#14b8a6",
      "#f43f5e",
      "#a855f7",
      "#22d3ee",
      "#65a30d",
      "#eab308",
      "#3b82f6",
      "#9333ea",
      "#059669",
      "#dc2626",
      "#be185d",
      "#7c2d12",
      "#1e40af",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const generateRandomGradient = useCallback(() => {
    const newStops: GradientStop[] = [];
    const numStops = 4 + Math.floor(Math.random() * 2); // 4-5 stops for better coverage

    for (let i = 0; i < numStops; i++) {
      newStops.push({
        color: generateRandomColor(),
        position: {
          x: Math.random() * 100,
          y: Math.random() * 100,
        },
        size: 35 + Math.random() * 25, // 35-60% size for better blending
      });
    }

    setGradientStops(newStops);
  }, []);

  // Memoize color conversions to avoid repeated parsing
  const processedStops = useMemo(() => {
    return gradientStops.map((stop) => {
      const hex = stop.color.replace("#", "");
      return {
        ...stop,
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16),
      };
    });
  }, [gradientStops]);

  const drawGradient = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use lower DPI for preview to improve performance
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance

    // Set actual canvas size in memory
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    // Scale the canvas back down using CSS
    canvas.style.width = Math.min(dimensions.width, 800) + "px";
    canvas.style.height = Math.min(dimensions.height, 450) + "px";

    // Scale the drawing context
    ctx.scale(dpr, dpr);

    // Work with logical dimensions
    const logicalWidth = dimensions.width;
    const logicalHeight = dimensions.height;

    // Clear and set base color
    ctx.fillStyle = "#050911";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Simplified two-layer approach for better performance
    ctx.globalCompositeOperation = "screen";

    // Main gradient layer - simplified
    processedStops.forEach((stop) => {
      const x = (stop.position.x / 100) * logicalWidth;
      const y = (stop.position.y / 100) * logicalHeight;
      const radius = (stop.size / 50) * Math.min(logicalWidth, logicalHeight);

      const radialGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      radialGradient.addColorStop(
        0,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.6)`
      );
      radialGradient.addColorStop(
        0.4,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.3)`
      );
      radialGradient.addColorStop(
        0.8,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.1)`
      );
      radialGradient.addColorStop(
        1,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0)`
      );

      ctx.fillStyle = radialGradient;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    });

    // Secondary layer for depth - much simpler
    ctx.globalCompositeOperation = "overlay";
    processedStops.forEach((stop) => {
      const x = (stop.position.x / 100) * logicalWidth;
      const y = (stop.position.y / 100) * logicalHeight;
      const radius = (stop.size / 70) * Math.min(logicalWidth, logicalHeight);

      const radialGradient = ctx.createRadialGradient(
        x,
        y,
        radius * 0.1,
        x,
        y,
        radius
      );
      radialGradient.addColorStop(
        0,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.2)`
      );
      radialGradient.addColorStop(
        0.6,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.05)`
      );
      radialGradient.addColorStop(
        1,
        `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0)`
      );

      ctx.fillStyle = radialGradient;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    });

    ctx.globalCompositeOperation = "source-over";
  }, [processedStops, dimensions]);

  const downloadWallpaper = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `gradient-wallpaper-${dimensions.width}x${dimensions.height}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Draw gradient when component mounts or when stops change (with debouncing)
  useEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(drawGradient);
    }, 150); // Slightly longer debounce for better performance
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
          <button onClick={generateRandomGradient} className="random-btn">
            🎲 Random Colors
          </button>
          <button onClick={drawGradient} className="generate-btn">
            🔄 Regenerate
          </button>
          <button onClick={downloadWallpaper} className="download-btn">
            📥 Download
          </button>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} className="gradient-canvas" />
      </div>
    </div>
  );
}

export default App;
