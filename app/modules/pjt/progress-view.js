import { esc } from '../../core/ui.js?v=20261031d';
import { calcAll, cellState, keyOf } from './progress.js?v=20261031d';
import { holidayName } from '../../shared/holidays.js?v=20261031d';
import { structureEditorHtml } from './structure-view.js?v=20261031d';
import { layoutEditorHtml } from './layout-view.js?v=20261031d';
import { snapToTuesday, weekNo, weekRange } from './layout.js?v=20261031d';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const chip = (t, tone) => '<span class="jh-pjt__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const dow = (d) => '일월화수목금토'[new Date(d + 'T12:00:00Z').getUTCDay()];
const bar = (pct) => '<span class="jh-pjt__bar2"><span style="width:' + Math.max(0, Math.min(100, pct)).toFixed(0) + '%"></span></span>';
/** 공정 탭: 날짜·수정 모드, 전체 요약, 그룹(섹터)별 카드(단계별 진행 막대 + 눌러 펼치는 체크표) — Ph2·Ph4(섹터 × 장비 × 단계)와 경량PJT(품목 × 단계) 같은 화면 */
export function progressHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "공정" 탭을 여세요.</div></div>';
  if (st.editor) return structureEditorHtml(st);
  if (st.layoutEd) return layoutEditorHtml(st);
  const S = st.structure; if (!st.ready) return '<div class="jh-pjt"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">공정</span></div><div class="jh-empty">' + esc(st.loadingNote || '불러오는 중...') + '</div></div>';
  const A = calcAll(S, st.states); const unit = S.unit || '대';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">공정</span></div>';
  const hol = holidayName(st.date); const dateBar = '<div class="jh-pjt__bar"><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-pg-act="prev" aria-label="전날">‹</button><input class="jh-input" type="date" data-pg-date value="' + esc(st.date) + '"><button type="button" class="jh-btn" data-variant="ghost" data-pg-act="next" aria-label="다음날">›</button><button type="button" class="jh-btn" data-variant="secondary" data-pg-act="today">오늘</button></span><span class="jh-pjt__tools">' + (hol ? chip(hol, 'red') : '') + '<button type="button" class="jh-btn" data-variant="' + (st.editMode ? 'primary' : 'secondary') + '" data-pg-act="edit" aria-pressed="' + st.editMode + '">✏️ 수정 모드' + (st.editMode ? ' (켜짐)' : '') + '</button>' + '<button type="button" class="jh-btn" data-variant="secondary" data-pg-act="ppt">📊 공정표 PPT</button>' + ((st.features || {}).weeklyReportPpt ? '<button type="button" class="jh-btn" data-variant="' + (st.weekly ? 'primary' : 'secondary') + '" data-pg-act="weekly">🗓️ 주간 공정회의 PPT</button>' : '') + (st.canEditStructure && (st.features || {}).layoutMap ? '<button type="button" class="jh-btn" data-variant="secondary" data-pg-act="layout">🗺️ 장비 배치도</button>' : '') + (st.canEditStructure ? '<button type="button" class="jh-btn" data-variant="secondary" data-pg-act="structure">⚙️ 구조 설정</button>' : '') + '</span></div>';
  const note = !st.isToday ? '<div class="jh-alert" data-tone="warn" role="status">' + esc(st.date) + ' (' + dow(st.date) + ') 기준으로 보는 중입니다 — ' + (st.editMode ? '수정 모드: 이 날짜의 체크를 고칠 수 있습니다(이전 날짜에서 체크된 칸은 그 날짜로 가서 고치세요).' : '읽기 전용입니다. 고치려면 "수정 모드"를 켜세요.') + '</div>' : (st.readonly ? '<div class="jh-field__hint">조회만 할 수 있습니다(팀장 지정이 없는 게스트 계정).</div>' : '');
  const weeklyPanel = st.weekly ? (() => { const tue = snapToTuesday(st.weekly.date), wr = weekRange(tue); return '<div class="jh-card"><div class="jh-pjt__pad"><div class="jh-pjt__bar"><span class="jh-plan__line"><input class="jh-input" type="date" data-pg-wdate value="' + esc(st.weekly.date) + '"><strong>' + weekNo(tue) + '주차 · ' + esc(wr.from.replace(/-/g, '. ')) + ' ~ ' + esc(wr.to.replace(/-/g, '. ')) + ' 기준</strong></span><button type="button" class="jh-btn" data-variant="primary" data-pg-act="weekly-make">PPT 만들기 · 다운로드</button></div><div class="jh-field__hint">회의는 화요일 기준이고 한 주는 수요일~화요일입니다. 고른 날짜가 속한 주의 화요일과 그 전주 화요일의 누적을 비교해, 섹터마다 도면과 장비 박스 색(도달 단계)·주간 표를 한 장씩 만듭니다.</div></div></div>'; })() : '';
  // 요약: 모든 프로젝트 같은 칸 — 전체 공정율, 총 물량, 단계마다 누적 완료 수
  const stageTotals = S.stages.map((s) => [s.name + ' 누적', A.groups.reduce((n, x) => n + ((x.calc.stages.find((y) => y.name === s.name) || {}).done || 0), 0) + unit]);
  const sum = '<div class="jh-pjt__cells jh-pjt__kpis">' + [['전체 공정율', f1(A.pct) + '%'], ['총 물량', A.items + unit]].concat(stageTotals).map(([l, x]) => '<div><span class="jh-field__hint">' + esc(l) + '</span><strong>' + esc(x) + '</strong></div>').join('') + '</div>';
  // 넓은 화면: 왼쪽에 섹터 카드(요약·단계 막대) 목록, 오른쪽에 고른 섹터의 체크표(여백 없이 균형). 좁은 화면(폰): 카드 안에 표가 펼쳐짐
  const wide = st.wide !== false; const selId = [...st.open][0] || ''; const selX = A.groups.find((x) => x.group.id === selId) || null;   // 섹션을 닫으면 선택 없음(오른쪽 체크표도 숨김). 처음 열릴 섹션은 index.js 의 openDefault 가 정한다
  const cards = A.groups.map((x) => groupHtml(st, x, x.group.id === selId, wide)).join('') || '<div class="jh-empty">등록된 품목이 없습니다.</div>';
  const empty = !S.leafCols.length ? '<div class="jh-empty">공정 단계가 설정되지 않았습니다. (구조 설정에서 단계를 정하세요)</div>' : '';
  const pane = wide && selX ? '<div class="jh-pjt__pane">' + card((selX.group.name || '전체') + ' 체크표', '<div class="jh-pjt__panebody">' + tableHtml(st, selX.group, selX.calc, st.states[selX.group.id] || {}) + '</div>') + '</div>' : '';
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + dateBar + note + weeklyPanel + card('공정 현황', '<div class="jh-pjt__pad">' + sum + '</div>') + empty + '<div class="jh-pjt__split jh-pjt__splitprog' + (pane ? '' : ' jh-pjt__splitclosed') + '"><div class="jh-pjt__cards">' + cards + '</div>' + pane + '</div></div></div>';
}
function groupHtml(st, x, selected, wide) {
  const S = st.structure; const g = x.group, c = x.calc; const unit = S.unit || '대';
  const steps = c.stages.map((s) => '<div class="jh-pjt__step"><span class="jh-field__hint">' + esc(s.name) + ' ' + s.done + '/' + s.total + '</span>' + bar(s.pct) + '</div>').join('');
  const title = esc(g.name || '전체') + ' <span class="jh-field__hint">(' + g.items.length + unit + ')</span>';
  const headBtn = '<button type="button" class="jh-pjt__ghead" data-pg-open="' + esc(g.id) + '" aria-expanded="' + selected + '"><span><strong>' + title + '</strong></span><span class="jh-pjt__pill">' + f1(c.pct) + '%</span></button>';
  const table = !wide && selected ? tableHtml(st, g, c, st.states[g.id] || {}) : '';
  return '<section class="jh-card jh-pjt__group" data-sel="' + selected + '">' + headBtn + '<div class="jh-pjt__steps">' + steps + '</div>' + table + '</section>';
}
function tableHtml(st, g, c, state) {
  const S = st.structure; const editable = !st.readonly; const cols = S.leafCols;
  const th = cols.map((col) => '<th>' + esc(col) + '</th>').join('');
  const rows = g.items.map((it) => '<tr><td class="jh-pjt__itname"><div>' + esc(it.name) + '</div><div class="jh-field__hint">' + c.itemPct[it.id] + '%</div></td>' + cols.map((col) => { const k = keyOf(it.id, col); const cs = cellState(state, k, st.isToday, st.editMode); const can = editable && cs.canToggle;
    return '<td><button type="button" class="jh-pjt__ck" data-state="' + (cs.done ? (cs.isNew ? 'new' : 'past') : '') + '"' + (can ? ' data-pg-ck="' + esc(g.id) + '|' + esc(it.id) + '|' + esc(col) + '"' : ' disabled') + ' aria-label="' + esc(it.name + ' ' + col) + (cs.done ? ' 완료' : '') + '">' + (cs.done ? '✓' : '') + '</button></td>'; }).join('') + '</tr>').join('');
  const sumRow = '<tr class="jh-pjt__sumrow"><td>합계</td>' + cols.map((col) => { const n = c.colCount[col] || 0; return '<td data-full="' + (n === g.items.length && n > 0) + '">' + n + '/' + g.items.length + '</td>'; }).join('') + '</tr>';
  return '<div class="jh-pjt__scroll"><table class="jh-pjt__ctable"><thead><tr><th>장비/품목</th>' + th + '</tr></thead><tbody>' + rows + sumRow + '</tbody></table></div>';
}
