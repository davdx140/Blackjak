"use client";

import { useEffect, useRef } from "react";

/**
 * Animated paint-swirl backdrop in the spirit of Balatro's menu/table shader:
 * a slowly rotating, pixelated, three-tone marbled field. `mood` lets the
 * table tint itself (gold on a win, red on a bust) with a smooth blend.
 */

export type Mood = "felt" | "menu" | "win" | "lose";

const PALETTES: Record<Mood, [number, number, number][]> = {
  felt: [
    [0.29, 0.5, 0.39],
    [0.2, 0.39, 0.31],
    [0.13, 0.25, 0.21],
  ],
  menu: [
    [0.87, 0.27, 0.25],
    [0.0, 0.46, 0.78],
    [0.09, 0.12, 0.14],
  ],
  win: [
    [0.42, 0.55, 0.3],
    [0.76, 0.58, 0.18],
    [0.15, 0.24, 0.17],
  ],
  lose: [
    [0.45, 0.27, 0.26],
    [0.28, 0.2, 0.22],
    [0.13, 0.12, 0.14],
  ],
};

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float time;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;

void main() {
  float pixel = length(res) / 3.2;
  vec2 uv = (floor(gl_FragCoord.xy / 3.2) * 3.2 - 0.5 * res) / length(res);
  float len = length(uv);
  float spin = 0.25;
  float angle = atan(uv.y, uv.x) + time * 0.035 - 20.0 * (spin * len + (1.0 - spin)) * 0.25;
  vec2 mid = (res / length(res)) / 2.0;
  uv = vec2(len * cos(angle) + mid.x, len * sin(angle) + mid.y) - mid;
  uv *= 30.0;
  float speed = time * 0.6;
  vec2 uv2 = vec2(uv.x + uv.y);
  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(cos(5.1123 + 0.353 * uv2.y + speed * 0.1311), sin(uv2.x - 0.113 * speed));
    uv -= 1.0 * cos(uv.x + uv.y) - 1.0 * sin(uv.x * 0.711 - uv.y);
  }
  float contrast = 1.6;
  float paint = min(2.0, max(0.0, length(uv) * 0.035 * contrast));
  float p1 = max(0.0, 1.0 - contrast * abs(1.0 - paint));
  float p2 = max(0.0, 1.0 - contrast * abs(paint));
  float p3 = 1.0 - min(1.0, p1 + p2);
  vec3 col = (0.3 / contrast) * c1 + (1.0 - 0.3 / contrast) * (c1 * p1 + c2 * p2 + c3 * p3);
  // soft vignette
  vec2 q = gl_FragCoord.xy / res - 0.5;
  col *= 1.0 - dot(q, q) * 0.7;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function SwirlBackground({ mood = "felt" }: { mood?: Mood }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(mood);
  target.current = mood;

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "res");
    const uTime = gl.getUniformLocation(prog, "time");
    const uC = [1, 2, 3].map((i) => gl.getUniformLocation(prog, `c${i}`));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cur = PALETTES[target.current].map((c) => [...c]);
    let raf = 0;
    const start = performance.now();
    const scale = 0.5; // render at half resolution: it's pixel-art anyway

    const resize = () => {
      el.width = Math.max(1, Math.floor(el.clientWidth * scale));
      el.height = Math.max(1, Math.floor(el.clientHeight * scale));
      gl.viewport(0, 0, el.width, el.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (t: number) => {
      const goal = PALETTES[target.current];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cur[i][j] += (goal[i][j] - cur[i][j]) * 0.03;
      gl.uniform2f(uRes, el.width, el.height);
      gl.uniform1f(uTime, reduced ? 20 : (t - start) / 1000 + 20);
      uC.forEach((u, i) => gl.uniform3f(u, cur[i][0], cur[i][1], cur[i][2]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} className="swirl" aria-hidden />;
}
