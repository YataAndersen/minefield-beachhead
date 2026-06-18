# Design Log: Translating Grid Logic into Tactical Tension

Minefield: Beachhead started from a simple question:

What if Minesweeper felt less like a quiet puzzle and more like a field operation?

The rules still matter. Numbers still tell the truth. The player still has to read the board. But the presentation, pacing, and feedback are tuned to make every click feel like a tactical decision instead of a casual guess.

## Focus as pressure

Campaign mode adds a Focus meter because pressure needs a body. It drains as the operation continues, drops harder when the field punishes you, and turns hesitation into part of the run.

Focus is not just health. It is the Operator's ability to keep reading the battlefield.

## SCAN as emergency information

SCAN exists for the moment when logic is still possible, but the board feels too loud. It gives a read on safe signals, but it costs Focus, so using it is never free.

The goal is not to remove tension. The goal is to let you trade one kind of risk for another.

## Procedural SFX and small reactions

The audio is procedural so the browser build stays light and responsive. Clicks, markers, SCAN, damage, and explosions are meant to give the board weight without requiring a huge audio package.

The Operator portrait also reacts to play: idle, tense, blinking, damage, and death states all help the UI feel less static. It is a small face in the HUD, but it carries a lot of the game's pulse.

## Mobile portrait first

Phone play forced the biggest design call. Landscape made the board too small, so the mobile layout now prioritizes portrait mode and a larger touch field. The goal is simple: fewer tiny taps, more readable danger.

## What I want feedback on

If you play the Campaign, I would love feedback on three things:

// Does sector 3 make SCAN feel necessary without feeling unfair?
// Does portrait mode feel comfortable on your phone?
// Does the Operator feedback make the board feel more alive?

Play here:
https://yata-andersen.itch.io/minefield-beachhead

