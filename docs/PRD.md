# Homebase — Product Requirements Document

## Vision

**Homebase** is your personal knowledge and productivity system that organizes itself. Capture notes, ideas, and tasks freely — AI handles the structure, connections, and retrieval.

> "Just write. Homebase figures out where it belongs."

### The Problem

Existing tools force a tradeoff:
- **Apple Notes / simple tools**: Frictionless capture, but becomes a graveyard. No structure, hard to find things later.
- **Notion / Obsidian / complex tools**: Powerful organization, but requires discipline. You become a librarian instead of a thinker.

### The Solution

Homebase gives you **frictionless capture + intelligent structure**:
- Write notes without thinking about where they go
- AI automatically categorizes, tags, and connects your content
- A unified timeline shows everything, organized by context
- An AI assistant that actually *knows* your knowledge base

---

## Core Concepts

### Philosophy

1. **Capture freely** — No friction to getting thoughts down
2. **AI organizes** — You don't file, the system does
3. **Query naturally** — Ask questions about your own knowledge
4. **Own your data** — Local-first, markdown files you control

### Key Differentiators

| Traditional Tools | Homebase |
|------------------|----------|
| You create the structure | AI creates the structure |
| You file notes into folders | Notes flow into inbox, AI sorts them |
| You manually link related content | AI suggests and creates connections |
| Search by keywords | Ask questions in natural language |

### Ownership & Trust Model

Homebase must feel safe and predictable. These rules define what the system can change automatically.

**A note has one home, many links:**
- Every note has a single **home location** (a filesystem folder/path where the markdown file lives).
- Notes can have many **relationships** (projects, people, topics, backlinks).

**User intent is respected:**
- If a user creates a note directly inside a folder/project, or manually moves a note, that note is considered **user-placed**.
- AI may still add metadata/relationships, but **file moves for user-placed notes are suggestion-only**.
- If a user manually adds/edits relationships (projects/people/topics), those are considered **user-owned** and should not be removed or overridden automatically (AI can suggest changes).

**AI can auto-apply safe metadata:**
- AI can auto-apply topics and relationships (e.g., people/project links) to changed notes.
- Any structural changes that affect where a note lives (moving files, creating/merging folders/projects) start as **suggestions requiring explicit approval**.

**Links never break on move/rename:**
- UI uses `[[wikilinks]]` and `@mentions`, but relationships are stored as stable IDs under the hood so moving/renaming files does not break links.

---

## Entities & Data Model

### MVP Entities

#### Note
The atomic unit of content.
- Rich text content (markdown-based)
- Stable ID (never changes)
- Created timestamp
- Modified timestamp
- **Home location** (derived from file path; where the markdown file lives)
- **Relationships** (many-to-many):
  - Projects (0..N)
  - Topics (0..N)
  - People (0..N, optional for MVP)
- AI-generated: topics, relationship suggestions, connections (with provenance + confidence)

#### Project
A container with a goal and end state.
- Name
- Description
- Status (active, paused, completed, archived)
- Optional filesystem home (a project can have a folder path for export-friendly organization)
- Related notes
- Related tasks
- Timeline of activity

#### Task
First-class citizen for actionable items.
- Title
- Description (optional)
- Status (todo, in_progress, done)
- Priority (low, medium, high, urgent)
- Due date (optional)
- Reminder (optional)
- Assigned person (optional)
- Parent note (if created from within a note)
- Parent project (optional)

Tasks can be created in two ways:
- **Inline from notes** (convert a checkbox into a task widget/entity)
- **Standalone in Tasks view** (optionally link back to a note)

#### Topic
Thematic tags, primarily AI-suggested.
- Name
- Related notes
- Can be manually created or AI-generated

#### Person (Nice to have for MVP)
People you reference or interact with.
- Name
- Related notes
- Related tasks (assigned to them)
- Related projects

### Post-MVP Entities

#### Area
Ongoing areas of responsibility with no end state (e.g., "Health", "Finances", "Career").

#### Goal
Higher-level aspirations that projects contribute to.

#### Source
Origin of information (book, article, conversation, etc.).

---

## Features

### MVP Features

