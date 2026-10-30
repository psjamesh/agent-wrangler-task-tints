# Task Tints

Background colours for tasks in [Agent Wrangler](https://github.com/psjamesh/agent-wrangler).

Give each task a hue from a hexagonal colour wheel. Its task-view tile, session cards and minimised pill keep that hue, blended with your current theme. Keep the theme's transparency or adjust it towards transparent or opaque. Theme backgrounds, images and blur continue to show through.

## Install

Requires Agent Wrangler host API **1.53.0 or later within 1.x** and a browser with relative CSS colour support.

Open **Settings → Extensions → + Add extension → Git URL** and paste:

```text
https://github.com/psjamesh/agent-wrangler-task-tints
```

Review the extension and install it. There are no runtime dependencies.

## Use

1. Open a task's **⋮** menu or right-click its tile, then choose **Colour…**.
2. Pick a hexagon on the wheel to preview it on the board. Click it again, or click outside the picker, to save it. The × button and Escape discard the preview.
3. Reopen **Colour…** to adjust **Transparency**. Drag to preview; releasing saves and keeps the picker open. The centre uses **Theme default**, with gentle changes nearby and stronger changes towards the ends.
4. Choose **Reset** to restore that task's current theme colour and transparency.

Use the arrow keys to move around the wheel, Enter or Space to choose (twice to save), and Escape to close it. Unassigned supports **Colour…** through its right-click menu. Restore a minimised task to change its colour.

Transparency can also be adjusted without choosing a hue. Picking another hue keeps the task's transparency adjustment.

Colours and transparency adjustments are shared across browsers connected to the same installation. They survive refreshes, restarts, renaming and archiving. Deleting a task removes its saved choices. Turning the extension off keeps those choices and restores ordinary theme surfaces; turning it on restores the tints.

The extension tints task tiles, their session-card bodies, child/worker and snoozed rows, and Agent Wrangler's standard minimised pills. Card bodies keep the task hue when selected; theme status colours identify state through the bars and surrounding halos. Extensions that replace the tray control their own appearance. Chat keeps its own colours.

Settings › Extensions › Task Tints has two toggles, applied as soon as they change. **Tint cards** (on by default) controls the card and row tint and border. **Tint session views** (off by default) gives the open session's panel (header, terminal and chat) and diff view a subtle wash of its task's colour. Tasks without a colour are never washed.

## Theme compatibility

The tint changes the RGB channels of the theme's `--tile-bg`, `--pill-idle-bg`, and card `--surface`/`--surface-2` colours using [relative CSS colours](https://www.w3.org/TR/css-color-5/#relative-RGB). At **Theme default**, each surface keeps its original alpha exactly, including fully transparent surfaces. Hover uses the tinted hover surface; selected cards keep the task tint and the theme's selection ring.

The transparency slider saves a position relative to each surface's theme opacity. Its effect follows a curve that favours the theme default: halfway along makes a quarter of the possible change. A 50%-opaque surface becomes 37.5% towards transparent or 62.5% towards opaque. The ends reach full transparency or opacity, and the readout shows the effective percentage towards that endpoint. Switching themes recomputes the result from that theme's defaults, independently for tiles, cards and pills. Background images, borders, drag indicators and backdrop filters remain owned by the theme and host.

State lives in `hues.json` inside `AW_DATA_DIR`, defaulting to `~/.agent-wrangler/hues.json`. Writes replace the state file atomically. The extension requests task read access and board rebuild/broadcast capabilities; it does not modify core task data.

## Development

```sh
npm ci
npm test
```

To include the real Agent Wrangler loader and slot integration test:

```sh
AW_SOURCE=/path/to/agent-wrangler npm test
```

To preview the actual picker with the host's styles, extension loader, built-in theme colours and an isolated temporary store:

```sh
AW_SOURCE=/path/to/agent-wrangler node test/serve-preview.js
```

Open `http://127.0.0.1:43827`. The preview supports theme switching, minimising/restoring and disabling/re-enabling the extension. Set `HUES_PREVIEW_PORT` to choose another port. It does not connect to your live board or change its tasks.

MIT licensed.
