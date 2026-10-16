// Liquid Image — a picture that ripples like liquid where the pointer (or a finger) passes.
// WebGL: a small ping-pong "flow map" remembers recent pointer velocity and slowly forgets it; the image is displaced by it.

export const meta = {
  name: "리퀴드 이미지",
  description: "마우스(폰에서는 손가락)가 지나간 자리가 물처럼 일렁이는 이미지. 색 갈라짐, 흑백→컬러 호버를 더할 수 있어요.",
  category: "media",
  defaultSize: { width: 960, height: 640 },
  props: [
    { key: "image", label: "이미지", type: "image", default: "" },
    { key: "fit", label: "맞추기", type: "select", options: [["cover", "꽉 채우기"], ["contain", "전체 보이기"]], default: "cover" },
    { key: "intensity", label: "일렁임 세기", type: "range", min: 0, max: 2, step: 0.05, default: 1 },
    { key: "radius", label: "번지는 범위", type: "range", min: 0.05, max: 0.6, step: 0.01, default: 0.22 },
    { key: "rgbShift", label: "색 갈라짐 (RGB)", type: "range", min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: "grayscale", label: "평소엔 흑백, 호버하면 컬러", type: "toggle", default: false },
    { key: "background", label: "여백 색 (전체 보이기·투명 부분)", type: "color", default: "#11110f" },
  ],
};

const FLOW_SIZE = 128;

