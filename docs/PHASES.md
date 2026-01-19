# Homebase — Implementation Phases

This document outlines the phased implementation plan for Homebase. Each phase has a clear deliverable that provides usable value.

---

## Overview

| Phase | Name | Outcome |
|-------|------|---------|
| 1 | Core Note-Taking App | You can take notes and they save locally |
| 2 | Organization Structure | You can organize notes into projects and folders |
| 3 | Timeline Views | See notes organized by time and context |
| 4 | Task Management | Track tasks alongside notes |
| 5 | AI Auto-Organization | AI categorizes and organizes automatically |
| 6 | Chat Assistant | Ask questions about your knowledge base |

**Post-MVP:**
| 7 | People & Relationships | Track people and their context |
| 8 | Connections & Graph | Discover and visualize connections |
| 9 | Research Assistant | AI agent for research tasks |
| 10 | Cloud Sync | Sync across devices (paid tier) |
| 11 | Extended Entities | Areas, Goals, Sources |

---

## Phase 1: Core Note-Taking App

### Goal
You can take notes and they save locally. Basically a local Apple Notes.

### Deliverables

- [ ] **Tauri + React setup**
  - Project scaffolding
  - Tauri configured for macOS (primary), Windows, Linux
  - React + TypeScript frontend
  - Tailwind CSS for styling
  - Basic app window with sidebar + main content layout
  - pnpm workspace layout (monorepo-friendly)

- [ ] **Rich text editor**
  - Integrate TipTap or Plate
  - Basic formatting: bold, italic, headers, lists, checkboxes, links
  - Markdown serialization (save as .md files)
  - Markdown parsing (load .md files into editor)
  - Clean, minimal styling
  - V1 round-trip contract (lossless):
    - Headings, paragraphs, links
    - Ordered/unordered lists + nested lists
    - Checkboxes (as markdown checklists)
    - Code blocks + inline code
    - Images/attachments (saved as files and referenced via relative links)
    - `[[wikilinks]]` and `@mentions` (stored as ID-backed links under the hood)

- [ ] **Note CRUD operations**
  - Create new note
  - Edit existing note
  - Delete note (move to trash or permanent)
  - Auto-save on change (debounced)

- [ ] **File system integration**
  - Define vault folder structure under a vault root (default: `~/Homebase/`)
  - Notes folder structure:
    - `notes/inbox/` (default capture location)
    - `notes/folders/...` (user-created folders)
    - `notes/projects/...` (optional project home folders)
  - Save notes as markdown files
  - Load notes from disk on startup
  - Watch for external file changes (optional)

- [ ] **Sidebar navigation**
  - List of notes (title + date)
  - Inbox section
  - Click to open note in editor
  - Visual indicator for selected note

- [ ] **Basic settings**
  - Settings panel/modal
  - API key input field (stored securely for Phase 5)
  - Vault directory:
    - Display current vault path
    - Change vault path (optional for v0.1; at minimum show it)
    - Button to reveal/open vault folder in the OS file manager

### Definition of Done
Open the app → Create a note → Write content → Add a checklist + link + image → Close app → Reopen → Content round-trips losslessly per the V1 contract.

---

## Phase 2: Organization Structure

### Goal
You can organize notes into projects and folders, and search across everything.

### Deliverables

- [ ] **In-memory indexing (v0.x)**
  - Build an in-memory index from markdown files on startup
  - Update the index on note save/change
  - Optional: persist a rebuildable cache in `.homebase/index.json` (or similar)
  - (Planned later) Migrate to SQLite/FTS once UX is validated

- [ ] **Folder structure**
  - Create folders in sidebar
  - Rename folders
  - Delete folders (with confirmation)
  - Nest folders (optional, could defer)
  - Move notes between folders
  - Folder stored as actual filesystem directories
  - Creating a note directly inside a folder is allowed (note becomes user-placed)
  - Manual move/placement is respected:
    - Notes manually moved (or created) into a folder/project are marked user-placed
    - AI never auto-moves user-placed notes (suggest-only)

- [ ] **Projects as first-class entity**
  - Project data model (name, description, status, created, modified)
  - Create new project
  - Edit project details
  - Archive/delete project
  - Projects section in sidebar
  - Project detail view (placeholder for now)
  - Optional project home folder for export-friendly organization

