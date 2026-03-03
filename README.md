# Eclectis

AI intelligence layer for personal content curation. Discovers, scores, and delivers content to wherever you already consume — RSS readers, email, read-later apps.

## Getting started

### Web app

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Engine

```bash
cd engine
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn engine.main:app --reload
```

### Supabase

```bash
supabase start
supabase db reset
```

## Project structure

```
eclectis/
├── web/          # Next.js app (React 19, TypeScript, Tailwind, shadcn)
├── engine/       # Python engine (FastAPI, Claude AI)
├── supabase/     # Migrations, seed data, RLS policies
├── docs/         # Design docs and plans
└── work-log/     # Session logs
```

## License

Private — all rights reserved.
