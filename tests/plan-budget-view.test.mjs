// 실행예산 화면 조각·편집 초안 시험 — 설계: 비공개 저장소 app-docs/execution-budget-design.md(대기열 1-3-9, 3단계). 공개 저장소라 가짜 숫자만 쓴다.
import { createRequire } from 'module';
import { buildBudgetSave, importFromEstimates } from '../app/modules/plan/budget.js';
import { draftBlank, draftFromBudget, draftAddRow, draftDelRow, draftSet, draftPreview, draftAddFromImport, draftAddDecisions, budgetCardHtml, budgetPreviewHtml } from '../app/modules/plan/budget-view.js';
const require = createRequire(import.meta.url); const { JSDOM } = require('../scripts/dev/node_modules/jsdom');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = (v) => JSON.stringify(v);
const dom = (html) => new JSDOM('<body>' + html + '</body>').window.document;
const R = (cat, amount, extra) => Object.assign({ cat, name: '내역', amount, memo: '' }, extra || {});
const NOW = '2026-10-24T09:00:00.000Z', O = (e) => Object.assign({ pjtId: 'P1', note: '', now: NOW, by: 'U1' }, e || {});
const saved1 = buildBudgetSave(null, [R('sub', 1000000, { name: '외주 A' }), R('labor', 500000), R('reserve', 100000), R('', 50000, { name: '미정' })], O({ note: '첫 개정' })).doc;
const saved2 = buildBudgetSave(saved1, [R('sub', 1200000, { name: '외주 A' }), R('labor', 500000)], O({ note: '네고', now: '2026-10-25T09:00:00.000Z' })).doc;
const imp0 = { state: 'noest', groups: [], autoCost: 0, supply: 0, decisions: 0, multi: false };

// ── 초안 도우미
{ const d = draftBlank(); ok(d.rows.length === 1 && d.baseRev === 0 && d.note === '' && J(d.rows[0]) === J({ cat: '', name: '', amount: '', memo: '', src: 'manual' }), '새 초안: 빈 행 하나·baseRev 0'); }
{ const snap = J(saved2); const d = draftFromBudget(saved2); ok(d.baseRev === 2 && d.rows.length === 2 && d.rows[0].amount === '1200000' && typeof d.rows[0].amount === 'string' && d.note === '' && J(saved2) === snap, '저장본 → 초안: 금액은 글자, baseRev = 현재 개정, 원본은 그대로'); }
{ const b = buildBudgetSave(null, [R('site', 5, { src: 'est', estNo: 'EST-1' })], O()).doc; const d = draftFromBudget(b); ok(d.rows[0].src === 'est' && d.rows[0].estNo === 'EST-1', '출처·견적 번호도 초안으로 이어진다'); }
{ const d0 = draftBlank(), d1 = draftAddRow(d0); ok(d1.rows.length === 2 && d0.rows.length === 1 && d1 !== d0, '행 추가(원본 불변)');
  let d = draftBlank(); for (let i = 0; i < 250; i++) d = draftAddRow(d); ok(d.rows.length === 200, '행은 200개까지만 늘어난다'); }
{ const d = draftAddRow(draftAddRow(draftBlank())); const d1 = draftDelRow(d, 1); ok(d1.rows.length === 2 && d.rows.length === 3, '행 삭제(원본 불변)');
  ok(draftDelRow(draftBlank(), 0).rows.length === 1 && J(draftDelRow(draftBlank(), 0).rows[0]) === J(draftBlank().rows[0]), '마지막 행을 지우면 빈 행 하나가 남는다');
  ok(draftDelRow(d, 9) === d && draftDelRow(d, -1) === d && draftDelRow(d, 'x') === d && draftDelRow(d, 1.5) === d, '없는 번호는 무시(같은 객체를 돌려준다)'); }
{ const d = draftBlank(); const e = draftSet(d, 0, 'name', '가'); ok(e.rows[0].name === '가' && d.rows[0].name === '', '칸 바꾸기(원본 불변)');
  ok(draftSet(d, 0, 'amount', '1,000').rows[0].amount === '1,000' && draftSet(d, 0, 'memo', 'm').rows[0].memo === 'm' && draftSet(d, 0, 'cat', 'site').rows[0].cat === 'site' && draftSet(d, 0, 'cat', '').rows[0].cat === '', '이름·금액·메모·비목');
  ok(J(draftSet(d, 0, 'cat', 'foo')) === J(d) && J(draftSet(d, 0, 'src', 'est')) === J(d) && J(draftSet(d, 0, 'evil', 'x')) === J(d) && J(draftSet(d, 5, 'name', 'x')) === J(d) && J(draftSet(d, -1, 'name', 'x')) === J(d), '모르는 비목·칸·번호는 무시(출처는 화면에서 못 바꾼다)');
  ok(draftSet(d, 0, 'name', 5).rows[0].name === '5' && draftSet(d, 0, 'name', null).rows[0].name === '', '글자가 아닌 값은 글자로 바꿔 둔다'); }
