/* 근로시간 > "캡스 업로드" 보기의 HTML(순수 함수). 시험: tests/hr-caps-import.test.mjs. 입력은 index.js 의 근로시간 화면이 data-caps-* 속성으로 연결한다. */
import { esc } from '../../core/ui.js?v=20261031c';
import { capsSummaryText } from './caps-import.js?v=20261031c';
export const capsInit = () => ({ stage: 'pick', fileName: '', parse: null, from: '', to: '', plan: null, err: '', busy: false, saved: null, progress: '' });
const card = (title, body) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3></div>' + body + '</section>';
const chip = (s) => '<span class="jh-chip"' + (s === '변경' ? ' data-tone="warn"' : s === '확인' ? ' data-tone="danger"' : s === '신규' || s === '보충' ? ' data-tone="accent"' : '') + '>' + esc(s === '확인' ? '확인 필요' : s) + '</span>';
const rng = (i, o) => (i || o ? esc(i || '--:--') + '~' + esc(o || '--:--') : '-');
const MAX_ROWS = 300;
/** 미리보기 표 — 반영할 건(신규·변경·보충)을 사람·날짜 순으로 */
function writesTable(plan) {
  const w = plan.writes; if (!w.length) return '<div class="jh-empty">반영할 건이 없습니다. 기간을 바꾸거나 파일을 확인해 주세요.</div>';
  const rows = w.slice(0, MAX_ROWS).map((i) => '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.date) + '</td><td>' + chip(i.status) + (i.cleared ? ' <span class="jh-chip" data-tone="accent">NFC 확인 해제</span>' : '') + '</td><td>' + rng(i.caps.in, i.caps.out.replace('+', '+')) + '</td><td>' + (i.before ? rng(i.before.in, i.before.out) + ' <span class="jh-hr__muted">(' + esc(i.before.hours) + 'h)</span>' : '<span class="jh-hr__muted">기록 없음</span>') + '</td><td><b>' + rng(i.after.in, i.after.out) + '</b> <span class="jh-hr__muted">(' + esc(i.after.hours) + 'h)</span></td></tr>').join('');
  return '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>이름</th><th>날짜</th><th>구분</th><th>캡스</th><th>지금 포털</th><th>반영 후</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (w.length > MAX_ROWS ? '<div class="jh-field__hint jh-hr__pad">처음 ' + MAX_ROWS + '건만 보여 드립니다(전체 ' + w.length + '건이 저장됩니다).</div>' : '');
}
function flagsTable(plan) {
  const f = plan.items.filter((i) => i.status === '확인'); if (!f.length) return '';
  const rows = f.slice(0, MAX_ROWS).map((i) => '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.date) + '</td><td>' + rng(i.caps.in, i.caps.out) + '</td><td>' + esc(i.reason) + '</td></tr>').join('');
  return card('⚠️ 확인 필요 ' + f.length + '건 — 저장하지 않습니다', '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>이름</th><th>날짜</th><th>캡스</th><th>이유</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="jh-field__hint jh-hr__pad">이 날들은 근로자별 달력에서 직접 입력하면 됩니다.</div>');
}
/** 전체 패널 — c 는 capsInit() 모양의 상태 */
export function capsPanelHtml(c) {
  const s = c || capsInit();
  const intro = card('📥 캡스 근태 파일 올리기', '<div class="jh-hr__pad"><div class="jh-field__hint">사무실 캡스 PC 의 ADT캡스 액세스가드(ACServer) <b>근태조회 → 엑셀(xls) 내보내기</b>로 받은 파일(올해 전체 한 파일)을 올립니다. <b>캡스 값이 우선</b>이고, 출근·퇴근 중 한쪽만 찍힌 날은 포털에 이미 있는 기록으로 채웁니다(포털에도 없으면 확인 필요). 직원은 이름으로 찾습니다. 저장하기 전에 아래 미리보기로 확인합니다.</div><div class="jh-field"><label class="jh-field__label" for="caps-file">캡스 근태 파일</label><input id="caps-file" class="jh-input" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-caps-file' + (s.busy ? ' disabled' : '') + '>' + (s.fileName ? '<div class="jh-field__hint">선택한 파일: ' + esc(s.fileName) + '</div>' : '') + '</div>' + (s.busy ? '<div class="jh-field__hint" role="status">' + esc(s.progress || '읽는 중…') + '</div>' : '') + '</div>');
  const err = s.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(s.err) + '</div>' : '';
  if (s.stage === 'done') return err + intro + '<div class="jh-alert" data-tone="accent" role="status">✅ ' + esc(s.saved.n) + '건을 근로 내역에 반영했습니다. 근로자별 달력에서 확인하실 수 있습니다.</div><div class="jh-hr__bar"><button type="button" class="jh-btn" data-ac-mode="cal">📅 근로자별 달력 보기</button><button type="button" class="jh-btn" data-variant="secondary" data-caps="reset">다른 파일 올리기</button></div>';
  if (!s.parse || !s.plan) return err + intro;
  const st = s.parse.stats, p = s.plan, c2 = p.counts;
  const info = '<div class="jh-hr__pad"><div class="jh-field__hint">파일 안: <b>' + esc(st.records) + '일</b> 기록 · 이름 ' + esc(st.names) + '명' + (st.mergedIds ? ' · 같은 이름의 캡스 ID ' + esc(st.mergedIds) + '건 병합' : '') + ' · ' + esc(st.from) + ' ~ ' + esc(st.to) + (s.parse.problems.length ? ' · <span data-tone="warn">읽지 못한 줄 ' + esc(s.parse.problems.length) + '개</span>' : '') + '</div></div>';
  const range = card('🗓 반영할 기간', '<div class="jh-hr__pad"><div class="jh-hr__grid"><div class="jh-field"><label class="jh-field__label" for="caps-from">시작일</label><input id="caps-from" class="jh-input" type="date" value="' + esc(s.from) + '" data-caps-from></div><div class="jh-field"><label class="jh-field__label" for="caps-to">종료일</label><input id="caps-to" class="jh-input" type="date" value="' + esc(s.to) + '" data-caps-to></div></div><div class="jh-field__hint">기본값은 포털에 근태 기록이 있는 첫 달부터입니다. 그 이전은 포털에 넣지 않습니다. 기간 밖 ' + esc(p.skipped.기간밖) + '일은 제외됩니다.</div></div>');
  const warn = (p.unmatched.length || p.duplicated.length || Object.keys(p.skipped.미매칭).length || Object.keys(p.skipped.동명이인).length) ? '<div class="jh-alert" data-tone="warn" role="status">' + (p.unmatched.length ? '포털에서 이름을 찾지 못한 사람: <b>' + p.unmatched.map(esc).join(', ') + '</b> — 반영하지 않습니다. ' : '') + (p.duplicated.length ? '포털에 같은 이름이 둘 이상인 사람: <b>' + p.duplicated.map(esc).join(', ') + '</b> — 반영하지 않습니다.' : '') + '</div>' : '';
  const kpi = '<div class="jh-kpi-grid"><div class="jh-kpi"><div class="jh-kpi__label">신규</div><div class="jh-kpi__value">' + esc(c2.신규) + '</div></div><div class="jh-kpi"><div class="jh-kpi__label">변경</div><div class="jh-kpi__value">' + esc(c2.변경) + '</div></div><div class="jh-kpi"><div class="jh-kpi__label">보충</div><div class="jh-kpi__value">' + esc(c2.보충) + '</div></div><div class="jh-kpi"><div class="jh-kpi__label">같은 값(저장 안 함)</div><div class="jh-kpi__value">' + esc(c2.동일) + '</div></div><div class="jh-kpi"><div class="jh-kpi__label">확인 필요</div><div class="jh-kpi__value">' + esc(c2.확인) + '</div></div></div>';
  const bar = '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-caps="save"' + (s.busy || !p.writes.length ? ' disabled' : '') + '>' + esc(p.writes.length) + '건 반영하기</button><button type="button" class="jh-btn" data-variant="secondary" data-caps="reset"' + (s.busy ? ' disabled' : '') + '>다른 파일 선택</button><span class="jh-field__hint">' + esc(capsSummaryText(p)) + '</span></div>';
  return err + intro + card('📊 파일 읽은 결과', info) + range + warn + card('🔎 미리보기 — 저장 전', kpi + writesTable(p)) + flagsTable(p) + bar;
}
