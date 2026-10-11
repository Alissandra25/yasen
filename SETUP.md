# Claude Code setup — how to drop this into the repo

Copy everything here into the repository root (keep the folder structure), then:

## 1. Dev dependencies for linting and formatting

```bash
npm i -D eslint@9 eslint-config-next eslint-plugin-i18next eslint-config-prettier prettier
```

`eslint-config-next` should match your Next.js version. Checked against Next 16.4 / ESLint 9.

## 2. Scripts in package.json

The hooks and skills call these names:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

## 3. Spec inside the repo

Export the English Notion pages to Markdown and save them as:

- `docs/spec/technical.md`
- `docs/spec/business.md`

Claude Code reads files, not Notion. CLAUDE.md points to these paths without `@`-importing them, so the spec is read only when needed instead of filling every session's context.

## 4. Git

- Commit `.claude/settings.json`, `.claude/hooks/`, `.claude/rules/`, `.claude/skills/`, `CLAUDE.md`, `docs/`.
- Add `.claude/.stop-attempts` and `.claude/settings.local.json` to `.gitignore`.

## 5. Moving to the next stage

Edit `docs/CURRENT_STAGE.md`: move the next stage to the top section. Claude builds only what that section lists.

## What each piece does

| Piece | Role |
| --- | --- |
| `CLAUDE.md` | Loaded every session: project, stack, commands, cross-cutting rules |
| `.claude/rules/db.md`, `ui.md` | Loaded only when working in matching paths |
| `.claude/skills/*` | Procedures loaded on demand: `add-feature`, `db-migration`, `i18n-sync`, `add-export`, `spec-update` |
| `protect-files.sh` | Blocks edits to `.env*` (except `.env.example`) and committed migrations |
| `guard-bash.sh` | Blocks `drizzle-kit push`, `DROP`/`TRUNCATE`, production DB URLs, force push, `rm -rf /` |
| `format.sh` | Prettier + ESLint `--fix` after every edit; remaining lint errors go back to Claude |
| `stop-checks.sh` | Typecheck + unit tests before Claude finishes (gives up after 3 tries) |
| `reinject-context.sh` | Re-adds the current stage and key rules after context compaction |
| `eslint.config.mjs` | Code rules: no `parseFloat`/`toFixed` for money, no hex colours, no `new Date('YYYY-MM-DD')`, no DB imports in UI, no literal UI text, no floating promises |
| `scripts/i18n-check.mjs` | Lists translation keys missing in en / uk / ru |

Hook scripts need `bash` and `node` (no `jq`). On Windows run Claude Code from WSL or Git Bash.