#### 1. Rich Text Editor
- WYSIWYG editing experience
- Markdown support under the hood
- Headers, lists, checkboxes, links
- Inline task creation
- Clean, minimal aesthetic (Linear + Notion warmth)
- Fast and responsive

#### 2. Note Management
- Create notes from anywhere
- Default landing: Inbox
- Can also create directly in a project or folder (this is considered **user-placed**)
- Apple Notes-like folder structure for manual organization
- Notes can exist in multiple contexts via relationships (e.g., one home folder, linked to multiple projects/people/topics)

#### 3. Inbox
- Default destination for new notes
- Chronological stream of uncategorized content
- AI processes inbox items and suggests organization; safe metadata can be auto-applied
- Can manually move items out of inbox

#### 4. Unified Timeline View
Primary home view showing activity across time:

```
Week of Jan 13
├── Monday, Jan 13
│   ├── Quick thought about API design
│   ├── [Project: Homebase] ← visual cluster
│   │   ├── PRD brainstorm session
│   │   └── Research on Tauri
│   └── Journal: Feeling productive today
├── Tuesday, Jan 14
│   └── [Project: Papertrail]
│       └── Bug investigation notes
...
```

Features:
- Group by day or week
- Visual clustering by project context
- Filter to single project's timeline
- Expandable/collapsible sections

#### 5. Project Management
- Create and manage projects
- Project detail view with:
  - Description
  - Status
  - Related notes (timeline view)
  - Related tasks
  - Activity feed
- Project-filtered timeline view

#### 6. Task Management
Separate tasks view aggregating all tasks:
- Filter by: status, priority, project, person, due date
- Sort by: due date, priority, created date
- Quick task creation
- Task detail panel:
  - Title & description
  - Priority selector
  - Due date picker
  - Reminder setting
  - Project assignment
  - Person assignment
- Inline task creation from notes (creates linked task)

#### 7. AI Auto-Organization
Background processing that organizes your content:

**Quick Pass (every 2-5 minutes or on change):**
- Analyze new/modified notes
- Assign topics (auto-apply)
- Add relationships (auto-apply where safe; track provenance)
- Suggest project association (as a relationship; auto-apply allowed)
- First-pass categorization

**Deep Pass (hourly):**
- Review recent changes holistically
- Find connections between notes
- Propose structural reorganization if needed (moves, new folders/projects, merges) **as suggestions**
- Identify patterns and clusters

AI suggestion workflow:
- Suggestions include a confidence score and human-readable justification (why it thinks this belongs in X).
- Suggestions are reviewed per-note (in the note’s metadata/suggestions panel) and in a global review/notifications queue.
- Structural changes (moving files, creating/merging folders/projects) require explicit user approval in v1.

#### 8. Chat Assistant
Always-available AI assistant at bottom of screen:
- Query your knowledge base naturally
- "What did I write about X?"
- "Summarize my notes on project Y"
- "What tasks are due this week?"
- "What do I know about [topic]?"

When not in active conversation:
- Collapsed/minimal view
- Quick access to recent notes
- Suggested queries based on recent activity

#### 9. Folder Structure
Apple Notes-like sidebar navigation:
- Inbox
- All Notes
- Projects (expandable)
- Topics (expandable)
- Folders (user-created, optional manual organization)
- Tasks
- People (if implemented)

### Post-MVP Features

#### Phase 2: Connections & Intelligence
- Suggested connections between notes
- "Related notes" panel when viewing a note
- Visual graph exploration view
- Smarter topic clustering

#### Phase 3: Research Assistant
- Powerful agent capabilities
- Can perform research tasks
- Web search integration
- "Research [topic] and add to my knowledge base"
- Long-running background tasks

#### Phase 4: Sync & Collaboration
- Cloud sync (paid tier)
- Cross-device access
- Optional: shared projects

#### Phase 5: Extended Entities
- Areas (ongoing responsibilities)
- Goals (high-level aspirations)
- Sources (track where knowledge came from)
- Full People entity with relationship tracking

---

## User Experience

### Primary Views

#### Home / Timeline
- Default landing after launch
- Unified timeline of all activity
- Chat assistant collapsed at bottom
- Quick capture button (floating)

