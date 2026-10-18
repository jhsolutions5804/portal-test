/* 모바일(m/) 고정 프로젝트(P4 Ph2·Ph4)의 일정 저장 경로 시험 — 대표님 결정7(2026-10-19): 모바일도 PC 와 같은 새 구조(pjt_registry/<id>/schedules)를 읽고 쓴다.
 * 배경: 모바일이 옛 컬렉션(user_schedules·ph4_schedules)에 쓰면 PC 달력·이력(서버 자동 기록은 새 구조만 감시)에 안 보이고 두 곳이 어긋난다.
 * 페이지(m/pjt.html)의 경로 함수를 소스에서 꺼내 가짜 collection/doc 으로 실제 실행해 가리키는 경로를 확인한다. */
import fs from 'node:fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const PJT = fs.readFileSync(new URL('../m/pjt.html', import.meta.url), 'utf8');
const HOME = fs.readFileSync(new URL('../m/home.html', import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // 주석은 제외하고 코드만 본다
const PJTC = strip(PJT), HOMEC = strip(HOME);

// ── 1) 옛 컬렉션 이름이 코드에 남아 있지 않다
ok(!/user_schedules|ph4_schedules/.test(PJTC), '★ m/pjt.html 코드에 옛 일정 컬렉션(user_schedules·ph4_schedules)이 남아 있지 않다');
ok(!/user_schedules|ph4_schedules/.test(HOMEC), '★ m/home.html 코드에 옛 일정 컬렉션이 남아 있지 않다');

// ── 2) 경로 함수를 꺼내 실제로 실행
const grab = (name) => { const m = new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{[^\\n]*\\}').exec(PJT); return m ? m[0] : ''; };
const src = ['schReg', 'schedList', 'schColl', 'schDocRef'].map(grab);
ok(src.every(Boolean), '경로 함수 4개(schReg·schedList·schColl·schDocRef)가 한 줄 함수로 있다 — 없는 것: ' + ['schReg', 'schedList', 'schColl', 'schDocRef'].filter((n, i) => !src[i]).join(','));
let F = null;
if (src.every(Boolean)) {
  const data = { light_p4ph2: [{ id: 'a' }], light_p4ph4: [{ id: 'b' }], light_abc: [{ id: 'c' }], light_p4ph2_only: [] };
  const collection = (_db, ...p) => 'C:' + p.join('/'); const doc = (_db, ...p) => 'D:' + p.join('/');
  F = new Function('data', 'collection', 'doc', 'db', src.join('\n') + '\nreturn { schReg, schedList, schColl, schDocRef };')(data, collection, doc, {});
}
const SITES_SRC = /const SITES=\{([\s\S]*?)\n\};/.exec(PJT); const SITES = SITES_SRC ? SITES_SRC[1] : '';
const fabDef = /fab:\{[^}]*\}/.exec(SITES); const supDef = /sup:\{[^}]*\}/.exec(SITES);
ok(fabDef && /schReg:'p4ph2'/.test(fabDef[0]) && supDef && /schReg:'p4ph4'/.test(supDef[0]), '고정 프로젝트 정의에 새 구조 키가 있다(fab=p4ph2, sup=p4ph4)');
const fab = { type: 'fixed', schReg: 'p4ph2' }, sup = { type: 'fixed', schReg: 'p4ph4' }, light = { type: 'light', regId: 'abc' };
if (F) {
  ok(F.schColl(fab) === 'C:pjt_registry/p4ph2/schedules', '★ P4 Ph2 일정 목록 경로 = pjt_registry/p4ph2/schedules  (실제: ' + F.schColl(fab) + ')');
  ok(F.schColl(sup) === 'C:pjt_registry/p4ph4/schedules', '★ P4 Ph4 일정 목록 경로 = pjt_registry/p4ph4/schedules  (실제: ' + F.schColl(sup) + ')');
  ok(F.schDocRef(fab, 'x1') === 'D:pjt_registry/p4ph2/schedules/x1' && F.schDocRef(sup, 'x2') === 'D:pjt_registry/p4ph4/schedules/x2', '★ 저장·수정·삭제·완료 체크가 가리키는 일정 문서 경로가 새 구조다');
  ok(F.schColl(light) === 'C:pjt_registry/abc/schedules' && F.schDocRef(light, 'y') === 'D:pjt_registry/abc/schedules/y', '경량 프로젝트는 기존 그대로(회귀 없음)');
  ok(F.schedList(fab)[0].id === 'a' && F.schedList(sup)[0].id === 'b' && F.schedList(light)[0].id === 'c', '일정 목록은 프로젝트별로 새 구조 구독 결과를 읽는다');
  ok(F.schedList({ type: 'fixed', schReg: 'nope' }).length === 0, '구독 결과가 없으면 빈 목록(오류 없음)');
}

// ── 3) 구독 시작과 홈의 오늘 일정 숫자
ok(/\['p4ph2',\s*'p4ph4'\]\.forEach\(ensureLightSchedSub\)/.test(PJTC), '★ 앱 시작 때 두 고정 프로젝트의 새 구조 일정을 구독한다');
ok(/collection\(db,\s*'pjt_registry',\s*'p4ph2',\s*'schedules'\)/.test(HOMEC) && /collection\(db,\s*'pjt_registry',\s*'p4ph4',\s*'schedules'\)/.test(HOMEC), '★ 모바일 홈의 오늘 일정 숫자도 새 구조(p4ph2·p4ph4)를 읽는다');
ok(/_todayCounts\.fab\s*=\s*c/.test(HOMEC) && /_todayCounts\.sup\s*=\s*c/.test(HOMEC), '오늘 일정 숫자 계산(fab·sup)은 그대로 유지된다');

// ── 4) 모바일 통합 일정 화면(m/schedule.html) — 저장·삭제·완료 체크가 colPath 경로를 쓰므로 여기가 가장 큰 어긋남의 원인이었다
const SCH = fs.readFileSync(new URL('../m/schedule.html', import.meta.url), 'utf8'); const SCHC = strip(SCH);
ok(!/user_schedules|ph4_schedules/.test(SCHC), '★ m/schedule.html 코드에 옛 일정 컬렉션이 남아 있지 않다');
const cp = /function colPath\(key\)\{[\s\S]*?\n\}/.exec(SCH);
ok(!!cp, 'colPath 함수가 있다');
if (cp) {
  const colPath = new Function(cp[0] + '\nreturn colPath;')();
  ok(colPath('fab').join('/') === 'pjt_registry/p4ph2/schedules' && colPath('sup').join('/') === 'pjt_registry/p4ph4/schedules', '★ 통합 일정에서 FAB·SUP 일정을 저장·삭제·완료 체크하는 경로가 새 구조다  (실제: ' + colPath('fab').join('/') + ' | ' + colPath('sup').join('/') + ')');
  ok(colPath('reg_abc').join('/') === 'pjt_registry/abc/schedules' && colPath('comp').join('/') === 'company_schedules' && colPath('zzz') === null, '경량 프로젝트·회사 공통 일정 경로는 그대로(회귀 없음)');
}
ok(/collection\(db,\s*'pjt_registry',\s*'p4ph2',\s*'schedules'\)[^\n]*fabSched\s*=\s*arr/.test(SCHC) && /collection\(db,\s*'pjt_registry',\s*'p4ph4',\s*'schedules'\)[^\n]*supSched\s*=\s*arr/.test(SCHC), '★ FAB·SUP 일정 구독이 새 구조를 읽는다');
ok(/forEach\(d=>\{[^\n]*(p4ph2[^\n]*p4ph4|p4ph4[^\n]*p4ph2)[^\n]*return[^\n]*\}\);?[\s\S]{0,200}ensureLightSub|if\(\s*FIXED_IDS?\.includes\(d\.id\)|if\(\s*\(?d\.id\s*===\s*'p4ph2'/.test(SCHC), '★ 등록 프로젝트 구독이 고정 프로젝트(p4ph2·p4ph4)를 건너뛴다 — 같은 경로를 두 번 읽어 일정이 FAB·프로젝트 이름으로 두 번 보이는 것 방지');

console.log('\n' + (fail ? fail + '건 실패' : '전부 통과') + ' (' + pass + '건)'); process.exit(fail ? 1 : 0);
