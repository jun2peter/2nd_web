// Lottie 애니메이션 — After Effects(Bodymovin)에서 내보낸 .json 또는 .lottie 파일을 재생한다.
// .json은 lottie-web(svg), .lottie는 dotlottie-web(canvas). 라이브러리는 ctx.lib로 고정 버전 CDN에서 가져온다.
export const meta = {
  name: "Lottie 애니메이션",
  description: "After Effects에서 내보낸 Lottie(.json·.lottie)를 재생해요. 항상 반복·호버·화면 진입·클릭·스크롤 스크럽 중 고르세요. 색과 크기는 파일 그대로, 배경은 투명이에요.",
  category: "media",
  defaultSize: { width: 480, height: 480 },
  runsWhenReduced: false,
  runsOffscreen: false,
  props: [
    { key: "src", label: "Lottie 파일 (.json 또는 .lottie 주소/경로)", type: "url", default: "" },
    { key: "playOn", label: "재생", type: "select", options: [["always", "항상 반복"], ["hover", "호버 중"], ["in-view", "화면에 들어오면 한 번"], ["click", "클릭할 때마다 처음부터"], ["scroll", "스크롤로 스크럽"]], default: "always" },
    { key: "speed", label: "속도", type: "range", min: 0.1, max: 3, step: 0.1, default: 1 },
    { key: "loop", label: "반복", type: "toggle", default: true },
    { key: "fit", label: "맞춤", type: "select", options: [["contain", "전체 보이기"], ["cover", "꽉 채움"]], default: "contain" },
    { key: "background", label: "배경 (예: transparent, #fff)", type: "text", default: "transparent" },
  ],
};

const note = (element, text) => { element.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;padding:16px;color:#888;font:12px/1.5 Arial,sans-serif;letter-spacing:.06em;text-align:center">${text}</div>`; };

export async function mount(element, props, ctx) {
  element.style.position = "relative"; element.style.overflow = "hidden";
  element.style.background = /^[#(),.%\w\s-]+$/.test(props.background || "") ? props.background : "transparent";
  if (!props.src) { note(element, "LOTTIE<br>오른쪽에 .json 또는 .lottie 파일 주소를 넣으세요"); return () => element.replaceChildren(); }
  const url = ctx.asset(props.src);
  const isDotLottie = /\.lottie(\?|$)/i.test(url);
  let destroyed = false;
  let anim = null;
  let api = null;
  try {
    if (isDotLottie) {
      const { DotLottie } = await ctx.lib("dotlottie");
      if (destroyed) return () => {};
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      element.append(canvas);
      anim = new DotLottie({ canvas, src: url, loop: props.loop, autoplay: props.playOn === "always" && !ctx.reducedMotion, speed: props.speed, renderConfig: { autoResize: true }, layout: { fit: props.fit, align: [0.5, 0.5] } });
      api = {
        play: () => anim.play(), pause: () => anim.pause(), stop: () => anim.stop(),
        restart: () => { anim.setFrame(0); anim.play(); },
        seek: (progress) => { const total = anim.totalFrames || 0; if (total > 1) anim.setFrame(Math.max(0, Math.min(total - 1, progress * (total - 1)))); },
        destroy: () => anim.destroy(),
      };
    } else {
      const module = await ctx.lib("lottie");
      const lottie = module?.default || module;
      if (destroyed) return () => {};
      const container = document.createElement("div");
      container.style.cssText = "width:100%;height:100%";
      element.append(container);
      anim = lottie.loadAnimation({ container, renderer: "svg", loop: props.loop, autoplay: props.playOn === "always" && !ctx.reducedMotion, path: url, rendererSettings: { preserveAspectRatio: props.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet", progressiveLoad: true } });
      anim.setSpeed(props.speed);
      anim.addEventListener("data_failed", () => note(element, "Lottie 파일을 읽지 못했어요 · 주소와 CORS를 확인하세요"));
      api = {
        play: () => anim.play(), pause: () => anim.pause(), stop: () => anim.stop(),
        restart: () => anim.goToAndPlay(0, true),
        seek: (progress) => { const total = anim.totalFrames || 0; if (total > 1) anim.goToAndStop(Math.round(progress * (total - 1)), true); },
        destroy: () => anim.destroy(),
      };
    }
  } catch (error) {
    console.warn("Lottie could not load.", error);
    note(element, "Lottie 라이브러리를 불러오지 못했어요 · 인터넷 연결을 확인하세요");
    return () => element.replaceChildren();
  }

  const cleanups = [];
  let stopLoop = () => {};
  let playedOnce = false;
  const hoverable = !ctx.isTouch;
  if (props.playOn === "hover" && hoverable) {
    const enter = () => api.play(); const leave = () => api.pause();
    element.addEventListener("pointerenter", enter); element.addEventListener("pointerleave", leave);
    cleanups.push(() => { element.removeEventListener("pointerenter", enter); element.removeEventListener("pointerleave", leave); });
  } else if (props.playOn === "hover") {
    stopLoop = ctx.loop(() => { if (ctx.pointer.down && ctx.pointer.inside) api.play(); });
  }
  if (props.playOn === "click") {
    const click = () => api.restart();
    element.addEventListener("click", click); element.style.cursor = "pointer";
    cleanups.push(() => element.removeEventListener("click", click));
  }
  if (props.playOn === "scroll") {
    const smoothing = ctx.reducedMotion ? 0 : 0.5;
    let shown = 0;
    stopLoop = ctx.loop(() => { shown += (ctx.scroll.progress - shown) * (1 - smoothing); api.seek(shown); });
  }
  if (ctx.reducedMotion && props.playOn !== "scroll") api.seek(0.5);

  return {
    destroy() { destroyed = true; stopLoop(); cleanups.forEach((fn) => fn()); try { api?.destroy(); } catch (error) { /* ignore */ } element.replaceChildren(); },
    visibility(visible) { if (props.playOn === "in-view" && visible && !playedOnce && !ctx.reducedMotion) { playedOnce = true; api.restart(); } },
    paused(isPaused) { if (isPaused) api.pause(); else if (props.playOn === "always" && !ctx.reducedMotion) api.play(); },
  };
}
