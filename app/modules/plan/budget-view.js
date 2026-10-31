/* 실행예산 화면 조각 + 편집 초안(draft) 도우미 — 순수(저장·서버를 모른다). 시험: tests/plan-budget-view.test.mjs · 계산·검증: budget.js · 저장: budget-io.js · 설계: 비공개 저장소 app-docs/execution-budget-design.md (대기열 1-3-9, 3단계).
 * 화면은 프로젝트 상세(projects-view.js)의 "실행예산" 카드 안에 들어간다. 버튼은 data-bd-act, 행 입력칸은 data-bd-k·data-bd-i, 메모는 data-bd-note — 이벤트는 컨트롤러(index.js)가 위임으로 처리한다(인라인 이벤트 없음). 모든 값은 esc 로 이스케이프한다.
 * 초안 도우미는 원본을 바꾸지 않고 새 초안을 돌려준다. 금액은 입력 중이라 글자로 둔다(저장할 때 sanitizeRows 가 검사). */
import { esc } from '../../core/ui.js?v=20261031h';
import { CATS, LIMITS, parseAmount, budgetTotals, revisionList, draftRowsFromImport } from './budget.js?v=20261031h';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const won = (n) => (Math.round(Number(n) || 0)).toLocaleString('ko-KR');
const catLabel = (k) => { const c = CATS.find((x) => x.key === k); return c ? c.label : '미배정'; };
const blankRow = () => ({ cat: '', name: '', amount: '', memo: '', src: 'manual' });
const isBlank = (r) => !isO(r) || (String(r.name == null ? '' : r.name).trim() === '' && String(r.memo == null ? '' : r.memo).trim() === '' && String(r.amount == null ? '' : r.amount).trim() === '');
const KIND_LABEL = { calc: '산식 표 반영', differs: '금액만 직접 고침(네고)', nocalc: '산식 표 없음', bad: '산식 표 오류' };
// ── 편집 초안
export const draftBlank = () => ({ rows: [blankRow()], note: '', baseRev: 0 });
export function draftFromBudget(b) {
  const rows = (isO(b) && Array.isArray(b.rows) ? b.rows : []).map((r) => { const o = { cat: r.cat, name: r.name, amount: String(r.amount), memo: r.memo, src: r.src }; if (r.estNo) o.estNo = r.estNo; return o; });
  return { rows: rows.length ? rows : [blankRow()], note: '', baseRev: isO(b) && Number.isInteger(b.rev) ? b.rev : 0 };
}
const withRows = (d, rows) => Object.assign({}, d, { rows });
export function draftAddRow(d) { return d.rows.length >= LIMITS.rows ? d : withRows(d, d.rows.concat([blankRow()])); }
export function draftDelRow(d, i) {
  if (!Number.isInteger(i) || i < 0 || i >= d.rows.length) return d;
  const rows = d.rows.filter((_, k) => k !== i); return withRows(d, rows.length ? rows : [blankRow()]);
}
/** 칸 바꾸기 — 비목·내역·금액·메모만(출처는 화면에서 못 바꾼다). 모르는 비목·칸·번호는 무시 */
export function draftSet(d, i, k, v) {
  if (!Number.isInteger(i) || i < 0 || i >= d.rows.length || !['cat', 'name', 'amount', 'memo'].includes(k)) return d;
  const val = v === null || v === undefined ? '' : String(v);
  if (k === 'cat' && val !== '' && !CATS.some((c) => c.key === val)) return d;
  return withRows(d, d.rows.map((r, n) => (n === i ? Object.assign({}, r, { [k]: val }) : r)));
}
/** 입력 중 미리보기 합 — 읽을 수 있는 금액만 더하고 읽을 수 없는 행은 invalid 로 센다(빈 행은 blank) */
export function draftPreview(rows) {
  const t = { sub: 0, labor: 0, site: 0, reserve: 0, unassigned: 0, total: 0, invalid: 0, blank: 0 };
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    if (isBlank(r)) { t.blank++; return; }
    const a = parseAmount(typeof r.amount === 'number' ? r.amount : String(r.amount == null ? '' : r.amount)); const cat = r.cat === undefined || r.cat === null ? '' : r.cat;
    if (a === null || (cat !== '' && !CATS.some((c) => c.key === cat))) { t.invalid++; return; }
    t[cat === '' ? 'unassigned' : cat] += a; t.total += a;
  });
  return t;
}
/** 견적 투입비를 초안에 넣는다 — 빈 행은 정리하고 묶음마다 "견적 투입비" 한 줄. 같은 견적 줄이 이미 있으면 금액만 갱신(사용자가 고른 비목·고친 이름은 그대로) */
export function draftAddFromImport(d, res) {
  const add = draftRowsFromImport(res); if (!add.length) return d;
  let rows = d.rows.filter((r) => !isBlank(r));
  add.forEach((nr) => {
    const amount = won(nr.amount); const idx = rows.findIndex((r) => r.src === 'est' && r.estNo === nr.estNo);
    if (idx >= 0) rows[idx] = Object.assign({}, rows[idx], { amount });
    else if (rows.length < LIMITS.rows) rows.push({ cat: '', name: nr.name, amount, memo: '', src: 'est', estNo: nr.estNo });
  });
  return withRows(d, rows.length ? rows : [blankRow()]);
}
/** 정할 항목(금액만 고친·산식 없는·산식 오류)을 금액이 빈 행으로 넣는다 — 원가를 추측해 채우지 않는다. 같은 이름·메모의 행이 있으면 넣지 않는다 */
export function draftAddDecisions(d, res) {
  const items = []; (isO(res) && Array.isArray(res.groups) ? res.groups : []).forEach((g) => { (isO(g) && Array.isArray(g.items) ? g.items : []).forEach((it) => { if (isO(it) && it.kind !== 'calc') items.push({ g, it }); }); });
  if (!items.length) return d;
  const rows = d.rows.filter((r) => !isBlank(r));
  items.forEach(({ g, it }) => {
    const name = String(it.name || '(이름 없음)').slice(0, LIMITS.name); const memo = ('견적 ' + String(g.no || g.baseNo || '') + ' — ' + (KIND_LABEL[it.kind] || it.kind) + ', 금액을 직접 입력').slice(0, LIMITS.memo);
    if (rows.some((r) => r.name === name && r.memo === memo)) return;
    if (rows.length < LIMITS.rows) rows.push({ cat: '', name, amount: '', memo, src: 'manual' });
  });
  return withRows(d, rows.length ? rows : [blankRow()]);
}
// ── 화면
const btn = (label, act, variant, extra) => '<button type="button" class="jh-btn" data-variant="' + (variant || 'secondary') + '" data-bd-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>';
const alertHtml = (msg, tone, extra) => '<div class="jh-alert" data-tone="' + (tone || 'warn') + '" role="alert"' + (extra || '') + '>' + esc(msg) + '</div>';
const dateOf = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '');
const sumCell = (label, v) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong>' + v + '</strong></div>';
const srcLabel = (r) => (r.src === 'est' ? '견적 ' + (r.estNo || '') : '직접');
/* 폰 폭(899px 이하)에서는 표의 행이 카드로 바뀐다(plan.css jh-plan__table--cards) — 첫 칸이 카드 제목이고, 나머지 칸 앞에 붙는 data-label 은 반드시 같은 열 머리글과 같은 글자(시험이 모든 칸을 대조한다) */
const rowsTable = (rows, attr) => '<div class="jh-plan__scroll"><table class="jh-plan__table jh-plan__table--cards"' + (attr ? ' ' + attr : '') + '><thead><tr><th>내역</th><th>비목</th><th class="jh-plan__num">금액(원)</th><th>메모</th><th>출처</th></tr></thead><tbody>'
  + rows.map((r) => '<tr><td>' + esc(r.name) + '</td><td data-label="비목">' + esc(catLabel(r.cat)) + '</td><td class="jh-plan__num" data-label="금액(원)">' + won(r.amount) + '</td><td data-label="메모">' + esc(r.memo) + '</td><td data-label="출처">' + esc(srcLabel(r)) + '</td></tr>').join('') + '</tbody></table></div>';