// ── 미리보기
{ const p = draftPreview([R('sub', '1,000'), R('labor', 500), R('site', 1), R('reserve', 10), R('', 100), { cat: 'sub', name: '', amount: '', memo: '' }, R('sub', 'abc'), R('sub', '-5'), R('foo', 3)]);
  ok(p.sub === 1000 && p.labor === 500 && p.site === 1 && p.reserve === 10 && p.unassigned === 100 && p.total === 1611, '미리보기 합: 읽을 수 있는 금액만(쉼표 허용), 비목 미배정 따로');
  ok(p.invalid === 3 && p.blank === 1, '읽을 수 없는 행(글자·음수·모르는 비목)은 invalid 로 센다, 빈 행은 blank'); }
ok(draftPreview([]).total === 0 && draftPreview(null).total === 0 && draftPreview('x').invalid === 0, '이상한 입력이면 0');

// ── 견적 가져오기 초안
const calc = (qty, price, count) => ({ rows: [{ name: '품', unit: '식', qty: String(qty), price: String(price), total: '', remark: '' }], markup: '10', unit: '10000', count: String(count) });
const itemOk = (name) => ({ name, spec: '', qty: 2, price: 110000, amount: 220000, remark: '', calc: calc(2, 100000, 2) });
const itemNego = (name) => ({ name, spec: '', qty: 2, price: 100000, amount: 200000, remark: '', calc: calc(2, 100000, 2) });
const itemPlain = (name) => ({ name, spec: '', qty: 1, price: 50000, amount: 50000, remark: '' });
const itemBad = (name) => ({ name, spec: '', qty: 1, price: 1, amount: 1, remark: '', calc: { rows: [{ name: 'x', unit: '', qty: 'abc', price: '1', total: '', remark: '' }], markup: '10', unit: '10000', count: '1' } });
const EST = [{ no: 'EST-2026-001-r2', baseNo: 'EST-2026-001', rev: 2, status: 'active', pjtId: 'P1', items: [itemOk('가'), itemNego('<b>나</b>'), itemPlain('다'), itemBad('라')] }];
const imp = importFromEstimates(EST, 'P1');
{ const d = draftAddFromImport(draftBlank(), imp); ok(d.rows.length === 1 && d.rows[0].src === 'est' && d.rows[0].estNo === 'EST-2026-001-r2' && d.rows[0].amount === '200,000' && d.rows[0].cat === '', '견적 투입비 가져오기: 빈 행은 대체되고 견적 투입비 한 줄(비목 미배정·금액 200,000)');
  let e = draftSet(d, 0, 'cat', 'site'); e = draftSet(e, 0, 'name', '고친 이름'); const imp2 = JSON.parse(JSON.stringify(imp)); imp2.groups[0].autoCost = 300000; const f = draftAddFromImport(e, imp2);
  ok(f.rows.length === 1 && f.rows[0].amount === '300,000' && f.rows[0].cat === 'site' && f.rows[0].name === '고친 이름', '★ 다시 가져오면 같은 견적 줄의 금액만 갱신하고 사용자가 고른 비목·고친 이름은 그대로(중복 행 없음)');
  const g = draftAddFromImport(draftSet(draftBlank(), 0, 'name', '직접'), imp); ok(g.rows.length === 2 && g.rows[0].name === '직접', '내용이 있는 행은 지우지 않고 뒤에 붙인다'); }
