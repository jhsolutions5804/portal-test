import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/closing\.js\?v=([0-9a-z]+)/) || fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/\.js\?v=([0-9a-z]+)/) || [])[1];
const M = await import('../app/modules/plan/monthly-mgmt.js?v=' + VER);
/* 영업기획 월간 보고서 경영 층 1단계(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 그 달 원가·노무비 증분(서버 마진 보고를 그 달까지·전달까지 두 번 불러 차이)·월 마진율·노무 수율. 저장·호출 없는 순수 함수라 가짜 응답으로 시험한다. 공개 저장소라 가짜 id·값만 쓴다.
 * 매출 기준: 프로젝트 매출 = 완결 청구(1-2-3-a, 대표님 2026-10-21) — pjtMargin 과 같은 규칙. 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비(pjtCost 와 같은 정의, 노무비 이중 차감 없음). */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b)));
const REP = (projects, extra) => Object.assign({ ok: true, upTo: '2026-09', projects: projects.map(([pjt, overhead, ownLabor]) => ({ pjt, overhead, ownLabor, laborWage: ownLabor, laborInsurance: 0 })), estimated: true, employerRate: 0.1 }, extra || {});
const CUR = REP([['R1', 1500, 3000], ['R2', 200, 0]]), PREV = REP([['R1', 1000, 2000]], { upTo: '2026-08' });
console.log('── ⓐ 그 달 증분 monthDelta(cur, prev, 연결된 PJT 등록 id) = 그 달까지 누계 − 전달까지 누계');
eq(M.monthDelta(CUR, PREV, 'R1'), { direct: 500, ownLabor: 1000, restated: false }, '★ 그 달 현장경비 증분 1500 − 1000 = 500, 자체 직접노무비 증분 3000 − 2000 = 1000');
eq(M.monthDelta(CUR, PREV, 'R2'), { direct: 200, ownLabor: 0, restated: false }, '★ 전달 응답에 없는 프로젝트는 전달 0 으로 본다(그 달에 처음 생긴 원가) — 200 − 0');
eq(M.monthDelta(CUR, REP([], { upTo: '2026-08' }), 'R1'), { direct: 1500, ownLabor: 3000, restated: false }, '전달에 아무 프로젝트도 없으면(서버가 성공했는데 비어 있음) 전부 그 달 증분');
eq(M.monthDelta(CUR, CUR, 'R1'), { direct: 0, ownLabor: 0, restated: false }, '두 응답이 같으면 증분 0');
console.log('── 한쪽이라도 못 받았으면 계산하지 않는다(조용히 한쪽만으로 계산하면 누계가 그 달 값처럼 보인다)');
eq(M.monthDelta(null, PREV, 'R1'), null, '★ 그 달 누계를 못 받았으면 null');
eq(M.monthDelta(CUR, null, 'R1'), null, '★ 전달 누계를 못 받았으면 null — 누계 전체가 그 달 값으로 보이지 않게');
eq(M.monthDelta({ ok: false, projects: [] }, PREV, 'R1'), null, '서버가 ok 가 아니라고 하면 null');
eq(M.monthDelta({ ok: true }, PREV, 'R1'), null, 'projects 가 없는 응답은 null');
eq(M.monthDelta(CUR, { ok: true, projects: 'x' }, 'R1'), null, 'projects 가 배열이 아닌 응답은 null');
console.log('── 연결이 없으면 원가를 모른다');
for (const bad of ['', null, undefined, 3, {}, 'auto', 'none']) { const r = M.monthDelta(CUR, PREV, bad); ok(r === null, '★ 연결된 PJT 등록 id 가 ' + JSON.stringify(bad) + ' 이면 null — 모르는 값을 0 으로 꾸미지 않는다(대기열 1-2-2-④ 교훈)'); }
console.log('── 소급 정정: 과거 전표를 고치면 달별 값이 어긋날 수 있다(설계 §3-1 이 인정한 위험)');
eq(M.monthDelta(REP([['R1', 900, 3000]]), PREV, 'R1'), { direct: -100, ownLabor: 1000, restated: true }, '★ 증분이 음수면 그대로 보여 주고 restated: true — 전달까지의 값이 정정된 것');
eq(M.monthDelta(REP([['R1', 1500, 1500]]), PREV, 'R1'), { direct: 500, ownLabor: -500, restated: true }, '노무비 증분이 음수여도 restated');
eq(M.monthDelta(CUR, PREV, 'R1').restated, false, '둘 다 0 이상이면 restated 가 아니다');
console.log('── 이상한 숫자는 0 으로 본다(NaN·문자·음수 필드가 합계를 망치지 않게)');
eq(M.monthDelta(REP([['R1', 'x', NaN]]), PREV, 'R1'), { direct: -1000, ownLabor: -2000, restated: true }, '숫자가 아닌 값은 0 — 그 결과 증분이 음수가 되면 restated 로 드러난다');
console.log('── 전달 계산 prevYm');
eq(M.prevYm('2026-09'), '2026-08', '2026-09 의 전달은 2026-08');
eq(M.prevYm('2026-01'), '2025-12', '★ 1월의 전달은 전년 12월');
eq(M.prevYm('2024-03'), '2024-02', '윤년 3월의 전달');
for (const bad of ['', null, undefined, '2026-13', '2026-00', '26-09', 'x', 20260901, {}]) eq(M.prevYm(bad), '', '★ 형식이 틀린 월(' + JSON.stringify(bad) + ')은 빈 글자');
console.log('── ⓑ 프로젝트 행 monthRow — 영업기획 프로젝트 하나의 그 달 청구·지급·원가·마진율·노무 수율');
const P = { id: 'pjt_1', code: 'P4-2', name: '가짜현장', status: 'run', linkPjt: 'R1' };
const SUM = { invoiced: 10000, collected: 8000, payIssued: 2500, paid: 2000 };
{ const r = M.monthRow(P, SUM, CUR, PREV);
  eq([r.id, r.pjt, r.code, r.name], ['pjt_1', 'R1', 'P4-2', '가짜현장'], '★ 영업기획 id(pjt_1)와 연결된 PJT 등록 id(R1)를 둘 다 담는다');
  eq([r.invoiced, r.collected, r.payIssued, r.paid], [10000, 8000, 2500, 2000], '그 달 청구(발행)·완결·지급 발행·지급 완료는 월 마감 값 그대로');
  eq([r.direct, r.ownLabor, r.cost], [500, 1000, 4000], '★ 원가 = 지급예정서 발행 2500 + 현장경비 증분 500 + 자체 직접노무비 증분 1000 = 4000 (노무비를 지급예정서에서 또 빼지 않는다 — pjtCost 와 같은 정의)');
  eq(r.margin, 50, '★ 월 마진율 = (완결 8000 − 원가 4000) ÷ 8000 = 50%');
  eq(r.laborYield, 8, '★ 노무 수율 = 완결 8000 ÷ 자체 직접노무비 1000 = 8');
  eq(r.cost === 4000 && r.status, 'ok', '원가를 알면 status ok'); }
