# Task Tints

Status: task menu entry, hexagonal colour wheel, Reset and theme-relative transparency control implemented.

## Purpose

Task Tints is an installable Agent Wrangler extension that lets the human give each task a recognisable background colour. The same chosen hue identifies the task in task view and in the minimised task tray. Colours are a personal organisation aid and carry no fixed meaning.

The repository is `https://github.com/psjamesh/agent-wrangler-task-tints`. The extension id is `hues` and its visible name is **Task Tints**.

## Confirmed scope

- Choose a background colour for an individual task in task view.
- Show the same hue when that task is minimised.
- Adjust task transparency relative to each surface's current theme default.
- Decide the picker appearance and entry point as part of this design.
- Create the repository in the `psjamesh` namespace.

## Interaction

Add **Colour…**, with a monochrome paintbrush icon, to the existing task header `⋮` menu and the task's right-click menu. Use the existing `task.action` extension slot. The Unassigned tile receives the action through its existing right-click menu; core does not expose extension actions in its header menu.

Open a small labelled picker beside the task header. Its title is **Task colour**, with the task name below it. Clamp it inside the viewport and use a compact dialog presentation on a small screen. The user specified a colour wheel made from hexagonal sections and a Reset button.

The picker contains:

- A honeycomb colour wheel: hue varies around its centre and saturation increases towards the outside. The centre is neutral. The builder chooses the density to keep the picker compact and usable.
- A visible check on the current choice and accessible colour descriptions. Arrow keys navigate the sections and Enter/Space selects one.
- A transparency slider centred on **Theme default**, with **More transparent** and **More opaque** ends. Dragging previews locally; releasing saves and keeps the picker open. It works without a selected hue.
- **Reset**, removing the task's saved colour and transparency adjustment and restoring the current theme surface.

A section click applies and saves its colour immediately, preserves any transparency adjustment, then closes the picker. Escape or an outside click closes and discards any unsaved slider preview. Return focus to the triggering task menu button when possible. There is no native colour dialog or separate custom-colour flow.

There is no Save button. A save failure retains the last confirmed colour and displays a short error; closing the picker must not turn a failed write into an apparent success. A minimised task can be restored and recoloured through the same task menu.

## Appearance

Store an optional RGB seed and relative opacity adjustment per task. Tint the existing theme's task surface and minimised-pill surface with 18% of that seed. At the slider's default, preserve each surface's original alpha exactly. Relative CSS colour channels alter RGB while retaining the source `alpha`; do not add an opaque background layer.

Save the slider as an integer adjustment from -100 to 100. For negative adjustments, multiply the theme alpha by `1 + adjustment / 100`. For positive adjustments, use `alpha + (1 - alpha) * adjustment / 100`. Zero leaves alpha unchanged. Apply the calculation independently to the tile and pill defaults. A task with only a transparency adjustment retains the theme RGB channels.

Changing the theme recomputes the appearance from the same seed and adjustment using the new theme's defaults, background images and backdrop filters. Text, borders, session cards, session status dots and status bars keep their theme colours and core's focus, drag and restore indicators. Task names remain visible in both representations; colour is an additional cue.

Terminal backgrounds, terminal text, chat backgrounds, the global board background and task ordering are outside this version. There are no colour categories, automatic colour assignment, tint-strength controls or global palette settings.

## Storage and synchronisation

Colours belong to the task on this Agent Wrangler installation. They survive browser refreshes, minimising/restoring, task renaming and server restarts, and are shared across browsers connected to that installation.

Keep extension-owned state in `<AW_DATA_DIR>/hues.json`, respecting Agent Wrangler's default data-directory behaviour. Save atomically and update in-memory state only after a successful write. Validate task ids against the host's task projection and accept only canonical six-digit hexadecimal RGB values, a relative opacity integer from -100 to 100, or an explicit reset. Each control changes only its own field for one task, preserving other tasks and fields. Reset clears both fields. Version 2 stores both maps and reads version 1 colour-only state with default transparency.

Expose the colour and opacity-adjustment maps in the extension's graph contribution. A control handler saves one field, requests a graph rebuild and acknowledges the originating request. Other connected boards receive the updated graph. The graph is authoritative: an acknowledgement only finishes the pending request and never overwrites newer graph state. Include a request id so acknowledgements and errors cannot affect a different pending edit. A failed transparency save discards its preview and displays the latest confirmed graph state.

Keep archived tasks' colours so restoring a task preserves its colour. Remove a task's entry when that task is deleted, using `onTaskDelete`. Reconcile stored ids against all existing tasks when contributing the graph, covering deletion while disabled without losing archived colours. Disabling Task Tints restores normal theme surfaces and removes its picker and menu actions while retaining saved colours. Re-enabling restores them.

## Integration

Use an ES-module extension with matching `package.json` and runtime manifests. Follow the existing extension conventions, including an explicit host API version range and declared `tasks:read`, `board:rebuild` and `board:broadcast` capabilities. No task-write capability is needed: Hues owns its own state.

Core already provides `task.action`, `task.body` and the DOM identity of task tiles and standard minimised pills. Use `task.action` for the entry point and the mounted `task.body` lifecycle for graph updates and cleanup. An extension-owned stylesheet can target `.task-cell[data-taskid]`, `.task-cell.no-task` and `.switcher-pill[data-taskid]` using validated/escaped ids. Keep it extension-owned so unloading restores core styling; do not rewrite core DOM or replace the tray. Check rendering against the actual host implementation before treating selectors as stable. Close the picker when its task disappears, preserving it across ordinary replacement renders of the same task.

The first version covers core's minimised task pills. Other extensions may replace the tray with their own UI. Task Tints must coexist with them without claiming tray ownership or styling their unrelated controls. Supporting a replacement tray that represents individual tasks may require a shared appearance hook; that integration is a separate decision.

The builder may choose the module layout, exact palette values, animation and tint percentages after checking dark and light themes. Keep runtime dependencies small and avoid unnecessary comments.

## Verification

- Validate reset, invalid colours, unknown tasks and atomic persistence failures.
- Check that concurrent edits to different tasks preserve both colours.
- Verify refresh/restart persistence, rename, minimising/restoring, archive/restore and delete cleanup.
- Exercise the actual host's extension loader, task menu and `task.body` lifecycle where practical.
- Check hexagonal-section selection, Reset, Escape, outside-click dismissal, arrow-key navigation, keyboard focus and save errors.
- Verify tile and minimised-pill appearance in dark, light and translucent themes, including exact default alpha preservation, relative adjustments, theme changes, readable labels and unchanged session status indicators.
- Disable/re-enable Task Tints and confirm its menu, picker and styling are removed/restored cleanly.

## Visual reference

The current implementation and screenshots are the visual reference for the hexagonal picker. The picker uses the host theme for its own surface and text.