ok(J(draftAddFromImport(draftBlank(), imp0)) === J(draftBlank()) && J(draftAddFromImport(draftBlank(), null)) === J(draftBlank()), '가져올 것이 없으면 초안 그대로');
{ const d = draftAddDecisions(draftBlank(), imp); ok(d.rows.length === 3 && d.rows.every((r) => r.amount === '' && r.src === 'manual' && r.cat === ''), '★ 정할 항목(금액만 고침·산식 없음·산식 오류) 3개를 금액 빈 행으로 추가 — 원가를 추측해 채우지 않는다');
  ok(/금액만 직접 고침/.test(d.rows[0].memo) && /산식 표 없음/.test(d.rows[1].memo) && /산식 표 오류/.test(d.rows[2].memo) && d.rows[0].name === '<b>나</b>', '메모에 이유가 남고 이름은 글자 그대로(이스케이프는 화면에서)');
  const again = draftAddDecisions(d, imp); ok(again.rows.length === 3, '같은 항목을 다시 추가해도 중복 행이 생기지 않는다');
  const long = JSON.parse(JSON.stringify(imp)); long.groups[0].items[1].name = 'x'.repeat(300); ok(draftAddDecisions(draftBlank(), long).rows.some((r) => r.name.length === 120), '긴 이름은 120자로 자른다'); }
ok(J(draftAddDecisions(draftBlank(), imp0)) === J(draftBlank()) && J(draftAddDecisions(draftBlank(), null)) === J(draftBlank()), '정할 항목이 없으면 초안 그대로');
{ let d = draftBlank(); for (let i = 0; i < 199; i++) d = draftAddRow(d); for (let i = 0; i < 200; i++) d = draftSet(d, i, 'name', 'n' + i); const e = draftAddDecisions(d, imp); ok(d.rows.length === 200 && e.rows.length === 200, '행이 모두 내용이 있고 200개면 더 추가하지 않는다(한도)'); }

// ── 상태별 화면
const D = (html) => dom(html);
ok(/불러오는 중/.test(budgetCardHtml(undefined, imp0)) && /불러오는 중/.test(budgetCardHtml({ state: 'loading' }, imp0)), '상태가 없거나 loading 이면 "불러오는 중"');
{ const d = D(budgetCardHtml({ state: 'error', error: '읽기 실패: <b>x</b>' }, imp0)); ok(d.querySelector('[role=alert]') && /읽기 실패/.test(d.body.textContent) && !d.querySelector('b') && d.querySelector('[data-bd-act="reload"]'), '오류: 이유(이스케이프됨)와 다시 불러오기 버튼'); }
{ const d = D(budgetCardHtml({ state: 'denied' }, imp0)); ok(/관리자/.test(d.body.textContent) && !d.querySelector('button'), '권한 없음: 안내만(버튼 없음)'); }
{ const d = D(budgetCardHtml({ state: 'corrupt', error: '깨짐 <i>이유</i>' }, imp0)); ok(/깨짐/.test(d.body.textContent) && !d.querySelector('i') && !d.querySelector('[data-bd-act="edit"]') && !d.querySelector('[data-bd-act="new"]'), '깨진 저장 문서: 이유만 보이고 수정·작성 버튼은 없다(그 위에 쓰지 않는다)'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: null }, imp0)); ok(/아직 실행예산이 없습니다/.test(d.body.textContent) && d.querySelector('[data-bd-act="new"]') && d.querySelector('[data-bd-act="new-import"]'), '저장본이 없으면 안내 + [작성]·[견적에서 가져와 작성]'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: saved1 }, imp0)); const t = d.body.textContent;
  ok(d.querySelector('[data-bd-read]') && /r1/.test(t) && /2026-10-24/.test(t) && /첫 개정/.test(t), '읽기: 개정 번호·저장일·메모');
  ok(/1,000,000/.test(t) && /500,000/.test(t) && /100,000/.test(t) && /1,650,000/.test(t), '읽기: 비목별 합과 총 계획(예비비·미배정 포함 1,650,000)');
  ok(d.querySelectorAll('[data-bd-read] tbody tr').length === 4 && /외주 A/.test(t), '읽기: 행 표');
  ok(/미배정/.test(t) && /50,000/.test(t) && d.querySelector('[data-bd-unassigned]'), '비목 미배정 금액이 있으면 경고 문구');
  ok(d.querySelector('[data-bd-act="edit"]') && !d.querySelector('[data-bd-act="history"]'), '수정(개정) 버튼 — 이력이 없으면 이력 버튼은 없다'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: saved2 }, imp0)); ok(d.querySelector('[data-bd-act="history"]') && /r2/.test(d.body.textContent) && !d.querySelector('[data-bd-unassigned]'), '이력이 있으면 이력 버튼, 미배정이 없으면 경고 없음'); }
{ const x = buildBudgetSave(null, [R('sub', 1, { name: '<img src=x onerror=alert(1)>', memo: '<script>alert(1)</script>', src: 'est', estNo: '<b>E</b>' })], O({ note: '<u>메모</u>' })).doc; const h = budgetCardHtml({ state: 'ready', saved: x }, imp0); const d = D(h);
  ok(!d.querySelector('img') && !d.querySelector('script') && !d.querySelector('b') && !d.querySelector('u') && !/onerror|onclick/i.test(h.replace(/&lt;[^&]*&gt;/g, '')), '★ 읽기 화면: 이름·메모·견적 번호·저장 메모를 이스케이프(태그가 살아나지 않는다)'); }
