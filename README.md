# Task Tints

Background colours for tasks in [Agent Wrangler](https://github.com/psjamesh/agent-wrangler).

Give each task a hue from a hexagonal colour wheel. Its task-view tile and minimised pill keep that hue, blended with your current theme. The tint preserves the surface's transparency; theme backgrounds, images and blur continue to show through.

## Install

Requires Agent Wrangler host API **1.53.0 or later within 1.x** and a browser with relative CSS colour support.

Open **Settings → Extensions → + Add extension → Git URL** and paste:

```text
https://github.com/psjamesh/agent-wrangler-task-tints
```

Review the extension and install it. There are no runtime dependencies.

## Use

1. Open a task's **⋮** menu or right-click its tile, then choose **Colour…**.
2. Pick a hexagon on the wheel. The colour saves immediately.
3. Choose **Reset** to restore that task's current theme colour.

Use the arrow keys to move around the wheel, Enter or Space to choose, and Escape to close it. Unassigned supports **Colour…** through its right-click menu. Restore a minimised task to change its colour.

Colours are shared across browsers connected to the same installation. They survive refreshes, restarts, renaming and archiving. Deleting a task removes its saved colour. Turning the extension off keeps saved colours and restores ordinary theme surfaces; turning it on restores the tints.

The extension tints task tiles and Agent Wrangler's standard minimised pills. Extensions that replace the tray control their own appearance. Session cards, status indicators, terminals and chat keep their own colours.

## Theme compatibility

The tint changes the RGB channels of the theme's `--tile-bg` and `--pill-idle-bg` colours and keeps their original alpha using [relative CSS colours](https://www.w3.org/TR/css-color-5/#relative-RGB). A 50% opaque surface stays 50% opaque, and a fully transparent surface stays fully transparent. Background images, borders, drag indicators and backdrop filters remain owned by the theme and host.

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
