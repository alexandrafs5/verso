---
name: preflight
description: Analyze a ROADMAP task before starting it and report the plan, what the agent will do alone, what the human must do by hand, blockers and open questions. Read-only. Use before /spec.
argument-hint: <ROADMAP task id, e.g. M2.4>
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(ls:*), Bash(docker ps:*), Bash(docker compose ps:*)
---

# /preflight — Plan a task before starting it

Argument: `$ARGUMENTS` (a ROADMAP task id such as `M2.4`). If empty, ask for it and stop.

This skill is read-only. It writes no spec, no code and no file. Its job is to show the human, before any work starts, what will happen and what the human has to do.

## Steps

1. Read `CLAUDE.md`, the task line in `ROADMAP.md` (and its milestone's "Done when"), the `ARCHITECTURE.md` sections the task cites (§ numbers), the matching screens in `docs/DESIGN.md` for UI tasks, and any spec in `specs/` that already mentions the task.
2. Check the repo: current branch, `git status`, whether the dependency tasks in ROADMAP are ticked, whether `develop` is the base, whether Docker services are up (`docker compose ps`), and whether the code the task builds on really exists.
3. Look for conflicts: ROADMAP vs ARCHITECTURE vs DESIGN vs code. If they disagree, report it as a blocker. Do not pick one.
4. Apply the scope rule: list anything in the task that touches [F2]-[F5] or [Future].
5. Split the work into what the agent does alone and what only the human can do. The human-only list is the most important part. Look for:
   - Accounts, API keys, OAuth clients, domains, sender verification (Brevo, Google, Supabase, Neon, Render, Vercel).
   - Secrets and `.env` values the agent must not invent or commit.
   - Starting local services (`docker compose up -d`, Postgres, Mailpit).
   - Manual checks the agent cannot do (real email delivery, a real OAuth round trip, visual check in a real browser, mobile device).
   - Decisions only the human can make (design choices, budget, wording in Spanish).
   - Approvals the workflow requires (changing a spec to `Approved`, merging a PR).
6. Estimate size. If the task needs more than one PR, or touches more than three areas, propose how to split it.

## Output

English, short, caveman-compatible. Use exactly these headings:

- `TASK`: id, title, one-sentence objective.
- `READY?`: dependencies ticked, base branch, services up. One line each, `yes` or `no (reason)`.
- `PLAN`: 4 to 8 numbered steps, each leaving the system runnable.
- `FILES`: files and folders that will appear or change.
- `AGENT DOES ALONE`: list.
- `YOU MUST DO`: list. Each item has the exact command or action, and when it is needed (`before start`, `during step N`, `after merge`). Write `nothing` if there is none.
- `BLOCKERS`: conflicts between documents, missing dependencies, scope problems.
- `QUESTIONS FOR /spec`: the questions Phase 2 must ask, 3 to 6, concrete, with a recommended option.
- `SIZE`: one PR or split, and why.

Do not offer to start implementing. End after `SIZE` with: `Next: /spec <task id>`.
