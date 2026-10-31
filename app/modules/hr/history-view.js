/* 인사 이력(인사기록카드) 화면 — HTML 만 만드는 순수 함수(시험: tests/hr-history-view.test.mjs·hr-history-view.test.py). 읽기·클릭 연결은 index.js mount(직원 상세). */
import { esc } from '../../core/ui.js?v=20261031c';
import { HIST_KINDS, HIST_GROUPS, filterItems, groupCounts } from './history.js?v=20261031c';
import { EMP_TYPES } from './logic.js?v=20261031c';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
export const HIST_PAGE = 30;
const NOTE = '있는 자료를 모아 보여 주기만 하며 새로 저장하지 않습니다. 금액은 기본으로 가려져 있고 인쇄본에는 들어가지 않습니다. 면담·평가 의견은 앞부분만 보이고 전문은 각 화면에서 봅니다.';

/** 카드 안쪽 — 읽는 중·오류·목록이 바뀔 때 이 부분만 다시 그린다(상세 화면의 입력 중인 칸을 건드리지 않으려고) */
export function historyInnerHtml(h) {
  if (!h) return '';
  const ready = !h.loading && Array.isArray(h.items);
  const print = '<button type="button" class="jh-btn" data-variant="secondary" data-h-print' + (ready && h.items.length ? '' : ' disabled') + '>🖨 인사기록카드 인쇄·PDF</button>';
  if (!ready) return card('📜 인사 이력', '<div class="jh-hr__pad"><div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div></div>', print);
  const group = h.filter || 'all'; const list = filterItems(h.items, group); const limit = h.limit || HIST_PAGE; const shown = h.shown || {};
  const chips = '<div class="jh-hr__bar">' + groupCounts(h.items).map(([k, n]) => '<button type="button" class="jh-btn" data-variant="' + (k === group ? 'primary' : 'ghost') + '" data-h-filter="' + k + '">' + esc(HIST_GROUPS.find((g) => g[0] === k)[1]) + ' ' + n + '</button>').join('') + '</div>';
  const warn = (h.errors && h.errors.length ? '<div class="jh-alert" data-tone="warn" role="status">⚠️ 일부 자료를 불러오지 못했습니다: ' + esc(h.errors.join(', ')) + ' — 아래 목록에서 빠져 있을 수 있습니다.</div>' : '') + (h.skipped ? '<div class="jh-field__hint">날짜를 알 수 없는 ' + h.skipped + '건은 표시하지 못했습니다.</div>' : '');
  const rows = list.slice(0, limit).map((it) => {
    const k = HIST_KINDS[it.kind] || { label: it.kind, mark: '' };
    const secret = it.secret ? (shown[it.key] ? '<div class="jh-field__hint">🔓 ' + esc(it.secret) + '</div>' : '<div class="jh-field__hint">금액 ●●●●● <button type="button" class="jh-btn" data-variant="ghost" data-h-show="' + esc(it.key) + '" style="min-height:0;padding:0 .4rem">[보기]</button></div>') : '';
    return '<div class="jh-hr__post"><div class="jh-hr__bar"><span class="jh-field__hint">' + esc(it.date) + '</span>' + chip(k.mark + ' ' + k.label, 'muted') + '<strong>' + esc(it.title) + '</strong>' + (it.link ? '<a class="jh-btn" data-variant="ghost" href="' + esc(it.link) + '" style="margin-left:auto;min-height:0">화면 ›</a>' : '') + '</div>' + (it.detail ? '<div class="jh-field__hint">' + esc(it.detail) + '</div>' : '') + secret + '</div>';
  }).join('');
  const more = list.length > limit ? '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="secondary" data-h-more>더 보기 (남은 ' + (list.length - limit) + '건)</button></div>' : '';
  return card('📜 인사 이력', '<div class="jh-hr__pad">' + chips + warn + (rows || '<div class="jh-empty">표시할 이력이 없습니다.</div>') + more + '<div class="jh-field__hint" style="margin-top:.5rem">' + esc(NOTE) + '</div></div>', print);
}
/** 직원 상세 화면에 붙는 카드 자리(#w-hist) */
export const historyCardHtml = (h) => (h ? '<div id="w-hist">' + historyInnerHtml(h) + '</div>' : '');

const empLabel = (v) => { const t = (EMP_TYPES || []).find((x) => x[0] === v); return t ? t[1] : (v || ''); };
/** 인쇄(PDF 저장)용 A4 세로 인사기록카드 — 금액·링크·주민번호·연락처·주소·계좌는 넣지 않는다 */
export function historyPrintHtml(worker, items, today) {
  const w = worker || {}; const th = 'style="text-align:left;background:#eee;width:22%"';
  const info = [['성명', w.name], ['사원번호', w.empNo], ['소속', w.dept], ['직급', w.rank], ['직원 구분', empLabel(w.empType)], ['담당업무', w.job], ['입사일', w.hireDate], ['퇴직일', w.resignDate || (w.status === 'resigned' ? '' : '재직 중')]];
  const rows = []; for (let i = 0; i < info.length; i += 2) rows.push('<tr><th ' + th + '>' + esc(info[i][0]) + '</th><td>' + esc(info[i][1] || '-') + '</td><th ' + th + '>' + esc(info[i + 1][0]) + '</th><td>' + esc(info[i + 1][1] || '-') + '</td></tr>');
  const body = (items || []).map((it) => '<tr><td style="white-space:nowrap">' + esc(it.date) + '</td><td style="white-space:nowrap">' + esc((HIST_KINDS[it.kind] || { label: it.kind }).label) + '</td><td>' + esc(it.title) + (it.detail ? '<div style="color:#555">' + esc(it.detail) + '</div>' : '') + '</td></tr>').join('');
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>인사기록카드 - ' + esc(w.name || '') + '</title><style>@page{size:A4;margin:14mm}body{font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:10pt;color:#111}h1{font-size:16pt;text-align:center;margin:0 0 4mm}table{border-collapse:collapse;width:100%;margin-bottom:5mm}th,td{border:1px solid #888;padding:3px 6px;vertical-align:top}h2{font-size:11pt;margin:4mm 0 2mm}p{color:#555;font-size:8.5pt}</style></head><body><h1>인사기록카드</h1><table>' + rows.join('') + '</table><h2>인사 이력</h2><table><thead><tr><th style="width:18%">날짜</th><th style="width:16%">구분</th><th>내용</th></tr></thead><tbody>' + (body || '<tr><td colspan="3">기록된 이력이 없습니다.</td></tr>') + '</tbody></table><p>출력일 ' + esc(today || '') + ' · 포털에 저장된 자료를 모은 것입니다. 주민등록번호·연락처·주소·계좌번호·금액은 포함하지 않습니다.</p></body></html>';
}
