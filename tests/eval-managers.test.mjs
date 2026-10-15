// 평가 회차 관리자(사장단 3명) 목록이 보안 규칙·화면·서버에서 같은지 대조한다 — 한 곳만 고치면 "버튼은 켜졌는데 저장이 거부"되거나 보호가 풀릴 수 있다.
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const P = await import('../app/shared/eval-perm.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rd = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const uidsIn = (txt, fnName) => { const i = txt.indexOf(fnName); if (i < 0) return null; const j = txt.indexOf('[', i), k = txt.indexOf(']', j); return [...txt.slice(j, k).matchAll(/'([A-Za-z0-9]{20,})'/g)].map((m) => m[1]); };
const ui = P.CYCLE_MANAGERS.map((m) => m.uid);
const blockRules = uidsIn(rd('../docs/rules/eval_rules_block.rules'), 'function isCycleManager'), fullRules = uidsIn(rd('../docs/rules/firestore.rules_테섭_평가추가본_2026-10-15.rules'), 'function isCycleManager');
ok(ui.length === 3 && new Set(ui).size === 3 && P.CYCLE_MANAGERS.map((m) => m.name).join() === '송지훈,김종화,김영희', '화면 목록: 송지훈·김종화·김영희 3명(중복 없음)');
ok(JSON.stringify(blockRules) === JSON.stringify(ui) && JSON.stringify(fullRules) === JSON.stringify(ui), '★ 보안 규칙(블록 파일·전체 추가본)의 사장단 목록이 화면 목록과 순서까지 같음');
// 서버 저장소는 별도라, 있을 때만 대조(서버 쪽 시험 eval.test.js 가 자기 목록을 따로 확인한다)
const srvPath = ['/tmp/pf/functions/eval-act.js', process.env.PORTAL_FUNCTIONS && process.env.PORTAL_FUNCTIONS + '/functions/eval-act.js'].filter(Boolean).find((f) => fs.existsSync(f));
if (srvPath) { const srv = fs.readFileSync(srvPath, 'utf8'); const su = uidsIn(srv, 'const CYCLE_MANAGERS'); ok(JSON.stringify(su) === JSON.stringify(ui), '★ 서버(eval-act.js)의 사장단 목록이 화면 목록과 같음'); } else console.log('SKIP 서버 목록 대조(서버 저장소 폴더 없음 — PORTAL_FUNCTIONS=경로 로 지정하면 대조)');
// 권한 판정
const adm = (o) => Object.assign({ admin: true, isGuest: false, rank: '대리', uid: 'x' }, o);
ok(ui.every((u) => P.canManageCycle(adm({ uid: u }))), '사장단 3명(관리자 계정)은 회차를 관리할 수 있음');
ok(!P.canManageCycle(adm({ uid: 'hr1', rank: '대리' })) && !P.canManageCycle(adm({ uid: 'z', rank: '대표' })) && !P.canManageCycle(adm({ uid: 'z', rank: '부사장' })), '★ 관리자 계정이라도 사장단 목록에 없으면 직급이 "대표"·"부사장"이어도 불가(직급은 바뀌는 값이라 믿지 않음)');
ok(!P.canManageCycle(adm({ uid: ui[0], admin: false })) && !P.canManageCycle(adm({ uid: ui[0], isGuest: true })) && !P.canManageCycle(adm({ uid: undefined })) && !P.canManageCycle(null), '사장단이라도 관리자 권한이 없거나 게스트이거나 uid 가 없으면 불가');
const evalAll = rd('../app/shared/eval-perm.js'); ok(!/EXEC\.indexOf[^\n]*canManageCycle|canManageCycle[^\n]*EXEC/.test(evalAll), 'canManageCycle 은 직급 목록(EXEC)을 쓰지 않음');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
