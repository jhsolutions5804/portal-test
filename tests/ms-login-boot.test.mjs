// node tests/ms-login-boot.test.mjs  (인자 없으면 저장소의 app/core 를 시험한다 — 자동 검사가 이 방식으로 부른다)
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert';
const s = fs.readFileSync(path.join(process.argv[2] || new URL('../app/core/', import.meta.url).pathname, 'boot.js'), 'utf8'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const at = (re) => { const m = s.search(re); ok(m >= 0, '있어야 함: ' + re); return m; };
const imp = at(/import \{ hasMicrosoftCallback, finishMicrosoftLogin, startMicrosoftLogin, msErrorMessage \} from '\.\/ms-auth\.js\?v=\w+';/);
const fin = at(/if \(hasMicrosoftCallback\(\)\) \{ try \{ await finishMicrosoftLogin\(\); \}/), slow = at(/setTimeout\(\(\) => \{ if \(!answered\) renderLogin/), watch = at(/\nwatchMe\(\(user, reason\)/), note = at(/let msNote = ''/);
ok(imp < note && note < fin && fin < slow && fin < watch, '순서: import → msNote → 콜백 처리(await) → 6초 타이머·watchMe');
ok((s.match(/renderLogin\(root, \{/g) || []).length === 2 && (s.match(/onMicrosoft: \(\) => startMicrosoftLogin\(\)/g) || []).length === 2, '로그인 화면 호출 2곳 모두 onMicrosoft 전달');
ok(/message: msg \|\| msNote \}\); msNote = ''; return;/.test(s), '실패 안내는 한 번만 표시');
ok((s.match(/import \{[^}]*\} from '\.\/ms-auth\.js/g) || []).length === 1, 'ms-auth import 는 한 번');
const ver = new Set([...s.matchAll(/\?v=(\w+)'/g)].map((m) => m[1])); ok(ver.size === 1, '모든 import 의 빌드 표기가 하나로 같음: ' + [...ver]);
console.log('boot.js 패치 점검 ' + n + '건 통과');
