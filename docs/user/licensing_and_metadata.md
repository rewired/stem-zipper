# Licensing and metadata workflow

Stem ZIPper collects pack metadata through the **Metadaten/Metadata** button in the top action bar. The modal can be opened at any time and appears automatically after a folder scan when the required fields are still empty.

## Required fields

* **Title**
* **Artist**
* **License** — choose one of CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, or CC-BY-NC-4.0

The pack action prompts for missing values and stays disabled until all three fields are complete. Optional fields cover album/collection, BPM, key, attribution, artist URL and contact e-mail. The attribution field is auto-suggested based on the current title and artist, but can be edited freely.

## Default artist memory

When saving the modal, the artist can be remembered as the default value (enabled by default). The remembered name is stored in the Electron main process and reused the next time the modal opens. The last five artists are tracked for quick selection.

## Files written into each ZIP

Every pack now embeds the collected metadata:

* `PACK-METADATA.json` — contains the structured metadata fields that were provided.
* `LICENSE.txt` — links to the Creative Commons license matching the chosen identifier.
* `ATTRIBUTION.txt` — contains the explicit attribution or, if omitted, a fallback in the form `Artist — Title`.
* `_stem-zipper.txt` — gains a `[Metadata]` section listing the captured values together with the pack timestamp, app version and locale.

These files are added to every generated ZIP archive alongside the usual stems and the Stem ZIPper stamp.
