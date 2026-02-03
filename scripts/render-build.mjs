import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    const pretty = [command, ...args].join(' ');
    throw new Error(`Command failed (${result.status}): ${pretty}`);
  }
}

function canRun(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

const candidates = [
  process.env.REMBG_PYTHON,
  'python3',
  'python',
].filter(Boolean);

const pythonCmd = candidates.find(canRun);

if (!pythonCmd) {
  console.error('[render-build] ERROR: Python not found in build environment.');
  console.error('[render-build] To use server-side REMBG, ensure Python is available or switch to a Docker service.');
  process.exit(1);
}

console.log(`[render-build] Using Python: ${pythonCmd}`);

// Install REMBG deps into the build/runtime environment
run(pythonCmd, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel']);
run(pythonCmd, ['-m', 'pip', 'install', '-r', 'requirements.txt']);

// Build the web app
run('npm', ['run', 'build']);
