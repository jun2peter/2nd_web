// Orb 3D — a breathing, noise-displaced sphere with a fresnel rim and a two-colour gradient (three.js).
// Rotates slowly, leans toward the pointer and swells a little with scroll speed. Transparent background.

export const meta = {
  name: "3D 오브",
  description: "숨 쉬듯 천천히 일렁이는 3D 구. 마우스 쪽으로 살짝 기울고 스크롤하면 조금 부풀어요. 배경이 투명해서 어느 페이지 위에도 올릴 수 있어요.",
  category: "3d",
  defaultSize: { width: 720, height: 720 },
  props: [
    { key: "colorA", label: "색 1", type: "color", default: "#3b2bff" },
    { key: "colorB", label: "색 2", type: "color", default: "#ff5a36" },
    { key: "rimColor", label: "가장자리 빛", type: "color", default: "#f4f3ed" },
    { key: "detail", label: "표면 세밀함 (낮으면 각진 결정)", type: "range", min: 1, max: 64, step: 1, default: 40 },
    { key: "distortion", label: "일렁임 세기", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "noiseScale", label: "무늬 촘촘함", type: "range", min: 0.3, max: 4, step: 0.05, default: 0.95 },
    { key: "speed", label: "속도", type: "range", min: 0, max: 3, step: 0.05, default: 0.8 },
    { key: "wireframe", label: "와이어프레임", type: "toggle", default: false },
    { key: "size", label: "크기 (상자 대비 %)", type: "range", min: 20, max: 100, step: 1, default: 72 },
  ],
};

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
const NOISE = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

const VERTEX = `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
varying vec3 vNormal;
varying vec3 vBase;
varying vec3 vViewPos;
varying float vNoise;
${NOISE}
// Domain-warped noise: slow liquid folds rather than bumps.
float field(vec3 p){
  vec3 q = p * uFreq;
  float warp = snoise(q * 0.65 + vec3(uTime * 0.21, -uTime * 0.17, 1.3));
  return snoise(q + vec3(0.0, uTime * 0.33, uTime * 0.14) + warp * 0.5);
}
void main(){
  vec3 dir = normalize(position);
  float n = field(dir);
  vec3 p = dir * (1.0 + n * uAmp);
  // Normal of the displaced surface from two nearby displaced samples.
  vec3 helper = abs(dir.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(helper, dir));
  vec3 b = cross(dir, t);
  vec3 d1 = normalize(dir + t * 0.012);
  vec3 d2 = normalize(dir + b * 0.012);
  vec3 p1 = d1 * (1.0 + field(d1) * uAmp);
  vec3 p2 = d2 * (1.0 + field(d2) * uAmp);
  vec3 nrm = normalize(cross(p1 - p, p2 - p));
  if (dot(nrm, dir) < 0.0) nrm = -nrm;
  vNoise = n;
  vNormal = normalize(normalMatrix * nrm);
  vBase = normalize(normalMatrix * dir);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRim;
uniform float uFlat;
uniform float uWire;
varying vec3 vNormal;
varying vec3 vBase;
varying vec3 vViewPos;
varying float vNoise;
void main(){
  vec3 n = normalize(vNormal);
  if (uFlat > 0.5) n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  vec3 v = normalize(-vViewPos);
  float facing = dot(n, v);
  // Rim from the undisplaced sphere keeps the glow on the silhouette instead of in every fold.
  float rim = pow(1.0 - clamp(dot(normalize(mix(normalize(vBase), n, 0.4)), v), 0.0, 1.0), 3.2);
  float folds = pow(1.0 - clamp(abs(facing), 0.0, 1.0), 3.0);
  float mixer = smoothstep(0.1, 0.9, 0.5 + 0.42 * (n.y * 0.8 - n.x * 0.35) + vNoise * 0.22);
  vec3 base = mix(uColorA, uColorB, mixer);
  vec3 L = normalize(vec3(-0.45, 0.7, 0.6));
  float wrap = clamp((dot(n, L) + 0.45) / 1.45, 0.0, 1.0);
  vec3 color = base * (0.25 + 0.9 * wrap);
  vec3 H = normalize(L + v);
  color += pow(clamp(dot(n, H), 0.0, 1.0), 80.0) * 0.28 * (0.6 + 0.4 * uRim);
  color += uRim * (rim * 0.8 + folds * 0.14);
  float alpha = 1.0;
  if (uWire > 0.5) {
    color = mix(base * 1.3, uRim, rim * 0.7);
    alpha = (0.3 + 0.7 * rim) * (facing < 0.0 ? 0.3 : 1.0);
  }
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`;

// Soft CSS sphere used when three.js or WebGL2 is unavailable.
function fallback(element, props, ctx) {
  const orb = document.createElement("div");
  orb.setAttribute("aria-hidden", "true");
  orb.style.cssText = [
    "position:absolute", "left:50%", "top:50%", "border-radius:50%", "pointer-events:none", "transform:translate(-50%,-50%)",
    `background:radial-gradient(circle at 34% 28%, ${props.rimColor} 0%, ${props.colorA} 34%, ${props.colorB} 100%)`,
    `box-shadow:inset -18px -24px 60px rgba(0,0,0,.28), 0 0 80px -24px ${props.colorB}`,
  ].join(";");
  const fit = () => {
    const { width, height } = ctx.size();
    const diameter = Math.max(8, Math.min(width, height) * props.size / 100);
    orb.style.width = orb.style.height = `${diameter}px`;
  };
  fit();
  element.append(orb);
  const stop = ctx.onResize(fit);
  return () => { stop(); orb.remove(); };
}

