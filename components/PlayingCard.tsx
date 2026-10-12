"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import { isRed, Rank, Suit, SUIT_SYMBOL } from "@/lib/cards";
import { sfx } from "@/lib/sound";

// Pip positions (x%, y%) for number cards; pips below the middle are flipped.
const PIPS: Record<string, [number, number][]> = {
  "2": [[50, 20], [50, 80]],
  "3": [[50, 20], [50, 50], [50, 80]],
  "4": [[30, 20], [70, 20], [30, 80], [70, 80]],
  "5": [[30, 20], [70, 20], [50, 50], [30, 80], [70, 80]],
  "6": [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  "7": [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [30, 80], [70, 80]],
  "8": [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [50, 65], [30, 80], [70, 80]],
  "9": [[30, 20], [70, 20], [30, 40], [70, 40], [50, 50], [30, 60], [70, 60], [30, 80], [70, 80]],
  "10": [[30, 20], [70, 20], [50, 30], [30, 40], [70, 40], [30, 60], [70, 60], [50, 70], [30, 80], [70, 80]],
};

const FACE: Record<string, { crown: string; tint: string }> = {
  J: { crown: "⚔", tint: "var(--blue)" },
  Q: { crown: "♛", tint: "var(--red)" },
  K: { crown: "♚", tint: "var(--orange)" },
};

export function CardFace({ r, s }: { r: Rank; s: Suit }) {
  const sym = SUIT_SYMBOL[s];
  const color = isRed(s) ? "card-red" : "card-black";
  const face = FACE[r];
  return (
    <div className={`card-face ${color}`}>
      <div className="corner tl">
        <span>{r}</span>
        <span>{sym}</span>
      </div>
      <div className="corner br">
        <span>{r}</span>
        <span>{sym}</span>
      </div>
      {r === "A" && <div className="ace-pip">{sym}</div>}
      {PIPS[r]?.map(([x, y], i) => (
        <span key={i} className="pip" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%)${y > 50 ? " rotate(180deg)" : ""}` }}>
          {sym}
        </span>
      ))}
      {face && (
        <div className="face-art" style={{ ["--tint" as string]: face.tint }}>
          <div className="face-crown">{face.crown}</div>
          <div className="face-letter">{r}</div>
          <div className="face-suit">{sym}</div>
        </div>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-back">
      <div className="card-back-inner">
        <span>♠</span>
      </div>
    </div>
  );
}

interface Props {
  r?: Rank;
  s?: Suit;
  faceDown?: boolean;
  index?: number;
  /** Id of an element to fly in from (the shoe). */
  from?: string;
  size?: "sm" | "md" | "lg";
  sound?: boolean;
  dim?: boolean;
}

/**
 * A card that, when it mounts, flies from the shoe to its slot and flips face
 * up, then idles with a gentle Balatro-style sway. Hovering tilts it in 3D.
 */
export default function PlayingCard({ r, s, faceDown, index = 0, from = "shoe", size = "md", sound = true, dim }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const tilt = ((index * 37) % 7) - 3;

  useLayoutEffect(() => {
    const el = ref.current;
    const src = document.getElementById(from);
    if (!el) return;
    let dx = 0;
    let dy = -300;
    if (src) {
      const a = src.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      dx = a.left + a.width / 2 - (b.left + b.width / 2);
      dy = a.top + a.height / 2 - (b.top + b.height / 2);
    }
    controls.set({ x: dx, y: dy, rotate: -25, rotateY: 180, scale: 0.9 });
    controls.start({
      x: 0,
      y: 0,
      rotate: tilt,
      rotateY: faceDown ? 180 : 0,
      scale: 1,
      transition: { type: "spring", stiffness: 170, damping: 19, mass: 0.9 },
    });
    if (sound) {
      sfx.deal();
      if (!faceDown) setTimeout(sfx.flip, 220);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    e.currentTarget.style.setProperty("--rx", `${-py * 22}deg`);
    e.currentTarget.style.setProperty("--ry", `${px * 22}deg`);
    e.currentTarget.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
    e.currentTarget.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
  };
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div className={`card-slot card-${size}${dim ? " card-dim" : ""}`} ref={ref}>
      <motion.div className="card-fly" animate={controls}>
        <div className="card-sway" style={{ animationDelay: `${-index * 0.7}s` }}>
          <div className="card-tilt" onPointerMove={onMove} onPointerLeave={onLeave}>
            <div className="card-front">{r && s && <CardFace r={r} s={s} />}</div>
            <CardBack />
            <div className="card-shine" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
