// 모듈 등록 파일(app/modules/index.js) 무결성 시험 — 2026-11-03 테섭 앱이 시작 단계에서 멈춘 사고(myinfo.manifest 를 쓰면서 import 줄을 빠뜨려 'myinfo is not defined')를 막는다.
// 브라우저 없이 파일만 읽는다(정적 점검). APP_DIR 환경 변수로 다른 앱 폴더를 점검할 수 있다(변이 시험용).
import fs from 'node:fs'; import path from 'node:path';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const APP = process.env.APP_DIR || path.resolve(new URL('../app/', import.meta.url).pathname);
const idxPath = path.join(APP, 'modules/index.js'); const src = fs.readFileSync(idxPath, 'utf8').replace(/\/\*[^]*?\*\//g, '');
// 1) 등록 배열이 쓰는 모듈 이름은 모두 import 되어 있어야 한다
const nsImports = {}; for (const m of src.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+'([^']+)'/g)) nsImports[m[1]] = m[2];
const named = new Set(); for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) m[1].split(',').forEach((x) => named.add(x.trim().split(/\s+as\s+/).pop()));
const used = [...new Set([...src.matchAll(/\b(\w+)\.(?:manifest|mount)\b/g)].map((m) => m[1]))];
ok(used.length >= 5, '등록 배열에서 모듈 ' + used.length + '개를 찾았다(점검 대상이 비어 있지 않음)');
for (const u of used) ok(!!nsImports[u] || named.has(u), '모듈 ' + u + ' 를 import 했다(안 하면 앱이 시작 단계에서 「' + u + ' is not defined」로 멈춘다)');
// 2) import 한 모듈 파일이 실제로 있고 manifest·mount 를 내보낸다
const ids = {};
for (const [name, rel] of Object.entries(nsImports)) {
  if (!used.includes(name)) continue;
  const file = path.join(APP, 'modules', rel.replace(/\?.*$/, ''));
  const exists = fs.existsSync(file); ok(exists, '모듈 파일이 있다: ' + rel.replace(/\?.*$/, ''));
  if (!exists) continue; const code = fs.readFileSync(file, 'utf8');
  ok(/export\s+const\s+manifest\b/.test(code), name + ': manifest 를 내보낸다');
  ok(/export\s+(?:async\s+)?function\s+mount\b|export\s+const\s+mount\b|export\s*\{[^}]*\bmount\b/.test(code), name + ': mount 를 내보낸다');
  const id = (code.match(/export\s+const\s+manifest\s*=\s*\{\s*id:\s*'([^']+)'/) || [])[1]; if (id) (ids[id] = ids[id] || []).push(name);
}
// 3) 모듈 id 는 겹치지 않는다(겹치면 한쪽 화면이 가려진다)
for (const [id, who] of Object.entries(ids)) ok(who.length === 1, '모듈 id 「' + id + '」 는 하나만 쓴다' + (who.length > 1 ? ' — 겹침: ' + who.join(', ') : ''));
// 4) 사용하지 않는 import 가 아니라 「쓰는데 없는」 것만 오류로 본다 — 쓰지 않는 namespace import 는 허용(등록 보류 중인 모듈)
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
