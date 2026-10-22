import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const M = await import('../app/modules/plan/monthly-mgmt.js?v=' + VER);
/* 영업기획 월간 보고서 2단계 — 전체 프로젝트 월별 추이(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇㅇ). 서버 마진 집계(report)가 이제 byMonth(월별 프로젝트별 현장경비·임금·보험·자체 노무)를 한 번에 주므로 달마다 부르지 않는다.
 * 월별 값은 누계의 차이가 아니라 서버가 준 월별 값 그대로다(월별 보험은 월 임금마다 반올림 — 월별 값끼리만 쓰고 누계와 섞지 않는다). 규칙은 1단계 monthRow 와 같다: 매출 = 완결 청구, 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비,
 * 완결이 0 이하면 마진율 null, 자체 노무가 0 이하면 노무 수율 null, 모르는 값은 꾸미지 않는다. 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 계산했다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b)));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
console.log('── trendMonths(끝 달, 개수): 끝 달까지 n개월을 오래된 달부터');
eq(M.trendMonths('2026-10', 6), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'], '★ 2026-10 까지 6개월');
eq(M.trendMonths('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02'], '★ 해를 넘긴다(2026-02 까지 4개월 → 2025-11 부터)');
eq(M.trendMonths('2026-10', 1), ['2026-10'], '1개월이면 그 달만');
eq(M.trendMonths('2026-10'), M.trendMonths('2026-10', 6), '개수를 안 주면 6개월');
for (const bad of ['', null, undefined, '2026-13', '2026-00', 'x', 3, {}]) eq(M.trendMonths(bad, 6), [], '★ 끝 달 형식이 틀리면(' + JSON.stringify(bad) + ') 빈 목록');
for (const n of [0, -1, 1.5, NaN, 'x', null]) eq(M.trendMonths('2026-10', n), M.trendMonths('2026-10', 6), '개수가 이상하면(' + String(n) + ') 기본 6개월');
ok(M.trendMonths('2026-10', 500).length <= 24, '개수는 24개월까지만(화면이 끝없이 길어지지 않게)');
console.log('── monthRowFromMonthly(프로젝트, 월 마감 행, 서버 월별 항목): 차이 없이 월별 값 그대로');
const P = { id: 'pjt_1', code: 'P4-2', name: '가짜현장', status: 'run', linkPjt: 'R1' };
const SUM = { invoiced: 10000, collected: 8000, payIssued: 2500, paid: 2000 };
const ENT = { pjt: 'R1', overhead: 500, laborWage: 900, laborInsurance: 100, ownLabor: 1000 };
{ const r = M.monthRowFromMonthly(P, SUM, ENT);
  eq([r.id, r.pjt, r.code, r.name, r.status], ['pjt_1', 'R1', 'P4-2', '가짜현장', 'ok'], '영업기획 id 와 연결된 PJT 등록 id 를 둘 다 담는다');
  eq([r.direct, r.ownLabor], [500, 1000], '★ 월별 현장경비·자체 노무는 서버 값 그대로(500·1000) — 누계에서 뺀 값이 아니다');
  eq(r.cost, 4000, '★ 원가 = 지급예정서 2500 + 현장경비 500 + 자체 노무 1000 = 4000');
  eq(r.margin, 50, '★ 마진율 = (완결 8000 − 4000) ÷ 8000 = 50%'); eq(r.laborYield, 8, '★ 노무 수율 = 8000 ÷ 1000 = 8'); eq(r.restated, false, '월별 값에는 소급 정정 개념이 없다'); }
{ const a = M.monthRowFromMonthly(P, SUM, ENT); const b = M.monthRow(P, SUM, { ok: true, projects: [{ pjt: 'R1', overhead: 1500, ownLabor: 3000 }] }, { ok: true, projects: [{ pjt: 'R1', overhead: 1000, ownLabor: 2000 }] }); eq([a.cost, a.margin, a.laborYield], [b.cost, b.margin, b.laborYield], '★ 같은 월 값이면 1단계(누계 차이)와 월별 값 방식의 원가·마진율·노무 수율이 같다 — 두 화면의 숫자가 어긋나지 않는다(누계 1500−1000=500·3000−2000=1000 ↔ 월별 500·1000)'); }
eq(M.monthRowFromMonthly(P, SUM, undefined).cost, 2500, '★ 서버가 성공했는데 그 달 항목이 없으면 현장경비·노무는 0 — 원가는 지급예정서뿐(정말 없는 것)');
eq([M.monthRowFromMonthly(P, SUM, undefined).direct, M.monthRowFromMonthly(P, SUM, undefined).ownLabor, M.monthRowFromMonthly(P, SUM, undefined).status], [0, 0, 'ok'], '항목이 없으면 direct 0·ownLabor 0·ok');
eq(M.monthRowFromMonthly(P, SUM, undefined).laborYield, null, '노무가 0 이면 노무 수율 null(무한대 아님)');
{ const r = M.monthRowFromMonthly(P, { invoiced: 10000, collected: 0, payIssued: 2500, paid: 0 }, ENT); ok(r.margin === null && r.laborYield === null, '★ 완결 청구가 0 이면 마진율·노무 수율 null — 발행 청구로 대신 계산하지 않는다(1-2-3-a)'); eq(r.invoiced, 10000, '발행 청구는 참고로 그대로'); }
{ const r = M.monthRowFromMonthly(Object.assign({}, P, { linkPjt: 'none' }), SUM, ENT); eq([r.status, r.margin, r.cost, r.direct], ['nolink', null, null, null], '★ 연결이 없으면 nolink — 월별 값이 있어도 원가를 모른다'); }
{ const r = M.monthRowFromMonthly(Object.assign({}, P, { linkPjt: '' }), SUM, ENT); eq(r.status, 'nolink', '연결이 비어 있어도 nolink'); }
for (const bad of [null, undefined, 3, 'x', [], {}]) { let threw = false, r; try { r = M.monthRowFromMonthly(bad, bad, bad); } catch (e) { threw = true; } ok(!threw && r && typeof r === 'object', '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const r = M.monthRowFromMonthly(P, SUM, { pjt: 'R1', overhead: NaN, ownLabor: Infinity }); ok(fin(r.cost) && fin(r.direct) && fin(r.ownLabor), '★ 서버 값이 NaN·Infinity 여도 유한한 숫자로 다룬다(화면에 안 나온다)'); }
console.log('── trendMatrix(프로젝트, 월 마감 함수, 서버 byMonth, 월 목록): 프로젝트 × 월 행렬');
const MONTHS = ['2026-08', '2026-09', '2026-10'];
const closings = { '2026-08': { byProject: [{ id: 'pjt_1', invoiced: 5000, collected: 4000, payIssued: 1000, paid: 0 }] }, '2026-09': { byProject: [{ id: 'pjt_1', invoiced: 10000, collected: 8000, payIssued: 2500, paid: 2000 }, { id: 'pjt_2', invoiced: 3000, collected: 0, payIssued: 0, paid: 0 }] }, '2026-10': { byProject: [] } };
const closingOf = (ym) => closings[ym] || { byProject: [] };
const BY = [{ month: '2026-08', projects: [{ pjt: 'R1', overhead: 200, laborWage: 300, laborInsurance: 30, ownLabor: 330 }] }, { month: '2026-09', projects: [{ pjt: 'R1', overhead: 500, laborWage: 900, laborInsurance: 100, ownLabor: 1000 }, { pjt: 'R2', overhead: 40, laborWage: 0, laborInsurance: 0, ownLabor: 0 }] }];
const PROJ = [P, { id: 'pjt_2', code: 'P4-3', name: '연결없음', status: 'run', linkPjt: 'none' }, { id: 'pjt_3', code: 'P4-4', name: '활동없음', status: 'run', linkPjt: 'R3' }, { id: 'pjt_4', code: 'P4-5', name: '원가만', status: 'run', linkPjt: 'R2' }];
{ const t = M.trendMatrix(PROJ, closingOf, BY, MONTHS);
  eq(t.months, MONTHS, '월 목록을 그대로 담는다');
  eq(t.rows.map((r) => r.id), ['pjt_1', 'pjt_2', 'pjt_4'], '★ 청구·원가가 한 번이라도 있던 프로젝트만(pjt_3 활동 없음은 빠지고, 청구는 없지만 현장경비 40 이 있는 pjt_4 는 나온다)');
  const a = t.rows[0]; eq(a.cells.length, 3, '프로젝트마다 월 수만큼 칸이 있다'); eq(a.cells.map((c) => c.margin), [r1(((4000 - (1000 + 200 + 330)) / 4000) * 100), 50, null], '★ pjt_1 마진율: 8월 (4000−1530)÷4000=61.8%, 9월 50%, 10월 완결 없음 null');
  eq(a.cells.map((c) => c.laborYield), [r1(4000 / 330), 8, null], '★ pjt_1 노무 수율: 8월 4000÷330=12.1, 9월 8, 10월 null');
  eq(a.cells.map((c) => c.cost), [1530, 4000, 0], '★ 원가: 8월 1000+200+330, 9월 2500+500+1000, 10월 활동 없음 0');
  eq(t.rows[1].cells.map((c) => c.status), ['nolink', 'nolink', 'nolink'], '★ 연결 없는 프로젝트(pjt_2)는 모든 달 nolink — 청구는 있어도 원가를 모른다');
  eq(t.rows[1].cells[1].invoiced, 3000, '그래도 청구 금액은 보인다');
  eq(t.rows[2].cells.map((c) => c.direct), [0, 40, 0], '★ pjt_4(R2): 8월 항목 없음 0, 9월 현장경비 40, 10월 0'); }
function r1(n) { return Math.round(n * 10) / 10; }
console.log('── 월별 합계: 그 달 활동이 있는 프로젝트만, 원가를 모르는 프로젝트가 있으면 비운다');
{ const t = M.trendMatrix(PROJ, closingOf, BY, MONTHS); eq(t.totals.length, 3, '월 수만큼 합계가 있다');
  eq([t.totals[0].collected, t.totals[0].cost, t.totals[0].unknown], [4000, 1530, 0], '★ 8월 합계: 그 달 활동 있는 프로젝트는 pjt_1 뿐(pjt_2 연결 없음은 8월 활동이 없어 세지 않는다 — 활동 없는 달에 "모름"으로 합계를 비우지 않는다)');
  eq(t.totals[0].margin, r1(((4000 - 1530) / 4000) * 100), '8월 합계 마진율 61.8%');
  eq(t.totals[1].unknown, 1, '★ 9월 합계: 활동이 있는 pjt_2 가 연결이 없어 원가를 모른다 → unknown 1'); eq([t.totals[1].margin, t.totals[1].laborYield], [null, null], '★ 그래서 9월 합계 마진율·노무 수율은 비운다(부풀림 방지)');
  eq(t.totals[2].unknown, 0, '10월은 활동 있는 프로젝트가 없어 unknown 0'); eq([t.totals[2].collected, t.totals[2].margin], [0, null], '10월 합계 완결 0·마진율 null'); }
console.log('── 서버가 월별 값을 안 줬으면(byMonth 없음) 행렬을 만들지 않는다');
for (const bad of [undefined, null, 'x', 3, {}]) eq(M.trendMatrix(PROJ, closingOf, bad, MONTHS), null, '★ byMonth 가 ' + JSON.stringify(bad) + ' 이면 null — 모르는 원가를 0 으로 꾸며 마진을 부풀리지 않는다(서버가 아직 안 올라간 본섭 등)');
eq(M.trendMatrix(PROJ, closingOf, [], MONTHS) !== null, true, '★ byMonth 가 빈 배열이면(서버는 성공했는데 월별 값이 하나도 없음) 행렬은 만든다 — 원가는 정말 0');
eq(M.trendMatrix(PROJ, closingOf, BY, []), null, '월 목록이 비면 null');
eq(M.trendMatrix(PROJ, closingOf, BY, 'x'), null, '월 목록이 배열이 아니면 null');
console.log('── 연결된 PJT 등록 id 로 찾는다(영업기획 id 아님 — 대기열 1-2-2-④ 교훈)');
{ const wrong = [{ month: '2026-09', projects: [{ pjt: 'pjt_1', overhead: 9999, laborWage: 9999, laborInsurance: 0, ownLabor: 9999 }] }]; const t = M.trendMatrix([P], closingOf, wrong, MONTHS); eq(t.rows[0].cells[1].direct, 0, '★ 서버 응답에 영업기획 id(pjt_1)로 된 항목이 있어도 쓰지 않는다 — 연결된 R1 로만 찾아서 R1 이 없으니 0'); }
{ const ms = ['2026-08', '2026-09']; const t = M.trendMatrix([P], closingOf, BY, ms); t.months.push('2030-01'); t.months[0] = 'x'; eq(ms, ['2026-08', '2026-09'], '★ 돌려준 months 를 고쳐도 입력 월 목록은 안 바뀐다(복사해서 담는다 — 화면이 고치면 컨트롤러의 원본이 오염되지 않게)'); }
{ const t = M.trendMatrix([P], closingOf, BY, MONTHS); const c = t.rows[0].cells[2]; ok(c.laborYield === null && c.margin === null, '★ 완결·노무가 없는 달의 마진율·노무 수율은 정확히 null 이다(JSON 비교는 Infinity·NaN 도 null 로 보이게 하므로 === 로 확인)'); const z = M.monthRowFromMonthly(P, SUM, { pjt: 'R1', overhead: 0, ownLabor: 0 }); ok(z.laborYield === null && fin(z.margin), '★ 노무가 0 이면 노무 수율이 정확히 null 이고 마진율은 유한한 숫자다(무한대가 아니다)'); const w = M.trendMatrix([P], closingOf, [{ month: '2026-09', projects: [{ pjt: 'R1', overhead: 0, ownLabor: 0 }] }], MONTHS); ok(w.totals[1].laborYield === null, '합계의 노무 수율도 노무가 0 이면 정확히 null'); }
console.log('── 안전');
{ const sn = JSON.stringify([PROJ, BY, closings]); M.trendMatrix(PROJ, closingOf, BY, MONTHS); ok(JSON.stringify([PROJ, BY, closings]) === sn, '입력을 바꾸지 않는다'); }
for (const bad of [null, undefined, 3, 'x', [], {}]) { let threw = false, r; try { r = M.trendMatrix(bad, bad, bad, bad); M.trendMatrix(PROJ, bad, BY, MONTHS); M.trendMatrix(PROJ, () => { throw new Error('x'); }, BY, MONTHS); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const t = M.trendMatrix([P], () => ({ byProject: 'x' }), BY, MONTHS); ok(t && t.rows.length >= 0, '월 마감 요약이 이상해도 행렬을 만든다(청구 0 으로)'); }
{ const t = M.trendMatrix(PROJ, closingOf, [{ month: '2026-09', projects: [{ pjt: 'R1', overhead: NaN, ownLabor: Infinity, laborWage: NaN }, null, 3, 'x'] }, null, { month: 5 }, { projects: 'x' }], MONTHS); ok(!/NaN|Infinity|null"?\s*[,}]\s*"cost"/.test(JSON.stringify(t.rows.map((r) => r.cells.map((c) => [c.cost, c.direct, c.ownLabor])))) && t.rows[0].cells.every((c) => c.status === 'nolink' || fin(c.cost)), '★ 서버 월별 값이 이상해도(NaN·Infinity·null·문자) 원가·현장경비·노무는 유한한 숫자다'); }
ok(pass + fail >= 78, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
