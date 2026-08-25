# Engine Integration Reference

## Three.js / Vite / browser

Prefer `public/assets/audio/audio_manifest.json` or project-specific equivalent. Load through Web Audio or HTMLAudio according to existing code. First touch must unlock/resume `AudioContext`. Use manifest gains before editing WAV loudness.

Validation:

```bash
npm.cmd run build
npm.cmd run check:assets
```

When no checker exists, run a small Node script that parses the manifest and verifies all referenced files exist.

## Phaser

Preload audio in the scene loader with semantic keys. Keep files under `public/assets/audio/` or the existing assets folder. Use OGG+MP3 fallback if targeting broad browsers.

## Unity

Runtime files usually belong in `Assets/Audio/`. For short SFX, set import/load type for low latency. For long music, stream or compressed-in-memory according to target. Keep source WAVs in a documented source folder if they should not ship raw.

## Godot

Use `res://assets/audio/` or the existing project convention. Short SFX can be WAV. Music should be OGG when possible. Check import loop settings for music.

## PlayCanvas

Follow the project asset registry. Document generated source files outside the uploaded runtime pack, and make sure entity/component references use semantic names.

## QA checklist

- Audio unlock works on mobile/browser first touch.
- Mute and volume controls still work.
- No missing manifest/import references.
- No clipping or painful high-frequency cues.
- Build passes.
- Asset budget remains under target.
- Manual test route is documented.
