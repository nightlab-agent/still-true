// Offline release-review checks. No package installation or live requests.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const dir = await mkdtemp('/tmp/still-true-release-review-');
const env = { PATH: process.env.PATH, HOME: dir, npm_config_cache: `${dir}/cache`,
  npm_config_userconfig: `${dir}/user.npmrc`, npm_config_globalconfig: `${dir}/global.npmrc`,
  npm_config_offline: 'true', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
const command = (cmd, args, cwd = dir) => {
  const result = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${cmd}: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
};
async function files(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) result.push(...await files(`${folder}/${entry.name}`));
    else result.push(`${folder}/${entry.name}`);
  }
  return result.sort();
}
try {
  const sources = (await Promise.all(['src', 'bin', 'test', '04-memory/review-newcomer'].map((part) => files(`${repo}${part}`)))).flat().filter((file) => /\.(?:mjs|js)$/.test(file));
  for (const source of sources) command(process.execPath, ['--check', source]);
  console.log(`node --check: ${sources.length} JavaScript files passed`);

  await writeFile(`${dir}/user.npmrc`, '');
  await writeFile(`${dir}/global.npmrc`, '');
  const [packed] = JSON.parse(command('npm', ['pack', repo, '--offline', '--ignore-scripts', '--json']));
  const paths = packed.files.map(({ path }) => path).sort();
  assert.deepEqual(paths, ['LICENSE', 'README.md', 'bin/still-true.js', 'package.json', 'src/cli.mjs', 'src/compare.mjs', 'src/extract.mjs', 'src/github.mjs']);
  assert.equal(packed.files.find(({ path }) => path === 'bin/still-true.js').mode, 0o755);
  command('tar', ['-xzf', packed.filename]);
  const { run, readState } = await import(pathToFileURL(`${dir}/package/src/cli.mjs`));
  const { extractClaims } = await import(pathToFileURL(`${dir}/package/src/extract.mjs`));
  const cli = `${dir}/package/bin/still-true.js`;
  console.log(`npm pack: ${packed.name}@${packed.version}, ${paths.length} expected files, executable bin and all imports present`);
  console.log(`archive sha256: ${createHash('sha256').update(await readFile(`${dir}/${packed.filename}`)).digest('hex')}`);
  assert.match(command(process.execPath, [cli, '--help']), /exit 2:/);
  assert.equal(JSON.parse(command(process.execPath, [cli, '--json', '--help'])).schema, 1);
  await writeFile(`${dir}/note.md`, '# Now\n\nhslee16/Archy#827 open\n');
  const noteBefore = await readFile(`${dir}/note.md`, 'utf8');
  const invoke = async (state, json = false) => {
    const lines = [];
    let reads = 0;
    const code = await run([`${dir}/note.md`, '--repo', 'o/r', ...(json ? ['--json'] : [])], {
      out: (line) => lines.push(line), extract: extractClaims, defaultRepo: null, env: {},
      read: (ref, options) => {
        reads++;
        return readState(ref, { ...options, fetchFn: async () => new Response(JSON.stringify({
          state: state === 'merged' ? 'closed' : state,
          ...(state === 'merged' ? { pull_request: { merged_at: '2026-11-05T19:19:00Z' } } : {}),
          html_url: 'https://github.com/hslee16/Archy/pull/827',
        }), { status: 200 }) });
      },
    });
    return { code, lines, reads };
  };
  const first = await invoke('merged');
  assert.equal(first.code, 1);
  assert.deepEqual(first.lines, [
    `${dir}/note.md:3  said open, but hslee16/Archy#827 is merged 2026-11-05  https://github.com/hslee16/Archy/pull/827`,
    '  "hslee16/Archy#827 open"', '1 claim checked, 1 contradicted',
  ]);
  assert.deepEqual(await invoke('merged'), first);
  const [merged, open] = await Promise.all([invoke('merged', true), invoke('open', true)]);
  assert.equal(merged.code, 1);
  assert.equal(open.code, 0);
  assert.equal(JSON.parse(open.lines[0]).claims[0].actual, 'open');
  assert.equal(merged.reads, 1);
  assert.equal(open.reads, 1);
  assert.equal(await readFile(`${dir}/note.md`, 'utf8'), noteBefore);
  console.log('packed README example, sequential repeats and overlapping open/merged reads: PASS, fresh requests and unchanged note');

  const preload = `${dir}/pending.mjs`;
  await writeFile(preload, `let calls = 0;
globalThis.fetch = async () => {
  if (++calls === 1) return new Response(JSON.stringify({ state: 'closed', pull_request: { merged_at: '2026-11-05T00:00:00Z' }, html_url: 'u' }), { status: 200 });
  process.stderr.write('BLOCKED\\n');
  return new Promise(() => { setInterval(() => {}, 1000); });
};\n`);
  await writeFile(`${dir}/pending.md`, '- waiting on #1\n- waiting on #2\n');
  const snapshot = async () => Promise.all((await files(dir)).map(async (file) => [file, createHash('sha256').update(await readFile(file)).digest('hex')]));
  const before = await snapshot();
  for (const json of [false, true]) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', preload, cli, `${dir}/pending.md`, '--repo', 'o/r', ...(json ? ['--json'] : [])], { cwd: dir, env });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('pending-read barrier timed out')); }, 5000);
      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; if (stderr.includes('BLOCKED\n')) child.kill('SIGTERM'); });
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout }); });
    });
    assert.equal(result.code, null);
    assert.equal(result.signal, 'SIGTERM');
    if (json) assert.equal(result.stdout, '');
    else { assert.match(result.stdout, /look:/); assert.doesNotMatch(result.stdout, /claims? checked/); }
    assert.deepEqual(await snapshot(), before);
    console.log(`packed subprocess SIGTERM after first result (${json ? 'JSON' : 'text'}): PASS, no success summary, no disk changes`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