- [ ] **Assign notes to projects**
  - Note metadata panel (right sidebar or bottom)
  - Project selector (multi-select)
  - Note can link to multiple projects (or none)
  - Update markdown frontmatter with `projects: [...]`
  - Project badge visible on note in list

- [ ] **Search**
  - Search input in sidebar or top bar
  - Fast search across note titles + content (in-memory index)
  - Search results list
  - Click result to open note
  - Highlight search terms (optional)

- [ ] **Note metadata panel**
  - Show: created date, modified date, projects, topics, folder location
  - Edit project links
  - Add/remove topics manually (prep for Phase 5)
  - Show placement state (AI-managed vs user-placed)
  - Manual relationships are user-owned (AI should not remove/override them automatically; suggest instead)

### Definition of Done
Create multiple notes → Create projects → Assign notes to projects → Search for a note by content → Find it instantly.

---

## Phase 3: Timeline Views

### Goal
See your notes organized by time with visual project context.

### Deliverables

- [ ] **Timeline as primary home view**
  - Default view when opening app
  - Chronological list of notes
  - Grouped by day
  - Week grouping toggle (day view vs week view)

- [ ] **Visual project clustering**
  - Notes in same project on same day grouped visually
  - Project label/badge on cluster
  - Different styling for clustered vs standalone notes
  - Example:
    ```
    Monday, Jan 13
    ├── Quick thought (no project)
    ├── [Homebase] ← cluster header
    │   ├── PRD notes
    │   └── Technical research
    └── Journal entry (no project)
    ```

- [ ] **Project-filtered timeline**
  - Click project in sidebar → see only that project's timeline
  - Same day/week grouping
  - Clear indicator that view is filtered
  - Easy way to return to full timeline

- [ ] **Quick capture**
  - Keyboard shortcut: Cmd+N (Mac), Ctrl+N (Windows/Linux)
  - Opens new note immediately
  - Lands in Inbox by default
  - Focus on editor, ready to type
  - Global shortcut (works even when app not focused) — stretch goal

- [ ] **Timeline navigation**
  - Scroll through time
  - Jump to specific date (date picker)
  - "Today" button to return to current date
  - Lazy loading for performance (load more as you scroll)

### Definition of Done
Open app → See timeline of recent notes → Notes grouped by day with project clusters → Filter to one project → See that project's history → Cmd+N to quickly add a note.

---

## Phase 4: Task Management

### Goal
Track tasks alongside notes as a full productivity system.

### Deliverables

- [ ] **Task data model**
  - Schema: id, title, description, status, priority, due_date, reminder, project_id, person_id, parent_note_id, created, modified
  - Status: todo, in_progress, done
  - Priority: low, medium, high, urgent

- [ ] **Task CRUD operations**
  - Create task (standalone)
  - Edit task
  - Delete task
  - Change status (quick toggle)
  - Tasks are markdown-backed for exportability:
    - Embedded tasks live inside notes as task widgets/blocks (still markdown)
    - Tasks view aggregates tasks by indexing notes
    - Standalone tasks create a note (or task file) that can optionally link back to a parent note
  - (Planned later) migrate to SQLite once the model is validated

- [ ] **Tasks view**
  - Dedicated Tasks section in sidebar
  - List of all tasks
  - Filtering:
    - By status (todo, in_progress, done, all)
    - By priority
    - By project
    - By due date (overdue, today, this week, later)
  - Sorting: due date, priority, created date, project
  - Quick status toggle in list

- [ ] **Task detail panel**
  - Click task to see/edit details
  - Title (editable)
  - Description (rich text, optional)
  - Status selector
  - Priority selector
  - Due date picker
  - Reminder setting
  - Project assignment
  - Person assignment (dropdown, prep for Phase 7)
  - Link to parent note (if created from note)

- [ ] **Inline task creation from notes**
  - Plain checkbox remains a lightweight checklist item by default
  - Convert checklist item → Task entity (e.g., via shortcut/button in the editor)
  - Converted task is rendered as a task widget inside the note (still markdown-backed)
  - Store a stable task ID so it stays linked even if the text changes
  - Task appears in Tasks view
  - Completing task in either place syncs
  - Visual link from task back to source note

