# 0002. Separate design repository, merged later

- Status: accepted
- Date: 2026-10-25
- Issue: bootstrap

## Context

Servare's repository holds only the data contract ("Visual UI design happens elsewhere"). The maintainer wants design work kept apart while it happens, and unified with the main repository when it is done.

## Decision

Design lives in `dk-1ng/servare-design`, with the same conventions as Servare (Prettier, EditorConfig, strict TS, Conventional Commits, English, a compatible label taxonomy). Milestone D10 merges the history into Servare and transfers the open issues.

## Alternatives considered

- Working inside Servare from the start would mix in-progress design with production code and its CI.

## Consequences

The contract is pinned in `references/` and must be re-pinned when Servare changes it.
