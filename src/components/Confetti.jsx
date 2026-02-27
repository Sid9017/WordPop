import { useState, useEffect } from "react";

const COLORS = ["#6c5ce7", "#fd79a8", "#00b894", "#fdcb6e", "#a29bfe", "#e17055", "#74b9ff", "#55efc4"];
const COUNT = 50;

export default function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 1.5 + Math.random() * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 40,
    }))
  );

  return (
    <div className="confetti-container">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
