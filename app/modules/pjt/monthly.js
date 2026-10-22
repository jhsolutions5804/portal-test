/* PJT 월간 보고서 — 현장 층 집계(순수 규칙, 화면·네트워크 없이 시험 가능). 설계 docs/monthly-report-design.md r1(대표님 2026-10-15~17 결정).
 * 입력은 모두 "문서 목록" [{ id: 'YYYY-MM-DD', ...문서 데이터 }] — 읽기(Firestore)는 호출하는 쪽이 한다. 금액·개인 정보는 다루지 않는다(현장 층).
 *  · 공정(progress_days): 날짜마다 "그날 새로 체크한 키"만 저장 → 월 증분은 날짜 합이 아니라 **월말 상태 − 전월말 상태**(옛 날짜 문서를 고쳐 체크를 취소해도 반영)
 *  · 설치 완료 = 설치 하위 열(installCols)이 모두 체크된 품목 = 시공검측 직전까지(대표님 확정) · 시공검측은 별도 단계 · 반입·입고검사는 참고 지표
 *  · 생산성 수율 = 그 달 새로 설치 완료된 품목 ÷ 그 달 투입 공수 — 데이터가 부족하면 숫자 대신 사유(공정 체크 없음·공수 없음), 설치가 거의 끝난 프로젝트는 "마감 단계" 표시
 *  · 공사일보 미작성 일수 = 달력 전체(휴무·주말·공휴일 포함) — 세는 기간은 월초(또는 프로젝트 시작일)~월말(또는 오늘·종료일) */
const KEY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s) => KEY.test(String(s || '')) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const isYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const pad = (n) => String(n).padStart(2, '0');
/** 월 범위: { first: 'YYYY-MM-01', last: 'YYYY-MM-말일', prevLast: 전월 말일, days: 일수 } — 형식이 틀리면 null */
export function monthRange(ym) {
  if (!isYm(ym)) return null; const [y, m] = ym.split('-').map(Number); const days = new Date(Date.UTC(y, m, 0)).getUTCDate(); const prev = new Date(Date.UTC(y, m - 1, 0));
  return { ym, first: ym + '-01', last: ym + '-' + pad(days), prevLast: prev.getUTCFullYear() + '-' + pad(prev.getUTCMonth() + 1) + '-' + pad(prev.getUTCDate()), days };
}
const dayNum = (d) => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
const inMonth = (id, r) => isDay(id) && id >= r.first && id <= r.last;

/* ───────── 공정 ───────── */
/** 공정 문서 한 건(groups: { 섹터: { '<품목>_<열>': true } })을 [{ gid, item, col }] 로. 열 이름은 구조(stages)에서 찾아 품목 id 에 '_' 가 있어도 안전 */
function cellsOf(doc, cols) {
  const out = []; const g = (doc && doc.groups) || {};
  Object.keys(g).forEach((gid) => { const m = g[gid] || {}; Object.keys(m).forEach((k) => {
    if (m[k] !== true) return; const col = cols.find((c) => k.length > c.length + 1 && k.endsWith('_' + c)); if (col) out.push({ gid, item: k.slice(0, k.length - col.length - 1), col });
  }); });
  return out;
}
/** 기준일(cut, 그날 포함)까지의 누적 상태 → { 'gid|item': Set(열) } — 날짜 문서의 합집합 */
export function stateAt(progressDocs, cut, structure) {
  const cols = (structure && structure.stages) || []; const st = {};
  (progressDocs || []).forEach((d) => { if (!d || !isDay(d.id) || d.id > cut) return; cellsOf(d, cols).forEach((c) => { const k = c.gid + '|' + c.item; (st[k] || (st[k] = new Set())).add(c.col); }); });
  return st;
}
/** 상태 → 집계: 설치 완료 품목 수·시공검측 통과 품목 수·단계별 체크 품목 수·체크된 칸 수·전체 품목 수 */
export function tally(st, structure) {
  const S = structure || {}; const install = S.installCols || [], stages = S.stages || []; const total = (S.groups || []).reduce((n, g) => n + ((g.items || []).length), 0);
  const known = new Set(); (S.groups || []).forEach((g) => (g.items || []).forEach((i) => known.add(g.id + '|' + i.id)));
  const keys = Object.keys(st).filter((k) => known.size === 0 || known.has(k)); const byStage = {}; stages.forEach((c) => { byStage[c] = 0; });
  let installed = 0, inspected = 0, cells = 0;
  keys.forEach((k) => { const v = st[k]; cells += v.size; stages.forEach((c) => { if (v.has(c)) byStage[c]++; }); if (install.length && install.every((c) => v.has(c))) installed++; if (v.has('시공검측')) inspected++; });
  return { installed, inspected, cells, byStage, total, installRate: total ? installed / total : 0, inspectRate: installed ? inspected / installed : 0 };
}
/** 월 공정 집계: 전월 말·이번 달 말 상태와 월 증분(상태 차이). 그 달에 새로 체크된 칸이 있었는지(touched)도 돌려준다 */
export function monthlyProgress(progressDocs, ym, structure) {
  const r = monthRange(ym); if (!r) return null; const a = tally(stateAt(progressDocs, r.prevLast, structure), structure), b = tally(stateAt(progressDocs, r.last, structure), structure);
  const by = {}; Object.keys(b.byStage).forEach((c) => { by[c] = b.byStage[c] - (a.byStage[c] || 0); });
  const monthDocs = (progressDocs || []).filter((d) => d && inMonth(d.id, r)); const touched = monthDocs.some((d) => cellsOf(d, (structure && structure.stages) || []).length > 0);
  return { start: a, end: b, delta: { installed: b.installed - a.installed, inspected: b.inspected - a.inspected, cells: b.cells - a.cells, byStage: by }, touched, checkDays: monthDocs.filter((d) => cellsOf(d, (structure && structure.stages) || []).length > 0).length };
}

