# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chinese-language React 19 + TypeScript 6 todo app with AI-powered task decomposition (DashScope API), categories, filtering/sorting, and localStorage persistence. Uses Vite 8 as the build tool.

## Common Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Type-check (tsc -b) then build for production (vite build)
npm run lint      # Run oxlint linter
npm run preview   # Preview production build locally
```

No test framework is configured — verify changes manually in the browser or use `npm run dev` + `curl http://localhost:5174`.

## Architecture

### Entry & Root Structure

```
src/main.tsx          → Creates React root, renders <App />
src/App.tsx           → Wraps everything in TodoProvider (state) + ErrorBoundary; renders InnerApp
src/hooks/useAppState.tsx  → State machine (finite-state reducer pattern); exports TodoProvider via createContext
```

All global state lives in a single context hook (`useAppState`). There is no Redux/Zustand — state transitions are managed by a reducer within the custom hook.

### Component Hierarchy

```
TodoProvider (state context)
├── ErrorBoundary (white-screen protection)
│   ├── Sidebar (left panel: category list, nav links)
│   │   ├── CategoryList
│   │   └── SidebarNav
│   └── Main content area
│       ├── Topbar (search + filter controls)
│       ├── AddTodoInput
│       ├── TodoList → maps TodoItem[]
│       │   └── TodoItem
│       ├── EditModal
│       ├── DeleteModal
│       ├── ToastContainer
│       └── StatsBar / EmptyState (conditional)
```

Key components:
- `Sidebar.tsx` — left navigation with category pills
- `Topbar.tsx` — search input, sort/filter dropdowns
- `AddTodoInput.tsx` — text input for creating new todos
- `TodoList.tsx` — filters and sorts todos from context, renders list
- `TodoItem.tsx` — individual todo row with checkbox, edit/delete triggers
- `EditModal.tsx` / `DeleteModal.tsx` — confirmation dialogs
- `ErrorBoundary.tsx` — catches render errors, shows fallback UI
- `ToastContainer.tsx` — transient notification system

### CSS Architecture

Styles are split across multiple CSS modules rather than using a CSS-in-JS library or Tailwind:

```
src/index.css            → Base/normalize styles
src/css/global.css       → Imports all other CSS partials
src/css/variables.css    → CSS custom properties (colors, spacing, typography)
src/css/layout.css       → App shell layout (sidebar + main flexbox)
src/css/components.css   → Shared component base styles
src/css/todo.css         → Todo-specific styles (items, lists, modals)
src/App.css              → App-level overrides
```

To add a new UI section: define variables in `variables.css`, layout rules in `layout.css`, and component styles where they belong.

### Types & Utilities

```
src/types.ts              → Shared TypeScript types (Todo, Category, AppState, etc.)
src/utils/storage.ts      → localStorage wrapper (read/write with serialization)
src/utils/helpers.ts      → Utility functions (sorting, filtering, formatting)
```

### Configuration Highlights

- **TypeScript**: Strict mode with `verbatimModuleSyntax` (use `import type` for types only) and `erasableSyntaxOnly` (all TS syntax must be erasable at emit). Target: ES2023.
- **Linting**: oxlint (not ESLint) with React + TypeScript plugins. Config in `.oxlintrc.json`.
- **Env vars**: `.env.local` is gitignored. DashScope API key goes here (referenced by README but `.env.example` not yet created).
- No path aliases configured — imports use relative paths from each file's location.
