import { esc } from '../../core/ui.js?v=20261011r';
import { GTYPES, GKEYS, dday, won, leasePayState, dueList, homeSummary, leaseMonthly } from './logic.js?v=20261011r';

const TABS = [['home', '개요'], ['lease', '임대'], ['vehicle', '차량'], ['asset', '자산·장비'], ['renewal', '갱신 일정']];
export const tabsHtml = (cur, base) => '<div class="jh-segmented jh-gen__tabs" role="group" aria-label="총무">' + TABS.map(([k, l]) => '<a class="jh-segmented__item" href="' + esc(base || '#/general') + '/' + k + '" aria-pressed="' + (k === cur) + '">' + esc(l) + '</a>').join('') + '</div>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const alertHtml = (tone, html) => '<div class="jh-alert" data-tone="' + tone + '" role="status">' + html + '</div>';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const ddayText = (n) => (n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + Math.abs(n));

/** 개요: 네 종류의 숫자와 가까운 만기·갱신 */
export function homeHtml(st) {
  const data = st.data; const s = homeSummary(data); const dues = dueList(data, st.today, 90); const total = GKEYS.reduce((n, k) => n + (data[k] || []).length, 0);
  const kpi = [['임대', s.leaseN + '건', '월 ' + won(s.leaseMonthly) + '원(관리비 포함)', 'lease'], ['차량', s.vehicleN + '대', '월 ' + won(s.vehicleMonthly) + '원', 'vehicle'], ['자산·장비', s.assetN + '점', '구입가 합계 ' + won(s.assetCost) + '원', 'asset'], ['갱신 일정', s.renewalN + '건', '연 환산 ' + won(s.renewalYear) + '원', 'renewal']];
  const k = '<div class="jh-kpi-grid">' + kpi.map(([l, v, h, key]) => '<a class="jh-kpi jh-gen__kpi" href="' + esc(st.base || '#/general') + '/' + key + '"><span class="jh-kpi__label">' + esc(l) + '</span><span class="jh-kpi__value">' + esc(v) + '</span><span class="jh-kpi__hint">' + esc(h) + '</span></a>').join('') + '</div>';
  const rows = dues.map((x) => '<tr class="jh-gen__row" data-g-go="' + esc(x.type) + '" data-g-id="' + esc(x.id) + '"><td>' + chip(ddayText(x.d), x.tone === 'muted' ? 'muted' : x.tone) + '</td><td>' + esc(x.date) + '</td><td>' + esc(GTYPES[x.type].title) + '</td><td>' + esc(x.label) + '</td><td>' + esc(x.what) + '</td></tr>').join('');
  const body = dues.length ? '<div class="jh-gen__scroll"><table class="jh-gen-table jh-gen-table--click"><thead><tr><th>남은 날</th><th>일자</th><th>구분</th><th>항목</th><th>내용</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">앞으로 90일 안에 다가오는 만기·갱신이 없습니다.</div>';
  const first = total === 0 ? alertHtml('info', '아직 입력된 항목이 없습니다. 각 탭에서 항목을 추가하거나, <strong>임대·갱신 일정</strong> 탭의 "엑셀 기준 첫 목록 넣기"로 월간 손익계산서 엑셀에 있던 항목을 한 번에 넣을 수 있습니다.') : '';
  return first + k + card('다가오는 만기·갱신 (90일 안, 지난 것 포함)', body);
}

