// src/shared/transition-engine.js
//Smooth Transition Between Palettes

const { lerpMatrix, IDENTITY } = require('./matrix-ops');

const Easings = {
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  },
  easeInQuad(t) {
    return t * t;
  },
  linear(t) {
    return t;
  },
};

class TransitionEngine {
  constructor() {
    this.animationId = null;
    this.currentMatrix = [...IDENTITY];
  }

  getCurrentMatrix() {
    return [...this.currentMatrix];
  }

  animate(config) {
    this.cancel();
    const { from, to, duration, easing, onFrame, onComplete } = config;
    const startTime = performance.now();
    const frameInterval = 16;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      const easedT = easing(rawT);

      this.currentMatrix = lerpMatrix(from, to, easedT);
      onFrame(this.currentMatrix);

      if (rawT < 1) {
        this.animationId = setTimeout(step, frameInterval);
      } else {
        this.animationId = null;
        this.currentMatrix = [...to];
        if (onComplete) onComplete();
      }
    };

    step();
  }

  jump(matrix, onFrame) {
    this.cancel();
    this.currentMatrix = [...matrix];
    onFrame(this.currentMatrix);
  }

  cancel() {
    if (this.animationId !== null) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }
  }

  isAnimating() {
    return this.animationId !== null;
  }
}

module.exports = { Easings, TransitionEngine };
