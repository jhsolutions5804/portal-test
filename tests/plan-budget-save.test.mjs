// 실행예산 저장·개정 시험 — 설계: 비공개 저장소 app-docs/execution-budget-design.md(대기열 1-3-9, 2단계). 공개 저장소라 가짜 숫자만 쓴다.
import { budgetDocId, buildBudgetSave, budgetFromDoc, revisionList, HISTORY_MAX, DOC_MAX_BYTES } from '../app/modules/plan/budget.js';
import { loadBudget, saveBudget } from '../app/modules/plan/budget-io.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = (v) => JSON.stringify(v);
const R = (cat, amount, extra) => Object.assign({ cat, name: '내역', amount, memo: '' }, extra || {});
const NOW = '2026-10-24T09:00:00.000Z', O = (extra) => Object.assign({ pjtId: 'P1', note: '', now: NOW, by: 'U1' }, extra || {});
const rows1 = [R('sub', 1000000), R('labor', 500000), R('reserve', 100000)];

ok(HISTORY_MAX === 50 && DOC_MAX_BYTES === 900000, '한도: 이력 50개·문서 900,000바이트(Firestore 1MB 안쪽)');

// ── 문서 번호
ok(budgetDocId('P1') === 'P1' && budgetDocId('abc_123-x') === 'abc_123-x' && budgetDocId('가나다') === '가나다', '프로젝트 id 가 문서 번호가 된다');
for (const bad of ['', null, undefined, 5, {}, [], 'a/b', '.', '..', '__x__', ' ', 'x'.repeat(101)]) ok(budgetDocId(bad) === null, '문서 번호로 못 쓰는 값은 null: ' + String(J(bad)).slice(0, 20));