function readHtml(bs) {
  const b = bs.saved; const t = budgetTotals(b.rows); const meta = ['r' + b.rev, dateOf(b.savedAt), b.note].filter(Boolean).map(esc).join(' · ');
  const sum = '<div class="jh-plan__sum jh-plan__sum--5">' + sumCell('외주', won(t.sub)) + sumCell('자체 노무', won(t.labor)) + sumCell('현장경비', won(t.site)) + sumCell('예비비', won(t.reserve)) + sumCell('총 계획', won(t.total)) + '</div>';
  const un = t.unassigned > 0 ? '<div class="jh-field__hint" data-bd-unassigned role="status">비목 미배정 금액 ' + won(t.unassigned) + '원 — 수정해서 비목을 골라 주세요(미배정은 총 계획에는 들어가지만 비목별 비교에서는 빠집니다).</div>' : '';
  const hist = Array.isArray(b.history) && b.history.length ? btn('개정 이력 (' + b.history.length + ')', 'history', 'ghost') : '';
  return '<div class="jh-plan__pad" data-bd-read><div class="jh-field__hint">' + meta + '</div>' + sum + un + rowsTable(b.rows) + '<div class="jh-plan__bar"><span class="jh-plan__line">' + btn('수정(개정)', 'edit', 'secondary') + hist + '</span></div></div>';
}
function historyHtml(bs) {
  const b = bs.saved; const list = revisionList(b);
  const rowsOf = (rev) => (rev === b.rev ? b.rows : ((b.history || []).find((h) => h.rev === rev) || {}).rows);
  const view = Number.isInteger(bs.viewRev) && bs.viewRev > 0 ? rowsOf(bs.viewRev) : null;
  const tbl = '<div class="jh-plan__scroll"><table class="jh-plan__table jh-plan__table--cards"><thead><tr><th>개정</th><th>저장일</th><th class="jh-plan__num">총 계획(원)</th><th class="jh-plan__num">행</th><th>메모</th><th></th></tr></thead><tbody>'
    + list.map((x) => '<tr><td>r' + x.rev + (x.current ? ' (현재)' : '') + '</td><td data-label="저장일">' + esc(dateOf(x.savedAt)) + '</td><td class="jh-plan__num" data-label="총 계획(원)">' + won(x.total) + '</td><td class="jh-plan__num" data-label="행">' + x.count + '</td><td data-label="메모">' + esc(x.note) + '</td><td data-label=""><button type="button" class="jh-btn" data-variant="ghost" data-bd-act="view-rev" data-bd-rev="' + x.rev + '">보기</button></td></tr>').join('') + '</tbody></table></div>';
  const rv = view ? '<div data-bd-revrows><strong>r' + bs.viewRev + ' 내용</strong>' + rowsTable(view) + '</div>' : '';
  return '<div class="jh-plan__pad" data-bd-history><strong>개정 이력</strong><div class="jh-field__hint">이전 개정은 그대로 보존됩니다(수정하면 새 개정이 쌓입니다).</div>' + tbl + rv + '</div>';
}
/** 입력 중 미리보기 조각 — 입력할 때마다 이 조각만 다시 그린다(입력칸의 커서를 잃지 않게) */
export function budgetPreviewHtml(d) {
  const p = draftPreview(d && d.rows); const warn = p.invalid > 0 ? ' <span data-bd-invalid>· 입력 확인 필요 ' + p.invalid + '행(금액은 0 이상 정수, 비목은 목록에서)</span>' : '';
  return '<div class="jh-field__hint" role="status">입력 중 합계 ' + won(p.total) + '원 (외주 ' + won(p.sub) + ' · 자체 노무 ' + won(p.labor) + ' · 현장경비 ' + won(p.site) + ' · 예비비 ' + won(p.reserve) + (p.unassigned ? ' · 비목 미배정 ' + won(p.unassigned) : '') + ')' + warn + '</div>';
}
function importHtml(imp) {
  const close = btn('닫기', 'import-close', 'ghost');
  if (!isO(imp) || !Array.isArray(imp.groups) || !imp.groups.length) return '<div class="jh-plan__calc" data-bd-import><div class="jh-field__hint">이 프로젝트에 연결된 유효한 견적이 없습니다(폐기된 견적은 제외).</div><div class="jh-plan__bar">' + close + '</div></div>';
  const groups = imp.groups.map((g) => {
    const dec = g.items.filter((x) => x.kind !== 'calc');
    const decide = dec.length ? '<div class="jh-plan__scroll"><table class="jh-plan__table jh-plan__table--cards"><thead><tr><th>정해야 할 항목</th><th>이유</th><th class="jh-plan__num">견적 금액</th><th class="jh-plan__num">산식 소계</th></tr></thead><tbody data-bd-decide>' + dec.map((x) => '<tr><td>' + esc(x.name) + '</td><td data-label="이유">' + esc(KIND_LABEL[x.kind] || x.kind) + (x.error ? ' — ' + esc(x.error) : '') + '</td><td class="jh-plan__num" data-label="견적 금액">' + won(x.amount) + '</td><td class="jh-plan__num" data-label="산식 소계">' + (x.subtotal === null || x.subtotal === undefined ? '-' : won(x.subtotal)) + '</td></tr>').join('') + '</tbody></table></div>' : '';
    return '<div><strong>견적 ' + esc(g.no) + '</strong> <span class="jh-field__hint">(r' + g.rev + (g.status === 'closed' ? ' · 종결' : '') + ') 산식 표가 있는 항목의 투입비 합 ' + won(g.autoCost) + '원 · 견적 금액 합 ' + won(g.supply) + '원(참고)</div>' + decide;
  }).join('');
  const multi = imp.multi ? '<div class="jh-field__hint">견적 묶음이 ' + imp.groups.length + '개입니다. 묶음마다 투입비 한 줄씩 가져옵니다.</div>' : '';
  return '<div class="jh-plan__calc" data-bd-import><strong>견적에서 가져오기 — 최종 확정된 개정본 기준</strong><div class="jh-field__hint">"투입비 가져오기"는 산식 표가 있고 금액이 견적가와 같은 항목의 소계 합만 한 줄로 가져옵니다(비목은 직접 고르세요). 네고로 금액만 고친 항목·산식 표가 없는 항목은 원가를 추측하지 않고 아래에 따로 보여 드립니다.</div>' + multi + groups
    + '<div class="jh-plan__bar"><span class="jh-plan__line">' + btn('투입비 가져오기', 'import-apply', 'primary', imp.autoCost > 0 ? '' : ' disabled') + btn('정할 항목을 행으로 추가', 'import-decisions', 'secondary', imp.decisions > 0 ? '' : ' disabled') + '</span>' + close + '</div></div>';
}
function rowEdit(r, i) {
  const n = (i + 1) + '번 행 ';
  const sel = '<select class="jh-select" data-bd-k="cat" data-bd-i="' + i + '" aria-label="' + esc(n + '비목') + '"><option value=""' + (r.cat === '' ? ' selected' : '') + '>미배정</option>' + CATS.map((c) => '<option value="' + c.key + '"' + (r.cat === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</select>';
  const inp = (k, v, extra) => '<input class="jh-input' + (k === 'amount' ? ' jh-plan__num' : '') + '" data-bd-k="' + k + '" data-bd-i="' + i + '" value="' + esc(v == null ? '' : v) + '" aria-label="' + esc(n + (k === 'name' ? '내역' : k === 'amount' ? '금액' : '메모')) + '"' + extra + '>';
  return '<tr data-bd-row="' + i + '"><td class="jh-plan__ecno" data-label="">' + (i + 1) + '</td><td data-label="비목">' + sel + '</td><td data-label="내역">' + inp('name', r.name, ' maxlength="' + LIMITS.name + '" placeholder="내역"') + '</td><td data-label="금액(원)">' + inp('amount', r.amount, ' inputmode="numeric" placeholder="0"') + '</td><td data-label="메모">' + inp('memo', r.memo, ' maxlength="' + LIMITS.memo + '" placeholder="메모"') + '</td><td data-label=""><button type="button" class="jh-btn" data-variant="ghost" data-bd-act="del-row" data-bd-i="' + i + '" aria-label="' + esc(n + '삭제') + '">삭제</button></td></tr>';
}
function editHtml(bs, imp) {
  const d = bs.draft; const first = d.baseRev === 0; const saving = bs.saving ? ' disabled' : '';
  const head = '<div class="jh-field__hint" role="status">' + (first ? 'r1 로 저장됩니다.' : 'r' + d.baseRev + ' 을 고쳐 r' + (d.baseRev + 1) + ' 로 저장됩니다(이전 개정은 이력에 남습니다).') + '</div>';
  const table = '<div class="jh-plan__scroll"><table class="jh-plan__table jh-plan__table--cards jh-plan__bdtable"><thead><tr><th></th><th>비목</th><th>내역</th><th class="jh-plan__num">금액(원)</th><th>메모</th><th></th></tr></thead><tbody data-bd-body>' + d.rows.map(rowEdit).join('') + '</tbody></table></div>';
  const tools = '<div class="jh-plan__bar"><span class="jh-plan__line">' + btn('+ 행 추가', 'add-row', 'secondary', d.rows.length >= LIMITS.rows ? ' disabled' : '') + btn('견적에서 가져오기', 'import-open', 'secondary') + '</span></div>';
  const note = '<div class="jh-field"><label class="jh-field__label">저장 메모(선택)</label><input class="jh-input" data-bd-note maxlength="' + LIMITS.memo + '" value="' + esc(d.note) + '" aria-label="저장 메모" placeholder="예: 네고 반영"></div>';
  const actions = '<div class="jh-plan__bar"><span class="jh-plan__line">' + btn('저장', 'save', 'primary', saving) + btn('취소', 'cancel', 'ghost', saving) + '</span></div>';
  return '<div class="jh-plan__pad" data-bd-edit>' + head + table + tools + (bs.showImport ? importHtml(imp) : '') + '<div data-bd-preview>' + budgetPreviewHtml(d) + '</div>' + note + actions + '</div>';
}
/** 실행예산 카드의 본문. bs = 프로젝트 하나의 화면 상태 { state(loading·ready·error·denied·corrupt), error, saved, draft, saving, showImport, showHistory, viewRev, msg, conflictRev }, imp = importFromEstimates 결과 */
export function budgetCardHtml(bs, imp) {
  if (!isO(bs) || bs.state === 'loading' || !bs.state) return '<div class="jh-plan__pad"><div class="jh-field__hint" role="status">실행예산을 불러오는 중…</div></div>';
  if (bs.state === 'error') return '<div class="jh-plan__pad">' + alertHtml('실행예산을 불러오지 못했습니다: ' + String(bs.error || '')) + '<div class="jh-plan__bar">' + btn('다시 불러오기', 'reload', 'secondary') + '</div></div>';
  if (bs.state === 'denied') return '<div class="jh-plan__pad">' + alertHtml('실행예산은 관리자만 볼 수 있습니다.') + '</div>';
  if (bs.state === 'corrupt') return '<div class="jh-plan__pad">' + alertHtml('저장된 실행예산이 올바르지 않아 열 수 없습니다(그 위에 덮어쓰지 않습니다): ' + String(bs.error || '')) + '<div class="jh-plan__bar">' + btn('다시 불러오기', 'reload', 'secondary') + '</div></div>';
  const msg = (bs.msg ? '<div class="jh-plan__pad"><div class="jh-field__hint" role="status">' + esc(bs.msg) + '</div></div>' : '') + (bs.err ? '<div class="jh-plan__pad" data-bd-err>' + alertHtml(bs.err) + '</div>' : '');
  const conflict = Number.isInteger(bs.conflictRev) ? '<div class="jh-plan__pad" data-bd-conflict>' + alertHtml('다른 곳에서 먼저 바뀌었습니다(현재 r' + bs.conflictRev + '). 내가 입력한 내용은 그대로 두었습니다. 최신 개정을 확인한 뒤, 내 입력으로 최신 개정을 고치려면 아래 버튼을 눌러 이어서 저장하세요.') + '<div class="jh-plan__bar">' + btn('최신 기준으로 이어서 저장', 'conflict-continue', 'secondary') + '</div></div>' : '';
  if (isO(bs.draft)) return msg + conflict + editHtml(bs, imp);
  if (!isO(bs.saved)) return msg + '<div class="jh-plan__pad"><div class="jh-empty">아직 실행예산이 없습니다. 견적에서 가져오거나 직접 작성해 주세요.</div><div class="jh-plan__bar"><span class="jh-plan__line">' + btn('실행예산 작성', 'new', 'secondary') + btn('견적에서 가져와 작성', 'new-import', 'secondary') + '</span></div></div>';
  return msg + readHtml(bs) + (bs.showHistory && Array.isArray(bs.saved.history) && bs.saved.history.length ? historyHtml(bs) : '');
}
