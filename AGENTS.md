# Homebase (notes-app) — Agent Instructions

## Context
This repo is building **Homebase**: a local-first knowledge + tasks app with a timeline-first UI.

Primary goals for v0.x:
- Fast, calm, keyboard-first note capture.
- Notes stored as **Markdown files** in a user-controlled vault folder.
- First-class **Projects**, **Folders**, and **Tasks** (Tasks can be embedded and managed inside notes).
- No AI features yet (AI auto-organization + chat come later).

## Non-Goals (for now)
- Do not implement AI auto-organization or chat assistant.
- Do not overbuild “enterprise” features (sync, auth, collaboration, multi-device).
- Do not add complex fallback systems unless explicitly required.

## Working Style
- Prefer the smallest correct implementation that supports the current phase goals.
- Avoid overengineering: keep abstractions minimal until duplication appears.
- Bias toward readable, testable code over cleverness.
- When the spec is ambiguous, stop and ask the user targeted questions before committing to a design that’s hard to change.

## Tech Decisions (current)
- Package manager: **pnpm**
- Use **pnpm workspaces** (monorepo-friendly; future backend/mobile possible).
- Desktop app: **Tauri + React + TypeScript**
- Editor: **TipTap**
- Initial search: **in-memory** (upgrade later to SQLite/FTS once UX is validated).

## Product Rules (business logic)
- Notes have **one home location** (filesystem path) and **many relationships** (projects/topics/people/links).
- If a user creates a note in a folder/project or manually moves it, the note is **user-placed** (do not auto-move it).
- Tasks:
  - Plain markdown checkboxes are lightweight checklist items.
  - A checklist item can be **converted to a Task entity** and managed via a task details UI (due date, assignee, etc.).

## Testing Requirements
- Add tests for important business rules and any non-trivial logic.
- Prefer unit tests for:
  - note/task parsing + serialization rules
  - link/ID mapping behavior
  - task conversion + sync behavior
  - vault path + file layout rules
- Prefer integration tests where it’s cheap and valuable (e.g., note save/load round-trip).

## Validation Discipline
- Run tests after meaningful changes.
- If tests fail due to your change, fix them before concluding work.
- If adding a feature with meaningful business logic and there’s no test, add one.

## Commands (update as project scaffolding lands)
- Install: `pnpm install`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Format: `pnpm format`

## Source of Truth
- Product intent: `docs/PRD.md`
- Implementation plan: `docs/PHASES.md`
