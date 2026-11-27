#!/usr/bin/env node
// 사용법: node tools/release.js <patch|minor|major> "변경1; 변경2; 변경3"
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const kind = process.argv[2], notes = (process.argv[3] || '').split(';').map(s => s.trim()).filter(Boolean);
if (!['patch', 'minor', 'major'].includes(kind) || !notes.length) { console.error('usage: node tools/release.js <patch|minor|major> "note1; note2"'); process.exit(1); }
const rd = f => fs.readFileSync(path.join(root, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(root, f), s);
const ver = JSON.parse(rd('version.json')); let [a, b, c] = ver.version.split('.').map(Number);
if (kind === 'major') { a++; b = 0; c = 0; } else if (kind === 'minor') { b++; c = 0; } else c++;
const nv = `${a}.${b}.${c}`, date = new Date().toISOString().slice(0, 10);
ver.version = nv; ver.build = date; ver.changes.unshift({ v: nv, date, notes }); ver.changes = ver.changes.slice(0, 20);
wr('version.json', JSON.stringify(ver, null, 2) + '\n');
wr('js/version.js', `'use strict';\nconst BUS_VERSION = '${nv}', BUS_BUILD = '${date}';\n`);
wr('index.html', rd('index.html').replace(/\?v=\d+\.\d+\.\d+/g, '?v=' + nv));
wr('sw.js', rd('sw.js').replace(/const VERSION = '[^']*'/, `const VERSION = '${nv}'`));
const cl = rd('CHANGELOG.md'), entry = `## v${nv} (${date})\n${notes.map(n => '- ' + n).join('\n')}\n\n`;
wr('CHANGELOG.md', cl.replace(/^(# .*\n\n)/, `$1${entry}`));
console.log('released v' + nv);
