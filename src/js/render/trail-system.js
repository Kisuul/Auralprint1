import { runtime } from "../core/preferences.js";
import { state } from "../core/state.js";

/* =============================================================================
   TrailSystem
   ========================================================================== */
class TrailSystem {
  constructor() {
    this.particles = []; // { xSim, ySim, bornSec, rgbStart }
    this.emitAccumulator = 0;
  }

  reset() {
    this.particles.length = 0;
    this.emitAccumulator = 0;
  }

  removeOverlaps(xSim, ySim, rPx) {
    if (rPx <= 0) return;
    const r2 = rPx * rPx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const dx = p.xSim - xSim;
      const dy = p.ySim - ySim;
      if ((dx*dx + dy*dy) <= r2) this.particles.splice(i, 1);
    }
  }

  emitAt(xSim, ySim, nowSec, rgbStart) {
    const s = runtime.settings;
    this.removeOverlaps(xSim, ySim, s.particles.overlapRadiusPx * state.dpr);
    this.particles.push({ xSim, ySim, bornSec: nowSec, rgbStart });
  }

  updateAndEmit(dtSec, nowSec, emitterXSim, emitterYSim, rgbStart) {
    const s = runtime.settings;

    const ttl = Math.max(0.0001, s.particles.ttlSec);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if ((nowSec - this.particles[i].bornSec) >= ttl) this.particles.splice(i, 1);
    }

    this.emitAccumulator += s.particles.emitPerSecond * dtSec;

    const maxEmitThisFrame = Math.ceil(s.particles.emitPerSecond * s.timing.maxDeltaTimeSec) + 2;

    let emits = 0;
    while (this.emitAccumulator >= 1 && emits < maxEmitThisFrame) {
      this.emitAt(emitterXSim, emitterYSim, nowSec, rgbStart);
      this.emitAccumulator -= 1;
      emits += 1;
    }
  }
}

export { TrailSystem };
