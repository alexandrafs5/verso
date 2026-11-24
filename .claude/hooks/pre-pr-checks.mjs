// PreToolUse hook for Bash. Blocks `gh pr create` unless lint, typecheck and tests pass.
// Exit code 2 blocks the tool call and shows stderr to the agent. Any other exit lets it run.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const command = input?.tool_input?.command ?? '';
if (!/\bgh\s+pr\s+create\b/.test(command)) process.exit(0);

const cwd = input.cwd ?? process.cwd();
const steps = ['pnpm lint', 'pnpm typecheck', 'pnpm test'];

for (const step of steps) {
  // Test output is large (request logs); the 1 MiB default makes spawnSync kill the child.
  const result = spawnSync(step, {
    cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const tail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      .trim()
      .split('\n')
      .slice(-25)
      .join('\n');
    process.stderr.write(
      `Blocked: "${step}" failed. Fix it before opening a PR. ` +
        `If tests failed, check that Postgres is running (docker compose up -d).\n${tail}\n`,
    );
    process.exit(2);
  }
}
process.exit(0);
