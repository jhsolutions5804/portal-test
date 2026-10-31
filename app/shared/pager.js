import { esc } from '../core/ui.js?v=20261031h';

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
/** 모듈 상태(st)를 받지 못하는 표 함수를 위한 앱 전체 공용 쪽 지도 — map 을 넘기지 않으면 여기에 기억한다 */
export const pagerGlobal = {};
export const pagerState = (map, key) => { const m = map || pagerGlobal; return m[key] || (m[key] = pagerDefault()); };
export const pagerReset = (map, key) => { const m = map || pagerGlobal; if (m[key]) m[key].page = 1; };
/** 검색·필터·정렬 같은 조건을 하나의 글자(sig)로 묶어 넘기면, 조건이 바뀌었을 때만 1쪽으로 돌린다 — 조건을 바꾸는 곳마다 pagerReset 을 부르지 않아도 된다 */
export function pagerSync(map, key, sig) { const st = pagerState(map, key); const g = String(sig == null ? '' : sig); if (st.sig !== g) { st.sig = g; st.page = 1; } return st; }
/** 쪽 막대 — 줄이 10개 이하이면 숨긴다(opts.always 로 항상 표시). key 는 한 화면의 목록 구분용(영문·숫자·-) */
export function pagerHtml(info, key, opts) {
  if (!(opts && opts.always) && info.total <= PAGE_SIZES[0]) return '';
  const k = esc(key);
  const nums = pageList(info.page, info.pages).map((n) => n === '…' ? '<span class="jh-field__hint">…</span>' : '<button type="button" class="jh-btn" data-variant="' + (n === info.page ? 'primary' : 'ghost') + '" data-pg-key="' + k + '" data-pg-go="' + n + '"' + (n === info.page ? ' aria-current="page"' : '') + '>' + n + '</button>').join('');
  const nav = (label, to, dis) => '<button type="button" class="jh-btn" data-variant="ghost" data-pg-key="' + k + '" data-pg-go="' + to + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  const text = info.total ? (info.from + 1) + '–' + info.to + ' / ' + info.total + '줄' : '0줄';
  const sel = '<label class="jh-field__hint">페이지당 <select class="jh-select jh-pgbar__sel" data-pg-key="' + k + '" data-pg-size aria-label="페이지당 줄 수">' + PAGE_SIZES.map((n) => '<option value="' + n + '"' + (n === info.size ? ' selected' : '') + '>' + n + '줄</option>').join('') + '</select></label>';
  return '<div class="jh-pgbar" data-pg-bar="' + k + '">' + sel + '<span class="jh-field__hint">' + text + '</span>' + nav('이전', info.page - 1, info.page <= 1) + nums + nav('다음', info.page + 1, info.page >= info.pages) + '</div>';
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
  const s = pagerState(map && act.key in map ? map : (act.key in pagerGlobal ? pagerGlobal : map), act.key);   // 그 목록이 쓰는 지도(모듈 상태 또는 공용)에 반영
  if (act.size) { if (!PAGE_SIZES.includes(act.size)) return false; s.size = act.size; s.page = 1; return true; }
  s.page = act.page; return true;
}

/** 이미 만들어 둔 표 HTML(<table>…<tbody>행…</tbody></table>)의 행을 쪽으로 나누고 아래에 쪽 막대를 붙인다 — 표를 만드는 코드를 고치지 않고 출력에만 씌울 수 있다.
 * 안전장치: tbody 가 하나가 아니거나 안에 중첩 표가 있거나 행이 깨끗이 나뉘지 않으면 **그대로** 돌려준다(화면이 깨지지 않게). 줄이 10개 이하이면 쪽 막대도 없이 그대로.
 * map 은 모듈 상태의 쪽 지도, key 는 목록 구분, sig 는 검색·필터 조건을 묶은 글자(조건이 바뀌면 1쪽으로) */
export function pageTableHtml(html, map, key, sig) {
  const h = String(html == null ? '' : html); const a = h.indexOf('<tbody>'); const b = h.lastIndexOf('</tbody>');
  if (a < 0 || b < a || h.indexOf('<tbody>', a + 7) >= 0) return h;
  const body = h.slice(a + 7, b); if (/<table/.test(body)) return h;
  const rows = body.split(/(?=<tr[\s>])/).filter((x) => x.trim()); if (!rows.length || rows.some((r) => !/<\/tr>\s*$/.test(r) || (r.match(/<tr[\s>]/g) || []).length !== 1)) return h;
  const info = pageInfo(rows.length, pagerSync(map, key, sig));
  if (rows.length <= PAGE_SIZES[0]) return h;
  const te = h.indexOf('</table>', b); const end = te < 0 ? h.length : te + 8 + (h.slice(te + 8, te + 14) === '</div>' ? 6 : 0);   // 쪽 막대는 표(와 그것을 감싼 스크롤 상자) 바로 아래에
  return h.slice(0, a + 7) + rows.slice(info.from, info.to).join('') + h.slice(b, end) + pagerHtml(info, key) + h.slice(end);
}
/** 자체 쪽 막대를 쓰는 화면(영업기획 등)을 위한 모듈 단위 페이지 크기 — 한 번 고르면 그 모듈의 모든 목록에 적용된다 */
export const pagerSizeGet = (group, dflt) => { const g = pagerGlobal['size:' + group]; return g && PAGE_SIZES.includes(g.size) ? g.size : (dflt || PAGE_SIZES[0]); };
export function pagerSizeSet(group, n) { n = Number(n); if (!PAGE_SIZES.includes(n)) return false; pagerGlobal['size:' + group] = { size: n, page: 1 }; return true; }
/** 줄이 10개를 넘을 때만 나오는 '페이지당 N줄' 선택 칸(change 이벤트는 pagerSizeAction 으로 읽는다) */
export function pagerSizeSelect(group, total) {
  if ((total || 0) <= PAGE_SIZES[0]) return '';
  const cur = pagerSizeGet(group);
  return '<label class="jh-field__hint">페이지당 <select class="jh-select jh-pgbar__sel" data-pg-size-group="' + esc(group) + '" aria-label="페이지당 줄 수">' + PAGE_SIZES.map((n) => '<option value="' + n + '"' + (n === cur ? ' selected' : '') + '>' + n + '줄</option>').join('') + '</select></label>';
}
/** change 이벤트가 위 선택 칸에서 온 것이면 { group, size } 아니면 null */
export function pagerSizeAction(ev) { const t = ev && ev.target; if (!t || !t.matches || !t.matches('[data-pg-size-group]')) return null; return { group: t.getAttribute('data-pg-size-group'), size: Number(t.value) }; }
