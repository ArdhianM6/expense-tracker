const { spawn } = require('node:child_process');
const path = require('node:path');

const projects = ['backend', 'frontend'];
const children = new Map();
let stopping = false;

function stopChild(child) {
  if (!child?.pid) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  return Promise.resolve();
}

async function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children.values()].map(stopChild));
  process.exit(exitCode);
}

for (const project of projects) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, project),
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });
  children.set(project, child);
  child.once('error', (error) => {
    console.error(`Gagal menjalankan ${project}:`, error.message);
    stopAll(1);
  });
  child.once('exit', (code) => {
    if (!stopping) stopAll(code || 0);
  });
}

process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));
