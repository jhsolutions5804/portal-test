/* 정적 점검: ① 가져오기(import)한 이름이 상대 모듈에 실제로 있는지 ② 코드에서 쓰는데 어디에도 정의·가져오지 않은 이름(오타·빠진 import)이 없는지.
 * 순수 함수 시험은 화면 코드(index.js·view.js)의 빠진 import 를 잡지 못한다 — 이 점검이 그것을 잡는다(2026-10-13, 인사 화면 7개가 열리자마자 ReferenceError 로 깨졌던 사고 이후 필수 게이트).
 * 사용: cd scripts/dev && npm i espree eslint-scope jsdom   →   node static_names_check.mjs   (문제가 있으면 종료 코드 1) */
import fs from 'fs'; import path from 'path'; import * as espree from 'espree'; import * as escope from 'eslint-scope';
const root = new URL('../../app', import.meta.url).pathname; const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(root);
const info = new Map();
for (const f of files) { const src = fs.readFileSync(f, 'utf8'); let ast; try { ast = espree.parse(src, { ecmaVersion: 2022, sourceType: 'module', range: true }); } catch (e) { console.log('구문 오류', f, e.message); continue; }
  const exp = new Set(); const imps = []; let star = false;
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration') { if (n.declaration) { if (n.declaration.declarations) n.declaration.declarations.forEach((d) => { const walkP = (p) => { if (p.type === 'Identifier') exp.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach((q) => walkP(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach((q) => q && walkP(q)); }; walkP(d.id); }); else if (n.declaration.id) exp.add(n.declaration.id.name); } n.specifiers.forEach((s) => exp.add(s.exported.name)); if (n.source) imps.push({ from: n.source.value, names: n.specifiers.map((s) => s.local.name), reexport: true }); }
    if (n.type === 'ExportDefaultDeclaration') exp.add('default'); if (n.type === 'ExportAllDeclaration') star = true;
    if (n.type === 'ImportDeclaration') imps.push({ from: n.source.value, names: n.specifiers.map((s) => (s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' ? '*' : s.imported.name)) });
  }
  info.set(f, { exp, imps, star, ast, src });
}
let bad = 0;
for (const [f, d] of info) for (const im of d.imps) { if (!im.from.startsWith('.')) continue; const target = path.resolve(path.dirname(f), im.from.split('?')[0]); const t = info.get(target); if (!t) { console.log('✗ 없는 파일:', path.relative(root, f), '→', im.from); bad++; continue; } if (t.star) continue; for (const n of im.names) { if (n === '*') continue; if (!t.exp.has(n)) { console.log('✗ 없는 내보내기:', path.relative(root, f), '→', path.relative(root, target), ':', n); bad++; } } }
console.log('연결 점검 완료. 문제', bad, '건 (파일', files.length, '개)');
// 정의되지 않은 변수 점검
const GLOBALS = new Set(['window', 'document', 'location', 'navigator', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'Math', 'JSON', 'Number', 'String', 'Array', 'Object', 'Set', 'Map', 'Promise', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'RegExp', 'Intl', 'Boolean', 'undefined', 'NaN', 'Infinity', 'URL', 'URLSearchParams', 'FormData', 'File', 'FileReader', 'Blob', 'Image', 'crypto', 'TextEncoder', 'TextDecoder', 'fetch', 'alert', 'confirm', 'prompt', 'sessionStorage', 'localStorage', 'history', 'screen', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Uint8Array', 'Uint16Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'Symbol', 'Reflect', 'Proxy', 'WeakMap', 'WeakSet', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape', 'atob', 'btoa', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'AbortController', 'structuredClone', 'queueMicrotask', 'BigInt', 'globalThis', 'getComputedStyle', 'performance', 'Notification', 'XMLHttpRequest', 'indexedDB', 'caches', 'DOMParser', 'XMLSerializer', 'Node', 'NodeList', 'KeyboardEvent', 'MouseEvent', 'DOMException', 'self', 'top', 'parent', 'open', 'print', 'emailjs', 'XLSX', 'pdfjsLib', 'import', 'createImageBitmap', 'DecompressionStream', 'Response', 'Headers', 'Request']);
let undef = 0;
for (const [f, d] of info) { let sm; try { sm = escope.analyze(d.ast, { ecmaVersion: 2022, sourceType: 'module' }); } catch (e) { console.log('분석 실패', f, e.message); continue; }
  const seen = new Set(); for (const r of sm.globalScope.through) { const n = r.identifier.name; if (GLOBALS.has(n) || seen.has(n)) continue; seen.add(n); const line = d.src.slice(0, r.identifier.range[0]).split('\n').length; console.log('✗ 정의되지 않은 이름:', path.relative(root, f) + ':' + line, n); undef++; } }
console.log('정의되지 않은 이름', undef, '건');
process.exit(bad + undef ? 1 : 0);
