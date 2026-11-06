#!/usr/bin/env node
import { run, readState } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
process.exitCode = await run(process.argv.slice(2), {
  out: (s) => console.log(s), extract: extractClaims, read: readState, token,
});
