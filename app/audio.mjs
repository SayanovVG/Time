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
  vibrate = () => navigator.vibrate?.([250, 100, 350]),
  onError = () => {},
} = {}) {
  let context,
    loading,
    buffer,
    wantedDeadline = null,
    scheduledDeadline = null,
    generation = 0;
  const sources = new Set();
  function track(source) {
    sources.add(source);
    source.onended = () => sources.delete(source);
    return source;
  }
  async function load() {
    if (buffer) return buffer;
    if (!loading)
      loading = fetchSample()
        .then((bytes) => context.decodeAudioData(bytes))
        .then((b) => (buffer = b))
        .catch((error) => {
          loading = null;
          throw error;
        });
    return loading;
  }
  function unlock() {
    try {
      context ||= makeContext();
      if (context.state === "suspended") context.resume().catch(() => {});
      load().catch(onError);
    } catch (error) {
      onError(error);
    }
  }
  function countdown(at, volume) {
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
    }
  }
  function gong(at) {
    const source = track(context.createBufferSource()),
      gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(at);
  }
  function stop() {
    generation++;
    wantedDeadline = scheduledDeadline = null;
    for (const source of sources) {
      try {
        source.stop();
      } catch {}
    }
    sources.clear();
  }
  function sync(snapshot) {
    if (!snapshot) {
      stop();
      return;
    }
    if (wantedDeadline === snapshot.deadline) return;
    stop();
    wantedDeadline = snapshot.deadline;
    const token = generation;
    unlock();
    if (!context) return;
    load()
      .then(() => {
        if (token !== generation || wantedDeadline !== snapshot.deadline)
          return;
        const remaining = (snapshot.deadline - now()) / 1000;
        if (remaining <= 0) return;
        const at = context.currentTime;
        // Schedule once on the audio clock; rendering and delayed JS ticks cannot replay cues.
        for (let left = 10; left >= 1; left--) {
          const delay = remaining - left;
          if (delay >= -0.08)
            countdown(at + Math.max(0, delay), 0.25 + ((10 - left) / 9) * 0.75);
        }
        gong(at + remaining);
        scheduledDeadline = snapshot.deadline;
      })
      .catch(onError);
  }
  function ring() {
    try {
      vibrate();
    } catch {}
    if (scheduledDeadline !== null && scheduledDeadline === wantedDeadline)
      return;
    const token = generation;
    unlock();
    if (context)
      load()
        .then(() => {
          if (token === generation) gong(context.currentTime);
        })
        .catch(onError);
  }
  return { unlock, sync, ring, stop };
}
