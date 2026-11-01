import { type FC, useEffect, useRef } from 'react';
import { audioEngine } from '@/engine/audioEngine';
import { usePlayerStore } from '@/app/stores';

interface VisualizerProps {
  barCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Visualizer: FC<VisualizerProps> = ({ barCount = 48, className = '', style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const analyser = audioEngine.analyserNode;
    if (analyser) {
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!analyser || !isPlaying) {
        // Draw resting subtle line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, height - 2, width, 2);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      const totalBars = Math.min(barCount, bufferLength);
      const barWidth = (width / totalBars) * 0.75;
      const gap = (width - barWidth * totalBars) / (totalBars - 1);

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'var(--accent, #1ED760)');
      gradient.addColorStop(0.7, '#3D91F4');
      gradient.addColorStop(1.0, '#FF4E50');
      ctx.fillStyle = gradient;

      for (let i = 0; i < totalBars; i++) {
        // Scale frequency index non-linearly to emphasize lower/mid frequencies
        const freqIdx = Math.floor(Math.pow(i / totalBars, 1.4) * (bufferLength * 0.7));
        const val = dataArray[freqIdx] || 0;
        const barHeight = Math.max(3, (val / 255) * height * 0.95);

        const x = i * (barWidth + gap);
        const y = height - barHeight;

        // Rounded top on bars
        const radius = Math.min(barWidth / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, height);
        ctx.closePath();
        ctx.fill();
      }
    };

    // Resize canvas to match display size (High-DPI support)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.scale(dpr, dpr);
      }
    });

    resizeObserver.observe(canvas);
    render();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [isPlaying, barCount]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        ...style,
      }}
    />
  );
};