- [ ] **Task counts and badges**
  - Project sidebar shows task count
  - "Due today" badge on Tasks section
  - Overdue indicator

### Definition of Done
Create tasks standalone → Create tasks from note checkboxes → View all tasks → Filter by project/status/priority → Complete a task → See it synced in note and task view.

---

## Phase 5: AI Auto-Organization

### Goal
AI automatically categorizes, tags, and organizes your notes.

### Deliverables

- [ ] **Claude API integration**
  - API client setup
  - Use API key from settings
  - Error handling (invalid key, rate limits, network issues)
  - Graceful degradation when API unavailable

- [ ] **Quick pass processor**
  - Trigger: on note save (debounced, ~30 seconds after last edit)
  - Or trigger: every 2-5 minutes for batch processing
  - For each new/modified note:
    - Send content to Claude
    - Extract topics (3-5 tags, auto-apply with provenance)
    - Add relationship links (projects/people, auto-apply where safe with provenance)
    - Identify potential tasks (suggest only; user confirms conversion)
    - Propose structural suggestions (moves, new folders/projects) with confidence + justification
  - Store suggestions in database
  - Update note frontmatter with applied metadata (topics/relationships) and provenance markers

- [ ] **Deep pass processor**
  - Trigger: background job, runs hourly
  - Or trigger: manual "Organize now" button
  - Analyze all notes modified in last period
  - Find connections between notes
  - Identify topic clusters
  - Suggest reorganization (moves, new folders/projects, merges/splits) with confidence + justification
  - Generate insights (optional)

- [ ] **AI suggestions UI**
  - Indicator when AI is processing
  - Visual distinction: AI-suggested vs manual tags
  - Suggestion panel on note:
    - "AI suggests: Project X" with Accept/Reject
    - "Suggested topics: A, B, C" with Accept/Reject each
    - "Move note to Folder X" with Accept/Reject + confidence + justification
    - "Create new project/folder Y and move these notes" with Accept/Reject
  - Bulk accept/reject in inbox view

