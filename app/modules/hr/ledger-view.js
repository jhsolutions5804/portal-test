/* 임금대장 화면 — HTML 만 만드는 순수 함수(시험: tests/hr-ledger-view.test.mjs·hr-ledger-view.test.py). 데이터 읽기·마감·해제는 ledger-io.js, 연결은 index.js mountLedger. */
import { esc } from '../../core/ui.js?v=20261031a';
import { LEDGER_HEAD, ledgerRowCells, ledgerTotalCells, ledgerTotals, isClosed } from './ledger.js?v=20261031a';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const pad2 = (n) => String(n).padStart(2, '0');
/** 서버 시각(Timestamp)·ISO 글자·Date 모두 "YYYY-MM-DD HH:MM"(한국 시간 기준 표시는 브라우저 시간대)로 */
export function ledgerWhen(v) {
  let d = null; if (v && typeof v.toDate === 'function') d = v.toDate(); else if (v instanceof Date) d = v; else if (typeof v === 'string' && v) d = new Date(v);
  if (!d || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
const num = (v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : esc(v));

/** 마감 상태 한 줄 — 마감됨 / 해제됨(다시 마감 필요) / 아직 마감 안 함 */
export function ledgerStatusHtml(close) {
  if (isClosed(close)) return chip('🔒 마감됨 v' + (close.version || 1), 'ok') + ' <span class="jh-field__hint">' + esc(ledgerWhen(close.closedAt)) + ' · ' + esc(close.closedBy || '') + ' · ' + (close.rowCount || 0) + '명 · 급여명세서 수정 잠금</span>';
  if (close && close.status === 'open') return chip('🔓 해제됨 — 다시 마감 필요', 'warn') + ' <span class="jh-field__hint">이전 마감 v' + (close.version || 1) + ' · 급여명세서를 고칠 수 있는 상태입니다</span>';
  return chip('미마감', 'muted') + ' <span class="jh-field__hint">마감하면 이 달 급여명세서를 고칠 수 없습니다(해제는 사유를 남겨야 합니다)</span>';
}

function checksHtml(checks) {
  const b = (checks && checks.blockers) || [], w = (checks && checks.warnings) || [];
  const list = (arr) => '<ul style="margin:.25rem 0 0 1.1rem">' + arr.map((x) => '<li>' + esc(x.msg) + '</li>').join('') + '</ul>';
  return (b.length ? '<div class="jh-alert" data-tone="danger" role="alert"><b>마감할 수 없습니다 (' + b.length + '건)</b>' + list(b) + '</div>' : '')
    + (w.length ? '<div class="jh-alert" data-tone="warn" role="status"><b>확인해 주세요 (' + w.length + '건)</b> — 마감은 할 수 있습니다' + list(w) + '</div>' : '')
    + (!b.length && !w.length ? '<div class="jh-alert" data-tone="info" role="status">점검을 모두 통과했습니다(지급·공제·실지급 검산, 급여명세서 누락 없음).</div>' : '');
}

/** 직원별 표 + 합계 줄. 가로가 넓어 스크롤 영역 안에 두고 첫 칸(성명)을 고정한다 */
export function ledgerTableHtml(rows) {
  const t = ledgerTotals(rows);
  const th = LEDGER_HEAD.map((h, i) => '<th' + (i === 0 ? ' style="position:sticky;left:0;background:var(--c-surface,#fff);z-index:1"' : '') + '>' + esc(h) + '</th>').join('');
  const tr = (cells, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map((c, i) => '<td' + (typeof c === 'number' ? ' style="text-align:right"' : '') + (i === 0 ? ' style="position:sticky;left:0;background:var(--c-surface,#fff);font-weight:600"' : '') + '>' + (i === 6 && c === '' ? '<span class="jh-field__hint">—</span>' : num(c)) + '</td>').join('') + '</tr>';
  return '<div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-l-table><thead><tr>' + th + '</tr></thead><tbody>' + rows.map((r) => tr(ledgerRowCells(r))).join('') + tr(ledgerTotalCells(t)).replace('<tr>', '<tr class="jh-hr__sum" style="font-weight:700">') + '</tbody></table></div>';
}

function logHtml(close) {
  const L = (close && Array.isArray(close.unlockLog)) ? close.unlockLog : []; if (!L.length) return '';
  return card('해제 이력', '<div class="jh-hr__pad"><ul style="margin:0 0 0 1.1rem">' + L.map((e) => '<li>' + esc(ledgerWhen(e.at)) + ' · ' + esc(e.by || '') + ' — ' + esc(e.reason || '') + '</li>').join('') + '</ul></div>');
}

/** 화면 전체. st: { ym, loading, error, busy, data: { rows, checks, close }, unlockOpen, reason } */
export function ledgerPageHtml(st) {
  const s = st || {};
  const bar = '<div class="jh-hr__bar"><div class="jh-field"><label class="jh-field__label">귀속월</label><input class="jh-input" type="month" data-l-month value="' + esc(s.ym || '') + '"></div></div>';
  if (s.loading) return bar + '<div class="jh-skeleton" style="height:var(--u-220)" aria-busy="true"></div>';
  if (s.error) return bar + '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc(s.error) + '</div>';
  const d = s.data; if (!d) return bar + '<div class="jh-empty">귀속월을 고르세요</div>';
  const closed = isClosed(d.close), rows = d.rows || [], checks = d.checks || { ok: false, blockers: [], warnings: [] };
  const dis = (c) => (c ? '' : ' disabled');
  const acts = '<div class="jh-hr__bar">'
    + '<button type="button" class="jh-btn" data-variant="primary" data-l-act="close"' + dis(checks.ok && !closed && rows.length && !s.busy) + '>🔒 이 달 마감</button>'
    + (closed ? '<button type="button" class="jh-btn" data-variant="secondary" data-l-act="unlock"' + dis(!s.busy) + '>🔓 마감 해제</button>' : '')
    + '<button type="button" class="jh-btn" data-variant="ghost" data-l-act="csv"' + dis(rows.length) + '>📊 엑셀(CSV) 내려받기</button>'
    + '<button type="button" class="jh-btn" data-variant="ghost" data-l-act="print"' + dis(rows.length) + '>🖨 인쇄·PDF</button></div>';
  const unlock = closed && s.unlockOpen ? card('마감 해제', '<div class="jh-hr__pad"><div class="jh-field"><label class="jh-field__label">해제 사유 <span class="jh-field__hint">(필수 · 이력에 남습니다)</span></label><textarea class="jh-input" rows="3" maxlength="500" data-l-reason placeholder="예: 6월분 식대 금액 정정">' + esc(s.reason || '') + '</textarea></div><div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-l-act="unlock-do"' + dis(!s.busy) + '>해제하기</button><button type="button" class="jh-btn" data-variant="ghost" data-l-act="unlock-cancel">취소</button></div></div>') : '';
  const body = rows.length ? ledgerTableHtml(rows) : '<div class="jh-empty">' + esc(s.ym) + ' 급여명세서가 없습니다. 급여명세서 화면에서 먼저 저장해 주세요.</div>';
  return bar + '<div class="jh-hr__bar">' + ledgerStatusHtml(d.close) + '</div>' + checksHtml(checks) + acts + unlock
    + card('임금대장 ' + (s.ym || ''), '<div class="jh-hr__pad">' + body + '<div class="jh-field__hint" style="margin-top:.5rem">근로기준법 제48조·시행령 제27조 기재사항(보존 3년). 근로시간·연장·야간·휴일은 급여명세서를 저장한 때의 값(실제 지급 기준)이고, 근로일수는 명세서에 없으면 출퇴근 기록에서 센 값입니다("—"는 자료 없음).</div></div>', rows.length ? chip(rows.length + '명', 'muted') : '') + logHtml(d.close);
}