console.log('── 매출 기준은 완결 청구(1-2-3-a) — 발행했지만 수금(완결) 안 된 청구는 마진 분모가 아니다');
{ const r = M.monthRow(P, { invoiced: 10000, collected: 0, payIssued: 2500, paid: 0 }, CUR, PREV); eq(r.margin, null, '★ 그 달 완결 청구가 0 이면 마진율은 null — 발행 청구(10000)로 대신 계산하지 않는다(대신 계산하면 규칙이 조용히 깨진다)'); eq(r.laborYield, null, '완결이 0 이면 노무 수율도 null'); eq(r.invoiced, 10000, '발행 청구는 참고로 그대로 보인다'); }
{ const r = M.monthRow(P, { invoiced: 0, collected: -500, payIssued: 0, paid: 0 }, CUR, PREV); eq(r.margin, null, '완결이 음수(역분개 등)이면 null'); }
console.log('── 0 나눗셈 방지');
{ const r = M.monthRow(P, SUM, REP([['R1', 1000, 2000]]), PREV); eq(r.ownLabor, 0, '노무비 증분이 0'); eq(r.laborYield, null, '★ 노무비가 0 이면 노무 수율은 null(무한대를 내지 않는다)'); eq(r.margin, 68.8, '노무비가 0 이어도 마진율은 계산된다 (8000 − (2500 + 0 + 0)) ÷ 8000 = 68.75 → 68.8'); }
{ const r = M.monthRow(P, SUM, REP([['R1', 1000, 2000]]), PREV); ok(r.laborYield === null && !('laborYield' in r && typeof r.laborYield === 'number'), '★ 노무비가 0 이면 노무 수율은 정확히 null 이다 — JSON 비교는 Infinity·NaN 도 null 로 보이게 하므로 === 로 확인한다(화면에 Infinity 가 찍히지 않게)'); }
for (const [lab, coll, labor] of [['완결 0', 0, 1000], ['노무 0', 8000, 0], ['둘 다 0', 0, 0], ['완결 음수', -5, 1000]]) { const cur = REP([['R1', 1000, 2000 + labor]]); const r = M.monthRow(P, { invoiced: 1, collected: coll, payIssued: 0, paid: 0 }, cur, PREV); ok(r.laborYield === null || (typeof r.laborYield === 'number' && Number.isFinite(r.laborYield)), '★ ' + lab + ' — 노무 수율은 null 이거나 유한한 숫자다(Infinity·NaN 이 나오지 않는다) — ' + String(r.laborYield)); ok(r.margin === null || Number.isFinite(r.margin), lab + ' — 마진율도 null 이거나 유한한 숫자 — ' + String(r.margin)); }
{ const rows = M.monthRows([P], { byProject: [Object.assign({ id: 'pjt_1' }, SUM)] }, REP([['R1', 1000, 2000]]), PREV); const t = M.monthTotals(rows); ok(t.laborYield === null, '★ 합계도 노무비가 0 이면 노무 수율이 정확히 null 이다'); }
console.log('── 원가를 모르면(서버 실패·연결 없음) 마진율·수율을 내지 않는다');
{ const r = M.monthRow(P, SUM, null, PREV); eq([r.margin, r.laborYield, r.direct, r.ownLabor, r.cost], [null, null, null, null, null], '★ 서버 응답이 없으면 원가·마진율·노무 수율이 모두 null — 지급예정서만으로 원가를 꾸며 마진을 보이지 않는다'); eq(r.status, 'nocost', 'status 는 nocost'); eq([r.invoiced, r.collected], [10000, 8000], '그래도 청구·완결 금액은 보인다(월 마감에서 오는 값이라 서버와 무관)'); }
{ const r = M.monthRow(Object.assign({}, P, { linkPjt: 'none' }), SUM, CUR, PREV); eq(r.status, 'nolink', '★ 연결이 없으면 status nolink'); eq(r.margin, null, '연결이 없으면 마진율 null'); }
{ const r = M.monthRow(Object.assign({}, P, { linkPjt: '' }), SUM, CUR, PREV); eq(r.status, 'nolink', '연결이 비어 있어도 nolink'); }
console.log('── 소급 정정이면 표시를 남긴다');
{ const r = M.monthRow(P, SUM, REP([['R1', 900, 3000]]), PREV); eq(r.restated, true, '★ 증분이 음수이면 restated: true 를 행에 남긴다(화면이 "전달 값이 정정됨"을 보여 준다)'); eq(r.status, 'ok', '그래도 계산은 한다(숨기지 않는다)'); }
{ const r = M.monthRow(P, SUM, CUR, PREV); eq(r.restated, false, '정상이면 restated 거짓'); }
console.log('── 영업기획 id 로 응답을 찾으면 안 된다(대기열 1-2-2-④ 교훈)');
{ const byWrongId = REP([['pjt_1', 9999, 9999]]); const r = M.monthRow(P, SUM, byWrongId, REP([], { upTo: '2026-08' })); eq([r.direct, r.ownLabor], [0, 0], '★ 응답에 영업기획 id(pjt_1)로 된 줄이 있어도 쓰지 않는다 — 연결된 R1 로만 찾아서 R1 이 없으니 0 (영업기획 id 로 찾는 변이를 잡는다)'); }
console.log('── 월 마감 byProject 에 없는 프로젝트(그 달 청구·지급이 0)도 원가가 있으면 행이 나온다');
{ const projects = [P, { id: 'pjt_2', code: 'P4-3', name: '원가만있는현장', status: 'run', linkPjt: 'R2' }, { id: 'pjt_3', code: 'X', name: '아무것도없음', status: 'run', linkPjt: 'R9' }];
  const closing = { byProject: [Object.assign({ id: 'pjt_1', code: 'P4-2', name: '가짜현장', status: 'run' }, SUM)] };
  const rows = M.monthRows(projects, closing, CUR, PREV);
  eq(rows.map((r) => r.id), ['pjt_1', 'pjt_2'], '★ 청구가 없어도 그 달 원가가 있는 프로젝트(pjt_2, 200)는 행이 나오고, 청구도 원가도 없는 프로젝트(pjt_3)는 빠진다');
  eq(rows[1].cost, 200, '원가만 있는 달은 원가 200(지급예정서 0 + 현장경비 200 + 노무 0)'); eq(rows[1].margin, null, '그 달 완결이 없으니 마진율은 null'); }
{ const rows = M.monthRows([P], { byProject: [] }, CUR, PREV); eq(rows.length, 1, '월 마감 byProject 가 비어 있어도 원가가 있으면 행이 나온다'); }
{ const rows = M.monthRows([P], null, CUR, PREV); ok(Array.isArray(rows), '월 마감 요약이 없어도 던지지 않는다'); }
{ const rows = M.monthRows([P], { byProject: [Object.assign({ id: 'pjt_1' }, SUM)] }, null, null); eq([rows.length, rows[0].status], [1, 'nocost'], '서버 응답이 없으면 청구가 있는 프로젝트는 행이 나오되 원가는 모름(nocost)'); }
console.log('── 합계 monthTotals');
{ const rows = M.monthRows([P, { id: 'pjt_2', code: 'P4-3', name: '원가만', status: 'run', linkPjt: 'R2' }], { byProject: [Object.assign({ id: 'pjt_1' }, SUM)] }, CUR, PREV); const t = M.monthTotals(rows);
  eq([t.invoiced, t.collected, t.payIssued, t.cost], [10000, 8000, 2500, 4200], '★ 합계: 발행 10000 · 완결 8000 · 지급 발행 2500 · 원가 4000 + 200 = 4200');
  eq(t.margin, 47.5, '★ 합계 마진율 = (8000 − 4200) ÷ 8000 = 47.5%');
  eq(t.laborYield, 8, '합계 노무 수율 = 8000 ÷ (1000 + 0) = 8');
  eq(t.unknown, 0, '원가를 모르는 프로젝트가 없으면 unknown 0'); }
{ const rows = M.monthRows([P, Object.assign({}, P, { id: 'pjt_9', linkPjt: 'none' })], { byProject: [Object.assign({ id: 'pjt_1' }, SUM), Object.assign({ id: 'pjt_9' }, SUM)] }, CUR, PREV); const t = M.monthTotals(rows); eq(t.unknown, 1, '★ 원가를 모르는 프로젝트(연결 없음) 1개는 unknown 으로 알리고'); eq(t.margin, null, '★ 합계 마진율도 내지 않는다(원가를 모르는 프로젝트의 완결 청구를 분모에 넣고 원가는 0 으로 두면 마진이 부풀려진다)'); }
eq(M.monthTotals([]), { invoiced: 0, collected: 0, payIssued: 0, paid: 0, direct: 0, ownLabor: 0, cost: 0, margin: null, laborYield: null, unknown: 0, restated: 0 }, '행이 없으면 전부 0·null');
console.log('── 안전: 입력을 바꾸지 않고 이상한 입력에 던지지 않는다');
{ const a = JSON.parse(JSON.stringify(CUR)), b = JSON.parse(JSON.stringify(PREV)), s = JSON.parse(JSON.stringify(SUM)); M.monthRow(P, s, a, b); M.monthDelta(a, b, 'R1'); ok(JSON.stringify(a) === JSON.stringify(CUR) && JSON.stringify(b) === JSON.stringify(PREV) && JSON.stringify(s) === JSON.stringify(SUM), '입력(응답·요약)을 바꾸지 않는다'); }
for (const bad of [null, undefined, 3, 'x', [], {}]) { let threw = false; try { M.monthRow(bad, bad, bad, bad); M.monthRows(bad, bad, bad, bad); M.monthTotals(bad); M.monthDelta(bad, bad, bad); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const r = M.monthRow({ id: 'pjt_1', linkPjt: 'R1' }, { invoiced: 1, collected: 1 }, CUR, PREV); ok(r && typeof r === 'object', '프로젝트 이름·코드가 없어도 행을 만든다'); }
ok(pass + fail >= 86, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