// ── 저장 계획 buildBudgetSave
{ const r = buildBudgetSave(null, rows1, O({ note: '첫 저장' }));
  ok(r.ok && r.unchanged === false && r.doc.rev === 1 && J(r.doc.history) === '[]', '처음 저장은 r1, 이력 없음');
  ok(Object.keys(r.doc).sort().join() === 'by,history,note,pjtId,rev,rows,savedAt' && r.doc.pjtId === 'P1' && r.doc.note === '첫 저장' && r.doc.savedAt === NOW && r.doc.by === 'U1', '문서 칸: pjtId·rev·rows·note·savedAt·by·history 만');
  ok(r.doc.rows.length === 3 && r.doc.rows[0].amount === 1000000 && r.doc.rows.every((x) => x.src === 'manual'), '행은 정리된 값(금액 정수·출처 manual)으로 저장'); }
{ const c = buildBudgetSave(null, rows1, O({ note: 'a', now: '2026-10-24T09:00:00.000Z', by: 'U1' })).doc;
  const r = buildBudgetSave(c, [R('sub', 1200000), R('labor', 500000)], O({ note: '네고 반영', now: '2026-10-25T09:00:00.000Z', by: 'U2' }));
  ok(r.ok && r.doc.rev === 2 && r.doc.note === '네고 반영' && r.doc.by === 'U2' && r.doc.savedAt === '2026-10-25T09:00:00.000Z', '고쳐 저장하면 r2');
  ok(r.doc.history.length === 1 && r.doc.history[0].rev === 1 && r.doc.history[0].note === 'a' && r.doc.history[0].by === 'U1' && r.doc.history[0].savedAt === NOW && J(r.doc.history[0].rows) === J(c.rows), '★ 이전 개정(r1)이 이력에 그대로 남는다(행·메모·저장자·시각)');
  const r3 = buildBudgetSave(r.doc, [R('sub', 1300000)], O({ note: 'r3' })); ok(r3.doc.rev === 3 && r3.doc.history.map((h) => h.rev).join() === '1,2', '이력은 쌓인다(r1·r2) — 현재는 r3');
  ok(J(c) === J(buildBudgetSave(null, rows1, O({ note: 'a' })).doc) && c.history.length === 0, '입력(현재 문서)을 바꾸지 않는다'); }
{ const c = buildBudgetSave(null, rows1, O()).doc; const same = buildBudgetSave(c, [R('sub', '1,000,000'), R('labor', '500,000'), R('reserve', 100000)], O({ note: '메모만 다름' }));
  ok(same.ok && same.unchanged === true && same.doc === c && same.doc.rev === 1, '★ 정리한 행이 같으면(쉼표 표기만 달라도) 번호를 올리지 않는다 — 메모만 바뀐 것도 같은 개정'); }
{ const c = buildBudgetSave(null, rows1, O()).doc; const r = buildBudgetSave(c, [R('sub', 1000000), R('labor', 500000), R('reserve', 100000, { memo: '예비' })], O()); ok(r.ok && !r.unchanged && r.doc.rev === 2, '행의 메모 한 칸만 달라도 새 개정'); }
{ const c = buildBudgetSave(null, rows1, O()).doc; const r = buildBudgetSave(c, [R('labor', 500000), R('sub', 1000000), R('reserve', 100000)], O()); ok(r.ok && !r.unchanged && r.doc.rev === 2, '행 순서가 바뀌어도 새 개정(순서도 내용)'); }
{ const r = buildBudgetSave(null, [R('sub', 1), R('foo', 2)], O()); ok(!r.ok && /2번 행/.test(r.error), '행이 틀리면 거부 + 몇 번 행인지'); }
ok(!buildBudgetSave(null, [], O()).ok && /저장할/.test(buildBudgetSave(null, [], O()).error) && !buildBudgetSave(null, [R('', '', { name: '' })], O()).ok, '빈 실행예산은 저장하지 않는다');
{ const r = buildBudgetSave(null, [R('sub', 0), R('labor', 0)], O()); ok(!r.ok && /0 ?원/.test(r.error), '합계가 0 원이면 저장하지 않는다(의미 없는 계획)'); }
ok(!buildBudgetSave(null, rows1, O({ pjtId: '' })).ok && !buildBudgetSave(null, rows1, O({ pjtId: 'a/b' })).ok && !buildBudgetSave(null, rows1, O({ pjtId: null })).ok, '프로젝트 id 가 이상하면 거부');
ok(!buildBudgetSave(null, rows1, O({ note: 'x'.repeat(201) })).ok && buildBudgetSave(null, rows1, O({ note: 'x'.repeat(200) })).ok && !buildBudgetSave(null, rows1, O({ note: 5 })).ok && buildBudgetSave(null, rows1, O({ note: undefined })).doc.note === '', '메모: 200자까지·글자만·없으면 빈 글자');
ok(buildBudgetSave(null, rows1, O({ note: '  앞뒤  ' })).doc.note === '앞뒤', '메모의 앞뒤 공백을 뗀다');
ok(!buildBudgetSave(null, rows1, O({ now: undefined })).ok && !buildBudgetSave(null, rows1, O({ now: '' })).ok && !buildBudgetSave(null, rows1, O({ now: 5 })).ok && !buildBudgetSave(null, rows1, O({ now: 'x'.repeat(41) })).ok, '저장 시각이 없거나 이상하면 거부(순수 함수라 시계를 스스로 읽지 않는다)');
ok(buildBudgetSave(null, rows1, O({ by: undefined })).doc.by === '' && buildBudgetSave(null, rows1, O({ by: 7 })).doc.by === '' && buildBudgetSave(null, rows1, O({ by: 'u'.repeat(200) })).doc.by.length === 80, '저장자: 글자가 아니면 빈 글자, 80자까지만');
ok(!buildBudgetSave(null, rows1, null).ok && !buildBudgetSave(null, rows1, 'x').ok, '옵션이 없으면 거부');
{ const c = buildBudgetSave(null, rows1, O()).doc;
  ok(!buildBudgetSave(Object.assign({}, c, { rev: 'x' }), rows1, O()).ok && !buildBudgetSave(Object.assign({}, c, { rev: 0 }), rows1, O()).ok && !buildBudgetSave(Object.assign({}, c, { history: 'x' }), rows1, O()).ok && !buildBudgetSave(Object.assign({}, c, { rows: 'x' }), rows1, O()).ok && !buildBudgetSave('x', rows1, O()).ok && !buildBudgetSave([], rows1, O()).ok, '★ 현재 저장 문서의 모양이 틀리면(번호·이력·행이 이상하거나 객체가 아님) 거부 — 깨진 문서 위에 개정을 쌓지 않는다');
  ok(buildBudgetSave(undefined, rows1, O()).ok && buildBudgetSave(null, rows1, O()).ok, '현재 문서가 없으면(null·undefined) 처음 저장'); }
