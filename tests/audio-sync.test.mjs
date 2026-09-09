import test from "node:test";
import assert from "node:assert/strict";
import { createBell, WorkoutTimer } from "../app/timer.mjs";

const settle = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};

// The device clock can stop or run at a different rate from the screen clock.
function harness({
  suspended = false,
  latency = 0,
  timestamp = false,
  fetchSample = async () => new ArrayBuffer(1),
  onError = (error) => {
    throw error;
  },
} = {}) {
  let wall = 0,
    releaseResume;
  const nodes = [],
    listeners = new Map(),
    heard = [];
  const context = {
    currentTime: 0,
    state: suspended ? "suspended" : "running",
    destination: {},
    baseLatency: 0,
    outputLatency: latency,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    resume() {
      return new Promise((resolve) => {
        releaseResume = resolve;
      });
    },
    decodeAudioData: async () => ({}),
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    }),
    createOscillator: () => node("tone"),
    createBufferSource: () => node("gong"),
  };
  if (timestamp)
    context.getOutputTimestamp = () => ({
      contextTime: Math.max(0, context.currentTime - latency),
      performanceTime: wall,
    });
  function node(type) {
    const n = {
      type,
      frequency: { value: 0 },
      connect() {},
      start(at) {
        this.at = Math.max(at, context.currentTime);
      },
      stop(at) {
        if (at === undefined) this.cancelled = true;
      },
    };
    nodes.push(n);
    return n;
  }
  const bell = createBell({
    makeContext: () => context,
    fetchSample,
    now: () => wall,
    performanceNow: () => wall,
    vibrate() {},
    onError,
  });
  function advance(nextWall, nextAudio) {
    const previousAudio = context.currentTime;
    if (nextAudio > previousAudio)
      for (const n of nodes) {
        if (!n.cancelled && !n.started && n.at <= nextAudio) {
          n.started = true;
          heard.push({
            type: n.type,
            frequency: n.frequency.value,
            wall:
              wall +
              Math.max(
                0,
                (n.at - previousAudio) / (nextAudio - previousAudio),
              ) *
                (nextWall - wall) +
              latency * 1000,
          });
        }
      }
    wall = nextWall;
    context.currentTime = nextAudio;
  }
  return {
    bell,
    context,
    nodes,
    heard,
    advance,
    now: () => wall,
    pendingGong: () => nodes.findLast((n) => n.type === "gong" && !n.cancelled),
    async resume() {
      context.state = "running";
      releaseResume?.();
      listeners.get("statechange")?.();
      await settle();
    },
    suspend() {
      context.state = "suspended";
      listeners.get("statechange")?.();
    },
  };
}

test("two-second audio startup delay does not move the gong past the screen deadline", async () => {
  const h = harness({ suspended: true });
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(2000, 0);
  await h.resume();
  assert.equal(h.pendingGong().at, 18);
});

test("an audio clock stalled by two seconds is realigned during the same countdown", async () => {
  const h = harness();
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(5000, 5);
  h.advance(7000, 5);
  h.bell.sync({ deadline: 20000 });
  await settle();
  assert.equal(h.pendingGong().at, 18);
});

test("two-hour timer corrects progressive audio drift instead of accumulating seconds", async () => {
  const h = harness();
  const timer = new WorkoutTimer({
    now: h.now,
    onChange: (snapshot) => h.bell.sync(snapshot),
    onEnd: () => h.bell.ring(),
  });
  timer.start(7200);
  await settle();
  for (let ms = 250; ms <= 7200500; ms += 250) {
    h.advance(ms, (ms / 1000) * 0.9992);
    timer.tick();
    await settle();
  }
  const cues = h.heard.filter((n) => n.type === "gong" || n.frequency === 1050);
  assert.equal(cues.length, 11);
  for (let i = 0; i < cues.length; i++) {
    const expected = 7190000 + i * 1000;
    assert.ok(
      Math.abs(cues[i].wall - expected) < 80,
      `cue ${i}: expected ${expected}, heard ${cues[i].wall}`,
    );
  }
});

test("fresh output timestamps compensate device latency without counting it twice", async () => {
  const h = harness({ latency: 0.24, timestamp: true });
  // A timestamp already describes the full output path; do not subtract the
  // latency properties again, even when they report a different estimate.
  h.context.baseLatency = 0.01;
  h.context.outputLatency = 0.5;
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(2000, 2);
  h.context.getOutputTimestamp = () => ({
    contextTime: 1.66,
    performanceTime: 1900,
  });
  h.bell.sync({ deadline: 20000 });
  assert.ok(Math.abs(h.pendingGong().at - 19.76) < 0.001);
  h.advance(20500, 20.5);
  h.bell.ring();
  assert.equal(h.heard.filter((n) => n.type === "gong").length, 1);
  assert.ok(Math.abs(h.heard.find((n) => n.type === "gong").wall - 20000) < 1);
});

