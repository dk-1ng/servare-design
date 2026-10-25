# Servare Design — agent instructions

UI/UX design for Servare (Firefox/Chromium MV3 media download extension, `dk-1ng/servare`). Output: research, decisions, a framework-free HTML/CSS/TS prototype on mock data, and a spec that Servare implements. Read `docs/brief.md` first; it is the distilled context for every task.

## Non-negotiable rules

- **Contract first.** Data comes only from `references/ui-contract.md`. Never invent fields; record gaps in `docs/discovery/contract-gaps.md` (they become issues in `dk-1ng/servare`).
- **No framework, nothing remote.** Plain HTML/CSS/TS or Web Components. No CDN, remote fonts, icons or scripts (MV3 CSP). System font stack, local SVG.
- **i18n.** No user-facing string in markup or code: keys in `prototype/_locales/{en,pt_BR}/messages.json` (WebExtensions format). Logical CSS properties (`margin-inline`, `padding-block`) for future RTL.
- **Accessibility:** WCAG 2.2 AA, keyboard operable, visible focus, `prefers-reduced-motion`, light and dark themes.
- **Original visual language.** Never copy other download extensions or brand design systems. Third-party assets only under MIT-compatible licenses, listed in `THIRD_PARTY_NOTICES.md`.
- **Product policy** (from Servare): no YouTube, no DRM/access-control circumvention, no telemetry. Protected media is shown as unavailable and never gets a download action.
- Everything in the repository (code, comments, docs, issues, commits, PRs) is in **English**. Talk to the maintainer in **Brazilian Portuguese**.
- No AI attribution lines (`Co-Authored-By`, "Generated with …") in commits or PRs.

## Context budget

- Read `docs/brief.md` + the files and sections the issue lists under **Inputs**. Do not read whole reference documents unless the issue says so.
- Decisions in `docs/decisions/` are settled; do not reopen them without new evidence.
- Concepts are explained once in `docs/process.md` (glossary). Link to it instead of re-explaining.
- One issue per session. State lives in GitHub (issue comments, project board), not in the chat.

## Tracking

Everything lives on GitHub `dk-1ng/servare-design`: issues, milestones `D0`…`D10` and the "Servare Design" project.
Labels: `type: *`, `ui: *`, `area: contract`, `complexity: high`, `needs: user input`, `status: ready | in progress | awaiting approval | blocked | triage`.

Project: https://github.com/users/dk-1ng/projects/5 · ID `PVT_kwHOE9rcGM4BosX0`
Status field `PVTSSF_lAHOE9rcGM4BosX0zhnLQDU` · options: Todo `99009eb3` · In Progress `b2272c5b` · Awaiting Approval `e9c427a7` · Done `f3aac9a7`

## Model routing

The main session is expected to run on **Sonnet** (`/model sonnet`). It orchestrates, does small issues inline and delegates the rest to the agents in `.claude/agents/`:

| Agent             | Model                                                | Use for                                                                                          |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ux-architect`    | Opus                                                 | `type: research`/`spike`, flows, information architecture, layout decisions, ADRs, contract gaps |
| `visual-designer` | Opus                                                 | Moodboard from reference images, visual direction, tokens, palette and contrast, icon/logo       |
| `prototyper`      | Sonnet (pass `model: "opus"` for `complexity: high`) | Wireframes in HTML, components, mock client, pages, tooling                                      |
| `ux-writer`       | Sonnet                                               | UI copy en/pt-BR, tone of voice, error messages, pseudo-localization                             |
| `qa-auditor`      | Sonnet                                               | Playwright screenshots, axe, keyboard, no-network and long-text checks                           |
| `reviewer`        | Opus                                                 | Reviewing every branch before the PR                                                             |
| `tracker`         | Haiku                                                | Labels, project cards, status comments                                                           |

Subagents start without this conversation's context: delegate only when the task is large or needs a different model, and give them the issue number, branch and any decision already made.

If the main session runs on Opus and the next issue does not need Opus, tell the maintainer **before starting** and suggest `/model sonnet`. If it runs on Sonnet and the issue needs Opus, delegate instead of asking to switch.

## When asked to "continue"

1. **Pending approval first:** `gh issue list -R dk-1ng/servare-design --state open --label "status: awaiting approval"`. If any, show its PR link and ask the maintainer for approval or feedback before anything else.
2. Find the issue: resume the one labeled `status: in progress` (read its last comment to see where it stopped), otherwise the lowest-numbered open issue in the earliest open milestone, skipping `status: blocked`:
   `gh issue list -R dk-1ng/servare-design --state open --milestone "<milestone>" --json number,title,labels`
   If it has `needs: user input`, ask the maintainer for that input first.
3. Check model routing; warn if needed.
4. `tracker`: mark the issue in progress. Main session: branch `<type>/<n>-short-description` from an up-to-date `main`.
5. Route the work:
   - `type: research` / `spike`, flows, IA, ADRs → `ux-architect`;
   - visual direction, tokens, icon → `visual-designer`;
   - prototype code and tooling → inline, or `prototyper` when it spans many files;
   - copy and translations → `ux-writer`.
6. Verify: `pnpm check` (once tooling exists) and every acceptance criterion; `qa-auditor` for visual changes.
7. `reviewer` on the branch. On `CHANGES REQUESTED`, fix and review again.
8. Open the PR (`Closes #N`, template filled in, screenshots), then `tracker` sets `status: awaiting approval` and moves the card.
9. **Explain the PR to the maintainer in Portuguese** (format below) and stop. Answer questions in this same session, from context; open files only when a question needs something not already loaded.
10. After explicit approval: squash merge, update local `main`, `tracker` marks done. Suggest `/clear` and "continue".
11. If the session must stop mid-task, `tracker` posts a comment with the exact state (done, missing, files touched, next step).

### PR explanation format (chat only, pt-BR, ≤ ~15 lines)

- **O que mudou** — the deliverable in one or two sentences.
- **Por quê** — the reasoning and the alternatives discarded.
- **Conceito aplicado** — the design concept, linked to `docs/process.md`. Explain it in depth only the first time it appears; later, only link it.
- **Onde ver** — files, screenshots or the page to open.

## Skills and external resources

Install third-party skills project-scoped (`.claude/skills/`) and only in the milestone that uses them, after reading their `SKILL.md`. Approved list and where each fits: `docs/process.md#tools`.
