#!/usr/bin/env python3
import argparse
import json
from datetime import date
from pathlib import Path


def write_if_missing(path: Path, text: str) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap a free-first game audio workspace.")
    parser.add_argument("project_root")
    parser.add_argument("--game-name", default=None)
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    game = args.game_name or root.name
    today = date.today().isoformat()

    created = []
    for folder in [
        root / "audio" / "source",
        root / "audio" / "generated",
        root / "audio" / "exports",
        root / "public" / "assets" / "audio" / "sfx",
        root / "public" / "assets" / "audio" / "music",
        root / "docs" / "context",
        root / "docs" / "audio",
    ]:
        if not folder.exists():
            folder.mkdir(parents=True, exist_ok=True)
            created.append(str(folder))

    manifest = {
        "version": "0.1.0",
        "game": game,
        "source": "free-local",
        "layers": {},
        "sfx": {},
        "budget": {
            "max_initial_pack_mb": 10,
            "max_simultaneous_music_layers": 2,
            "max_simultaneous_sfx": 8,
        },
    }
    manifest_path = root / "public" / "assets" / "audio" / "audio_manifest.json"
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        created.append(str(manifest_path))

    audio_state = f"""# AUDIO_STATE

## {game} Audio Pack - {today}

Goal:
- Establish a free-first audio workspace for music, SFX, adaptive layers, source files, runtime exports, manifest integration, and QA.

Generation route:
- Prefer local procedural/rFXGen-style synthesis, FFmpeg, Audacity, AudioCraft when already installed, and no-cost online generators only with license notes.

Runtime:
- Manifest: `public/assets/audio/audio_manifest.json`
- Runtime audio: `public/assets/audio/`
- Sources: `audio/source/`
- Generated working files: `audio/generated/`
- Final exports: `audio/exports/`

QA:
- Verify manifest references exist.
- Run the project build/check commands.
- Test audio unlock, mute/volume, SFX, music loop, transitions, and mobile/browser behavior.
"""
    if write_if_missing(root / "docs" / "context" / "AUDIO_STATE.md", audio_state):
        created.append(str(root / "docs" / "context" / "AUDIO_STATE.md"))

    decision_log = f"""# AUDIO_DECISION_LOG

## {today} - Free-first audio workspace

- Decision: use the Universal Free Game Audio Director workflow for music and SFX.
- Reason: keep production local/free when possible, with clear license and QA evidence.
- Alternatives: paid audio APIs, unclear third-party samples, or undocumented manual exports.
- Review when: the project adopts a new engine, deploy target, or audio budget.
"""
    if write_if_missing(root / "docs" / "context" / "AUDIO_DECISION_LOG.md", decision_log):
        created.append(str(root / "docs" / "context" / "AUDIO_DECISION_LOG.md"))

    print(json.dumps({"project_root": str(root), "created": created}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