/* ───────── 출역·공수 ───────── */
/** 월 투입 공수 합과 출역: 공수 문서(md: { 근로자: 공수 }), 출역 문서(checks: [근로자 id, …]). 일평균 출역 인원은 출역한 날 기준 */
export function monthlyManday(mandayDocs, attendanceDocs, ym) {
  const r = monthRange(ym); if (!r) return null; let total = 0, mdDays = 0; const people = new Set();
  (mandayDocs || []).forEach((d) => { if (!d || !inMonth(d.id, r)) return; let day = 0; const m = d.md || {}; Object.keys(m).forEach((w) => { const v = Number(m[w]); if (isFinite(v) && v > 0) { day += v; people.add(w); } }); if (day > 0) { total += day; mdDays++; } });
  let attDays = 0, heads = 0; (attendanceDocs || []).forEach((d) => { if (!d || !inMonth(d.id, r)) return; const n = Array.isArray(d.checks) ? new Set(d.checks.filter((x) => x != null && x !== '')).size : 0; if (n > 0) { attDays++; heads += n; } });
  return { manday: Math.round(total * 100) / 100, mandayDays: mdDays, attendDays: attDays, avgHeads: attDays ? Math.round((heads / attDays) * 10) / 10 : 0, workers: people.size };
}

/* ───────── 공사일보 ───────── */
const s = (v) => String(v == null ? '' : v).trim();
/** 공사일보 월 요약. 미작성 일수는 **달력 전체**(결정 11): 기간 = max(월초, 프로젝트 시작일) ~ min(월말, 오늘, 종료일)의 모든 날 중 일보가 없는 날.
 *  참고로 "출역이 있는 날 중 미작성"(attendDays 집합을 주면)도 센다. opts = { today, startDate, endDate, attendDocs } */
export function monthlyReports(reportDocs, ym, opts) {
  const r = monthRange(ym); if (!r) return null; const o = opts || {};
  const from = isDay(o.startDate) && o.startDate > r.first ? o.startDate : r.first; let to = r.last; if (isDay(o.today) && o.today < to) to = o.today; if (isDay(o.endDate) && o.endDate < to) to = o.endDate;
  const have = new Set(); const remarks = []; let lastTomorrow = '', lastDate = '';
  (reportDocs || []).slice().sort((a, b) => String(a && a.id).localeCompare(String(b && b.id))).forEach((d) => {   // 복사해서 정렬 — 받은 배열을 바꾸지 않는다(순수 함수)
    if (!d || !inMonth(d.id, r)) return; have.add(d.id);
    if (s(d.remarks)) remarks.push({ date: d.id, text: s(d.remarks), author: s(d.author) }); if (s(d.tomorrow)) { lastTomorrow = s(d.tomorrow); lastDate = d.id; }
  });
  const span = from <= to ? dayNum(to) - dayNum(from) + 1 : 0; let written = 0; for (const id of have) if (id >= from && id <= to) written++;
  const attend = new Set((o.attendDocs || []).filter((d) => d && inMonth(d.id, r) && Array.isArray(d.checks) && d.checks.length > 0).map((d) => d.id));
  let attendMissing = 0; attend.forEach((id) => { if (id >= from && id <= to && !have.has(id)) attendMissing++; });
  return { from, to, span, written, missing: Math.max(0, span - written), attendMissing, remarks, nextPlan: { text: lastTomorrow, from: lastDate }, total: have.size };
}

