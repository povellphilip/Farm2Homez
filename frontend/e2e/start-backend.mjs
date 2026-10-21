// Starts Django for end-to-end tests on a fresh, seeded throwaway SQLite database.
// Used by playwright.config.ts; never point this at a real database.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend');
const venvPython = [join(backend, '.venv', 'Scripts', 'python.exe'), join(backend, '.venv', 'bin', 'python')].find(existsSync);
const python = process.env.E2E_PYTHON ?? venvPython ?? 'python';
const database = join(tmpdir(), 'farm2home-e2e.sqlite3');
const port = process.env.E2E_BACKEND_PORT ?? '8001';

rmSync(database, { force: true });
const env = { ...process.env, DJANGO_ENV: 'development', DATABASE_URL: `sqlite:///${database.replace(/\\/g, '/')}`, PAYMENTS_MOCK_ENABLED: 'True',
  // The suite signs in dozens of times a minute from one address; production keeps the strict default.
  AUTH_LOGIN_RATE: '1000/min',
};

for (const args of [['migrate', '-v0'], ['createcachetable'], ['seed_demo', '--with-admin']]) {
  const result = spawnSync(python, ['manage.py', ...args], { cwd: backend, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const server = spawn(python, ['manage.py', 'runserver', `127.0.0.1:${port}`, '--noreload'], { cwd: backend, env, stdio: 'inherit' });
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