// 이력 한도
{ let cur = null, last = null; for (let i = 1; i <= HISTORY_MAX + 1; i++) { last = buildBudgetSave(cur, [R('sub', 1000 + i)], O()); if (!last.ok) break; cur = last.doc; }
  ok(cur && cur.rev === HISTORY_MAX + 1 && cur.history.length === HISTORY_MAX && last.ok, '이력 50개가 된 r51 까지는 저장된다');
  const over = buildBudgetSave(cur, [R('sub', 999999)], O()); ok(!over.ok && /이력|개정/.test(over.error) && cur.rev === HISTORY_MAX + 1, '★ 이력이 50개를 넘는 저장은 거부하고(조용히 옛 이력을 버리지 않는다) 현재 문서는 그대로'); }
// 크기 한도
{ const big = (n) => Array.from({ length: 200 }, (_, i) => ({ cat: 'site', name: '가'.repeat(120), amount: n + i, memo: '나'.repeat(200) })); let cur = null, hit = null;
  for (let i = 1; i <= 8; i++) { const r = buildBudgetSave(cur, big(i * 1000), O()); if (!r.ok) { hit = { i, error: r.error }; break; } cur = r.doc; }
  ok(hit && hit.i >= 2 && hit.i <= 6 && /큽니다|크기/.test(hit.error), '★ 문서가 900KB 를 넘으면 거부 + 이유(행이 큰 개정을 몇 번 쌓으면 걸린다) — 걸린 번째: ' + (hit && hit.i));
  ok(new TextEncoder().encode(J(cur)).length <= DOC_MAX_BYTES, '저장된 문서는 한도 안쪽'); }

// ── 저장된 문서 읽기 budgetFromDoc
{ const c = buildBudgetSave(buildBudgetSave(null, rows1, O()).doc, [R('sub', 1)], O({ note: '둘째' })).doc;
  const raw = Object.assign({}, c, { updatedAt: { seconds: 1, nanoseconds: 0 }, evil: 'x' }); const r = budgetFromDoc(raw);
  ok(r.ok && r.budget.rev === 2 && r.budget.history.length === 1 && r.budget.rows.length === 1 && r.budget.note === '둘째', '저장된 문서를 읽는다(서버 시각 필드 updatedAt 은 무시)');
  ok(!('updatedAt' in r.budget) && !('evil' in r.budget) && Object.keys(r.budget).sort().join() === 'by,history,note,pjtId,rev,rows,savedAt', '알려진 칸만 새 객체로 복사');
  ok(r.budget.history[0].rev === 1 && Object.keys(r.budget.history[0]).sort().join() === 'by,note,rev,rows,savedAt', '이력 항목도 알려진 칸만'); }
