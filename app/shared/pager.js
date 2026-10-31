import { esc } from '../core/ui.js?v=20261031g';

/* 목록 페이지 나누기 공용 부품 — 모든 모듈(PJT 관리 제외)의 목록이 같은 규칙·같은 모양을 쓴다.
 * 쓰는 법: ① 모듈 상태에 map = {} 를 둔다 ② 목록을 그릴 때 info = pageInfo(rows.length, pagerState(map, key)) → rows.slice(info.from, info.to) 만 그리고 pagerHtml(info, key) 를 표 아래에 붙인다
 * ③ 모듈의 클릭·변경 처리 맨 앞에서 act = pagerAction(ev) 가 있으면 pagerApply(map, act) 하고 그 목록을 다시 그린다
 * ④ 검색·필터·정렬을 바꾸면 pagerReset(map, key) 로 1쪽으로 돌린다 ⑤ 엑셀·CSV·인쇄·일괄 작업은 쪽과 무관하게 **전체 줄**을 쓴다(rows 자체는 자르지 않는다) */
export const PAGE_SIZES = [10, 20, 50];
export const pagerDefault = () => ({ size: 10, page: 1 });
/** 쪽 계산 — 허용하지 않는 줄 수는 10줄로, 범위를 벗어난 쪽은 가까운 쪽으로 맞춘다 */
export function pageInfo(total, st) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const size = PAGE_SIZES.includes(Number(st && st.size)) ? Number(st.size) : PAGE_SIZES[0];
  const pages = Math.max(1, Math.ceil(n / size));
  const page = Math.min(Math.max(1, Math.floor(Number(st && st.page) || 1)), pages);
  const from = n ? (page - 1) * size : 0; const to = Math.min(n, from + size);
  return { size, pages, page, from, to, total: n };
}
/** 쪽 번호 단추 목록 — 첫 쪽·끝 쪽·현재 쪽 앞뒤 2쪽만, 사이는 '…' */
export function pageList(page, pages) {
  const keep = new Set([1, pages]); for (let i = page - 2; i <= page + 2; i++) if (i >= 1 && i <= pages) keep.add(i);
  const nums = [...keep].sort((a, b) => a - b); const out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}
/** 목록마다 따로 쪽·줄 수를 기억하는 상태 지도에서 key 의 상태를 꺼낸다(없으면 만든다) */
export const pagerState = (map, key) => map[key] || (map[key] = pagerDefault());
export const pagerReset = (map, key) => { if (map[key]) map[key].page = 1; };
/** 검색·필터·정렬 같은 조건을 하나의 글자(sig)로 묶어 넘기면, 조건이 바뀌었을 때만 1쪽으로 돌린다 — 조건을 바꾸는 곳마다 pagerReset 을 부르지 않아도 된다 */
export function pagerSync(map, key, sig) { const st = pagerState(map, key); const g = String(sig == null ? '' : sig); if (st.sig !== g) { st.sig = g; st.page = 1; } return st; }
/** 쪽 막대 — 줄이 10개 이하이면 숨긴다(opts.always 로 항상 표시). key 는 한 화면의 목록 구분용(영문·숫자·-) */
export function pagerHtml(info, key, opts) {
  if (!(opts && opts.always) && info.total <= PAGE_SIZES[0]) return '';
  const k = esc(key);
  const nums = pageList(info.page, info.pages).map((n) => n === '…' ? '<span class="jh-field__hint">…</span>' : '<button type="button" class="jh-btn" data-variant="' + (n === info.page ? 'primary' : 'ghost') + '" data-pg-key="' + k + '" data-pg-go="' + n + '"' + (n === info.page ? ' aria-current="page"' : '') + '>' + n + '</button>').join('');
  const nav = (label, to, dis) => '<button type="button" class="jh-btn" data-variant="ghost" data-pg-key="' + k + '" data-pg-go="' + to + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  const text = info.total ? (info.from + 1) + '–' + info.to + ' / ' + info.total + '줄' : '0줄';
  const sel = '<label class="jh-field__hint">페이지당 <select class="jh-select jh-pager__sel" data-pg-key="' + k + '" data-pg-size aria-label="페이지당 줄 수">' + PAGE_SIZES.map((n) => '<option value="' + n + '"' + (n === info.size ? ' selected' : '') + '>' + n + '줄</option>').join('') + '</select></label>';
  return '<div class="jh-pager" data-pg-bar="' + k + '">' + sel + '<span class="jh-field__hint">' + text + '</span>' + nav('이전', info.page - 1, info.page <= 1) + nums + nav('다음', info.page + 1, info.page >= info.pages) + '</div>';
}
/** 클릭·변경 이벤트가 쪽 막대에서 온 것이면 { key, page } 또는 { key, size }, 아니면 null */
export function pagerAction(ev) {
  const t = ev && ev.target; if (!t || !t.closest) return null;
  const go = t.closest('[data-pg-go]');
  if (go) return go.disabled ? { key: go.getAttribute('data-pg-key'), page: 0, noop: true } : { key: go.getAttribute('data-pg-key'), page: Number(go.getAttribute('data-pg-go')) || 1 };
  if (t.matches && t.matches('[data-pg-size]')) return { key: t.getAttribute('data-pg-key'), size: Number(t.value) };
  return null;
}
/** 쪽 막대 동작을 상태 지도에 반영 — 바뀌었으면 true(다시 그려야 함) */
export function pagerApply(map, act) {
  if (!act || act.noop) return false;
  const s = pagerState(map, act.key);
  if (act.size) { if (!PAGE_SIZES.includes(act.size)) return false; s.size = act.size; s.page = 1; return true; }
  s.page = act.page; return true;
}