#### Note Editor
- Full-screen or panel view
- Rich text editing
- Metadata sidebar (project, topics, related items)
- AI suggestions non-intrusive

#### Project View
- Project header (name, description, status)
- Tabbed content: Notes | Tasks | Timeline
- Project-specific actions

#### Tasks View
- List of all tasks
- Powerful filtering and sorting
- Inline editing
- Bulk actions

#### Chat / Assistant
- Expandable from bottom bar
- Full conversation history
- Can reference notes and tasks in responses
- Action buttons for suggested follow-ups

### Design Principles

1. **Minimal** — No clutter, content-first
2. **Crisp** — Sharp typography, clear hierarchy (Linear-inspired)
3. **Warm** — Subtle colors, not sterile (Notion-inspired)
4. **Fast** — Instant response, no loading states for local ops
5. **Calm** — AI works in background, never intrusive

### Key Interactions

- **Quick capture**: Cmd+N from anywhere → lands in inbox
- **Quick task**: Cmd+T → create task inline
- **Quick search**: Cmd+K → search notes, tasks, projects
- **Quick chat**: Cmd+/ → focus chat assistant
- **Link creation**: `[[wikilinks]]` and `@mentions` create ID-backed links (robust to rename/move)

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Desktop Shell | Tauri | Lightweight (~10MB), Rust backend, native performance |
| Frontend | React + TypeScript | Fast development, rich ecosystem |
| UI Framework | TBD (Tailwind + custom) | Flexibility for custom design |
| Editor | TipTap or Plate | Rich text editing with markdown support |
| Local Storage | Markdown files | User owns their data, portable |
| Index/Search | SQLite | Fast queries, relationships, full-text search |
| AI | Claude API | Best reasoning for unstructured text |

### Data Architecture

```
~/Homebase/
├── notes/
│   ├── inbox/
│   │   └── 2024-01-15-quick-thought.md
│   ├── projects/
│   │   └── homebase/
│   │       └── prd-brainstorm.md
│   ├── folders/
│   │   └── personal/
│   │       └── journal-jan.md
│   └── archive/
├── assets/
│   └── <note-id>/
│       └── image.png
├── config/
│   └── settings.json
└── .homebase/
    ├── index.db          # SQLite index
    ├── embeddings.db     # Vector store for semantic search
    ├── ai-state.json     # AI processing + suggestion queue state
    └── chat-history.json # Chat session history
```

### Markdown File Format

```markdown
---
id: uuid-here
created: 2024-01-15T10:30:00Z
modified: 2024-01-15T14:22:00Z
projects: [homebase, papertrail]
topics: [product, planning]
people: [dennis]
ai_confidence: 0.85
---

# Note Title

Note content here with **rich text** and:
- [ ] Task items that can be converted into linked tasks
- Regular bullet points
- [[Links to other notes]]
- @mentions of people
```

### AI Processing Pipeline

```
New/Modified Note
       ↓
   Quick Pass (2-5 min)
       ↓
   - Extract topics (auto-apply)
   - Add relationships (projects/people, auto-apply where safe)
   - Identify potential tasks (suggest)
   - Update index
       ↓
   Deep Pass (hourly)
       ↓
   - Cross-reference all recent notes
   - Find connections
   - Cluster topics
   - Propose structural changes (moves/new folders/projects)
       ↓
   User Review (optional)
       ↓
   - Approve/decline structural suggestions
   - Manually adjust anything
```

### Chat Assistant Architecture

- Retrieval-Augmented Generation (RAG)
- Embed all notes → vector store
- On query: semantic search → retrieve relevant notes → generate response
- Can execute simple actions (create note, create task, show list)

---

## Monetization

### Freemium Model

**Free Tier:**
- Full local functionality
- Bring Your Own Key (BYOK) for AI
  - User provides Claude API key
  - Or uses existing Claude subscription
- Unlimited notes, projects, tasks
- All organizational features

**Paid Tier ($X/month):**
- Hosted AI processing (no API key needed)
- Cloud sync across devices
- Priority AI processing
- Advanced AI features (research assistant)
- Backup & recovery

