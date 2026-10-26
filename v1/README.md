# ¡Chucuchú!

Classroom train race for Spanish lessons, shown on a projector and driven by one person at the laptop.
Teams pick a difficulty (1–10), answer a Spanish question, and their toy train moves forward by that many fields.
Wrong answer = the train stays. The game ends after the chosen number of rounds; the farthest train wins.

- 3D toy world (three.js r170, vendored in `vendor/`), 2D toy UI on top.
- 520 A1 questions in 13 topics, 4 per difficulty level per topic (`js/questions.js`). Topic picker on the start screen: one topic, several, or Mix.
- Difficulty 1–5: ABCD (click the letter the team says). 6–10: open answers (reveal, then mark ✓/✗).
- Power-ups come from `?` crates above the tracks, and from 3 bonus tiles on the difficulty grid each round (awarded for a correct answer):
  Turbo, Minigun (shoots piñatas next to the track, +1 field each), 50/50, Otra vez, Semáforo, Robo de carbón, Cambio de vía, Escudo.
- Undo last turn, edit team names/colours/fields mid-game, autosave in `localStorage` (resume after a refresh).

## Run

Any static server from the project root, e.g.

```bash
python3 -m http.server 8743
```

then open `http://localhost:8743`. ES modules need http, `file://` will not work.

## Keys

`Space`/`Enter` next · `1`–`0` difficulty · `A`–`D` answer · `T`/`N` correct/wrong · `M` menu · `F` fullscreen · `Esc` close menu

## Question format

One line per question: `<difficulty> <type> <prompt> = <answers>`.
Types: `?` choose, `>` translate PL→ES, `_` fill the gap (`___`), `#` write the number, `~` conjugate.
ABCD: options separated by ` | `, the first one is correct (shuffled in game). Open: accepted answers separated by ` / `.

## Credits

Fonts: Lilita One and Fredoka (SIL Open Font License), self-hosted in `fonts/`.
three.js: MIT.

Sounds, all CC0 from freesound.org (trimmed and normalised):

| File | Sound | Author |
| --- | --- | --- |
| toot | [toy train toot.mp3](https://freesound.org/s/196632/) | FuriousGinger |
| bell | [toy train bell.mp3](https://freesound.org/s/196631/) | FuriousGinger |
| whistle | [Toy Train Whistle Soft.aif](https://freesound.org/s/162817/) | timgormly |
| chug | [R20-40-Constant Steam Train.wav](https://freesound.org/s/480820/) | craigsmith |
| correct | [Correct Bell](https://freesound.org/s/538147/) | Fupicat |
| wrong | [Wrong Answer](https://freesound.org/s/648462/) | -Andreas |
| powerup | [Bouncing Power Up 1_4](https://freesound.org/s/478343/) | Joao_Janz |
| pop | [Pop sound](https://freesound.org/s/202230/) | deraj |
| fanfare | [Success Fanfare Trumpets.mp3](https://freesound.org/s/456966/) | FunWithSound |
| applause | [Short applause.wav](https://freesound.org/s/529455/) | johntrap |
| tick | [single-tick.wav](https://freesound.org/s/668355/) | DeltaCode |
| click | [PlasticMouseClick](https://freesound.org/s/734219/) | NoisyRedFox |
| boing | [Boing 2](https://freesound.org/s/540790/) | magnuswaker |
| squeak | [Squeaky Toy 7](https://freesound.org/s/861825/) | qubodup |
| pew | [Retro, Pew Shot.wav](https://freesound.org/s/459145/) | LilMati |
| minigun | [Minigun Fire](https://freesound.org/s/500304/) | Bratish |
