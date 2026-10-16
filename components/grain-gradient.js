// Grain Gradient — slowly flowing colour fields with film grain, lit by the pointer.
// Reference component: shows meta, props, ctx.createCanvas("webgl"), ctx.loop, ctx.pointer and cleanup.

export const meta = {
  name: "그레인 그라디언트",
  description: "천천히 흐르는 색면과 필름 그레인. 마우스 주변이 밝아져요. 첫 화면 배경으로 좋아요.",
  category: "background",
  defaultSize: { width: 1440, height: 900 },
  props: [
    { key: "colorA", label: "색 1", type: "color", default: "#ff5a36" },
    { key: "colorB", label: "색 2", type: "color", default: "#3b2bff" },
    { key: "colorC", label: "색 3", type: "color", default: "#f4f3ed" },
    { key: "background", label: "바탕색", type: "color", default: "#080808" },
    { key: "speed", label: "흐름 속도", type: "range", min: 0, max: 3, step: 0.05, default: 0.6 },
    { key: "scale", label: "무늬 크기", type: "range", min: 0.3, max: 4, step: 0.05, default: 1.4 },
    { key: "grain", label: "그레인", type: "range", min: 0, max: 0.4, step: 0.01, default: 0.12 },
    { key: "mouse", label: "마우스 반응", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
};

const VERTEX = `attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform vec2 uMouse; uniform float uMouseAmount;
uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC; uniform vec3 uBackground;
uniform float uScale; uniform float uGrain;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y) * uScale;
  float t = uTime * 0.08;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 2.5 * r);
  vec3 color = mix(uBackground, uColorA, smoothstep(0.25, 0.85, f));
  color = mix(color, uColorB, smoothstep(0.35, 0.9, length(q)) * 0.75);
  color = mix(color, uColorC, smoothstep(0.62, 1.0, r.x) * 0.55);
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float light = smoothstep(0.55, 0.0, length((uv - uMouse) * aspect));
  color += light * uMouseAmount * 0.35 * (uColorC + 0.2);
  color += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * uGrain;
  gl_FragColor = vec4(color, 1.0);
}`;

const rgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value.padEnd(6, "0").slice(0, 6);
  const parsed = Number.parseInt(full, 16);
  return Number.isFinite(parsed) ? [(parsed >> 16 & 255) / 255, (parsed >> 8 & 255) / 255, (parsed & 255) / 255] : [0, 0, 0];
};

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader failed");
  return shader;
}

export function mount(element, props, ctx) {
  const surface = ctx.createCanvas("webgl");
  const gl = surface.context;
  if (!gl) {
    element.style.background = `radial-gradient(circle at 30% 30%, ${props.colorA}, transparent 60%), radial-gradient(circle at 70% 70%, ${props.colorB}, transparent 55%), ${props.background}`;
    return;
  }
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = Object.fromEntries(["uResolution", "uTime", "uMouse", "uMouseAmount", "uColorA", "uColorB", "uColorC", "uBackground", "uScale", "uGrain"].map((name) => [name, uniform(name)]));
  gl.uniform3fv(u.uColorA, rgb(props.colorA));
  gl.uniform3fv(u.uColorB, rgb(props.colorB));
  gl.uniform3fv(u.uColorC, rgb(props.colorC));
  gl.uniform3fv(u.uBackground, rgb(props.background));
  gl.uniform1f(u.uScale, props.scale);
  gl.uniform1f(u.uGrain, props.grain);

  const mouse = { x: 0.5, y: 0.5, amount: 0 };
  let clock = 0;
  const draw = () => {
    gl.viewport(0, 0, surface.pixelWidth, surface.pixelHeight);
    gl.uniform2f(u.uResolution, surface.pixelWidth, surface.pixelHeight);
    gl.uniform1f(u.uTime, clock);
    gl.uniform2f(u.uMouse, mouse.x, mouse.y);
    gl.uniform1f(u.uMouseAmount, mouse.amount * props.mouse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  ctx.loop((time, delta) => {
    clock += delta * props.speed * 4;
    const pointer = ctx.pointer;
    const target = pointer.moved && pointer.inside ? 1 : 0;
    if (pointer.moved) {
      mouse.x += (pointer.x - mouse.x) * 0.06;
      mouse.y += ((1 - pointer.y) - mouse.y) * 0.06;
    }
    mouse.amount += (target - mouse.amount) * 0.05;
    draw();
  });
  ctx.onResize(draw);

  return () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };
}
