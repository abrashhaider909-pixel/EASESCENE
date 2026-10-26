# Contributing to EzScene

Thanks for helping. EzScene is meant to be adapted by other universities, so
clear, small changes are the most useful.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Use the one-click demo accounts on the landing page to try each portal.

## Before opening a pull request

```bash
npm run lint           # type check
npm test               # unit tests
npm run check:secrets  # never commit keys or tokens
```

For UI changes, walk the affected screens in the browser and attach screenshots.

## Where things live

- `src/lib/store.ts` – every data change goes through a store action. Add new
  behaviour here first, with a unit test in `tests/unit/`.
- `src/lib/access.ts` – permission rules. Use these helpers in both screens and store.
- `src/screens/` – one file per screen; keep screens free of business rules.
- `src/lib/constants.ts` – seed data (demo accounts, designations, forms).
- `supabase/schema.sql` – keep it re-runnable (`if not exists`, `add column if not exists`).

## Adding a form for your university

Sign in as admin → Templates → Blank form (or upload your PDF/Word template),
add fields, write the letter text with `{{field_id}}` tokens, and pick the
default chain. To ship it as seed data, add a `makeType({...})` entry in
`src/lib/constants.ts`.

## Conduct

Be respectful and constructive. Don't post personal data from real students in
issues, screenshots or test fixtures.
