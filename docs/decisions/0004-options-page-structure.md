# 0004. Options page structure and site rules editor model

- Status: proposed
- Date: 2026-10-25
- Issue: #10

## Context

The options page (contract §4.4, servare M5) edits seven `Settings` fields and a list of per-domain `DomainRule`s (design §6). Most users only need to change where files go and what they are called; several settings and most rule keys are technical (`failureThreshold`, `propagateQuery`, `hideFragments`). Every `DomainRule` key is optional and "falls back to the default", but the defaults of most keys are not documented (G18). `settings/set` takes a `Partial<Settings>`; `rules/set` takes a whole rule for one domain. Details in [`options-history-ia.md`](../flows/options-history-ia.md) §2–§3 and §5.

## Decision

1. **One page, six sections in fixed order:** Saving files (`subfolder`, `saveAs`, `nameTemplate`), Languages (`preferredLanguages`), Download speed (`speedProfile`), Audio only (`mp3Quality` presets), Site rules, Advanced (`failureThreshold`, exact `mp3Quality`), the last one collapsed. In-page navigation links to each section and to History.
2. **Settings save per field, on change.** Each committed change sends `settings/set` with that field and re-renders from the returned `Settings`; `invalid-payload` issue paths map to inline field errors. No global Save button.
3. **Rules are edited as a unit with an explicit Save.** List sorted by domain, editor with Save/Cancel, domain read-only once created (rename = remove and add), Remove without confirmation but with Undo (re-send the removed rule).
4. **A missing rule key means "Default", and the editor preserves that.** Each key is Default / On / Off (or a value). The editor writes only keys the user set and deletes a key when the user picks Default; it never copies current defaults into a rule. `speedProfile`'s default is shown as the global setting's value; other defaults are shown as "Default" until G18 documents them.
5. **Basic layer:** all of Saving files, Languages, Download speed, MP3 presets, and the rule keys `detection`, `audioOnly`, `speedProfile`. **Advanced layer:** `failureThreshold`, exact `mp3Quality`, and the rule keys `minDirectSize`, `hideFragments`, `feedMode`, `propagateQuery`.

## Alternatives considered

- **Two pages or tabs (General / Advanced).** Hides advanced settings well, but splits related fields (MP3 presets vs exact level, speed vs per-site speed) and adds navigation for seven fields.
- **A single global Save button for settings.** Familiar from web forms, but unsaved edits get lost when the tab closes, and `settings/set` already accepts one field at a time.
- **Rule keys as plain checkboxes that always write a value.** Simpler controls, but a rule would freeze every default at the moment it was saved, so later changes to servare's defaults would not reach that site, and the user could not tell an override from a default.
- **Rule key controls as three-way radio groups.** Most discoverable, but seven groups make the editor long for a power-only feature; a native `<select>` per key is one tab stop and keyboard-native.

## Consequences

- The rules editor needs to show "Default" honestly without knowing its value until servare answers G18.
- Auto-save needs a clear, polite "Saved" status and per-field error handling; the prototype's mock client must reproduce `invalid-payload` issue paths.
- The MP3 presets (0 / 2 / 5) are a UI-only mapping; a stored value outside them is shown as "Custom (level N)".
- The page must be designed for 320 CSS px reflow, where the rule editor replaces the list instead of sitting beside it.