test("missing, zero or stale output timestamps use the available latency estimate", async () => {
  for (const stamp of [
    null,
    { contextTime: 0, performanceTime: 0 },
    { contextTime: 1, performanceTime: 1000 },
  ]) {
    const h = harness({ latency: 0.24 });
    h.context.baseLatency = 0.01;
    if (stamp) h.context.getOutputTimestamp = () => stamp;
    h.advance(2000, 2);
    h.bell.sync({ deadline: 20000 });
    await settle();
    assert.equal(h.pendingGong().at, 19.75);
  }
});

test("resume during the last seconds discards missed notes and preserves the remaining crescendo", async () => {
  const h = harness();
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(11250, 11.25);
  h.suspend();
  h.advance(14250, 11.25);
  await h.resume();
  h.advance(20250, 17.25);
  h.bell.ring();
  const cues = h.heard.filter((n) => n.type === "gong" || n.frequency === 1050);
  assert.deepEqual(
    cues.map((n) => n.wall),
    [10000, 11000, 15000, 16000, 17000, 18000, 19000, 20000],
  );
});

test("the final screen tick realigns a late gong and cannot ring it twice", async () => {
  const h = harness();
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(19000, 19);
  h.advance(20000, 19);
  h.bell.ring();
  assert.equal(h.pendingGong().at, 19);
  h.advance(20250, 19.25);
  h.bell.ring();
  h.advance(23000, 22);
  assert.deepEqual(
    h.heard.filter((n) => n.type === "gong").map((n) => n.wall),
    [20000],
  );
});

test("delayed screen callbacks do not postpone or replay audio that ran on time", async () => {
  const h = harness();
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(22000, 22);
  h.bell.ring();
  h.advance(23000, 23);
  const cues = h.heard.filter((n) => n.type === "gong" || n.frequency === 1050);
  assert.deepEqual(
    cues.map((n) => Math.round(n.wall)),
    Array.from({ length: 11 }, (_, i) => (10 + i) * 1000),
  );
});

test("resuming after zero rings once, while stopping a pending resume stays silent", async () => {
  const finished = harness({ suspended: true });
  finished.bell.sync({ deadline: 5000 });
  await settle();
  finished.advance(6000, 0);
  finished.bell.ring();
  await finished.resume();
  finished.advance(6250, 0.25);
  finished.bell.ring();
  finished.advance(7000, 1);
  assert.deepEqual(
    finished.heard.map((n) => n.type),
    ["gong"],
  );

  const cancelled = harness({ suspended: true });
  cancelled.bell.sync({ deadline: 5000 });
  await settle();
  cancelled.bell.stop();
  cancelled.advance(6000, 0);
  await cancelled.resume();
  assert.equal(cancelled.nodes.length, 0);
});

test("timer replacement and adjustment while resume is pending only schedule the latest deadline", async () => {
  const h = harness({ suspended: true });
  h.bell.sync({ deadline: 20000 });
  await settle();
  h.advance(2000, 0);
  h.bell.sync({ deadline: 30000 });
  h.bell.sync({ deadline: 45000 });
  await h.resume();
  assert.equal(h.nodes.filter((n) => n.type === "gong").length, 1);
  assert.equal(h.pendingGong().at, 43);
});

test("successive timers keep their own deadline despite audio pauses between sets", async () => {
  const h = harness();
  for (let round = 0; round < 3; round++) {
    h.advance(round * 30000, round * 28);
    h.bell.sync({ deadline: round * 30000 + 20000 });
    await settle();
    h.advance(round * 30000 + 20250, round * 28 + 20.25);
    h.bell.ring();
  }
  assert.deepEqual(
    h.heard.filter((n) => n.type === "gong").map((n) => n.wall),
    [20000, 50000, 80000],
  );
});

test("regular synchronization does not repeat failed downloads or flood error messages", async () => {
  let requests = 0,
    errors = 0;
  const h = harness({
    fetchSample: async () => {
      if (++requests === 1) throw new Error("offline");
      return new ArrayBuffer(1);
    },
    onError: () => errors++,
  });
  for (let ms = 0; ms < 2000; ms += 250) {
    h.advance(ms, ms / 1000);
    h.bell.sync({ deadline: 20000 });
    await settle();
  }
  assert.equal(requests, 1);
  assert.equal(errors, 1);
  h.bell.sync({ deadline: 30000 });
  await settle();
  assert.equal(requests, 2);
  assert.equal(h.pendingGong().at, 30);
});
