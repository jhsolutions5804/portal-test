/* 영업기획 화면 공용 조각 — 카드·칩·쪽 이동·입력칸. 색·간격은 theme/plan.css 의 변수만 쓴다. */
import { esc } from '../../core/ui.js?v=20261013t';
export const won = (n) => (Math.round(Number(n) || 0)).toLocaleString('ko-KR');
export const signed = (n) => (n >= 0 ? '+' : '') + won(n);
export const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
export const chip = (t, tone) => '<span class="jh-plan__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
export const fld = (label, inner, hint) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + '</label>' + inner + (hint ? '<div class="jh-field__hint">' + esc(hint) + '</div>' : '') + '</div>';
export const selectHtml = (attr, val, opts, extra) => '<select class="jh-select" ' + attr + (extra ? ' ' + extra : '') + '>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
/** 쪽 이동 막대. p: paginate() 결과, attr: 버튼에 붙일 속성 이름(예: data-es-page), key: 어느 목록인지 */
export function pagerHtml(p, attr, key) {
  if (p.pages <= 1) return p.total ? '<div class="jh-field__hint jh-plan__center">전체 ' + p.total + '건</div>' : '';
  const b = (n, label, on, dis) => '<button type="button" class="jh-btn" data-variant="' + (on ? 'primary' : 'ghost') + '" ' + attr + '="' + key + ':' + n + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  return '<div class="jh-plan__pager">' + b(Math.max(1, p.page - 1), '‹', false, p.page === 1) + Array.from({ length: p.pages }, (_, i) => i + 1).map((n) => b(n, n, n === p.page, false)).join('') + b(Math.min(p.pages, p.page + 1), '›', false, p.page === p.pages) + '</div><div class="jh-field__hint jh-plan__center">전체 ' + p.total + '건 중 ' + p.from + '-' + p.to + '건</div>';
}
