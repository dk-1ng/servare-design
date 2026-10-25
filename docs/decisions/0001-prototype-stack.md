# 0001. Prototype stack: plain HTML, CSS and TypeScript

- Status: accepted
- Date: 2026-10-25
- Issue: bootstrap

## Context

The prototype should become the starting point of Servare's real UI. Servare has no UI framework today (only zod), and its MV3 Content Security Policy forbids remote fonts, icons and scripts.

## Decision

Build the prototype with plain HTML, CSS and strict TypeScript, using Web Components for reusable parts. Use system fonts and local SVG. Read data only through a mock client that mirrors the contract's `PortClient` (requests plus `media/updated` and `job/updated` events), with fixtures taken from the contract's JSON examples. Keep strings in WebExtensions `_locales/<lang>/messages.json` files.

## Alternatives considered

- React, Svelte or another framework would make the stack decision for Servare. That decision belongs in `servare/docs/design.md`.
- Figma or Penpot mockups would need a manual translation step into code, and the maintainer does not work in visual tools.

## Consequences

Components can move into Servare as they are, and replacing the mock client with the real `PortClient` needs no component changes. In return, the reactive rendering is ours to write, so it stays deliberately small.