for (const [label, raw] of [['null', null], ['글자', 'x'], ['배열', []], ['pjtId 없음', { rev: 1, rows: [R('sub', 1)], history: [] }], ['rev 0', { pjtId: 'P', rev: 0, rows: [R('sub', 1)], history: [] }], ['rev 소수', { pjtId: 'P', rev: 1.5, rows: [R('sub', 1)], history: [] }], ['행 이상', { pjtId: 'P', rev: 1, rows: [R('foo', 1)], history: [] }], ['행 비어 있음', { pjtId: 'P', rev: 1, rows: [], history: [] }], ['이력이 배열 아님', { pjtId: 'P', rev: 2, rows: [R('sub', 1)], history: 'x' }], ['이력 번호가 현재 이상', { pjtId: 'P', rev: 2, rows: [R('sub', 1)], history: [{ rev: 2, rows: [R('sub', 1)], savedAt: NOW, note: '', by: '' }] }], ['이력 번호 순서 틀림', { pjtId: 'P', rev: 3, rows: [R('sub', 1)], history: [{ rev: 2, rows: [R('sub', 1)], savedAt: NOW, note: '', by: '' }, { rev: 1, rows: [R('sub', 1)], savedAt: NOW, note: '', by: '' }] }], ['이력 행 이상', { pjtId: 'P', rev: 2, rows: [R('sub', 1)], history: [{ rev: 1, rows: [R('foo', 1)], savedAt: NOW, note: '', by: '' }] }], ['이력 51개', { pjtId: 'P', rev: 52, rows: [R('sub', 1)], history: Array.from({ length: 51 }, (_, i) => ({ rev: i + 1, rows: [R('sub', 1)], savedAt: NOW, note: '', by: '' })) }], ['메모 글자 아님', { pjtId: 'P', rev: 1, rows: [R('sub', 1)], note: 5, history: [] }]]) {
  const r = budgetFromDoc(raw); ok(r.ok === false && typeof r.error === 'string' && r.error && !('budget' in r), '이상한 저장 문서는 거부(' + label + ')'); }
{ let cur = null; for (let i = 1; i <= HISTORY_MAX + 1; i++) cur = buildBudgetSave(cur, [R('sub', 1000 + i)], O()).doc; const r = budgetFromDoc(cur); ok(r.ok && r.budget.history.length === HISTORY_MAX && r.budget.rev === HISTORY_MAX + 1, '★ 이력이 정확히 50개인 문서(r51)도 읽는다(한도 경계)'); }
{ const h = (rev) => ({ rev, rows: [R('sub', 1)], savedAt: NOW, note: '', by: '' }); ok(!budgetFromDoc({ pjtId: 'P', rev: 3, rows: [R('sub', 1)], history: [h(1), h(1)] }).ok && budgetFromDoc({ pjtId: 'P', rev: 3, rows: [R('sub', 1)], history: [h(1), h(2)] }).ok && !budgetFromDoc({ pjtId: 'P', rev: 3, rows: [R('sub', 1)], history: [h(2), h(2)] }).ok, '★ 이력에 같은 개정 번호가 두 번 있으면 거부(순서는 반드시 증가)'); }
{ const r = budgetFromDoc(JSON.parse('{"pjtId":"P","rev":1,"rows":[{"cat":"sub","name":"a","amount":1,"memo":""}],"history":[],"__proto__":{"polluted":true}}')); ok(r.ok && ({}).polluted === undefined && !('polluted' in r.budget), '__proto__ 오염을 막는다'); }
{ const r = budgetFromDoc({ pjtId: 'P', rev: 1, rows: [R('sub', 1)] }); ok(r.ok && J(r.budget.history) === '[]' && r.budget.note === '' && r.budget.by === '' && r.budget.savedAt === '', '이력·메모·저장자가 없는 저장 문서도 읽는다(빈 값)'); }

// ── 개정 목록 revisionList
{ let cur = buildBudgetSave(null, [R('sub', 1000), R('reserve', 100)], O({ note: 'r1', now: '2026-10-24T09:00:00.000Z' })).doc; cur = buildBudgetSave(cur, [R('sub', 2000)], O({ note: 'r2', now: '2026-10-25T09:00:00.000Z' })).doc;
  const l = revisionList(cur); ok(l.length === 2 && l[0].rev === 2 && l[0].current === true && l[1].rev === 1 && l[1].current === false, '개정 목록은 최신이 위, 현재 표시');
  ok(l[0].total === 2000 && l[1].total === 1100 && l[1].count === 2 && l[1].note === 'r1' && l[1].savedAt === '2026-10-24T09:00:00.000Z', '개정마다 합계·행 수·메모·시각');
  { const c3 = buildBudgetSave(cur, [R('sub', 3000)], O({ note: 'r3', now: '2026-10-26T09:00:00.000Z' })).doc; const l3 = revisionList(c3); ok(l3.map((x) => x.rev).join() === '3,2,1' && l3.map((x) => x.current).join() === 'true,false,false' && l3[2].total === 1100, '★ 개정이 셋이면 3·2·1 순서(최신이 위) — 이력 순서를 뒤집어 보여 준다'); }
  ok(revisionList(null).length === 0 && revisionList({}).length === 0 && revisionList('x').length === 0, '이상한 입력이면 빈 목록'); }

