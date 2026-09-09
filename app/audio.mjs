// Exact countdown frequencies, envelopes and rising volume from fixes-v2.js.
// Gong bytes extracted unchanged from backup-pre-max-time-v2-2026-08-23.
export const COUNTDOWN_VOICES = [
  { f: 1050, a: 0.35, d: 1.4 },
  { f: 2100, a: 0.18, d: 1 },
  { f: 3150, a: 0.1, d: 0.7 },
  { f: 525, a: 0.12, d: 1.2 },
];
export function createBell({
  makeContext = () => new (window.AudioContext || window.webkitAudioContext)(),
  fetchSample = async () => {
    const r = await fetch(
      new URL("./audio/original-gong.mp3", import.meta.url),
    );
    if (!r.ok) throw new Error("Звук недоступен");
    return r.arrayBuffer();
  },
  now = () => Date.now(),
  performanceNow = () => performance.now(),
  vibrate = () => navigator.vibrate?.([250, 100, 350]),
  onError = () => {},
} = {}) {
  let context,
    loading,
    buffer,
    resuming,
    loadFailed = false,
    wantedDeadline = null;
  const sources = new Set();
  const cues = new Map();
  function track(source) {
    sources.add(source);
    source.onended = () => sources.delete(source);
    return source;
  }
  function load() {
    if (!loading && !loadFailed)
      loading = fetchSample()
        .then((bytes) => context.decodeAudioData(bytes))
        .then((b) => {
          buffer = b;
          reconcile();
        })
        .catch((error) => {
          loading = null;
          loadFailed = true;
          onError(error);
        });
  }
  function unlock() {
    try {
      if (!context) {
        context = makeContext();
        context.addEventListener?.("statechange", () => {
          if (context.state === "running") reconcile();
          else {
            // Retire rendered cues and discard queued ones before a frozen
            // audio clock resumes. Already-heard notes must never be replayed.
            for (const [left, cue] of cues) {
              cancel(cue);
              if (!cue.done && cue.at > context.currentTime) cues.delete(left);
            }
          }
        });
        context.addEventListener?.("sinkchange", reconcile);
      }
      if (context.state !== "running" && !resuming) {
        // resume() is asynchronous: the screen clock keeps advancing meanwhile.
        resuming = context
          .resume()
          .then(() => {
            resuming = null;
            reconcile();
          })
          .catch((error) => {
            resuming = null;
            onError(error);
          });
      }
      load();
      reconcile();
    } catch (error) {
      onError(error);
    }
  }
  function countdown(at, volume) {
    const nodes = [];
    for (const x of COUNTDOWN_VOICES) {
      const o = track(context.createOscillator()),
        g = context.createGain();
      o.frequency.value = x.f;
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(x.a * volume, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, at + x.d);
      o.connect(g);
      g.connect(context.destination);
      o.start(at);
      o.stop(at + x.d + 0.05);
      nodes.push(o);
    }
    return nodes;
  }
  function gong(at) {
    const source = track(context.createBufferSource()),
      gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(at);
    return [source];
  }
  function cancel(cue) {
    for (const source of cue?.nodes || []) {
      try {
        source.stop();
      } catch {}
      sources.delete(source);
    }
  }
  function stop() {
    wantedDeadline = null;
    cancel({ nodes: sources });
    sources.clear();
    cues.clear();
  }
  function outputTime() {
    // Convert the audible device position to the screen clock, rather than
    // assuming AudioContext.currentTime and Date.now advance together.
    // https://www.w3.org/TR/webaudio-1.1/#dom-audiocontext-getoutputtimestamp
    const stamp = context.getOutputTimestamp?.();
    const age = stamp ? performanceNow() - stamp.performanceTime : Infinity;
    const audible = stamp ? stamp.contextTime + age / 1000 : NaN;
    if (
      stamp?.contextTime > 0 &&
      stamp.performanceTime > 0 &&
      age >= 0 &&
      age < 250 &&
      Number.isFinite(audible) &&
      audible <= context.currentTime + 0.04
    )
      return audible;
    // Older browsers and the first frames after resume may lack a valid stamp.
    const latency = [context.baseLatency, context.outputLatency].reduce(
      (sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0),
      0,
    );
    return context.currentTime - latency;
  }
  function reconcile() {
    if (wantedDeadline === null || !buffer || context.state !== "running")
      return;
    const time = now();
    const endAt = outputTime() + (wantedDeadline - time) / 1000;
    for (let left = 10; left >= 0; left--) {
      const cue = cues.get(left);
      // Preserve sounding envelopes and the final gong; reschedule only future
      // sources. Keep retired entries even after their nodes end to prevent replay.
      if (cue && (cue.done || cue.at <= context.currentTime)) continue;
      const at = endAt - left;
      if (
        left > 0 &&
        (time > wantedDeadline - left * 1000 + 80 ||
          at < context.currentTime - 0.08)
      ) {
        cancel(cue);
        cues.set(left, { done: true });
        continue;
      }
      // Ignore render-quantum jitter but correct drift on every screen tick.
      if (cue && Math.abs(cue.at - at) < 0.04) continue;
      cancel(cue);
      const start = Math.max(context.currentTime, at);
      cues.set(left, {
        at: start,
        nodes:
          left === 0
            ? gong(start)
            : countdown(start, 0.25 + ((10 - left) / 9) * 0.75),
      });
    }
  }
  function sync(snapshot) {
    if (!snapshot) {
      stop();
      return;
    }
    if (wantedDeadline !== snapshot.deadline) {
      stop();
      loadFailed = false;
      wantedDeadline = snapshot.deadline;
    }
    unlock();
  }
  function ring() {
    try {
      vibrate();
    } catch {}
    wantedDeadline ??= now();
    // The last UI tick must also reconcile a pending gong, not merely assume
    // that an old schedule is still aligned with zero on the screen.
    unlock();
  }
  return { unlock, sync, ring, stop };
}
