# Homebase (notes-app) — Agent Instructions

## Context

Homebase is a local-first knowledge + tasks app with a timeline-first UI. Notes are stored as Markdown files in a user-controlled vault.

## Current Decisions

- Package manager: pnpm (pnpm workspaces)
- Desktop: Tauri + React + TypeScript (+ Tailwind)
- Editor: TipTap
- Search (v0.x): in-memory index (fast to ship; DB later if needed)

## Testing & Validation

- Add tests for important business rules and non-trivial logic.
- Run tests after meaningful changes; fix failures before concluding.
- If you add meaningful business logic and there’s no test, add one.

## Commands

- Install: `pnpm install`
- Test: `pnpm test`

## Source of Truth

- Product intent: `docs/PRD.md`
- Implementation plan: `docs/PHASES.md`
