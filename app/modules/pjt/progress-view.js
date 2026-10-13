import { esc } from '../../core/ui.js?v=20261013zi';
import { calcAll, cellState, keyOf } from './progress.js?v=20261013zi';
import { holidayName } from '../../shared/holidays.js?v=20261013zi';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const chip = (t, tone) => '<span class="jh-pjt__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const dow = (d) => '일월화수목금토'[new Date(d + 'T12:00:00Z').getUTCDay()];
const bar = (pct) => '<span class="jh-pjt__bar2"><span style="width:' + Math.max(0, Math.min(100, pct)).toFixed(0) + '%"></span></span>';
/** 공정 탭: 날짜·수정 모드, 전체 요약, 그룹(섹터)별 카드(단계별 진행 막대 + 눌러 펼치는 체크표) — Ph2·Ph4(섹터 × 장비 × 단계)와 경량PJT(품목 × 단계) 같은 화면 */
export function progressHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "공정" 탭을 여세요.</div></div>';
  const S = st.structure; if (!st.ready) return '<div class="jh-pjt"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">공정</span></div><div class="jh-empty">' + esc(st.loadingNote || '불러오는 중...') + '</div></div>';
  const A = calcAll(S, st.states); const zones = S.model === 'zones';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">공정</span></div>';
  const hol = holidayName(st.date); const dateBar = '<div class="jh-pjt__bar"><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-pg-act="prev" aria-label="전날">‹</button><input class="jh-input" type="date" data-pg-date value="' + esc(st.date) + '"><button type="button" class="jh-btn" data-variant="ghost" data-pg-act="next" aria-label="다음날">›</button><button type="button" class="jh-btn" data-variant="secondary" data-pg-act="today">오늘</button></span><span class="jh-pjt__tools">' + (hol ? chip(hol, 'red') : '') + '<button type="button" class="jh-btn" data-variant="' + (st.editMode ? 'primary' : 'secondary') + '" data-pg-act="edit" aria-pressed="' + st.editMode + '">✏️ 수정 모드' + (st.editMode ? ' (켜짐)' : '') + '</button></span></div>';
  const note = !st.isToday ? '<div class="jh-alert" data-tone="warn" role="status">' + esc(st.date) + ' (' + dow(st.date) + ') 기준으로 보는 중입니다 — ' + (st.editMode ? '수정 모드: 이 날짜의 체크를 고칠 수 있습니다(이전 날짜에서 체크된 칸은 그 날짜로 가서 고치세요).' : '읽기 전용입니다. 고치려면 "수정 모드"를 켜세요.') + '</div>' : (st.readonly ? '<div class="jh-field__hint">조회만 할 수 있습니다(팀장 지정이 없는 게스트 계정).</div>' : '');
  const totals = zones ? [['전체 공정율', f1(A.pct) + '%'], ['총 물량', A.items + '대'], ['누적 반입', A.groups.reduce((s, x) => s + ((x.calc.stages.find((y) => y.name === '반입') || {}).done || 0), 0) + '대'], ['누적 설치', A.groups.reduce((s, x) => s + ((x.calc.stages.find((y) => y.name === '설치') || {}).done || 0), 0) + '대']] : [['전체 공정율', f1(A.pct) + '%'], ['총 품목수', A.items], ['평균 진행률', f1(A.avgItemPct) + '%'], ['완료 품목', A.doneItems + ' / ' + A.items]];
  const sum = '<div class="jh-pjt__cells jh-pjt__kpis">' + totals.map(([l, v]) => '<div><span class="jh-field__hint">' + esc(l) + '</span><strong>' + esc(v) + '</strong></div>').join('') + '</div>';
  const body = A.groups.map((x) => groupHtml(st, x)).join('') || '<div class="jh-empty">등록된 품목이 없습니다.</div>';
  const empty = !S.leafCols.length ? '<div class="jh-empty">공정 단계가 설정되지 않았습니다. (설정에서 단계를 정하세요)</div>' : '';
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + dateBar + note + card('공정 현황', '<div class="jh-pjt__pad">' + sum + '</div>') + empty + body + '</div></div>';
}
function groupHtml(st, x) {
  const S = st.structure; const g = x.group, c = x.calc; const open = st.open.has(g.id); const zones = S.model === 'zones'; const state = st.states[g.id] || {};
  const steps = c.stages.map((s) => '<div class="jh-pjt__step"><span class="jh-field__hint">' + esc(s.name) + ' ' + (s.subs ? s.done + '/' + s.total : s.done + '/' + s.total) + '</span>' + bar(s.pct) + '</div>').join('');
  const title = zones ? esc(g.name) + ' <span class="jh-field__hint">(' + g.items.length + '대)</span>' : '품목별 공정 체크 <span class="jh-field__hint">(' + g.items.length + '개)</span>';
  const headBtn = '<button type="button" class="jh-pjt__ghead" data-pg-open="' + esc(g.id) + '" aria-expanded="' + open + '"><span><strong>' + title + '</strong></span><span class="jh-pjt__pill">' + f1(c.pct) + '%</span></button>';
  const table = open ? tableHtml(st, g, c, state) : '';
  return '<section class="jh-card jh-pjt__group">' + headBtn + (zones ? '<div class="jh-pjt__steps">' + steps + '</div>' : '') + table + '</section>';
}
function tableHtml(st, g, c, state) {
  const S = st.structure; const editable = !st.readonly; const cols = S.leafCols;
  const th = cols.map((col) => '<th>' + esc(col) + '</th>').join('');
  const rows = g.items.map((it) => '<tr><td class="jh-pjt__itname"><div>' + esc(it.name) + '</div><div class="jh-field__hint">' + c.itemPct[it.id] + '%</div></td>' + cols.map((col) => { const k = keyOf(it.id, col); const cs = cellState(state, k, st.isToday, st.editMode, S.model); const can = editable && cs.canToggle;
    return '<td><button type="button" class="jh-pjt__ck" data-state="' + (cs.done ? (cs.isNew || S.model === 'items' ? 'new' : 'past') : '') + '"' + (can ? ' data-pg-ck="' + esc(g.id) + '|' + esc(it.id) + '|' + esc(col) + '"' : ' disabled') + ' aria-label="' + esc(it.name + ' ' + col) + (cs.done ? ' 완료' : '') + '">' + (cs.done ? '✓' : '') + '</button></td>'; }).join('') + '</tr>').join('');
  const sumRow = '<tr class="jh-pjt__sumrow"><td>합계</td>' + cols.map((col) => { const n = c.colCount[col] || 0; return '<td data-full="' + (n === g.items.length && n > 0) + '">' + n + '/' + g.items.length + '</td>'; }).join('') + '</tr>';
  return '<div class="jh-pjt__scroll"><table class="jh-pjt__ctable"><thead><tr><th>' + (S.model === 'zones' ? '장비번호' : '품목') + '</th>' + th + '</tr></thead><tbody>' + rows + sumRow + '</tbody></table></div>';
}
