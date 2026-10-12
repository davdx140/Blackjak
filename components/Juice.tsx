"use client";

import { useEffect, useRef, useState } from "react";

/** A number that counts toward its value and does a little pop when it changes. */
export function CountUp({ value, prefix = "", className = "" }: { value: number; prefix?: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const [pop, setPop] = useState(0);
  const from = useRef(value);

  useEffect(() => {
    if (value === from.current) return;
    const start = performance.now();
    const a = from.current;
    const b = value;
    from.current = value;
    setPop((p) => p + 1);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span key={pop} className={`countup ${pop ? "juice" : ""} ${className}`}>
      {prefix}
      {shown.toLocaleString("en-US")}
    </span>
  );
}

/** Text whose letters bob in a wave, like Balatro's title text. */
export function WavyText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`wavy ${className}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.08}s` }} aria-hidden>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

/** A burst of chip/spark particles, used for blackjacks and big wins. */
export function Burst({ count = 26, gold = true }: { count?: number; gold?: boolean }) {
  const [parts] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 80 + Math.random() * 140;
      return {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist - 40,
        r: Math.random() * 720 - 360,
        d: Math.random() * 0.15,
        c: gold ? ["#f5b143", "#fda200", "#fff1c2", "#fe5f55"][i % 4] : ["#009dff", "#4bc292", "#fff"][i % 3],
      };
    }),
  );
  return (
    <div className="burst" aria-hidden>
      {parts.map((p, i) => (
        <i
          key={i}
          style={{
            ["--x" as string]: `${p.x}px`,
            ["--y" as string]: `${p.y}px`,
            ["--r" as string]: `${p.r}deg`,
            background: p.c,
            animationDelay: `${p.d}s`,
          }}
        />
      ))}
    </div>
  );
}