const inputFor = (f, val, attr) => {
  const v = esc(val == null ? '' : val);
  if (f.t === 'select') return '<select class="jh-select" ' + attr + '>' + f.o.map((o) => '<option' + (String(val) === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
  if (f.t === 'area') return '<textarea class="jh-input" rows="3" ' + attr + '>' + v + '</textarea>';
  if (f.t === 'date') return '<input class="jh-input" type="date" value="' + v + '" ' + attr + '>';
  if (f.t === 'money' || f.t === 'int') return '<input class="jh-input" inputmode="numeric" value="' + v + '" ' + attr + '>';
  return '<input class="jh-input" value="' + v + '" ' + (f.ph ? 'placeholder="' + esc(f.ph) + '" ' : '') + attr + '>';
};
/** 항목 하나의 입력 양식(새로 만들기·수정) + 이력 편집 */
export function editHtml(st) {
  const e = st.edit; const T = GTYPES[e.type];
  const fields = T.fields.map((f) => '<div class="jh-field' + (f.t === 'area' ? ' jh-gen__wide' : '') + '"><label class="jh-field__label">' + esc(f.l) + (f.req ? ' *' : '') + '</label>' + inputFor(f, e.vals[f.k], 'data-gf="' + f.k + '"') + '</div>').join('');
  let log = '';
  if (T.log) {
    const L = T.log;
    const head = L.cols.map((c) => '<th>' + esc(c.l) + '</th>').join('') + '<th></th>';
    const rows = e.rows.map((r, i) => '<tr>' + L.cols.map((c) => '<td>' + inputFor(c, r[c.k], 'data-gl="' + i + ':' + c.k + '" aria-label="' + esc(c.l) + '"') + '</td>').join('') + '<td><button type="button" class="jh-btn" data-variant="ghost" data-g-logdel="' + i + '">삭제</button></td></tr>').join('');
    log = '<h4 class="jh-gen__sub">' + esc(L.l) + ' <span class="jh-field__hint">(' + e.rows.length + '줄)</span></h4><div class="jh-gen__scroll"><table class="jh-gen-table"><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="' + (L.cols.length + 1) + '" class="jh-field__hint">이력이 없습니다.</td></tr>') + '</tbody></table></div><div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="ghost" data-g-logadd>+ 줄 추가</button></div>';
  }
  const title = (e.isNew ? T.add : T.label(e.vals) + ' 수정');
  return card(title, '<div class="jh-gen__pad"><div class="jh-gen__grid">' + fields + '</div>' + log + '<div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-g-act="save">저장</button><button type="button" class="jh-btn" data-variant="ghost" data-g-act="cancel">취소</button>' + (e.isNew ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-g-act="delete">삭제</button>') + '</div></div>');
}
/** 목록 표(검색·상태 거름 반영) */
export function tableHtml(st, type) {
  const T = GTYPES[type]; const q = (st.q || '').trim().toLowerCase(); const all = st.data[type] || [];
  const list = all.filter((d) => (!st.onlyActive || T.active(d)) && (!q || JSON.stringify(d).toLowerCase().includes(q)));
  const head = T.cols.map((c) => '<th' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + esc(c[0]) + '</th>').join('') + '<th>상태·알림</th>';
  const rows = list.map((d) => {
    const dues = T.dues(d).map((du) => { const n = dday(du.date, st.today); return n === null ? null : { n, what: du.what, lead: du.lead }; }).filter(Boolean).sort((a, b) => a.n - b.n)[0];
    let badge = '';
    if (type === 'lease') { const ps = leasePayState(d, st.today); if (ps) badge += chip(ps.text, ps.tone); }
    if (dues && T.active(d) && dues.n <= Math.max(dues.lead, 0)) badge += ' ' + chip(ddayText(dues.n) + ' ' + dues.what, dues.n < 0 ? 'danger' : 'warn');
    return '<tr class="jh-gen__row' + (T.active(d) ? '' : ' jh-gen__off') + '" data-g-open="' + esc(d.id) + '">' + T.cols.map((c) => '<td' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + esc(c[1](d, st.today)) + '</td>').join('') + '<td>' + badge + '</td></tr>';
  }).join('');
  return list.length ? '<div class="jh-gen__scroll"><table class="jh-gen-table jh-gen-table--click"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">' + (all.length ? '조건에 맞는 항목이 없습니다.' : '아직 항목이 없습니다.') + '</div>';
}
export function listHtml(st, type) {
  const T = GTYPES[type]; const hasSeed = (st.seed || {})[type] > 0 && !(st.data[type] || []).length;
  const bar = '<div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-g-add>' + esc(T.add) + '</button><input class="jh-input jh-gen__q" data-g-q placeholder="검색" value="' + esc(st.q || '') + '" aria-label="검색"><label class="jh-field__hint"><input type="checkbox" data-g-active' + (st.onlyActive ? ' checked' : '') + '> ' + esc(T.activeFilter) + '만 보기</label>' + (hasSeed ? '<button type="button" class="jh-btn" data-variant="ghost" data-g-seed>엑셀 기준 첫 목록 넣기</button>' : '') + '</div>';
  const extra = type === 'lease' ? '<div class="jh-field__hint jh-gen__pad">월 납부액 = 월 임대료 + 월 부가세. 입금 이력은 항목을 열면 "귀속 월"별로 기록합니다.</div>' : '';
  return (st.edit && st.edit.type === type ? editHtml(st) : '') + card(T.title + ' (' + (st.data[type] || []).length + ')', '<div class="jh-gen__pad">' + bar + '</div><div id="g-table">' + tableHtml(st, type) + '</div>' + extra);
}
export { leaseMonthly };
