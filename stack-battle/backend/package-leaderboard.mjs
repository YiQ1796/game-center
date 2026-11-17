import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const stripExports = source => source.replace(/^export /gm, '').trim();

export function buildAppsScript() {
  const engine = stripExports(read('../engine.mjs').split('export function createMatch')[0])
    .replace(/^const (MATCH_TIME|KO_LIMIT) = .*;\n/gm, '');
  return [engine, stripExports(read('../names.mjs')), read('./leaderboard-apps-script.gs').trim()].join('\n\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  writeFileSync(new URL('../../publisher-source.html', import.meta.url),
    '<!doctype html><meta charset="utf-8"><title>Score service source</title><pre id="score-source">' +
      escape(buildAppsScript()) + '</pre>');
}
