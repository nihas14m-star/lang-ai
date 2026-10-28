# English Tutor AI

An AI-powered English-learning Android application: diagnostics, adaptive daily
practice, scenario conversations with corrections, speaking analysis, spaced
repetition, and progress tracking.

**Core principle:** measurable learning outcomes over AI interaction time.
Scores are derived only from observable exercise results. Unavailable
capabilities (e.g. phoneme-level pronunciation scoring) are labeled as
unavailable — never faked.

## Repository layout

```
english-tutor-ai/
├── shared/     Learning engine (pure TypeScript): CEFR, SRS (SM-2), skill
│               scoring, curriculum, daily missions, drill bank, diagnostics,
│               Indian-English awareness, API contracts (zod).
├── backend/    Node/Express AI orchestration: NVIDIA NIM (default) plus
│               OpenAI/OpenRouter/Gemini adapters, rule-based offline tutor,
│               structured-output validation with repair, rate limiting,
│               optional bearer auth, Free Dictionary API vocabulary lookup.
└── app/        Expo (SDK 58) Android app: expo-router, expo-sqlite
                (local-first storage), expo-speech (TTS), expo-speech-recognition
                (on-device ASR), zustand state.
```

## Prerequisites

- Node.js ≥ 20 (tested on 22)
- For the Android build: JDK 17 and the Android SDK (see below)

## Backend setup

```bash
cd backend
cp .env.example .env          # then edit: add NVIDIA_API_KEY
npm install
npm start                     # http://localhost:8787
npm run live:test             # optional: one real structured call against the configured provider
```

- `NVIDIA_API_KEY` — get one at https://build.nvidia.com (free tier available).
- Default model: `nvidia/nemotron-3.5-lightning-30b-a3b` (verified working; older
  `meta/llama-3.3-70b-instruct` reached end-of-life on NIM). If you change the model,
  run `npm run live:probe` to check availability on your account — NIM accounts can
  only invoke a subset of catalogued models.
- With no keys configured the backend automatically runs a deterministic
  rule-based tutor so every endpoint still works (responses are labeled
  `degraded: true`).
- Set `API_TOKEN` to require `Authorization: Bearer <token>` on all endpoints.
- Never commit `.env`. Keys only ever live server-side.

## App setup (Android)

> **Path requirement:** build from a path WITHOUT spaces (e.g. `C:\dev\english-tutor-ai`).
> The Android NDK/CMake toolchain fails on paths containing spaces, and OneDrive-synced
> folders cause file locking during builds. If your project lives under a spaced or
> OneDrive path, move or clone it to a local space-free directory for `gradlew` builds.

```bash
cd app
npm install
# Point the app at your backend (10.0.2.2 = host machine from the emulator)
# Set EXPO_PUBLIC_BACKEND_URL (e.g. in .env) if it is not the default.

npm run android               # Expo dev server (Expo Go or dev build)
```

Speech recognition needs a **development build** (native module):

```bash
npx expo prebuild -p android  # generates android/ (done in CI here)
npx expo run:android          # builds + installs on a device/emulator
```

## Building an APK

Requires JDK 17 + Android SDK:

```bash
cd app/android
# local.properties: sdk.dir=<path-to-android-sdk>
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

## Tests

```bash
npm test        # runs shared (68) + backend (42) + app (4) suites
npm run typecheck
```

## Privacy model

- All learner data (profile, mistakes, vocabulary, conversations) is stored
  **only on the device** (SQLite).
- Audio is never persisted; only transcripts are used.
- The backend receives an ephemeral, request-scoped learner snapshot and keeps
  no learner records.
- The profile screen includes one-tap full data deletion.

## Honest capability status

| Capability | Status |
|:---|:---|
| Grammar/vocabulary/SRS, diagnostics, missions, curriculum | Fully on-device |
| Conversation/writing/interview feedback | Backend AI; offline → rule-based tutor (labeled) |
| Speech-to-text | On-device recognizer (Android 13+ best) |
| Text-to-speech | On-device (expo-speech) |
| Fluency metrics (wpm, pauses, fillers) | Measured from real mic/ASR data |
| Pronunciation phoneme scoring | **Not available** — ASR word-recognition hints only, labeled |
| CEFR level | Diagnostic estimate, not an official certification |