// 이력 패널
{ const d = D(budgetCardHtml({ state: 'ready', saved: saved2, showHistory: true }, imp0)); const rows = [...d.querySelectorAll('[data-bd-history] tbody tr')]; ok(rows.length === 2 && /r2/.test(rows[0].textContent) && /r1/.test(rows[1].textContent) && d.querySelector('[data-bd-history] [data-bd-act="view-rev"][data-bd-rev="1"]'), '이력 패널: 최신이 위, 개정마다 [보기]');
  const v = D(budgetCardHtml({ state: 'ready', saved: saved2, showHistory: true, viewRev: 1 }, imp0)); ok(v.querySelector('[data-bd-revrows]') && /r1 내용/.test(v.body.textContent) && v.querySelectorAll('[data-bd-revrows] tbody tr').length === 4, '[보기]를 누른 개정(r1)의 행을 아래에 보여 준다');
  const w = D(budgetCardHtml({ state: 'ready', saved: saved2, showHistory: true, viewRev: 99 }, imp0)); ok(!w.querySelector('[data-bd-revrows]'), '없는 개정 번호는 보여 주지 않는다');
  const c = D(budgetCardHtml({ state: 'ready', saved: saved2, showHistory: true, viewRev: 2 }, imp0)); ok(c.querySelectorAll('[data-bd-revrows] tbody tr').length === 2, '현재 개정(r2)도 볼 수 있다'); }
// 편집
{ const draft = draftFromBudget(saved2); draft.note = '메모 <x>'; const h = budgetCardHtml({ state: 'ready', saved: saved2, draft }, imp0); const d = D(h);
  ok(d.querySelector('[data-bd-edit]') && !d.querySelector('[data-bd-read]') && /r3/.test(d.querySelector('[data-bd-edit]').textContent), '편집: r2 를 고치면 r3 로 저장된다는 안내');
  ok(d.querySelectorAll('[data-bd-body] tr').length === 2 && d.querySelector('[data-bd-k="amount"][data-bd-i="0"]').value === '1200000' && d.querySelector('[data-bd-k="name"][data-bd-i="1"]'), '편집: 행마다 비목·내역·금액·메모 입력칸(번호 표시)');
  const sel = d.querySelector('[data-bd-k="cat"][data-bd-i="0"]'); ok(sel.tagName === 'SELECT' && [...sel.options].map((o) => o.value).join() === ',sub,labor,site,reserve' && sel.value === 'sub' && sel.options[0].textContent.includes('미배정'), '비목 선택: 미배정·외주·자체 노무·현장경비·예비비');
  ok(d.querySelector('[data-bd-note]').value === '메모 <x>' && d.querySelector('[data-bd-preview]') && d.querySelector('[data-bd-act="save"]') && d.querySelector('[data-bd-act="cancel"]') && d.querySelector('[data-bd-act="add-row"]') && d.querySelector('[data-bd-act="import-open"]') && d.querySelector('[data-bd-act="del-row"][data-bd-i="1"]'), '편집: 메모·미리보기·저장·취소·행 추가·견적에서 가져오기·행 삭제');
  ok(d.querySelector('[data-bd-k="amount"]').getAttribute('inputmode') === 'numeric' && d.querySelector('[data-bd-k="name"]').getAttribute('maxlength') === '120' && d.querySelector('[data-bd-k="memo"]').getAttribute('maxlength') === '200' && d.querySelector('[data-bd-note]').getAttribute('maxlength') === '200', '입력칸: 금액 숫자 자판·내역 120자·메모 200자 제한');
  ok(d.querySelector('[data-bd-k="name"][data-bd-i="0"]').getAttribute('aria-label') === '1번 행 내역' && d.querySelector('[data-bd-k="cat"][data-bd-i="1"]').getAttribute('aria-label') === '2번 행 비목', '입력칸마다 접근성 이름(번호 행 + 칸)');
  const sv = D(budgetCardHtml({ state: 'ready', saved: saved2, draft, saving: true }, imp0)); ok(sv.querySelector('[data-bd-act="save"]').disabled && sv.querySelector('[data-bd-act="cancel"]').disabled, '저장 중에는 저장·취소 버튼이 꺼진다');
  const x = draftSet(draftBlank(), 0, 'name', '<img src=x onerror=alert(1)>'); const xh = budgetCardHtml({ state: 'ready', saved: null, draft: x }, imp0); const xd = D(xh); ok(!xd.querySelector('img') && xd.querySelector('[data-bd-k="name"]').value === '<img src=x onerror=alert(1)>', '★ 편집 화면: 입력값은 속성으로 안전하게(태그가 살아나지 않고 값은 그대로)'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: draftBlank() }, imp0)); const et = d.querySelector('[data-bd-edit]').textContent; ok(/r1 로 저장됩니다/.test(et) && !/고쳐/.test(et), '처음 작성은 "r1 로 저장됩니다"(개정 안내가 아니다)'); }