### Why This Works

- Low barrier to entry (free + BYOK)
- Power users pay for convenience
- AI costs covered by paid users
- Local-first means low hosting costs for free tier

---

## Target Users (V1)

| User | Role | Use Case |
|------|------|----------|
| Oleg | Software Engineer, Founder | Multiple projects (Papertrail, Matches Store, agency), heavy notes and tasks |
| May | Product Marketing Manager | Building apps with AI tools, needs organized knowledge |
| Dennis | GM at Bolt Drive | Management context, tracking people and projects |
| Nick | Head of Technical Pre-Sales | Technical knowledge, client interactions, solutions |

### Common Traits
- Manages multiple projects simultaneously
- Heavy note-takers
- Values organization but doesn't want to do it manually
- Technical enough to use BYOK
- Would pay for convenience and power features

---

## MVP Scope

### In Scope
- [ ] Desktop app (Tauri) for macOS (primary), Windows, Linux
- [ ] Rich text editor with markdown support
- [ ] Note creation and management
- [ ] Inbox with chronological view
- [ ] Timeline view (day/week grouping)
- [ ] Basic folder structure (Apple Notes-like)
- [ ] Project creation and management
- [ ] Project-filtered views
- [ ] Task management (full CRUD)
- [ ] Tasks view with filtering
- [ ] AI auto-organization (quick pass + deep pass)
- [ ] Topic extraction and assignment
- [ ] Chat assistant for querying knowledge
- [ ] Local storage (markdown + SQLite)
- [ ] BYOK for AI (Claude API key)

### Out of Scope (Post-MVP)
- Cloud sync
- Collaboration features
- Mobile apps
- Web app
- Research assistant agent
- Graph visualization
- Areas, Goals, Sources entities
- Advanced People features
- Hosted AI option

---

## Open Questions & Risks

### Open Questions

1. **Editor choice**: TipTap vs Plate vs other? Need to prototype.
2. **AI latency**: How to handle slow API responses? Optimistic UI?
3. **Conflict resolution**: If AI reorganizes while user is editing?
4. **Embedding strategy**: Which embedding model? Local or API?
5. **Task sync**: Any integration with native Reminders/calendar?
6. **AI move policy**: When should a file move be suggested vs auto-applied (beyond inbox), and how is “user-placed” tracked?
7. **Markdown round-trip**: What content types are guaranteed lossless in v1 (tables, embeds, attachments, custom widgets)?

### Risks

| Risk | Mitigation |
|------|------------|
| AI organization feels wrong | User can always override; AI learns from corrections |
| Performance with large vaults | SQLite indexing; lazy loading; pagination |
| Rich text editor complexity | Use proven library (TipTap); limit initial features |
| Tauri learning curve | Strong Rust ecosystem; good docs; fallback to Electron |
| API costs for users | BYOK means user controls spend; efficient prompting |

---

## Success Metrics

### MVP Success
- All 4 target users actively using daily
- Notes captured and auto-organized correctly >80% of time
- Chat assistant provides useful answers >70% of queries
- App feels fast (all local ops <100ms)

### Long-term Success
- User retention >60% at 30 days
- Paid conversion >5% of active users
- NPS >50

---

## Appendix

### Inspiration & References

- **Apple Notes**: Simplicity of capture, folder structure
- **Notion**: Warmth, flexibility, blocks
- **Linear**: Crispness, speed, keyboard-first
- **Obsidian**: Local-first, markdown, linking
- **Roam/Logseq**: Daily notes, bidirectional links
- **Mem**: AI organization concept

### Competitive Landscape

| Product | Strength | Weakness vs Homebase |
|---------|----------|---------------------|
| Apple Notes | Simple, native | No AI, no cross-linking |
| Notion | Flexible, powerful | Complex, requires manual org |
| Obsidian | Local, extensible | Steep learning curve |
| Mem | AI-first | Cloud-only, subscription-required |
| Roam | Networked thought | Complex, acquired/stagnant |

Homebase sits at the intersection: **Apple Notes simplicity + Notion warmth + Obsidian local-first + Mem AI-organization**.
