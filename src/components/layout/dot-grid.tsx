"use client";

import { useEffect, useRef } from "react";

// Adapted from the supplied React Bits DotGrid: circle dots and pointer springs only.
const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aDot;
uniform vec2 uResolution;
uniform float uSize;
out vec2 vLocal;
out float vEnergy;
out float vFade;
void main() {
  vLocal = aCorner * (uSize + 1.0);
  vEnergy = aDot.z;
  vFade = aDot.w;
  vec2 clip = (aDot.xy + vLocal) / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vEnergy;
in float vFade;
uniform float uSize;
uniform vec3 uBase;
uniform vec3 uActive;
out vec4 outColor;
void main() {
  float distance = length(vLocal) - uSize;
  float alpha = clamp(0.5 - distance / max(fwidth(distance), 0.0001), 0.0, 1.0);
  alpha *= mix(0.22, 0.7, vEnergy) * vFade;
  vec3 color = mix(uBase, uActive, vEnergy);
  outColor = vec4(color * alpha, alpha);
}
`;

const CELL = 32;
const RADIUS = 120;
const DOT_RADIUS = 1.5;
// Subtle spring: 0.5s settling time and 0.2 bounce, using DotGrid's spring formula.
const ZETA = 1 - 0.85 * 0.2;
const OMEGA = 4 / (ZETA * 0.5);
const STIFFNESS = OMEGA * OMEGA;
const DAMPING = 2 * ZETA * OMEGA;

function toRgb(color: string): [number, number, number] {
  const hex = color.trim().replace(/^#/, "");
  // Sivva's resolved color tokens are six-digit hex values.
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [0, 0, 0];
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number];
}

function smootherstep(value: number) {
  const x = Math.min(1, Math.max(0, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function DotGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const vao = gl.createVertexArray();
    const corners = gl.createBuffer();
    const dotBuffer = gl.createBuffer();
    if (!vao || !corners || !dotBuffer) {
      if (vao) gl.deleteVertexArray(vao);
      if (corners) gl.deleteBuffer(corners);
      if (dotBuffer) gl.deleteBuffer(dotBuffer);
      gl.deleteProgram(program);
      return;
    }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      size: gl.getUniformLocation(program, "uSize"),
      base: gl.getUniformLocation(program, "uBase"),
      active: gl.getUniformLocation(program, "uActive"),
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const view = { width: 0, height: 0 };
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, time: 0, inside: false, presence: 0 };
    let rest = new Float32Array(0);
    let offsets = new Float32Array(0);
    let velocities = new Float32Array(0);
    let dots = new Float32Array(0);
    let base: [number, number, number] = [0, 0, 0];
    let active: [number, number, number] = [0, 0, 0];
    let visible = false;
    let contextLost = false;
    let raf = 0;
    let last = 0;

    const canInteract = () => finePointer.matches && !reducedMotion.matches;
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const render = () => {
      if (!view.width || !view.height || contextLost) return;
      for (let i = 0; i < rest.length / 2; i++) {
        const index = i * 2;
        const x = rest[index] + offsets[index];
        const y = rest[index + 1] + offsets[index + 1];
        const proximity = smootherstep(1 - Math.hypot(x - pointer.x, y - pointer.y) / RADIUS) * pointer.presence;
        const energy = Math.min(1, Math.max(proximity, Math.hypot(velocities[index], velocities[index + 1]) / 160));
        const target = i * 4;
        dots[target] = x;
        dots[target + 1] = y;
        dots[target + 2] = energy;
        dots[target + 3] = smootherstep(Math.min(rest[index], view.width - rest[index]) / CELL) * smootherstep(Math.min(rest[index + 1], view.height - rest[index + 1]) / CELL);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, view.width, view.height);
      gl.uniform1f(uniforms.size, DOT_RADIUS);
      gl.uniform3f(uniforms.base, ...base);
      gl.uniform3f(uniforms.active, ...active);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dots);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dots.length / 4);
      gl.bindVertexArray(null);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || contextLost || !canInteract()) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      const drive = pointer.inside ? 6500 * Math.tanh(speed / 900) * 0.12 : 0;
      const dirX = speed > 0 ? pointer.vx / speed : 0;
      const dirY = speed > 0 ? pointer.vy / speed : 0;
      const steps = Math.max(1, Math.ceil(dt * 120));
      const step = dt / steps;
      let moving = false;
      for (let i = 0; i < rest.length; i += 2) {
        const distance = Math.hypot(rest[i] + offsets[i] - pointer.x, rest[i + 1] + offsets[i + 1] - pointer.y);
        const force = smootherstep(1 - distance / RADIUS) * drive;
        for (let n = 0; n < steps; n++) {
          velocities[i] += (force * dirX - STIFFNESS * offsets[i] - DAMPING * velocities[i]) * step;
          velocities[i + 1] += (force * dirY - STIFFNESS * offsets[i + 1] - DAMPING * velocities[i + 1]) * step;
          offsets[i] += velocities[i] * step;
          offsets[i + 1] += velocities[i + 1] * step;
        }
        if (Math.hypot(offsets[i], offsets[i + 1]) > 0.02 || Math.hypot(velocities[i], velocities[i + 1]) > 0.5) {
          moving = true;
        } else {
          offsets[i] = offsets[i + 1] = velocities[i] = velocities[i + 1] = 0;
        }
      }
      const decay = Math.exp(-dt / 0.08);
      pointer.vx *= decay;
      pointer.vy *= decay;
      const targetPresence = pointer.inside ? 1 : 0;
      pointer.presence += (targetPresence - pointer.presence) * (1 - Math.exp(-dt / 0.2));
      const fading = Math.abs(targetPresence - pointer.presence) > 0.002;
      if (!fading) pointer.presence = targetPresence;
      render();
      if (moving || fading || Math.hypot(pointer.vx, pointer.vy) > 1) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !visible || document.hidden || contextLost || !canInteract()) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const reset = () => {
      stop();
      offsets.fill(0);
      velocities.fill(0);
      pointer.inside = false;
      pointer.presence = pointer.vx = pointer.vy = pointer.time = 0;
      render();
    };

    const resize = () => {
      reset();
      const rect = canvas.getBoundingClientRect();
      view.width = rect.width;
      view.height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const cols = Math.floor(rect.width / CELL);
      const rows = Math.floor(rect.height / CELL);
      rest = new Float32Array(cols * rows * 2);
      offsets = new Float32Array(rest.length);
      velocities = new Float32Array(rest.length);
      dots = new Float32Array(cols * rows * 4);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = (row * cols + col) * 2;
          rest[index] = (rect.width - (cols - 1) * CELL) / 2 + col * CELL;
          rest[index + 1] = (rect.height - (rows - 1) * CELL) / 2 + row * CELL;
        }
      }
      if (!contextLost) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, dots.byteLength, gl.DYNAMIC_DRAW);
      }
      render();
    };

    const refreshColors = () => {
      const styles = getComputedStyle(container);
      base = toRgb(styles.getPropertyValue("--muted-foreground"));
      active = toRgb(styles.getPropertyValue("--primary"));
      render();
    };

    const onMove = (event: PointerEvent) => {
      if (!canInteract() || !visible || document.hidden || event.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= view.width && y <= view.height;
      if (!inside && !pointer.inside) return;
      const now = performance.now();
      if (inside && pointer.inside && pointer.time) {
        const elapsed = Math.max(4, now - pointer.time) / 1000;
        pointer.vx += ((x - pointer.x) / elapsed - pointer.vx) * 0.6;
        pointer.vy += ((y - pointer.y) / elapsed - pointer.vy) * 0.6;
      } else {
        pointer.vx = pointer.vy = 0;
      }
      Object.assign(pointer, { x, y, inside, time: now });
      wake();
    };

    const onLeave = () => {
      pointer.inside = false;
      pointer.time = 0;
      wake();
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onLeave();
    };
    const onVisibility = () => {
      if (document.hidden) reset();
      else wake();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      stop();
      delete container.dataset.webgl;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) reset();
      else wake();
    });
    intersectionObserver.observe(container);
    const themeObserver = new MutationObserver(refreshColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    reducedMotion.addEventListener("change", reset);
    finePointer.addEventListener("change", reset);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    refreshColors();
    resize();
    container.dataset.webgl = "true";

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener("change", reset);
      finePointer.removeEventListener("change", reset);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(corners);
      gl.deleteBuffer(dotBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      delete container.dataset.webgl;
    };
  }, []);

  return (
    <div ref={containerRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 text-muted-foreground">
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:32px_32px] [[data-webgl=true]_&]:hidden" />
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
    </div>
  );
}
