# Original MAX TIME timer sounds

`original-gong.mp3` is the original embedded MP3, extracted without transcoding
from `index.html` at commit `646b8219c5b4c826ff96a2966220d6cd2dd0e72b`
(`backup-pre-max-time-v2-2026-08-23`).

SHA-256: `25b83293cc1c7f2e7f6d771f8f2a0a866384d54e68ddf529b2ebe9135b77245e`.

The last ten seconds use the exact four oscillator frequencies, gain envelopes
and volume progression from `fixes-v2.js` in the pre-3.0 app, then this recording
plays at the original gain of 0.8. Starting in 3.1.1, future cues are realigned
against the screen's deadline on each timer tick, audio resume and completion.
Valid output timestamps (or the browser's latency estimates) account for the
device output path. Already-started cues are retained, so clock correction
does not replay notes or duplicate the gong. The MP3 ships in the offline cache; no old HTML or
external audio request is needed at runtime.
