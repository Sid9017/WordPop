import { useEffect, useRef } from "react";

const BLOB_COUNT = 9;
const REPEL_RADIUS = 250;
const REPEL_STRENGTH = 120;
const RETURN_SPEED = 0.03;

export default function AuroraBackground() {
  const containerRef = useRef(null);
  const blobState = useRef([]);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const blobs = Array.from(el.children);
    blobState.current = blobs.map(() => ({ dx: 0, dy: 0 }));

    function onMove(x, y) {
      mouse.current.x = x;
      mouse.current.y = y;
    }

    function handleMouse(e) { onMove(e.clientX, e.clientY); }
    function handleTouch(e) {
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    }
    function handleTouchEnd() {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    }

    let animId;
    function animate() {
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        const rect = blob.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const ddx = cx - mx;
        const ddy = cy - my;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);

        const state = blobState.current[i];

        if (dist < REPEL_RADIUS && dist > 0) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          const angle = Math.atan2(ddy, ddx);
          state.dx += (Math.cos(angle) * force - state.dx) * 0.08;
          state.dy += (Math.sin(angle) * force - state.dy) * 0.08;
        } else {
          state.dx *= (1 - RETURN_SPEED);
          state.dy *= (1 - RETURN_SPEED);
        }

        blob.style.transform = `translate(${state.dx}px, ${state.dy}px)`;
      }

      animId = requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", handleMouse, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="aurora-bg" ref={containerRef} aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-blob aurora-blob-4" />
      <div className="aurora-blob aurora-blob-5" />
      <div className="aurora-blob aurora-blob-6" />
      <div className="aurora-blob aurora-blob-7" />
      <div className="aurora-blob aurora-blob-8" />
      <div className="aurora-blob aurora-blob-9" />
    </div>
  );
}
