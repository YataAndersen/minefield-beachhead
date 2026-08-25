# Free Audio Tools Reference

## Local procedural

Use for fast SFX, UI feedback, pickups, mistakes, confirmations, impacts, toy sounds, and placeholders. Good options: rFXGen, sfxr, jsfxr, Python `wave`, Web Audio offline render, Pure Data, SuperCollider.

Pros: no license risk, no internet, deterministic, tiny files.
Risks: can sound synthetic; polish with envelopes, layering, EQ, and soft normalization.

## AudioCraft / AudioGen

Use for organic environmental SFX, foley-like textures, creature sounds, ambience, and prompt-driven variants when local setup is available.

Pros: open-source route, local control.
Risks: heavy install/download, GPU/CPU cost, slower iteration. Record model/source and generated-file status.

## No-cost online generators

Use only when the tool offers downloadable files and acceptable rights for personal/commercial use. Save the prompt, tool name, URL, date, license text or screenshot/note, and output filename.

Pros: quick high-fidelity options.
Risks: terms can change, export may be manual, attribution/usage may be unclear.

## Music sketching

Use BeepBox/JummBox, LMMS, Bosca Ceoil, MuseScore, Hydrogen, or DAW-free trackers for loops, motifs, and adaptive stems. Export WAV for source and compressed OGG/MP3/AAC for runtime.

## FFmpeg patterns

Trim:

```bash
ffmpeg -y -i input.wav -ss 0.00 -t 0.50 -af "afade=t=in:st=0:d=0.005,afade=t=out:st=0.42:d=0.08" output.wav
```

Mono SFX:

```bash
ffmpeg -y -i input.wav -ac 1 -ar 44100 -af "volume=0.85,alimiter=limit=0.9" output.wav
```

Mobile MP3 music:

```bash
ffmpeg -y -i input.wav -ac 2 -ar 44100 -codec:a libmp3lame -b:a 96k output.mp3
```

OGG loop candidate:

```bash
ffmpeg -y -i loop.wav -ac 2 -ar 44100 -codec:a libvorbis -q:a 4 loop.ogg
```
