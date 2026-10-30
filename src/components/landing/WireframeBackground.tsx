import { useEffect, useRef } from 'react';

/**
 * WireframeBackground
 * 
 * High-performance, zero-dependency Canvas 2D background featuring an upward-flowing
 * 3D parametric wireframe helix/cone with animated glowing data pulses, inspired by
 * modern tech platforms (Mintlify, Linear).
 * 
 * Invariants:
 * - 0 external dependencies (Canvas 2D native).
 * - Automatic DPR scaling (retina-sharp up to 2x DPR).
 * - Pauses on visibilitychange (0% CPU/battery when inactive).
 * - Smooth lerped mouse parallax depth.
 */
export function WireframeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseCurrent = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let isVisible = !document.hidden;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      mouseTarget.current.x = (e.clientX / width - 0.5) * 45;
      mouseTarget.current.y = (e.clientY / height - 0.5) * 30;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STRAND_COUNT = 48;
    const RINGS = [0.22, 0.42, 0.62, 0.8];
    let lastTime = performance.now();
    let totalElapsed = 0;

    const render = (now: number) => {
      if (!isVisible) return;
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      totalElapsed += prefersReducedMotion ? dt * 0.05 : dt;

      // Mouse damping / spring physics
      mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * 0.05;
      mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Geometry anchors: base anchored at bottom right/center framing the login card
      const isMobile = width < 768;
      const cx = isMobile ? width * 0.5 : width * 0.66 + mouseCurrent.current.x * 0.4;
      const cy = height * 1.06 + mouseCurrent.current.y * 0.3;
      const rx0 = isMobile ? width * 0.4 : Math.min(width, height) * 0.28;
      const ry0 = rx0 * 0.32;
      const rx1 = isMobile ? width * 0.8 : width * 0.58;
      const ry1 = height * 0.22;
      const flareTopY = -40 + mouseCurrent.current.y * 0.8;

      const strands: {
        p0: [number, number];
        cp1: [number, number];
        cp2: [number, number];
        p1: [number, number];
        depthAlpha: number;
      }[] = [];

      // Precompute 3D curved Bézier paths
      for (let i = 0; i < STRAND_COUNT; i++) {
        const theta = (i / STRAND_COUNT) * Math.PI * 2;
        const p0x = cx + rx0 * Math.cos(theta);
        const p0y = cy + ry0 * Math.sin(theta);

        // Twist and harmonic undulation
        const twist = 0.58 + Math.sin(totalElapsed * 0.0006 + theta) * 0.08;
        const p1x = cx + rx1 * Math.cos(theta + twist) + mouseCurrent.current.x;
        const p1y = flareTopY + ry1 * Math.sin(theta + twist);

        const cp1x = p0x + (p1x - p0x) * 0.3 + Math.sin(theta) * 70;
        const cp1y = p0y - (p0y - p1y) * 0.42;

        const cp2x = p0x + (p1x - p0x) * 0.72 - Math.sin(theta) * 50;
        const cp2y = p0y - (p0y - p1y) * 0.82;

        // Depth cue: front-facing strands (sin > 0) are more prominent
        const depthAlpha = 0.35 + 0.65 * ((Math.sin(theta) + 1) * 0.5);

        strands.push({
          p0: [p0x, p0y],
          cp1: [cp1x, cp1y],
          cp2: [cp2x, cp2y],
          p1: [p1x, p1y],
          depthAlpha
        });
      }

      // 1. Draw Static Resting Wire Tracks
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const s of strands) {
        ctx.beginPath();
        ctx.moveTo(s.p0[0], s.p0[1]);
        ctx.bezierCurveTo(s.cp1[0], s.cp1[1], s.cp2[0], s.cp2[1], s.p1[0], s.p1[1]);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.045 * s.depthAlpha})`;
        ctx.stroke();
      }

      // 2. Draw Transverse Rings (Cage Hoops)
      for (const t of RINGS) {
        ctx.beginPath();
        for (let i = 0; i <= STRAND_COUNT; i++) {
          const s = strands[i % STRAND_COUNT];
          const u = 1 - t;
          const rx = u * u * u * s.p0[0] + 3 * u * u * t * s.cp1[0] + 3 * u * t * t * s.cp2[0] + t * t * t * s.p1[0];
          const ry = u * u * u * s.p0[1] + 3 * u * u * t * s.cp1[1] + 3 * u * t * t * s.cp2[1] + t * t * t * s.p1[1];
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Draw Upward-Flowing Glowing Energy Pulses
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.6;

      const cycleSpeed = 0.00075;
      for (let i = 0; i < STRAND_COUNT; i++) {
        const s = strands[i];
        // 2 staggered pulses per strand for fluid continuity
        for (let p = 0; p < 2; p++) {
          const phaseOffset = (i / STRAND_COUNT) + (p * 0.5);
          const phase = ((totalElapsed * cycleSpeed + phaseOffset) % 1.0);

          ctx.beginPath();
          ctx.moveTo(s.p0[0], s.p0[1]);
          ctx.bezierCurveTo(s.cp1[0], s.cp1[1], s.cp2[0], s.cp2[1], s.p1[0], s.p1[1]);

          // Animate dash offset from bottom (0) to top (1)
          const dashLen = 45;
          const gapLen = 380;
          ctx.setLineDash([dashLen, gapLen]);
          ctx.lineDashOffset = -(phase * (dashLen + gapLen) * 3);

          ctx.strokeStyle = `rgba(248, 113, 113, ${0.75 * s.depthAlpha})`;
          ctx.stroke();
        }
      }

      // Reset shadow for canvas cleanliness
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.95
      }}
    />
  );
}
