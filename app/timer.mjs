/** Wall-clock deadline is independent of timer callback frequency and rendering. */
export class WorkoutTimer {
  constructor({
    now = () => Date.now(),
    onChange = () => {},
    onEnd = () => {},
  } = {}) {
    this.now = now;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.current = null;
  }
  start(seconds, meta = {}) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 5 || n > 7200)
      throw new Error("Длительность: от 5 до 7200 секунд.");
    this.current = {
      ...meta,
      seconds: n,
      deadline: this.now() + n * 1000,
      modified: false,
    };
    this.onChange(this.snapshot());
  }
  snapshot() {
    return this.current
      ? {
          ...this.current,
          left: Math.max(
            0,
            Math.ceil((this.current.deadline - this.now()) / 1000),
          ),
        }
      : null;
  }
  tick() {
    const state = this.snapshot();
    if (state && state.left === 0) {
      this.current = null;
      this.onEnd(state);
    } else if (state) this.onChange(state);
    return state;
  }
  adjust(delta) {
    if (!this.current) return;
    const c = this.current,
      left = this.snapshot().left;
    if (
      left + delta < 5 ||
      c.seconds + delta > (c.mode === "rest" ? 3600 : 7200) ||
      c.seconds + delta < 5
    )
      return;
    c.seconds += delta;
    c.deadline += delta * 1000;
    c.modified = true;
    this.onChange(this.snapshot());
  }
  stop() {
    const previous = this.snapshot();
    this.current = null;
    this.onChange(null);
    return previous;
  }
}
export function createBell() {
  let context;
  function unlock() {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === "suspended") context.resume();
    } catch {}
  }
  function ring() {
    unlock();
    if (!context) return;
    try {
      const now = context.currentTime;
      for (const [f, gain, duration] of [
        [520, 0.22, 1.5],
        [1040, 0.12, 1.2],
        [1560, 0.05, 0.7],
      ]) {
        const osc = context.createOscillator(),
          volume = context.createGain();
        osc.frequency.value = f;
        volume.gain.setValueAtTime(0.001, now);
        volume.gain.exponentialRampToValueAtTime(gain, now + 0.008);
        volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(volume);
        volume.connect(context.destination);
        osc.start(now);
        osc.stop(now + duration + 0.1);
      }
      navigator.vibrate?.([150, 80, 180]);
    } catch {}
  }
  return { unlock, ring };
}