const VERTEX = `attribute vec2 position; varying vec2 vUv; void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

// Flow map: rg = velocity (biased around 0.5), b = how much is moving. Stored in RGBA8, so decay also
// subtracts one step per frame to make sure it really reaches rest.
const FLOW_FRAGMENT = `precision highp float;
varying vec2 vUv;
uniform sampler2D uFlow; uniform vec2 uMouse; uniform vec2 uVelocity;
uniform float uAspect; uniform float uRadius; uniform float uAlpha; uniform float uDecay;
const float STEP = 1.0 / 255.0;
void main(){
  vec4 prev = texture2D(uFlow, vUv);
  vec2 v = (prev.rg - 0.5) * uDecay;
  v = sign(v) * max(abs(v) - STEP, 0.0);
  float m = max(prev.b * uDecay - STEP, 0.0);
  vec2 d = vUv - uMouse; d.x *= uAspect;
  float f = (1.0 - smoothstep(0.0, uRadius, length(d))) * uAlpha;
  float speed = min(1.0, length(uVelocity));
  v = mix(v, uVelocity * 0.5, f);
  m = mix(m, max(m, 1.0 - pow(1.0 - speed, 3.0)), f);
  gl_FragColor = vec4(v + 0.5, m, 1.0);
}`;

const IMAGE_FRAGMENT = `precision highp float;
varying vec2 vUv;
uniform sampler2D uImage; uniform sampler2D uFlow;
uniform vec2 uResolution; uniform vec2 uScale;
uniform float uContain; uniform float uIntensity; uniform float uShift;
uniform float uGray; uniform float uColor; uniform float uReveal; uniform float uZoom; uniform float uTime;
uniform vec3 uBackground;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
vec3 placeholder(vec2 uv, float aspect){
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 c = mix(vec3(0.925, 0.921, 0.902), vec3(0.80, 0.795, 0.772), smoothstep(-0.9, 0.9, p.x * 0.5 - p.y));
  c = mix(c, vec3(0.972, 0.968, 0.955), (1.0 - smoothstep(0.0, 0.7, length(p - vec2(-0.22 * aspect, 0.18)))) * 0.55);
  return c;
}
void main(){
  float aspect = uResolution.x / uResolution.y;
  vec4 flowTex = texture2D(uFlow, vUv);
  vec2 flow = (flowTex.rg - 0.5) * 2.0;
  flow = sign(flow) * max(abs(flow) - 0.012, 0.0);
  float mag = flowTex.b;
  vec2 q = vUv * vec2(aspect, 1.0) * 3.5;
  vec2 turb = vec2(noise(q + vec2(uTime * 0.35, 0.0)), noise(q + vec2(7.3, 19.1) - uTime * 0.35)) - 0.5;
  vec2 disp = (flow * 0.09 + turb * mag * 0.04) * uIntensity;
  disp.x /= aspect;
  vec2 uv = (vUv - 0.5) * uZoom + 0.5 - disp;
  vec2 iuv = (uv - 0.5) * uScale + 0.5;
  vec2 split = flow * uShift * 0.03 * uScale; split.x /= aspect;
  vec4 mid = texture2D(uImage, iuv);
  vec3 col = vec3(texture2D(uImage, iuv + split).r, mid.g, texture2D(uImage, iuv - split).b);
  float inside = mid.a;
  if (uContain > 0.5) {
    vec2 px = uScale / uResolution * 1.5;
    vec2 e = smoothstep(vec2(0.0), px, iuv) * smoothstep(vec2(0.0), px, 1.0 - iuv);
    inside *= e.x * e.y;
  }
  col = mix(uBackground, col, inside);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, mix(1.0, clamp(uColor + mag * 1.5, 0.0, 1.0), uGray));
  col = mix(placeholder(uv, aspect), col, uReveal);
  gl_FragColor = vec4(col, 1.0);
}`;

const rgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value.padEnd(6, "0").slice(0, 6);
  const parsed = Number.parseInt(full, 16);
  return Number.isFinite(parsed) ? [(parsed >> 16 & 255) / 255, (parsed >> 8 & 255) / 255, (parsed & 255) / 255] : [0, 0, 0];
};

const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export function mount(element, props, ctx) {
  const url = ctx.asset(props.image);
  const contain = props.fit === "contain";
  let destroyed = false;

  const label = document.createElement("div");
  label.textContent = "IMAGE";
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, {
    position: "absolute", left: "14px", bottom: "12px", zIndex: "2", pointerEvents: "none",
    font: `500 10px/1 ${MONO}`, letterSpacing: ".16em", color: "rgba(17,17,15,.48)",
    opacity: url ? "0" : "1", transition: "opacity .6s ease",
  });

  // Plain <img> fallback: no WebGL, or a host that does not allow CORS (the effect needs pixel access).
  let plain = null;
  const onPlainEnter = (event) => { if (plain && event.pointerType !== "touch") plain.style.filter = "none"; };
  const onPlainLeave = () => { if (plain) plain.style.filter = props.grayscale ? "grayscale(1)" : "none"; };
  const showPlain = (src) => {
    if (destroyed || plain) return;
    plain = new Image();
    plain.alt = "";
    plain.draggable = false;
    plain.decoding = "async";
    Object.assign(plain.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: "1", display: "block",
      objectFit: contain ? "contain" : "cover", background: props.background, opacity: "0",
      filter: props.grayscale ? "grayscale(1)" : "none", transition: "opacity .9s cubic-bezier(.16,1,.3,1), filter .7s ease",
    });
    plain.onload = () => { if (!destroyed) plain.style.opacity = "1"; };
    plain.onerror = () => {
      if (destroyed) return;
      plain.remove();
      plain = null; // back to the (still interactive) placeholder
      label.style.opacity = "1";
    };
    element.addEventListener("pointerenter", onPlainEnter);
    element.addEventListener("pointerleave", onPlainLeave);
    element.insertBefore(plain, label.parentNode === element ? label : null);
    plain.src = src;
  };

  const surface = ctx.createCanvas("webgl", { antialias: false });
  const gl = surface.context;
  element.append(label);

  if (!gl) {
    element.style.background = "linear-gradient(160deg, #ecebe6, #cfccc5)";
    if (url) showPlain(url);
    return () => {
      destroyed = true;
      element.removeEventListener("pointerenter", onPlainEnter);
      element.removeEventListener("pointerleave", onPlainLeave);
      plain?.remove();
      label.remove();
      surface.canvas.remove();
      element.style.background = "";
    };
  }

  /* ---------- GL setup ---------- */

  const shaders = [];
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader failed");
    shaders.push(shader);
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const link = (source, names) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Program failed");
    return { program, u: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) };
  };
  const flowProgram = link(FLOW_FRAGMENT, ["uFlow", "uMouse", "uVelocity", "uAspect", "uRadius", "uAlpha", "uDecay"]);
  const imageProgram = link(IMAGE_FRAGMENT, ["uImage", "uFlow", "uResolution", "uScale", "uContain", "uIntensity", "uShift", "uGray", "uColor", "uReveal", "uZoom", "uTime", "uBackground"]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const makeTexture = (wrap = gl.CLAMP_TO_EDGE) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return texture;
  };
  const imageTexture = makeTexture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  const flows = [0, 1].map(() => {
    const texture = makeTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FLOW_SIZE, FLOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0.5, 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer };
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let flowIndex = 0;

  gl.useProgram(flowProgram.program);
  gl.uniform1i(flowProgram.u.uFlow, 0);
  gl.useProgram(imageProgram.program);
  gl.uniform1i(imageProgram.u.uImage, 0);
  gl.uniform1i(imageProgram.u.uFlow, 1);
  gl.uniform1f(imageProgram.u.uContain, contain ? 1 : 0);
  gl.uniform1f(imageProgram.u.uShift, props.rgbShift);
  gl.uniform1f(imageProgram.u.uGray, props.grayscale ? 1 : 0);
  gl.uniform3fv(imageProgram.u.uBackground, rgb(props.background));

  /* ---------- Image ---------- */

  let imageAspect = 0;
  let loaded = false;
  let reveal = 0;
  let dirty = true;
  const pot = (value, limit) => Math.min(limit, 2 ** Math.ceil(Math.log2(Math.max(2, value))));

  // Redraw into a power-of-two canvas so the texture can mipmap (smooth when a big photo is shown small).
  const upload = (img) => {
    const width = img.naturalWidth || 1024;
    const height = img.naturalHeight || 1024;
    const limit = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048, pot(Math.max(512, surface.pixelWidth, surface.pixelHeight) * 1.2, 4096));
    const canvas = document.createElement("canvas");
    canvas.width = pot(width, limit);
    canvas.height = pot(height, limit);
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); }
    finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); canvas.width = canvas.height = 0; }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    imageAspect = width / height;
  };

  let img = null;
  if (url) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (destroyed) return;
      try { upload(img); }
      catch (error) { showPlain(url); return; }
      loaded = true;
      if (ctx.reducedMotion || ctx.editing) reveal = 1;
      dirty = true;
      draw();
    };
    img.onerror = () => { if (!destroyed) showPlain(url); };
    img.src = url;
  }

  /* ---------- Pointer (mouse via window, touch via the element so it keeps following during page scroll) ---------- */

  const pointer = { type: ctx.isTouch ? "touch" : "mouse", x: 0, y: 0, seen: false, out: false, touching: false };
  const onPointer = (event) => {
    if (event.pointerType === "touch") { pointer.type = "touch"; return; }
    pointer.type = event.pointerType || "mouse";
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.seen = true;
    pointer.out = false;
  };
  const onWindowLeave = () => { pointer.out = true; };
  const onTouch = (event) => {
    const touch = event.touches[0];
    pointer.type = "touch";
    pointer.touching = Boolean(touch);
    if (touch) { pointer.x = touch.clientX; pointer.y = touch.clientY; }
  };
  addEventListener("pointermove", onPointer, { passive: true });
  addEventListener("pointerdown", onPointer, { passive: true });
  document.documentElement.addEventListener("mouseleave", onWindowLeave);
  const touchEvents = ["touchstart", "touchmove", "touchend", "touchcancel"];
  touchEvents.forEach((type) => element.addEventListener(type, onTouch, { passive: true }));

  /* ---------- Frame ---------- */

  const velocity = { x: 0, y: 0 };
  const last = { x: 0.5, y: 0.5 };
  let wasActive = false;
  let hover = 0;
  let energy = 0;
  let clock = 0;
  const easeReveal = () => 1 - (1 - reveal) ** 3;

  const updateFlow = (alpha, x, y, decay) => {
    const read = flows[flowIndex];
    const write = flows[1 - flowIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
    gl.viewport(0, 0, FLOW_SIZE, FLOW_SIZE);
    gl.useProgram(flowProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform2f(flowProgram.u.uMouse, x, y);
    gl.uniform2f(flowProgram.u.uVelocity, velocity.x, velocity.y);
    gl.uniform1f(flowProgram.u.uAspect, surface.width / surface.height);
    gl.uniform1f(flowProgram.u.uRadius, props.radius);
    gl.uniform1f(flowProgram.u.uAlpha, alpha);
    gl.uniform1f(flowProgram.u.uDecay, decay);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    flowIndex = 1 - flowIndex;
  };

  const draw = () => {
    if (destroyed || gl.isContextLost()) return;
    const surfaceAspect = surface.width / surface.height;
    const aspect = imageAspect || surfaceAspect;
    const scale = contain
      ? [Math.max(surfaceAspect / aspect, 1), Math.max(aspect / surfaceAspect, 1)]
      : [Math.min(surfaceAspect / aspect, 1), Math.min(aspect / surfaceAspect, 1)];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, surface.pixelWidth, surface.pixelHeight);
    gl.useProgram(imageProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, flows[flowIndex].texture);
    const u = imageProgram.u;
    gl.uniform2f(u.uResolution, surface.pixelWidth, surface.pixelHeight);
    gl.uniform2f(u.uScale, scale[0], scale[1]);
    gl.uniform1f(u.uIntensity, props.intensity);
    gl.uniform1f(u.uColor, hover);
    gl.uniform1f(u.uReveal, loaded ? easeReveal() : 0);
    gl.uniform1f(u.uZoom, 1 - 0.035 * hover);
    gl.uniform1f(u.uTime, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  ctx.loop((time, delta) => {
    if (destroyed || plain) return;
    if (ctx.reducedMotion) { draw(); return; }
    const dt = Math.min(Math.max(delta || 1 / 60, 1 / 240), 1 / 20);
    const rect = element.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    let active = false;
    let x = 0;
    let y = 0;
    if (pointer.touching || (pointer.type !== "touch" && pointer.seen && !pointer.out)) {
      x = (pointer.x - rect.left) / width;
      y = 1 - (pointer.y - rect.top) / height;
      active = pointer.touching || (x >= 0 && x <= 1 && y >= 0 && y <= 1);
    }
    // Velocity in "box heights per second", squashed into the -1..1 range the flow map stores.
    let targetX = 0;
    let targetY = 0;
    if (active && wasActive) {
      targetX = ((x - last.x) * (width / height) / dt) * 0.22;
      targetY = ((y - last.y) / dt) * 0.22;
    }
    if (active) { last.x = x; last.y = y; }
    wasActive = active;
    const follow = 1 - Math.exp(-dt * 16);
    velocity.x += (targetX - velocity.x) * follow;
    velocity.y += (targetY - velocity.y) * follow;
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > 1) { velocity.x /= speed; velocity.y /= speed; }

    const decay = 0.955 ** (dt * 60);
    energy = energy * decay + (active ? Math.min(1, speed) : 0);
    const hoverTarget = active ? 1 : 0;
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 3.5));
    if (loaded && reveal < 1) reveal = Math.min(1, reveal + dt / 1.2);

    const busy = energy > 0.004 || Math.abs(hover - hoverTarget) > 0.002 || (loaded && reveal < 1);
    if (!busy && !dirty) return; // nothing is moving: keep the last frame, save the GPU
    dirty = false;
    clock += dt;
    updateFlow(active ? 1 : 0, x, y, decay);
    draw();
  });
  ctx.onResize(() => { dirty = true; draw(); });

  return () => {
    destroyed = true;
    if (img) { img.onload = null; img.onerror = null; }
    removeEventListener("pointermove", onPointer);
    removeEventListener("pointerdown", onPointer);
    document.documentElement.removeEventListener("mouseleave", onWindowLeave);
    touchEvents.forEach((type) => element.removeEventListener(type, onTouch));
    element.removeEventListener("pointerenter", onPlainEnter);
    element.removeEventListener("pointerleave", onPlainLeave);
    gl.deleteTexture(imageTexture);
    flows.forEach(({ texture, framebuffer }) => { gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture); });
    gl.deleteBuffer(buffer);
    gl.deleteProgram(flowProgram.program);
    gl.deleteProgram(imageProgram.program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    plain?.remove();
    label.remove();
    surface.canvas.remove();
  };
}
