/* 영업기획 화면 공용 조각 — 카드·칩·쪽 이동·입력칸. 색·간격은 theme/plan.css 의 변수만 쓴다. */
import { esc } from '../../core/ui.js?v=20261030a';
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

/** 목록으로 돌아올 때 필터·쪽·스크롤 위치를 되살리기 위한 기억(같은 탭 안에서만, sessionStorage). 쓸 수 없는 환경이면 조용히 건너뛴다 */
export const uiState = { load(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } }, save(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 기억하지 못해도 화면은 동작한다 */ } } };
/** 주소(해시)만 갱신한다 — 화면은 이미 그렸으므로 틀이 다시 그리지 않게 pushState 를 쓰고, 브라우저 뒤로 가기·앞으로 가기는 틀이 주소를 읽어 화면을 다시 그린다 */
export function pushHash(hash) { if (location.hash === hash) return; try { history.pushState(null, '', hash); } catch (e) { location.hash = hash; } }
