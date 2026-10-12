/* 화면 열기 점검 준비: 앱이 https 로 불러오는 외부 모듈(Firebase 등) 이름을 모아 가짜 모듈로 대체한다 */
import { register } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const appDir = new URL('../../app', import.meta.url).pathname; const names = new Set();
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) { const s = fs.readFileSync(p, 'utf8'); for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'https:\/\/[^']*'/g)) m[1].split(',').forEach((n) => { n = n.trim().split(' as ')[0].trim(); if (n) names.add(n); }); } } })(appDir);
process.env.JH_STUB_NAMES = path.join(os.tmpdir(), 'jh_stub_names.json'); fs.writeFileSync(process.env.JH_STUB_NAMES, JSON.stringify([...names]));
register('./smoke_hooks.mjs', import.meta.url);
