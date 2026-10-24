import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const M = await import('../app/modules/plan/monthly-mgmt.js?v=' + VER);
const IO = await import('../app/modules/plan/monthly-mgmt-io.js?v=' + VER);
const V = await import('../app/modules/plan/monthly-mgmt-view.js?v=' + VER);
const C = await import('../app/modules/plan/monthly-mgmt-csv.js?v=' + VER);
const B = await import('../app/modules/plan/budget.js?v=' + VER);
/* 월간 보고서 경영 층 4단계 — 원가 달성률을 실행예산 기준으로(대기열 1-3-9, 대표님 2026-10-24 ㅇㅇ). 프로젝트에 유효한 실행예산이 있으면 총 계획(예비비 포함)이 목표 원가, 없으면 지금처럼 목표 마진율 기준(둘을 구분 표기). 실제 원가 = 지급예정서 발행 누계(외주) + 현장경비 + 자체 직접노무비(자체 노무)로 비목 실적과 같다. 공개 저장소라 가짜 값만 쓴다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b)));
const REP = (over, labor, upTo) => ({ ok: true, upTo: upTo || '2026-09', projects: [{ pjt: 'R1', overhead: over, ownLabor: labor, laborWage: labor, laborInsurance: 0 }], estimated: true, employerRate: 0.1 });
const P = (o) => Object.assign({ id: 'pjt_1', code: 'P4-2', name: '가짜현장', status: 'run', linkPjt: 'R1', targetMargin: 12, createdAt: { seconds: 1 } }, o || {});
const EST = [{ id: 'e1', pjtId: 'pjt_1', status: 'active', items: [{ qty: 1, price: 10000000 }] }];
const PAY = (amt, ym) => ({ id: 'p' + amt + ym, docType: 'payment', status: 'active', pjtId: 'pjt_1', pjtIds: ['pjt_1'], issueDate: (ym || '2026-09') + '-05', amount: amt, supply: amt });
const SET = [PAY(1000000)];
const R = (cat, amount, extra) => Object.assign({ cat, name: '내역 ' + cat, amount, memo: '' }, extra || {});
const NOW = '2026-10-24T09:00:00.000Z';
const BUD = (rows, id) => B.buildBudgetSave(null, rows || [R('sub', 1500000), R('labor', 600000), R('site', 400000), R('reserve', 200000)], { pjtId: id || 'pjt_1', note: '', now: NOW, by: 'u' }).doc; // 계획 총 2,700,000(예비비 포함), 예비비 제외 2,500,000
const bud = BUD();
const row = (cur, b, p, e, s) => M.achievementRow(p || P(), e === undefined ? EST : e, s === undefined ? SET : s, cur, '2026-09', b);

console.log('── 실행예산 기준 행: 계획 270만 / 실제(외주 100만 + 노무 70만 + 현장경비 30만) 200만');
{ const a = row(REP(300000, 700000), bud);
  ok(a.status === 'ok' && a.basis === 'budget' && a.budgetRev === 1, '★ 실행예산이 있으면 기준이 실행예산(r1)이다');
  ok(a.plan === 2700000 && a.targetCost === 2700000, '★ 목표(계획) 원가 = 실행예산 총 계획(예비비 포함) 2,700,000 — 견적×(1−목표 마진율)이 아니다');
  ok(a.payIssued === 1000000 && a.direct === 300000 && a.ownLabor === 700000 && a.cost === 2000000, '실제 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비(마진 모듈과 같은 정의) 2,000,000');
  ok(a.rate === 74.1 && a.over === false && a.usingReserve === false, '★ 달성률 74.1%·초과 아님·예비비 사용 아님');
  ok(Array.isArray(a.byCat) && a.byCat.map((c) => c.cat).join() === 'sub,labor,site,reserve', '비목별 4줄(외주·자체 노무·현장경비·예비비)');
  const c = Object.fromEntries(a.byCat.map((x) => [x.cat, x]));
  ok(c.sub.plan === 1500000 && c.sub.actual === 1000000 && c.sub.rate === 66.7 && c.sub.over === false, '외주: 지급예정서 발행 100만 / 계획 150만 = 66.7%');
  ok(c.labor.plan === 600000 && c.labor.actual === 700000 && c.labor.rate === 116.7 && c.labor.over === true, '★ 자체 노무: 70만 / 60만 = 116.7% 초과(총계는 안이어도 비목은 초과가 드러난다)');
  ok(c.site.plan === 400000 && c.site.actual === 300000 && c.site.rate === 75 && c.site.over === false, '현장경비 30만 / 40만 = 75%');
  ok(c.reserve.plan === 200000 && c.reserve.actual === null && c.reserve.rate === null, '예비비는 계획만(실적·달성률 없음)');
  ok(a.target === 12, '목표 마진율 입력값(12)은 그대로 보존된다(계산에 쓰지 않을 뿐)'); }

console.log('── 예비비 사용 중 · 초과');
{ const a = row(REP(900000, 700000), bud); ok(a.cost === 2600000 && a.over === false && a.usingReserve === true && a.rate === 96.3, '★ 실제 260만 > 예비비 제외 계획 250만, ≤ 총 계획 270만 → 예비비 사용 중(초과 아님)'); }
{ const a = row(REP(1100000, 700000), bud); ok(a.cost === 2800000 && a.over === true && a.usingReserve === false && a.rate === 103.7, '★ 실제 280만 > 총 계획 270만 → 초과(예비비 사용 중과 겹치지 않는다)'); }
{ const a = row(REP(800000, 700000), bud); ok(a.cost === 2500000 && a.usingReserve === false && a.over === false, '정확히 예비비 제외 계획(250만)과 같으면 아직 예비비를 쓰지 않은 것'); }

console.log('── 견적이 없어도 실행예산이 있으면 나온다 / 연결·원가를 모를 때');
{ const a = row(REP(300000, 700000), bud, P(), []); ok(a.status === 'ok' && a.basis === 'budget' && a.est === 0 && a.plan === 2700000, '★ 견적이 없어도 실행예산이 있으면 noest 로 빠지지 않는다'); }
{ const a = row(REP(300000, 700000), bud, P({ linkPjt: 'none' })); ok(a.status === 'nolink' && a.basis === 'budget' && a.plan === 2700000 && a.cost === null && a.rate === null && a.byCat === null, '★ PJT 연결이 없으면 nolink — 계획은 보이고 원가·달성률은 꾸미지 않는다'); }
{ const a = row(null, bud); ok(a.status === 'nocost' && a.basis === 'budget' && a.plan === 2700000 && a.cost === null && a.rate === null && a.over === null, '★ 서버 원가를 모르면 nocost — 지급예정서만으로 달성률을 내지 않는다'); }
{ const a = row({ ok: true, upTo: '2026-09', projects: [] }, bud); ok(a.status === 'ok' && a.direct === 0 && a.ownLabor === 0 && a.cost === 1000000, '서버가 성공했는데 그 프로젝트 항목이 없으면 현장경비·자체 노무는 0 으로 본다(마진 모듈·월간 보고서가 이미 쓰는 규칙) — 지급예정서 100만만 실제 원가'); }

console.log('── 지급예정서는 선택한 달까지만(외주 실적)');
{ const a = row(REP(300000, 700000), bud, P(), EST, SET.concat([PAY(500000, '2026-10')])); ok(a.payIssued === 1000000 && a.cost === 2000000, '다음 달(10월) 발행분은 9월 누계에 넣지 않는다'); }

console.log('── 실행예산이 없거나 쓸 수 없을 때는 지금과 같다(목표 마진율 기준)');
{ const base = M.achievementRow(P(), EST, SET, REP(300000, 700000), '2026-09'); const a = row(REP(300000, 700000), undefined), n = row(REP(300000, 700000), null);
  ok(JSON.stringify(a) === JSON.stringify(n) && a.basis !== 'budget' && !a.budgetBad && a.plan === undefined && a.byCat === undefined && !a.usingReserve, '★ budget 인자가 없거나 null 이면 기준 margin, 새 필드는 비어 있다');
  ok(base.targetCost === 8800000 && base.status === 'ok' && base.cost === 2000000 && base.rate === 22.7 && base.over === false && base.est === 10000000 && base.target === 12, '★ 기존 계산(견적 1,000만 × (1−12%) = 880만, 실제 200만, 22.7%)이 그대로다'); }
{ const bad = { pjtId: 'pjt_1', rev: 1, rows: [{ cat: 'foo', name: 'x', amount: 1 }], history: [] }; const a = row(REP(300000, 700000), bad); ok(a.basis !== 'budget' && a.budgetBad === true && a.targetCost === 8800000 && a.rate === 22.7, '★ 깨진 실행예산은 목표 마진율 기준으로 돌아가고 budgetBad 로 알린다(깨진 숫자로 계산하지 않는다)'); }
{ const zero = { pjtId: 'pjt_1', rev: 1, rows: [R('sub', 0)], note: '', savedAt: NOW, by: '', history: [] }; const a = row(REP(300000, 700000), zero); ok(a.basis !== 'budget' && !a.budgetBad, '합계가 0 인 실행예산은 없는 것으로 보고(오류 아님) 목표 마진율 기준'); }
{ const a = row(REP(300000, 700000), 'x'); const b2 = row(REP(300000, 700000), [1]); ok(a.basis !== 'budget' && b2.basis !== 'budget', '객체가 아닌 값은 없는 것으로 본다'); }
{ const a = row(REP(300000, 700000), undefined, P(), []); ok(a.status === 'noest' && a.basis !== 'budget', '실행예산도 견적도 없으면 지금처럼 noest'); }
{ const a = row(REP(300000, 700000), undefined, P({ targetMargin: undefined })); ok(a.status === 'notarget', '실행예산이 없고 목표 마진율도 없으면 지금처럼 notarget'); }

console.log('── 미배정·입력을 바꾸지 않음');
{ const u = BUD([R('sub', 1500000), R('', 50000)]); const a = row(REP(300000, 700000), u); ok(a.warnUnassigned === true && a.plan === 1550000 && a.byCat.find((x) => x.cat === 'sub').plan === 1500000, '비목 미배정 금액은 총 계획에는 들어가고 비목별에서는 빠지며 경고가 켜진다'); }
{ const b0 = JSON.stringify(bud), e0 = JSON.stringify(EST), s0 = JSON.stringify(SET), c = REP(300000, 700000), c0 = JSON.stringify(c), p = P(), p0 = JSON.stringify(p); row(c, bud, p); ok(JSON.stringify(bud) === b0 && JSON.stringify(EST) === e0 && JSON.stringify(SET) === s0 && JSON.stringify(c) === c0 && JSON.stringify(p) === p0, '입력(실행예산·견적·정산서·서버 응답·프로젝트)을 바꾸지 않는다'); }

console.log('── 실행예산 문서 읽기 parseBudgets(문서 목록 → Map)');
{ const docs = [Object.assign({ id: 'pjt_1' }, bud), Object.assign({ id: 'pjt_2' }, BUD(null, 'pjt_2'))]; const r = M.parseBudgets(docs); ok(r.map instanceof Map && r.map.size === 2 && r.map.get('pjt_1').rev === 1 && r.bad.length === 0, '정상 문서는 프로젝트 id 로 찾는다'); }
{ const r = M.parseBudgets([Object.assign({ id: 'pjt_1' }, bud), { id: 'pjt_9', pjtId: 'pjt_9', rev: 0, rows: [] }, Object.assign({ id: 'pjt_x' }, bud)]); ok(r.map.size === 1 && r.bad.join() === 'pjt_9,pjt_x', '★ 깨진 문서와 문서 번호가 안의 프로젝트 번호와 다른 문서는 bad 로 알리고 쓰지 않는다'); }
for (const x of [null, undefined, 'x', 5, {}]) ok(M.parseBudgets(x).map.size === 0 && M.parseBudgets(x).bad.length === 0, '목록이 아니면 빈 결과(' + JSON.stringify(x) + ')');
ok(M.parseBudgets([null, 5, 'x', { rev: 1 }, { id: 5 }]).map.size === 0, '객체가 아니거나 id 가 없는 항목은 건너뛴다');
{ const r = M.parseBudgets([Object.assign({ id: '__proto__' }, BUD(null, '__proto__'))]); ok(r.map.size === 0 && ({}).rev === undefined, '__proto__ 같은 문서 번호도 안전하다(문서 번호 규칙에 걸려 bad)'); }

console.log('── achievementRows(목록)');
{ const projects = [P(), P({ id: 'pjt_2', code: 'A2', name: '실행예산 없음', linkPjt: 'R2' }), P({ id: 'pjt_3', code: 'A3', name: '견적도 없음', linkPjt: 'R3' })];
  const est = EST.concat([{ id: 'e2', pjtId: 'pjt_2', status: 'active', items: [{ qty: 1, price: 5000000 }] }]); const cur = { ok: true, upTo: '2026-09', projects: [{ pjt: 'R1', overhead: 300000, ownLabor: 700000 }, { pjt: 'R2', overhead: 100000, ownLabor: 100000 }, { pjt: 'R3', overhead: 0, ownLabor: 0 }], estimated: true };
  const budgets = new Map([['pjt_1', bud], ['pjt_3', BUD(null, 'pjt_3')]]); const rows = M.achievementRows(projects, est, SET, cur, '2026-09', budgets);
  ok(rows.map((r) => r.id + ':' + (r.basis === 'budget' ? 'budget' : 'margin')).join() === 'pjt_1:budget,pjt_2:margin,pjt_3:budget', '★ 실행예산이 있는 프로젝트는 기준 budget, 없는 프로젝트는 margin, 견적이 없어도 실행예산이 있으면 포함(순서는 프로젝트 순서)');
  const old = M.achievementRows(projects, est, SET, cur, '2026-09'); ok(old.map((r) => r.id).join() === 'pjt_1,pjt_2' && old.every((r) => r.basis !== 'budget'), '★ budgets 인자가 없으면 지금과 같다(견적 없는 pjt_3 은 빠진다)');
  const withBad = M.achievementRows(projects, est, SET, cur, '2026-09', new Map([['pjt_1', bud]]), ['pjt_2', 'pjt_x']); ok(withBad.find((r) => r.id === 'pjt_2').budgetBad === true && !withBad.find((r) => r.id === 'pjt_1').budgetBad && withBad.find((r) => r.id === 'pjt_2').basis !== 'budget', '★ 걸러 낸 깨진 문서의 프로젝트(pjt_2)에만 budgetBad — 실행예산이 멀쩡한 프로젝트(pjt_1)는 영향 없음'); ok(M.achievementRows(projects, est, SET, cur, '2026-09', null, new Set(['pjt_2'])).find((r) => r.id === 'pjt_2').budgetBad === true, 'Set 으로 줘도 같다'); ok(M.achievementRows(projects, est, SET, cur, '2026-09', null, 'pjt_2').every((r) => !r.budgetBad), '배열·Set 이 아닌 값은 무시');
  const weird = M.achievementRows(projects, est, SET, cur, '2026-09', { pjt_1: bud }); ok(weird.every((r) => r.basis !== 'budget'), 'Map 이 아닌 값(일반 객체)은 없는 것으로 본다'); }

console.log('── 컨트롤러: 실행예산 읽기·실패·깨진 문서');
const tick = () => new Promise((r) => setTimeout(r, 0)); const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
const mk = (budgets) => { const log = { paints: 0 }; const d = { today: () => '2026-09-20', loadBase: async () => { const o = { projects: [P()], estimates: EST, settlements: SET }; if (budgets !== 'omit') o.budgets = budgets; return o; }, callMargin: async (pl) => REP(300000, 700000, pl.upTo), callMgmt: null, paint: () => { log.paints++; } }; return { log, ctl: IO.createMonthlyMgmtController(d) }; };
{ const { ctl } = mk([Object.assign({ id: 'pjt_1' }, bud)]); await ctl.open(); await settle(); const s = ctl.st; ok(s.budgetState === 'ok' && s.budgetBad.length === 0 && s.achState === 'ok' && s.ach.length === 1 && s.ach[0].basis === 'budget' && s.ach[0].rate === 74.1, '★ 실행예산을 읽으면 달성률 표가 실행예산 기준으로 만들어진다'); }
{ const { ctl } = mk('omit'); await ctl.open(); await settle(); const s = ctl.st; ok(s.budgetState === 'ok' && s.ach[0].basis !== 'budget' && s.ach[0].rate === 22.7, '실행예산 정보를 주지 않는 이전 방식(budgets 없음)도 그대로 동작한다(목표 마진율 기준)'); }
{ const { ctl } = mk(null); await ctl.open(); await settle(); const s = ctl.st; ok(s.budgetState === 'error' && s.ach[0].basis !== 'budget' && s.achState === 'ok', '★ 실행예산을 못 읽었으면(null) 화면은 목표 마진율 기준으로 보이되 budgetState 가 error — 화면이 그 사실을 알린다'); }
{ const bad = { id: 'pjt_1', pjtId: 'pjt_1', rev: 0, rows: [] }; const { ctl } = mk([bad]); await ctl.open(); await settle(); const s = ctl.st; ok(s.budgetState === 'ok' && s.budgetBad.join() === 'pjt_1' && s.ach[0].basis !== 'budget' && s.ach[0].budgetBad === true, '★ 깨진 실행예산 문서는 목록(budgetBad)에 올라가고, 그 프로젝트 행에는 budgetBad 가 붙어 표에서 어느 프로젝트인지 보인다(목표 마진율 기준 값)'); }
{ const { ctl } = mk([Object.assign({ id: 'pjt_1' }, bud)]); await ctl.open(); await settle(); await ctl.act('prev'); await settle(); ok(ctl.st.ym === '2026-08' && ctl.st.ach[0].basis === 'budget' && ctl.st.ach[0].plan === 2700000, '월을 넘겨도 실행예산이 유지된다(다시 읽지 않아도 같은 계획)'); }

console.log('── 화면');
const txt = (h) => String(h).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const ROW = (o) => Object.assign({ id: 'pjt_1', pjt: 'R1', code: 'P4-2', name: '가짜현장', status: 'ok', restated: false, invoiced: 10000, collected: 8000, payIssued: 2500, paid: 2000, direct: 500, ownLabor: 1000, cost: 4000, margin: 50, laborYield: 8 }, o || {});
const TOT = () => ({ invoiced: 10000, collected: 8000, payIssued: 2500, paid: 2000, direct: 500, ownLabor: 1000, cost: 4000, margin: 50, laborYield: 8, unknown: 0, restated: 0 });
const ST = (ach, o) => Object.assign({ ym: '2026-09', rows: [ROW()], totals: TOT(), srv: { state: 'ok', notes: [] }, cum: [], cumTotals: { collected: 0, cost: 0, margin: null, unknown: 0 }, achState: 'ok', ach, budgetState: 'ok', budgetBad: [] }, o || {});
const a1 = row(REP(300000, 700000), bud), a2 = row(REP(900000, 700000), bud), a3 = row(REP(1100000, 700000), bud), m1 = M.achievementRow(P({ id: 'pjt_2', code: 'A2', name: '목표만' }), EST.map((e) => Object.assign({}, e, { pjtId: 'pjt_2' })), [], REP(300000, 700000), '2026-09');
const achHtml = (st) => { const h = V.monthlyMgmtHtml(st); const i = h.indexOf('<h3>원가 달성률</h3>'); const j = h.indexOf('</section>', i); const sec = i < 0 ? '' : h.slice(i, j); const b = sec.indexOf('<tbody>'); return b < 0 ? '' : sec.slice(b, sec.indexOf('</tbody>', b)); }; // 달성률 표의 행만(카드 아래 설명문에는 판정 이름이 모두 적혀 있어 "이 문구는 없어야 한다" 시험이 설명문에 걸린다)
{ const h = V.monthlyMgmtHtml(ST([a1, m1])); const t = txt(h);
  ok(t.includes('실행예산 r1') && t.includes('목표 마진율'), '★ 프로젝트 이름 옆에 기준이 "실행예산 r1" / "목표 마진율"로 구분 표기된다(새 칸을 만들지 않아 기존 표 모양·칸 위치가 그대로다)');
  ok(t.includes('2,700,000') && t.includes('2,000,000') && t.includes('74.1') && t.includes('실행예산 안'), '계획 원가·실제 원가·달성률·판정(실행예산 안)');
  ok(t.includes('외주 66.7%') && t.includes('자체 노무 116.7%(초과)') && t.includes('현장경비 75%'), '★ 비목별 달성률이 프로젝트 이름 아래에 보이고 초과 비목은 글자로 표시된다'); }
{ const t = txt(achHtml(ST([a2]))); ok(t.includes('예비비 사용 중') && !t.includes('실행예산 초과'), '★ 예비비 사용 중이라고 글자로 알린다(초과와 구분)'); }
{ const t = txt(achHtml(ST([a3]))); ok(t.includes('실행예산 초과') && !t.includes('예비비 사용 중'), '초과는 "실행예산 초과"'); }
{ const t = txt(achHtml(ST([m1]))); ok(t.includes('목표 안') && !t.includes('실행예산 안'), '실행예산이 없는 프로젝트는 지금 판정 문구(목표 안)를 쓴다'); }
{ const nl = row(REP(300000, 700000), bud, P({ linkPjt: 'none' })); const t = txt(achHtml(ST([nl]))); ok(t.includes('PJT 연결 없음') && t.includes('2,700,000') && !t.includes('실행예산 안'), '연결이 없으면 계획은 보이고 판정은 이유(PJT 연결 없음)'); }
{ const t = txt(V.monthlyMgmtHtml(ST([a1], { budgetState: 'error' }))); ok(t.includes('실행예산을 불러오지 못해') && t.includes('목표 마진율 기준'), '★ 실행예산을 못 읽었으면 표 위에 "목표 마진율 기준으로만 표시한다"고 알린다(조용히 바꾸지 않는다)'); }
ok(!txt(V.monthlyMgmtHtml(ST([a1]))).includes('실행예산을 불러오지 못해'), '정상일 때는 그 알림이 없다');
{ const bad = row(REP(300000, 700000), { pjtId: 'pjt_1', rev: 1, rows: [{ cat: 'foo', name: 'x', amount: 1 }], history: [] }); const t = txt(achHtml(ST([bad]))); ok(t.includes('실행예산 오류'), '깨진 실행예산 프로젝트에는 "실행예산 오류"가 보이고 목표 마진율 기준 값으로 표시된다'); }
{ const t = txt(V.monthlyMgmtHtml(ST([a1], { budgetBad: ['pjt_9'] }))); ok(/깨진 실행예산 1개/.test(t), '읽을 수 없는 실행예산 문서가 있으면 개수를 알린다'); }
{ const t = txt(V.monthlyMgmtHtml(ST([a1]))); ok(/저장본/.test(t) && /목표 마진율 기준/.test(t), '★ 한계를 숨기지 않는다: 서버가 저장하는 저장본(스냅샷)은 아직 목표 마진율 기준임을 적는다'); }
{ const x = row(REP(300000, 700000), BUD([R('sub', 1500000, { name: '<img src=x onerror=alert(1)>' })]), P({ name: '<img src=x onerror=alert(1)>', code: '"><b>' })); const h = achHtml(ST([x])); ok(!/<img|<b>/.test(h), '★ 프로젝트 이름·코드의 태그가 살아나지 않는다'); }
{ const { createRequire } = await import('node:module'); const { JSDOM } = createRequire(import.meta.url)('../scripts/dev/node_modules/jsdom'); const d = new JSDOM('<body>' + V.monthlyMgmtHtml(ST([a1, a2, a3, m1])) + '</body>').window.document;
  const sec = [...d.querySelectorAll('section')].find((s) => s.querySelector('h3') && s.querySelector('h3').textContent.includes('원가 달성률')); const heads = [...sec.querySelectorAll('thead th')].map((x) => x.textContent.trim()); let bad = [];
  sec.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (i === 0) return; if (td.getAttribute('data-label') !== heads[i]) bad.push(heads[i] + '≠' + td.getAttribute('data-label')); }));
  ok(sec.querySelector('table').classList.contains('jh-plan__table--cards') && bad.length === 0 && heads.length === 7 && heads[3] === '목표 원가', '★ 폰 카드 전환: 모든 칸의 data-label 이 같은 열 머리글과 같은 글자이고 표는 기존 7칸 그대로다 ' + bad.slice(0, 2).join(' / ')); }

console.log('── 엑셀(CSV)');
const parse = (csv) => csv.replace(/^\ufeff/, '').split(/\r?\n/).map((l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }); // 따옴표로 감싼 칸을 제대로 푼다(모든 칸이 큰따옴표로 감싸진다)
{ const csv = C.monthlyMgmtCsv(ST([a1, a2, a3, m1])); const L = parse(csv); const i = L.findIndex((r) => (r[0] || '').startsWith('[원가 달성률')); const head = L[i + 1]; const r1 = L[i + 2];
  ok(head.join('|') === ['프로젝트', '견적 공급가액', '목표 마진율(%)', '목표 원가', '실제 원가(누계)', '달성률(%)', '판정', '기준', '외주 달성률(%)', '자체 노무 달성률(%)', '현장경비 달성률(%)'].join('|'), '★ 엑셀 달성률 머리글: 기존 7칸은 그대로 두고 끝에 기준·비목별 달성률 칸만 덧붙인다(엑셀을 이미 쓰는 사람의 열 위치가 바뀌지 않는다)');
  ok(r1[7] === '실행예산 r1' && r1[3] === '2700000' && r1[4] === '2000000' && r1[5] === '74.1' && r1[6] === '실행예산 안' && r1[8] === '66.7' && r1[9] === '116.7' && r1[10] === '75', '★ 실행예산 행: 기준·계획·실제·달성률·판정·비목별 숫자(쉼표·% 없이 숫자)');
  const rm = L[i + 5]; ok(rm[7] === '목표 마진율' && rm[6] === '목표 안' && rm[8] === '' && rm[9] === '' && rm[10] === '', '목표 마진율 기준 행은 비목별 칸이 비어 있다');
  ok(L[i + 3][6] === '예비비 사용 중' && L[i + 4][6] === '실행예산 초과', '판정 글자: 예비비 사용 중 / 실행예산 초과'); }
{ const nl = row(null, bud); const L = parse(C.monthlyMgmtCsv(ST([nl]))); const i = L.findIndex((r) => (r[0] || '').startsWith('[원가 달성률')); const r = L[i + 2]; ok(r[7] === '실행예산 r1' && r[3] === '2700000' && r[4] === '' && r[5] === '' && r[6] === '원가 확인 못함' && r[8] === '', '★ 원가를 모르면 실제 원가·달성률·비목별 칸이 비고 이유만 적힌다(엑셀은 회수되지 않으니 꾸미지 않는다)'); }
{ const x = row(REP(300000, 700000), bud, P({ name: '=1+1', code: '+A' })); const csv = C.monthlyMgmtCsv(ST([x])); ok(!/(^|,)[=+@-]1\+1/.test(csv.split('\n').find((l) => l.includes('1+1')) || ''), '수식으로 시작하는 프로젝트 이름은 엑셀에서 수식으로 실행되지 않게 보호된다'); }

console.log('\n' + (fail ? fail + '건 실패 / 통과 ' + pass : '전부 통과 (' + pass + '건)'));
process.exit(fail ? 1 : 0);