export async function mount(element, props, ctx) {
  let destroyed = false;
  ctx.onDestroy(() => { destroyed = true; });

  let THREE = null;
  try { THREE = await ctx.lib("three"); } catch (error) { console.warn("orb-3d: three.js could not load, showing a CSS sphere.", error); }
  if (destroyed) return () => {};
  if (!THREE) return fallback(element, props, ctx);

  const surface = ctx.createCanvas("webgl2");
  if (!surface.context) { surface.canvas.remove(); return fallback(element, props, ctx); }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: surface.canvas, context: surface.context, alpha: true, antialias: true });
  } catch (error) {
    console.warn("orb-3d: WebGL renderer failed, showing a CSS sphere.", error);
    surface.canvas.remove();
    return fallback(element, props, ctx);
  }
  renderer.setClearColor(0x000000, 0);
  // Pixel ratio 1 + device-pixel size keeps three's canvas size identical to the host's (no rounding tug-of-war).
  renderer.setPixelRatio(1);

  const touch = ctx.isTouch;
  const small = touch || Math.min(surface.width, surface.height) < 480;
  let detail = Math.round(props.detail);
  detail = Math.min(detail, small ? 24 : 64);
  if (ctx.editing) detail = Math.min(detail, 40);
  if (props.wireframe) detail = Math.min(detail, small ? 14 : 20);
  detail = Math.max(1, detail);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6);
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0 },
    uFreq: { value: props.noiseScale },
    uColorA: { value: new THREE.Color(props.colorA) },
    uColorB: { value: new THREE.Color(props.colorB) },
    uRim: { value: new THREE.Color(props.rimColor) },
    uFlat: { value: detail <= 5 && !props.wireframe ? 1 : 0 },
    uWire: { value: props.wireframe ? 1 : 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    wireframe: props.wireframe,
    transparent: props.wireframe,
    depthWrite: !props.wireframe,
  });
  const tilt = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  tilt.add(mesh);
  scene.add(tilt);

  const amp = props.distortion * 0.3;
  let baseScale = 1;
  const resize = () => {
    renderer.setSize(surface.pixelWidth, surface.pixelHeight, false);
    camera.aspect = surface.width / surface.height;
    camera.updateProjectionMatrix();
    const visibleH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const visibleMin = Math.min(visibleH, visibleH * camera.aspect);
    baseScale = ((props.size / 100) * visibleMin) / 2 / (1 + amp * 0.9);
  };
  resize();

  const state = { clock: Math.random() * 20, spin: 0, swell: 0, hover: 0, tiltX: 0, tiltY: 0 };
  const render = () => {
    uniforms.uTime.value = state.clock * 0.35;
    uniforms.uAmp.value = amp * (1 + state.swell * 0.9 + state.hover * 0.22);
    mesh.scale.setScalar(baseScale * (1 + state.swell * 0.06 + state.hover * 0.015));
    mesh.rotation.set(state.spin * 0.35 + 0.3, state.spin, 0);
    tilt.rotation.set(state.tiltX, state.tiltY, 0);
    renderer.render(scene, camera);
  };

  ctx.loop((time, delta) => {
    const dt = Math.min(delta, 0.1);
    const ease = (rate) => 1 - Math.exp(-dt * rate);
    const scroll = ctx.scroll;
    const velocity = scroll.velocity || 0;
    const swellTarget = Math.min(1, Math.abs(velocity) / 40);
    state.swell += (swellTarget - state.swell) * ease(swellTarget > state.swell ? 6 : 1.4);
    state.clock += dt * props.speed * (1 + state.swell * 1.6);
    state.spin += dt * 0.14 * props.speed + Math.max(-0.02, Math.min(0.02, velocity * 0.0004));

    // Lean toward the pointer (anywhere on the page); on touch, toward the finger while pressed, plus scroll.
    const p = ctx.pointer;
    let aimX = 0;
    let aimY = 0;
    let near = 0;
    if (touch) {
      if (p.down && p.inside) { aimX = p.x - 0.5; aimY = p.y - 0.5; near = 1; }
      aimY += (scroll.progress - 0.5) * 0.5;
    } else if (p.moved) {
      aimX = Math.max(-0.8, Math.min(0.8, p.x - 0.5));
      aimY = Math.max(-0.8, Math.min(0.8, p.y - 0.5));
      near = Math.max(0, 1 - Math.hypot(p.x - 0.5, p.y - 0.5) / 0.6);
    }
    state.tiltY += (aimX * 0.6 - state.tiltY) * ease(2.2);
    state.tiltX += (aimY * 0.5 - state.tiltX) * ease(2.2);
    state.hover += (near - state.hover) * ease(2.5);
    render();
  });

  ctx.onResize(() => { resize(); render(); });

  return () => {
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