// ── 입출력 loadBudget / saveBudget (가짜 저장소)
const mkStore = (init) => { const m = new Map(Object.entries(init || {})); const log = []; return { m, log, deps: { read: async (id) => { log.push('read ' + id); return m.has(id) ? { exists: true, data: m.get(id) } : { exists: false, data: null }; }, write: async (id, data) => { log.push('write ' + id); m.set(id, data); }, now: () => NOW, stamp: () => '<서버시각>', by: () => 'U1' } }; };
{ const s = mkStore(); const r = await loadBudget(s.deps, 'P1'); ok(r.ok && r.budget === null && s.log.join() === 'read P1', '문서가 없으면 budget null(오류 아님)'); }
ok(!(await loadBudget(mkStore().deps, 'a/b')).ok && !(await loadBudget(mkStore().deps, '')).ok, '프로젝트 id 가 이상하면 읽지 않는다');
{ const s = mkStore(); const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0, note: '처음' });
  ok(r.ok && r.rev === 1 && s.m.has('P1') && s.m.get('P1').updatedAt === '<서버시각>' && s.m.get('P1').rev === 1, '처음 저장: 문서가 쓰이고 서버 시각이 붙는다');
  ok(s.log.join() === 'read P1,write P1', '읽기 → 쓰기 순서');
  const l = await loadBudget(s.deps, 'P1'); ok(l.ok && l.budget.rev === 1 && l.budget.rows.length === 3, '저장한 것을 다시 읽는다');
  const r2 = await saveBudget(s.deps, { pjtId: 'P1', rows: [R('sub', 5)], baseRev: 1 }); ok(r2.ok && r2.rev === 2 && s.m.get('P1').history.length === 1, '고쳐 저장하면 r2 + 이력');
  const stale = await saveBudget(s.deps, { pjtId: 'P1', rows: [R('sub', 9)], baseRev: 1 }); ok(!stale.ok && stale.conflict === true && /다른 곳에서/.test(stale.error) && s.m.get('P1').rev === 2, '★ 내가 불러온 개정(r1)이 이미 낡았으면 덮어쓰지 않고 충돌로 거절');
  const same = await saveBudget(s.deps, { pjtId: 'P1', rows: [R('sub', 5)], baseRev: 2 }); ok(same.ok && same.unchanged === true && same.rev === 2 && s.log.filter((x) => x === 'write P1').length === 2, '내용이 같으면 쓰지 않는다(unchanged)'); }
{ const s = mkStore(); const first = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); const again = await saveBudget(s.deps, { pjtId: 'P1', rows: [R('sub', 7)], baseRev: 0 }); ok(first.ok && !again.ok && again.conflict === true, '처음(baseRev 0) 저장을 두 곳에서 하면 뒤의 것이 충돌'); }
for (const [label, br] of [['없음', undefined], ['음수', -1], ['소수', 1.5], ['글자', '0'], ['null', null], ['NaN', NaN]]) { const r = await saveBudget(mkStore().deps, Object.assign({ pjtId: 'P1', rows: rows1 }, br === undefined ? {} : { baseRev: br })); ok(!r.ok && !r.conflict && /개정 번호/.test(r.error), '★ 불러온 개정 번호(baseRev)가 ' + label + ' 이면 충돌이 아니라 "개정 번호" 문제로 거부(0 이상 정수만)'); }
{ const s = mkStore(); const r = await saveBudget(s.deps, { pjtId: 'P1', rows: [R('foo', 1)], baseRev: 0 }); ok(!r.ok && !s.log.includes('write P1'), '행이 틀리면 쓰지 않는다'); }
{ const s = mkStore({ P1: { pjtId: 'P1', rev: 0, rows: [] } }); const l = await loadBudget(s.deps, 'P1'); const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(!l.ok && l.corrupt === true && !r.ok && r.corrupt === true && !s.log.includes('write P1'), '★ 저장된 문서가 깨져 있으면 읽기도 저장도 거절하고 덮어쓰지 않는다'); }
{ const s = mkStore(); s.deps.read = async () => { const e = new Error('no'); e.code = 'permission-denied'; throw e; }; const l = await loadBudget(s.deps, 'P1'); const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(!l.ok && l.denied === true && !r.ok && r.denied === true, '권한이 없으면 denied(오류와 구분)'); }
{ const s = mkStore(); s.deps.read = async () => { throw new Error('network'); }; const l = await loadBudget(s.deps, 'P1'); ok(!l.ok && !l.denied && /읽기 실패/.test(l.error), '읽기 실패는 이유와 함께'); }
{ const s = mkStore(); s.deps.write = async () => { const e = new Error('x'); e.code = 'unavailable'; throw e; }; const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(!r.ok && /저장 실패/.test(r.error) && /unavailable/.test(r.error) && !r.conflict, '쓰기 실패는 코드와 함께 알린다'); }
{ const s = mkStore(); s.deps.write = async () => { const e = new Error('x'); e.code = 'permission-denied'; throw e; }; const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(!r.ok && r.denied === true, '쓰기 권한 없음은 denied'); }
{ const s = mkStore(); delete s.deps.now; delete s.deps.by; delete s.deps.stamp; const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(r.ok && /^\d{4}-\d\d-\d\dT/.test(s.m.get('P1').savedAt) && s.m.get('P1').by === '' && !('updatedAt' in s.m.get('P1')), '시계·저장자·서버 시각 주입이 없어도 동작(시각은 기본 ISO, 저장자는 빈 글자)'); }
{ const s = mkStore(); s.deps.now = () => { throw new Error('시계 고장'); }; s.deps.by = () => { throw new Error('저장자 고장'); }; const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(r.ok && /^\d{4}-\d\d-\d\dT/.test(s.m.get('P1').savedAt) && s.m.get('P1').by === '', '★ 시계·저장자 함수가 예외를 던져도 저장은 던지지 않고 기본값으로 이어진다'); }
{ const s = mkStore(); s.deps.now = () => 12345; s.deps.by = () => 99; const r = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(r.ok && /^\d{4}-\d\d-\d\dT/.test(s.m.get('P1').savedAt) && s.m.get('P1').by === '', '시계가 글자가 아닌 값을 돌려주면 기본 ISO 시각, 저장자가 글자가 아니면 빈 글자'); }
{ const s = mkStore(); const only = { read: s.deps.read }; const r = await saveBudget(only, { pjtId: 'P1', rows: rows1, baseRev: 0 }); ok(!r.ok && /저장소 연결/.test(r.error) && s.log.length === 0, '★ 읽기만 있고 쓰기가 없는 저장소는 읽지도 않고 거부'); }
{ const s = mkStore(); const r0 = await saveBudget(s.deps, { pjtId: 'P1', rows: rows1, baseRev: 0 }); const only = { read: s.deps.read }; const r = await saveBudget(only, { pjtId: 'P1', rows: rows1, baseRev: 1 }); ok(r0.ok && !r.ok && /저장소 연결/.test(r.error), '쓰기가 없으면 내용이 같아서 쓸 일이 없어도 거부(저장 연결이 온전한지 먼저 본다)'); }
ok(!(await saveBudget(null, { pjtId: 'P1', rows: rows1, baseRev: 0 })).ok && !(await loadBudget(null, 'P1')).ok && !(await saveBudget({}, { pjtId: 'P1', rows: rows1, baseRev: 0 })).ok, '주입이 없거나 읽기·쓰기 함수가 없으면 거부(던지지 않는다)');
for (const bad of [null, undefined, 'x', 5, []]) { let threw = false, r; try { r = await saveBudget(mkStore().deps, bad); } catch (e) { threw = true; } ok(!threw && r && r.ok === false, '★ 저장 인자가 이상해도(' + String(J(bad)) + ') 던지지 않고 거부'); }
{ const s = mkStore(); const arg = { pjtId: 'P1', rows: [R('sub', '1,000')], baseRev: 0, note: ' 메모 ' }; const snap = J(arg); await saveBudget(s.deps, arg); ok(J(arg) === snap, '인자를 바꾸지 않는다'); }

console.log('\n' + (fail ? fail + '건 실패 / 통과 ' + pass : '전부 통과 (' + pass + '건)'));
process.exit(fail ? 1 : 0);
