# Eclectis

AI intelligence layer for personal content curation. Discovers, scores, and delivers content to your existing tools.

## Stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (new-york style)
- **Engine:** Python 3.11+, FastAPI, Anthropic Claude, hatchling build
- **Database:** Supabase (PostgreSQL + RLS)
- **Fonts:** Inter (body), JetBrains Mono (code/data)

## Monorepo layout

```
eclectis/
├── web/          # Next.js app (App Router)
├── engine/       # Python FastAPI engine
├── supabase/     # Migrations, seed, RLS
├── docs/         # Design docs and plans
├── work-log/     # Session logs
├── PRODUCT.md    # Product vision
├── DECISIONS.md  # Architecture decisions
└── README.md
```

## Conventions

- Sentence case for all headings, labels, and button text
- Right-align numeric cells/columns; right-align their labels too
- Inter font for all body text (not Quicksand)
- Design system: navy-slate brand palette, warm amber accent, light + dark mode
- Use `cn()` from `@/lib/utils` for conditional class merging

## Commands

```bash
# Web
cd web && npm run dev    # Dev server on :3000
cd web && npm run build  # Production build

# Engine
cd engine && pip install -e .          # Install in dev mode
cd engine && uvicorn engine.main:app   # Run API server
```
