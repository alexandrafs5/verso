---
name: task-close
description: Close an implemented ROADMAP task: run checks, run the review agents, tick ROADMAP, set the spec to Implemented, commit, and open a PR to develop. Use after /spec-impl is finished.
argument-hint: <spec NN-slug>
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(pnpm lint:*), Bash(pnpm typecheck:*), Bash(pnpm test:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(ls:*)
---

# /task-close — Finish a task and open the PR

Argument: `$ARGUMENTS` (spec number, slug or full name). If empty, use the spec that matches the current branch `spec-NN-slug`. If none matches, ask and stop.

The user invoking this command is the approval to commit, push and open a PR for this one task. It is not approval for anything else.

## Steps

Stop at the first failure and report it. Do not work around a failure.

1. **Branch check.** Current branch must be `spec-NN-slug`, never `main` or `develop`. The spec status must be `Approved` (it is changed to `Implemented` in step 6).
2. **Checks.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, in that order. If `pnpm test` fails because Postgres is down, tell the user to run `docker compose up -d` and stop. Never disable a lint rule or skip a test to get green.
3. **Review agents, in parallel.**
   - `repo-rules-reviewer` always.
   - `ui-states-auditor` only if the diff touches `apps/web`.
   - `spec-consistency-reviewer` only if the diff changes a file in `specs/` or ARCHITECTURE.md or DESIGN.md.

   Give each the spec path. Show every `MUST FIX` and `BLOCKER` to the user. If any exist, stop and let the user decide. `SHOULD FIX` and `NOTES` go in the final report.
4. **Acceptance criteria.** Read the spec's acceptance criteria. For each one, find the evidence (test name, command output, file). Tick the ones with evidence. List the ones without. If any is unticked, stop.
5. **ROADMAP.** Tick the task checkbox in `ROADMAP.md`.
6. **Spec status.** Change `**Status:** Approved` to `Implemented` in the spec. Tick its acceptance criteria.
7. **Commit.** Stage only the task's files (no `git add -A`; no `.env`, no secrets). One conventional commit (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), in English, plus the attribution lines the session requires.
8. **PR.** Push the branch and open a PR with `gh pr create --base develop`. Never target `main`. Never push to `develop` or `main`. The description has: what changed, the acceptance criteria result, the new dependencies each with a one-line reason, the manual steps the reviewer must do, and the attribution line the session requires.
9. **Report.** Reply in 5 lines or fewer: PR link, checks result, reviewer verdicts, anything left for the human (manual checks, env vars, accounts, merge).

## Rules

- One task per PR. If the diff contains work outside the spec's scope, stop and ask.
- Do not merge the PR. Merging is the human's action.
- Do not amend or force-push existing commits.
