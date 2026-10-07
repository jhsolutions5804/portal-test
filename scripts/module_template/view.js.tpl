import { esc } from '../../core/ui.js?v=__VER__';

/* __TITLE__ 의 화면 조각 — 모든 값은 esc() 로 감싸 HTML 로 만든다. 스타일은 theme/__ID__.css 와 공용 클래스(jh-card·jh-btn·jh-field·jh-chip …)를 쓴다 */
export function pageHtml(items, summary) {
  const rows = (items || []).map((x) => '<div class="jh-__ID__row">' + esc(x.title || x.id) + '</div>').join('');
  return '<div class="jh-__ID__"><section class="jh-card"><div class="jh-panel__head"><h3>__ICON__ __TITLE__</h3><span class="jh-chip">' + esc(summary) + '</span></div><div class="jh-form">' + (rows || '<div class="jh-empty">아직 항목이 없습니다.</div>') + '</div></section></div>';
}__WIDGET_VIEW__
