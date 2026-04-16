import { state } from "./state.js";

/* =============================================================================
   Sim space vs Screen space
   ========================================================================== */
const Spaces = (() => {
  function centerPx() {
    return { x: state.widthPx * 0.5, y: state.heightPx * 0.5 };
  }
  function simToScreen(xSim, ySim) {
    const c = centerPx();
    return { x: c.x + xSim, y: c.y - ySim };
  }
  return { centerPx, simToScreen };
})();

/* =============================================================================
   Canvas sizing
   ========================================================================== */
function resizeCanvasToDisplaySize() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = state.canvas.clientWidth;
  const cssH = state.canvas.clientHeight;

  const pxW = Math.floor(cssW * dpr);
  const pxH = Math.floor(cssH * dpr);

  if (pxW !== state.widthPx || pxH !== state.heightPx || dpr !== state.dpr) {
    state.dpr = dpr;
    state.widthPx = pxW;
    state.heightPx = pxH;
    state.canvas.width = pxW;
    state.canvas.height = pxH;
  }
}

export { Spaces, resizeCanvasToDisplaySize };
