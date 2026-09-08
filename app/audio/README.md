# Original MAX TIME timer sounds

`original-gong.mp3` is the original embedded MP3, extracted without transcoding
from `index.html` at commit `646b8219c5b4c826ff96a2966220d6cd2dd0e72b`
(`backup-pre-max-time-v2-2026-08-23`).

SHA-256: `25b83293cc1c7f2e7f6d771f8f2a0a866384d54e68ddf529b2ebe9135b77245e`.

The last ten seconds use the exact four oscillator frequencies, gain envelopes
and volume progression from `fixes-v2.js` in the pre-3.0 app, then this recording
plays at the original gain of 0.8. The audio clock now schedules the same sounds
against the timer deadline. The MP3 ships in the offline cache; no old HTML or
external audio request is needed at runtime.
