---
name: universal-free-game-audio-director
description: Free-first game audio production skill for music, loops, adaptive layers, stingers, UI sounds, and SFX in browser, mobile, Unity, Godot, Three.js, Phaser, PlayCanvas, and native game projects. Use when the user asks to create, generate, replace, integrate, audit, document, or QA game audio using free local tools, open-source tools, no-cost online generators, AudioCraft/AudioGen, GenSFX-style browser tools, rFXGen/sfxr-style procedural tools, FFmpeg, Audacity, Web Audio, or engine import pipelines.
---

# Universal Free Game Audio Director

Use this skill to make game audio end to end: spec, generation, export, integration, manifest, license notes, and QA. Prefer local/free/open-source paths first; use online no-cost tools only when they produce downloadable files with acceptable usage rights.

## Operating Rules

1. Verify the real project root before editing.
2. Read only the audio-relevant context first: `AGENTS.md`, `docs/context/AUDIO_STATE.md`, `docs/context/AUDIO_DECISION_LOG.md`, `public/assets/audio/**`, `src/audio/**`, engine audio scripts, and existing manifests.
3. Create or update a short `AUDIO_TECHNICAL_PACK` before implementing non-trivial audio work.
4. Prefer WAV mono/stereo 44.1 kHz for SFX source, OGG/MP3/AAC for compressed music/runtime when supported, and keep original sources outside the public build when possible.
5. Never add paid APIs, paid SDKs, closed services, or unclear third-party samples without recording cost, license, and a free alternative.
6. Do not delete old audio until the new manifest is verified and the user approves cleanup.
7. Put every new runtime audio file in a manifest or documented import path; no orphaned assets.
8. Validate with build, asset budget, manifest existence checks, and at least one manual test route.

## Tool Selection

- Use local procedural synthesis first for fast placeholders, UI, short feedback, retro/chiptune, educational sounds, and deterministic packs.
- Use `rFXGen`, `sfxr`, `jsfxr`, or Python synthesis for short SFX under 2 seconds.
- Use FFmpeg for trimming, fades, normalization, sample-rate conversion, channel conversion, and mobile encodes.
- Use Audacity locally for manual polish or batch processing only when installed and helpful.
- Use Meta AudioCraft/AudioGen locally for high-fidelity environmental SFX when setup already exists or the user accepts the download/runtime cost.
- Use no-cost online tools such as GenSFX-style generators only when the user can download the result and the license/usage rights are recorded.
- Use LMMS, Bosca Ceoil, BeepBox/JummBox, MuseScore, Hydrogen, or similar free tools for music sketches when MIDI/pattern composition is better than AI generation.

## AUDIO_TECHNICAL_PACK

Before implementation, write or append a compact pack in `docs/context/AUDIO_STATE.md`:

```text
## <Game/Feature> Audio Pack - <YYYY-MM-DD>

Goal:
- ...

Game states:
- menu, gameplay, success, fail, transition, ambience, etc.

Assets:
- key -> target file -> duration -> format -> trigger

Generation route:
- local procedural / rFXGen / AudioCraft / GenSFX / FFmpeg / music tracker

Export:
- SFX: WAV mono 44.1 kHz, short tail, normalized softly
- Music: OGG/MP3/AAC runtime encode, loop points documented

Integration:
- manifest path
- engine/runtime file to update

QA:
- manifest references exist
- build/test command
- asset budget
- manual listening route

License:
- source, rights, restrictions, attribution
```

## Default Project Layout

Prefer this layout when the project has no audio convention:

```text
audio/
  source/
  generated/
  exports/
public/assets/audio/
  audio_manifest.json
docs/context/
  AUDIO_STATE.md
  AUDIO_DECISION_LOG.md
docs/audio/
```

For engine-specific projects, adapt without fighting the engine:

- Unity: put runtime audio under `Assets/Audio/`, sources under `AudioSource/` or `Assets/Audio/Source/`, and document import settings.
- Godot: put runtime audio under `res://assets/audio/` or existing `audio/`, import as stream/sample according to duration.
- Three.js/Phaser/Vite: put runtime audio under `public/assets/audio/` and load by manifest.
- PlayCanvas: use the project asset convention and document upload/import names.

## Manifest Contract

When possible, use this minimal schema:

```json
{
  "version": "0.1.0",
  "game": "ProjectName",
  "source": "free-local",
  "layers": {
    "day": { "src": "music/day_loop.mp3", "loop": true, "gain": 0.4 }
  },
  "sfx": {
    "menu_open": { "src": "sfx/menu_open.wav", "gain": 0.35 }
  },
  "budget": {
    "max_initial_pack_mb": 10,
    "max_simultaneous_music_layers": 2,
    "max_simultaneous_sfx": 8
  }
}
```

Always verify every `src` exists relative to the manifest base.

## Generation Workflow

1. Inventory existing audio and runtime calls.
2. Define names first: stable semantic keys such as `menu_open`, `player_jump`, `level_complete`, `night_transition`.
3. Generate placeholder or final assets in small batches.
4. Normalize softly; avoid harsh high frequencies, clipping, long tails, and loud surprises.
5. Integrate by manifest or engine import settings.
6. Update docs and asset manifest/license notes.
7. Run checks and report exact commands.

## Quality Targets

- SFX duration: UI 0.05-0.20s, interactions 0.10-0.50s, stingers 0.50-2.50s.
- Music loop: seamless or fade-compatible, with loop length and BPM documented.
- Mobile/browser: keep the initial public audio pack below the project budget, default 10 MB when no budget exists.
- Mixing: music should leave room for SFX; fix loudness with manifest gain before regenerating.
- Child/cozy games: prefer soft attacks, warm timbres, wooden/kalimba/bell textures, and non-punishing fail cues.

## Scripts

- Run `scripts/bootstrap_audio_project.py <project-root> --game-name <Name>` when a project needs the standard audio folders and starter docs.

## References

- Read `references/free-audio-tools.md` when choosing between local procedural, AudioCraft, online generators, trackers, DAWs, or FFmpeg.
- Read `references/engine-integration.md` when integrating into Unity, Godot, Three.js, Phaser, PlayCanvas, or Web Audio.