// 편집 화면의 속성 값 이스케이프 — 따옴표로 속성을 깨고 나오는 입력
{ const raw = { name: '"><img src=x onerror=alert(1)>', amount: '"><b>x</b>', memo: '"><u>m</u>', note: '"><i>n</i>' };
  let dd = draftSet(draftSet(draftSet(draftBlank(), 0, 'name', raw.name), 0, 'amount', raw.amount), 0, 'memo', raw.memo); dd = Object.assign({}, dd, { note: raw.note }); const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: dd }, imp0));
  ok(!d.querySelector('img') && !d.querySelector('b') && !d.querySelector('u') && !d.querySelector('i'), '★ 따옴표로 속성을 깨려는 입력(내역·금액·메모·저장 메모)이 태그로 살아나지 않는다');
  ok(d.querySelector('[data-bd-k="name"]').value === raw.name && d.querySelector('[data-bd-k="amount"]').value === raw.amount && d.querySelector('[data-bd-k="memo"]').value === raw.memo && d.querySelector('[data-bd-note]').value === raw.note, '값은 입력칸에 글자 그대로 들어간다'); }
// 미리보기
{ const d = draftSet(draftSet(draftAddRow(draftBlank()), 0, 'amount', '1,000'), 1, 'amount', 'abc'); const h = budgetPreviewHtml(d); ok(/1,000/.test(h) && /확인/.test(h), '미리보기 조각: 합계와 입력 확인이 필요한 행 수'); ok(/0/.test(budgetPreviewHtml(draftBlank())) && !/확인 필요/.test(budgetPreviewHtml(draftBlank())), '빈 초안은 0 원·경고 없음'); }
// 견적 패널
{ const draft = draftBlank(); const d = D(budgetCardHtml({ state: 'ready', saved: null, draft, showImport: true }, imp)); const p = d.querySelector('[data-bd-import]'); const t = p ? p.textContent : '';
  ok(p && /EST-2026-001-r2/.test(t) && /200,000/.test(t) && /r2/.test(t), '견적 패널: 최종 개정본 번호·자동 투입비');
  ok(p.querySelectorAll('[data-bd-decide] tr').length === 3 && /금액만 직접 고침/.test(t) && /산식 표 없음/.test(t) && /산식 표 오류/.test(t), '정할 항목 3개를 이유와 함께 표로');
  ok(!p.querySelector('b') && p.querySelector('[data-bd-decide]').textContent.includes('<b>나</b>'), '★ 항목 이름은 글자 그대로 보이고 태그로 살아나지 않는다');
  ok(p.querySelector('[data-bd-act="import-apply"]') && !p.querySelector('[data-bd-act="import-apply"]').disabled && p.querySelector('[data-bd-act="import-decisions"]') && !p.querySelector('[data-bd-act="import-decisions"]').disabled && p.querySelector('[data-bd-act="import-close"]'), '가져오기·정할 항목 추가·닫기 버튼'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: draftBlank(), showImport: true }, imp0)); ok(/유효한 견적이 없습니다/.test(d.querySelector('[data-bd-import]').textContent) && !d.querySelector('[data-bd-act="import-apply"]'), '견적이 없으면 안내만(가져오기 버튼 없음)'); }
{ const only = importFromEstimates([{ no: 'E', baseNo: 'E', rev: 1, status: 'active', pjtId: 'P1', items: [itemPlain('x')] }], 'P1'); const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: draftBlank(), showImport: true }, only)); ok(d.querySelector('[data-bd-act="import-apply"]').disabled && !d.querySelector('[data-bd-act="import-decisions"]').disabled, '자동 투입비가 0 이면 가져오기 버튼이 꺼지고 정할 항목 추가는 켜진다'); }
{ const two = importFromEstimates([{ no: 'EST-A', baseNo: 'EST-A', rev: 1, status: 'active', pjtId: 'P1', items: [itemOk('a')] }, { no: 'EST-B', baseNo: 'EST-B', rev: 1, status: 'closed', pjtId: 'P1', items: [itemOk('b')] }], 'P1'); const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: draftBlank(), showImport: true }, two)); const t = d.querySelector('[data-bd-import]').textContent; ok(/EST-A/.test(t) && /EST-B/.test(t) && /종결/.test(t) && /견적 묶음이 2개/.test(t), '견적 묶음이 여럿이면 모두 보여 주고 여럿임을 알린다(종결 표시)'); }
{ const clean = importFromEstimates([{ no: 'EST-C', baseNo: 'EST-C', rev: 1, status: 'active', pjtId: 'P1', items: [itemOk('a')] }], 'P1'); const d = D(budgetCardHtml({ state: 'ready', saved: null, draft: draftBlank(), showImport: true }, clean)); ok(!d.querySelector('[data-bd-act="import-apply"]').disabled && d.querySelector('[data-bd-act="import-decisions"]').disabled && !d.querySelector('[data-bd-decide]'), '★ 정할 항목이 0개면 [정할 항목을 행으로 추가]가 꺼지고 표도 없다'); }
// 메시지·충돌
{ const d = D(budgetCardHtml({ state: 'ready', saved: saved1, msg: '저장했습니다 <b>r1</b>' }, imp0)); ok(/저장했습니다/.test(d.body.textContent) && !d.querySelector('b') && d.querySelector('[role=status],[role=alert]'), '안내 메시지(이스케이프)'); }
{ const d = D(budgetCardHtml({ state: 'ready', saved: saved2, draft: draftFromBudget(saved1), conflictRev: 2 }, imp0)); ok(d.querySelector('[role=alert]') && /다른 곳에서 먼저 바뀌었습니다/.test(d.body.textContent) && /r2/.test(d.body.textContent) && d.querySelector('[data-bd-act="conflict-continue"]') && d.querySelector('[data-bd-edit]'), '★ 충돌: 경고 + [최신 기준으로 이어서 저장] 버튼, 내가 입력한 편집 화면은 그대로 둔다'); }
{ const e = '2번 행: <b>금액</b>을 입력해 주세요.'; const d1 = D(budgetCardHtml({ state: 'ready', saved: saved1, err: e }, imp0)); const d2 = D(budgetCardHtml({ state: 'ready', saved: saved1, draft: draftFromBudget(saved1), err: e }, imp0));
  ok([d1, d2].every((d) => d.querySelector('[role=alert]') && d.body.textContent.includes('2번 행: <b>금액</b>을 입력해 주세요.') && !d.querySelector('b')), '★ 저장 실패 오류(err)는 읽기·편집 화면 모두 경고로 보이고 이스케이프된다');
  ok(!D(budgetCardHtml({ state: 'ready', saved: saved1, err: '' }, imp0)).querySelector('[role=alert]'), '오류가 비어 있으면 경고가 없다'); }
// 규약
{ const hs = [budgetCardHtml({ state: 'ready', saved: saved2, showHistory: true }, imp0), budgetCardHtml({ state: 'ready', saved: saved2, draft: draftFromBudget(saved2), showImport: true }, imp), budgetCardHtml({ state: 'ready', saved: null }, imp0), budgetCardHtml({ state: 'error', error: 'x' }, imp0)];
  ok(hs.every((h) => !/\son(click|input|change|error|load)=/i.test(h)), '인라인 이벤트 속성이 없다(이벤트는 위임으로만)');
  ok(hs.every((h) => { const d = dom(h); return [...d.querySelectorAll('button')].every((b) => b.getAttribute('type') === 'button' && b.classList.contains('jh-btn') && /^(primary|secondary|ghost|danger)$/.test(b.getAttribute('data-variant') || '')); }), '모든 버튼: type=button·jh-btn·data-variant');
  ok(hs.every((h) => !/<form/i.test(h)), '<form> 을 쓰지 않는다'); }

console.log('\n' + (fail ? fail + '건 실패 / 통과 ' + pass : '전부 통과 (' + pass + '건)'));
process.exit(fail ? 1 : 0);