/* ───────── 수율 ───────── */
export const FINISHING_RATE = 0.95;   // 전월 말 설치 완료율이 이 이상이면 "마감 단계"
/** 생산성 수율(설계 §3-1·§4): { status, ... } — status = ok(값 있음) | no-check(공정 체크 없음, 입력 누락 가능) | no-manday(공수 입력 없음) | finishing(마감 단계) | no-data(공정 구조 없음)
 *  분자·분모는 항상 같이(installed·manday) 돌려준다. per100 = 공수 100당 새로 설치 완료된 품목 */
export function productivity(prog, md, structure) {
  const none = { status: 'no-data', installed: 0, manday: 0, value: null, per100: null };
  if (!prog || !md || !structure || !(structure.installCols || []).length) return none;
  const installed = prog.delta.installed, manday = md.manday; const base = { installed, manday, value: null, per100: null, installRate: prog.end.installRate };
  if (prog.start.installRate >= FINISHING_RATE) return Object.assign(base, { status: 'finishing' });   // 설치가 거의 끝난 달 — 설치 수율 대신 마감 단계로 표시(마감 체크리스트는 2단계)
  if (!(manday > 0)) return Object.assign(base, { status: 'no-manday' });
  const checked = prog.delta.byStage; const installChecks = (structure.installCols || []).concat(['시공검측']).some((c) => (checked[c] || 0) !== 0);
  if (!prog.touched && !installChecks) return Object.assign(base, { status: 'no-check' });
  const value = installed / manday; return Object.assign(base, { status: 'ok', value, per100: Math.round(value * 1000) / 10 });
}

/** 현장 층 월간 보고 한 벌(순수 집계) — 호출하는 쪽이 읽어 온 문서 목록을 넣는다. docs = { progress, manday, attendance, reports }, project = { structure, startDate, endDate, today } */
export function fieldReport(docs, ym, project) {
  const r = monthRange(ym); if (!r) return null; const d = docs || {}, p = project || {};
  const progress = p.structure ? monthlyProgress(d.progress, ym, p.structure) : null; const md = monthlyManday(d.manday, d.attendance, ym);
  const reports = monthlyReports(d.reports, ym, { today: p.today, startDate: p.startDate, endDate: p.endDate, attendDocs: d.attendance });
  return { ym, range: r, progress, manday: md, reports, yield: productivity(progress, md, p.structure) };
}
/** 마감 체크리스트(시공검측 이후 프로젝트 완성도, 설계 §3-4) — 그 달 말(이번 달이면 오늘)까지 완료한 항목 수. 항목 이름·개수는 프로젝트가 정한다(코드에 단계 이름이 없다).
 * 지난 달 보고서에는 그 뒤에 완료한 항목의 완료일을 내보내지 않는다(미래 정보가 새지 않게). 항목이 없으면 완성도 null(0 으로 나누지 않음). 정해진 필드만 내보낸다(uid·금액 등은 버림). */
export function closeoutSummary(items, ym, today) {
  const r = monthRange(ym); const list = (Array.isArray(items) ? items : []).filter((i) => i && typeof i === 'object' && !Array.isArray(i) && typeof i.name === 'string' && i.name.trim());
  const cut = r ? (isDay(today) && today < r.last ? today : r.last) : ''; const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const out = list.map((i) => { const done = !!cut && isDay(i.doneDate) && i.doneDate <= cut; return { id: str(i.id), name: i.name.trim(), done, doneDate: done ? i.doneDate : '', assignee: str(i.assignee), memo: str(i.memo) }; });
  const done = out.filter((x) => x.done).length;
  return { total: out.length, done, rate: out.length ? done / out.length : null, doneThisMonth: r ? out.filter((x) => x.done && x.doneDate >= r.first).length : 0, items: out };
}