- [ ] **Processing queue**
  - Queue notes for processing
  - Background processing (doesn't block UI)
  - Status indicator: "3 notes pending processing"
  - Retry logic for failed items
  - Global review/notifications queue for AI suggestions (moves/structure)

- [ ] **Settings for AI**
  - Enable/disable auto-organization
  - Quick pass frequency
  - Deep pass frequency
  - API key management
  - Move policy (v1: all file moves require approval)

### Definition of Done
Write notes freely → AI auto-applies safe metadata (topics/links) → AI proposes structural moves with confidence + justification → User approves/declines in a review queue → Notes become organized without surprising moves.

---

## Phase 6: Chat Assistant

### Goal
Ask natural language questions about your knowledge base.

### Deliverables

- [ ] **Embeddings pipeline**
  - Generate embeddings for all notes
  - Use Claude/OpenAI embeddings API (or local model)
  - Store embeddings in SQLite or separate vector DB
  - Update embeddings on note change
  - Batch processing for initial indexing

- [ ] **Chat UI**
  - Collapsed bar at bottom of screen
  - Click/shortcut to expand
  - Full chat interface when expanded
  - Message history within session
  - Input field with send button
  - Keyboard shortcut: Cmd+/ to focus

- [ ] **RAG-based retrieval**
  - On user query:
    - Generate query embedding
    - Semantic search against note embeddings
    - Retrieve top N relevant notes
    - Include in context for Claude
    - Generate response

- [ ] **Response formatting**
  - Markdown rendering in chat
  - Source references: "Based on [Note Title]"
  - Clickable links to source notes
  - Copy response button

- [ ] **Query types**
  - Factual: "What do I know about X?"
  - Temporal: "What did I write last week about Y?"
  - Aggregation: "Summarize my notes on project Z"
  - Tasks: "What tasks are due this week?"
  - Connections: "How does X relate to Y?"

- [ ] **Basic actions from chat**
  - "Create a note about X" → creates note
  - "Add a task to do Y" → creates task
  - "Show me notes about Z" → navigates to search results

- [ ] **Conversation history**
  - Persist chat history (current session at minimum)
  - Previous conversations accessible (stretch)
  - Clear conversation button

### Definition of Done
Open chat → Ask "What do I know about [topic]?" → Get answer with sources → Click source to see original note → Ask follow-up → Create task from chat.

---

## Post-MVP Phases

### Phase 7: People & Relationships

- [ ] Person entity (name, notes, contact info)
- [ ] Assign notes to people (mentioned, about, from)
- [ ] Assign tasks to people
- [ ] Person detail view (all related notes, tasks, projects)
- [ ] AI extraction of people mentioned in notes
- [ ] People section in sidebar

### Phase 8: Connections & Graph

- [ ] AI-suggested connections between notes
- [ ] "Related notes" panel on note view
- [ ] Manual linking between notes ([[wiki-style]])
- [ ] Backlinks (notes that link to this note)
- [ ] Graph visualization view
- [ ] Explore connections interactively

### Phase 9: Research Assistant

- [ ] Agent capabilities (multi-step actions)
- [ ] Web search integration
- [ ] "Research [topic] for me" command
- [ ] Agent adds findings to knowledge base
- [ ] Long-running background research
- [ ] Source tracking for external content

### Phase 10: Cloud Sync

- [ ] User accounts (authentication)
- [ ] Cloud storage for notes
- [ ] Real-time sync across devices
- [ ] Conflict resolution
- [ ] Offline support with sync on reconnect
- [ ] Paid tier implementation
- [ ] Hosted AI option (no BYOK needed)

### Phase 11: Extended Entities

- [ ] Areas (ongoing responsibilities)
- [ ] Goals (high-level aspirations)
- [ ] Sources (track where knowledge came from)
- [ ] Relationships between entities
- [ ] AI categorization into areas/goals

---

## Technical Notes

### Phase Dependencies

```
Phase 1 (Core)
    ↓
Phase 2 (Organization) ← in-memory index for v0.x
    ↓
Phase 3 (Timeline) ← requires projects from Phase 2
    ↓
Phase 4 (Tasks) ← requires projects + indexing
    ↓
Phase 5 (AI Org) ← requires notes, projects, topics
    ↓
Phase 6 (Chat) ← requires embeddings, all content indexed
```

### Suggested Tech Decisions

| Component | Recommendation | Alternatives |
|-----------|----------------|--------------|
| Editor | TipTap | Plate, Lexical, ProseMirror |
| State Management | Zustand | Redux, Jotai |
| Styling | Tailwind CSS | CSS Modules, Styled Components |
| Search (v0.x) | In-memory index | SQLite FTS (later) |
| Embeddings | OpenAI text-embedding-3-small | Voyage, local model |
| Vector Search | SQLite with vec extension | Separate vector DB |

### File Structure (Final)

```
~/Homebase/
├── notes/
│   ├── inbox/
│   │   └── 2024-01-15-quick-thought.md
│   ├── projects/
│   │   └── homebase/
│   │       └── prd-brainstorm.md
│   └── folders/
│       └── personal/
│           └── journal-jan.md
├── assets/
│   └── <note-id>/
│       └── image.png
├── config/
│   └── settings.json
└── .homebase/
    ├── index.db          # SQLite: notes, projects, tasks, topics, people
    ├── embeddings.db     # Vector store for semantic search
    ├── ai-state.json     # AI processing queue, state
    └── chat-history.json # Chat session history
```

---

## Success Criteria Per Phase

| Phase | Success = |
|-------|-----------|
| 1 | All 4 users using daily for note capture |
| 2 | Users organizing into projects without friction |
| 3 | Timeline is the primary way users navigate |
| 4 | Tasks fully replace a separate task app |
| 5 | >80% of AI suggestions are accepted |
| 6 | Users ask the assistant daily questions |

---

## Getting Started

**Phase 1 first steps:**
1. Initialize Tauri + React project
2. Set up project structure and tooling
3. Create basic layout (sidebar + editor)
4. Integrate TipTap editor
5. Implement file save/load
6. Ship v0.1.0 to test users

Let's build.
