import { esc } from '../../core/ui.js?v=20261031c';
import { docFileName } from '../../shared/doc-filename.js?v=20261031c';
import { hasMoney, hasPersonal } from '../../shared/pjt-log.js?v=20261031c';
import { ckRowsFrom, ckCheck, ckDirty, CK_MAX } from './closeout.js?v=20261031c';
/* PJT 월간 보고서 탭 화면(문자열) — 설계 docs/monthly-report-design.md r1. 현장 층(금액 없음). 계산은 서버(monthlyReportAct)가 했고, 이 파일은 **받은 결과를 그리기만** 한다.
 * st = { proj, label, loading, error, months:[{ym,version,partial,yieldStatus,…}], ym, report|null, canEdit, busy, msg, notesDraft:{remarks,nextPlan}, today } */
const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const fmt = (v, d) => { const x = n(v); const k = Math.pow(10, d || 0); return (Math.round(x * k) / k).toLocaleString('ko-KR'); };
const pct = (v) => (Math.round(n(v) * 1000) / 10).toLocaleString('ko-KR') + '%';
const signed = (v) => (n(v) > 0 ? '+' : '') + fmt(v);
/** "2026-08-03" → "08. 03" — 값이 없거나 형식이 달라도 오류 없이(빈 글자) */
const md = (d) => String(d == null ? '' : d).slice(5).replace('-', '. ');
export const monthLabel = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); return m ? m[1] + '년 ' + Number(m[2]) + '월' : ''; };
/** 선택할 수 있는 월: 이번 달부터 최근 12개월(KST) + 이미 만든 달 — 최신순, 중복 없음 */
export function monthOptions(todayYmd, made) {
  const m = /^(\d{4})-(\d{2})/.exec(String(todayYmd || '')); const out = [];
  if (m) { let y = Number(m[1]), mo = Number(m[2]); for (let i = 0; i < 12; i++) { out.push(y + '-' + String(mo).padStart(2, '0')); mo--; if (mo === 0) { mo = 12; y--; } } }
  (made || []).forEach((x) => { if (x && x.ym && out.indexOf(x.ym) === -1) out.push(x.ym); });
  return out.sort().reverse();
}
/** 수율 칸 — 설계 §3-1·§4: 숫자가 말이 안 되는 경우(공정 체크 없음·공수 없음·마감 단계·구조 없음)는 숫자 대신 사유, 분자·분모는 항상 같이 */
export function yieldView(y) {
  const Y = y || {}; const parts = '설치 완료 ' + signed(Y.installed) + ' ÷ 공수 ' + fmt(Y.manday, 1);
  switch (Y.status) {
    case 'ok': return { tone: 'ok', main: '공수 100당 ' + fmt(Y.per100, 1) + '품목', sub: parts };
    case 'no-check': return { tone: 'warn', main: '공정 체크 없음', sub: '입력 누락 가능 · 공수 ' + fmt(Y.manday, 1) };
    case 'no-manday': return { tone: 'warn', main: '공수 입력 없음', sub: '설치 완료 ' + signed(Y.installed) };
    case 'finishing': return { tone: 'info', main: '마감 단계', sub: '설치 완료율 ' + pct(Y.installRate) + ' — 설치 수율 대신 아래 "마감 완성도"로 본다' };
    default: return { tone: 'warn', main: '공정 구조 없음', sub: '이 프로젝트에는 공정 구조가 없어 수율을 낼 수 없습니다' };
  }
}
const CAT_ICON = { '발주처 요청·지시': '📨', '일정 변경': '📅', '범위·수량 변경': '📐', '현장 이슈': '⚠️', '회의 결정': '🗣️' };
/** 이력 요약(설계 §2-1 5번) — 서버가 이력 로그에서 계산한 결과. 옛 보고서에는 없다 */
export function logSummaryHtml(L) {
  if (!L) return '<div class="jh-empty">이 보고서는 이력 요약이 생기기 전에 만들어졌습니다. "다시 만들기"를 누르면 포함됩니다.</div>';
  const cats = Object.keys(L.byCategory || {}).filter((k) => n(L.byCategory[k]) > 0).map((k) => '<span class="jh-badge">' + (CAT_ICON[k] || '•') + ' ' + esc(k) + ' ' + fmt(L.byCategory[k]) + '</span>').join(' ');
  const st = L.byStatus || {}; const list = (items, fn) => (items && items.length ? '<ul class="jh-pjt__mrlist">' + items.map(fn).join('') + '</ul>' : '');
  const due = (x) => '<li><span class="jh-field__hint">' + esc(md(x.dueDate)) + (x.daysOver ? ' · ' + esc(x.daysOver) + '일 지남' : '') + (x.claimedByName ? ' · 👤 ' + esc(x.claimedByName) : ' · 맡은 사람 없음') + '</span> ' + esc(x.title) + '</li>';
  const more = (o) => (o && o.total > (o.items || []).length ? '<div class="jh-field__hint">외 ' + fmt(o.total - o.items.length) + '건은 이력 탭에서 볼 수 있습니다.</div>' : '');
  const ch = L.changes || {}, ov = L.overdue || {}, nx = L.dueNext || {};
  return '<div class="jh-pjt__mrgrid">' + tile('이번 달 기록된 이력', fmt(L.total) + '건', '직접 입력 ' + fmt(L.manual) + ' · 자동 기록(일정) ' + fmt(L.auto), '')
    + tile('처리 상태', '처리 중 ' + fmt(st.open), '완료 ' + fmt(st.done) + ' · 종결 ' + fmt(st.closed) + ' · 보류 ' + fmt(st.hold), n(st.open) > 0 ? 'warn' : 'ok')
    + tile('변경사항', fmt(ch.total) + '건', '영향 확인 전 ' + fmt(ch.unchecked) + '건', n(ch.unchecked) > 0 ? 'warn' : '') + '</div>'
    + (cats ? '<div>' + cats + '</div>' : '<div class="jh-empty">이번 달에 기록된 이력이 없습니다.</div>')
    + (ch.items && ch.items.length ? '<h4 class="jh-pjt__mrh">변경사항 (영향 확인 전이 위)</h4>' + list(ch.items, (x) => '<li><span class="jh-field__hint">' + esc(md(x.date)) + (x.impactChecked ? ' · 영향 확인됨' : ' · 영향 확인 전') + '</span> ' + esc(x.title) + '</li>') + more(ch) : '')
    + (ov.items && ov.items.length ? '<h4 class="jh-pjt__mrh">기한이 지났는데 처리 중인 요청 (' + fmt(ov.total) + '건)</h4>' + list(ov.items, due) + more(ov) : '')
    + (nx.items && nx.items.length ? '<h4 class="jh-pjt__mrh">다음 달에 기한이 오는 요청 (' + fmt(nx.total) + '건)</h4>' + list(nx.items, due) + more(nx) : '')
    + '<div class="jh-field__hint">보고서를 만든 날(' + esc(L.asOf || '') + ')의 처리 상태입니다. 후보 항목과 대외비 항목은 포함하지 않습니다.</div>';
}
const tile = (label, main, sub, tone) => '<div class="jh-pjt__mrtile"' + (tone ? ' data-tone="' + esc(tone) + '"' : '') + '><div class="jh-field__hint">' + esc(label) + '</div><div class="jh-pjt__mrnum">' + esc(main) + '</div>' + (sub ? '<div class="jh-field__hint">' + esc(sub) + '</div>' : '') + '</div>';
const card = (title, body, note) => '<section class="jh-card"><div class="jh-panel__head"><h3 class="jh-pjt__dayh">' + esc(title) + '</h3></div><div class="jh-pjt__pad">' + (note ? '<div class="jh-field__hint">' + esc(note) + '</div>' : '') + body + '</div></section>';
/** 마감 완성도(시공검측 이후 프로젝트 완성도, 설계 §3-4) — 서버가 그 달 말 기준으로 계산한 report.data.closeout 을 그린다. 항목 이름은 프로젝트가 정한 것. 옛 보고서에는 없다 */
export function closeoutHtml(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return '<div class="jh-empty">이 보고서는 마감 체크리스트가 생기기 전에 만들어졌습니다. "다시 만들기"를 누르면 포함됩니다.</div>';
  const items = (Array.isArray(c.items) ? c.items : []).filter((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.name === 'string' && x.name.trim()); const total = Number.isInteger(c.total) && c.total > 0 ? c.total : 0;
  if (!total || !items.length) return '<div class="jh-empty">이 프로젝트에는 마감 체크리스트가 없습니다(PJT 권한자·관리자가 월간 보고서 탭에서 항목을 만듭니다).</div>';
  const done = n(c.done), rate = typeof c.rate === 'number' && isFinite(c.rate) ? pct(c.rate) : '—'; const li = items.map((x) => { const d = x.done === true; return '<li data-done="' + (d ? 'true' : 'false') + '">' + (d ? '✓ ' : '☐ ') + '<strong>' + esc(x.name) + '</strong> <span class="jh-field__hint">' + (d ? '완료' + (x.doneDate ? ' ' + esc(md(x.doneDate)) : '') : '미완료') + (x.assignee ? ' · ' + esc(x.assignee) : '') + '</span>' + (x.memo ? ' <span class="jh-field__hint">— ' + esc(x.memo) + '</span>' : '') + '</li>'; }).join('');
  return '<div class="jh-pjt__mrgrid">' + tile('마감 완성도', fmt(done) + ' / ' + fmt(total) + '항목', rate + ' (완료 ÷ 전체, 그 달 말 기준)', '') + tile('이번 달 완료', signed(c.doneThisMonth) + '항목', '그 달에 완료일이 있는 항목', n(c.doneThisMonth) > 0 ? 'ok' : '') + '</div><ul class="jh-pjt__mrlist jh-pjt__cklist">' + li + '</ul>';
}
/** 보고서 본문(현장 층) — 서버가 돌려준 report.data 를 그린다 */
export function reportBodyHtml(rep) {
  const d = rep.data || {}, p = d.progress, m = d.manday, r = d.reports, yv = yieldView(d.yield);
  const prog = p ? '<div class="jh-pjt__mrgrid">'
    + tile('설치 완료 (누적)', fmt(p.end.installed) + ' / ' + fmt(p.end.total) + '품목', pct(p.end.installRate), '')
    + tile('이번 달 새로 설치 완료', signed(p.delta.installed) + '품목', '시공검측 직전까지 모든 설치 단계가 끝난 품목', p.delta.installed > 0 ? 'ok' : '')
    + tile('시공검측 통과 (누적)', fmt(p.end.inspected) + '품목', '이번 달 ' + signed(p.delta.inspected) + ' · 통과율 ' + pct(p.end.inspectRate) + '(통과 ÷ 설치 완료)', '')
    + tile('참고: 반입 · 입고검사', '이번 달 ' + signed((p.delta.byStage || {})['반입']) + ' · ' + signed((p.delta.byStage || {})['입고검사']), '누적 ' + fmt((p.end.byStage || {})['반입']) + ' · ' + fmt((p.end.byStage || {})['입고검사']) + '품목', '') + '</div>'
    + '<div class="jh-field__hint">공정을 체크한 날 ' + fmt(p.checkDays) + '일 · 이번 달 새로 체크된 칸 ' + signed(p.delta.cells) + '</div>'
    : '<div class="jh-empty">이 프로젝트에는 공정 구조가 없어 공정을 집계하지 않았습니다.</div>';
  const mand = m ? '<div class="jh-pjt__mrgrid">' + tile('투입 공수 합', fmt(m.manday, 1), '공수 입력 ' + fmt(m.mandayDays) + '일 · 인원 ' + fmt(m.workers) + '명', '') + tile('출역', fmt(m.attendDays) + '일', '일평균 ' + fmt(m.avgHeads, 1) + '명', '') + '</div>' : '';
  const rem = (r && r.remarks || []).map((x) => '<li><span class="jh-field__hint">' + esc(md(x.date)) + (x.author ? ' · ' + esc(x.author) : '') + '</span> ' + esc(x.text) + '</li>').join('');
  const rpt = r ? '<div class="jh-pjt__mrgrid">' + tile('공사일보 작성', fmt(r.written) + '일 / ' + fmt(r.span) + '일', '세는 기간 ' + (r.from ? md(r.from).replace('. ', '/') : '') + ' ~ ' + (r.to ? md(r.to).replace('. ', '/') : ''), '')
    + tile('미작성 (달력 전체)', fmt(r.missing) + '일', '휴무·주말·공휴일 포함 · 출역이 있는데 미작성 ' + fmt(r.attendMissing) + '일', r.missing > 0 ? 'warn' : 'ok') + '</div>'
    + '<h4 class="jh-pjt__mrh">특이사항 (공사일보 비고)</h4>' + (rem ? '<ul class="jh-pjt__mrlist">' + rem + '</ul>' : '<div class="jh-empty">비고가 적힌 날이 없습니다.</div>') : '';
  const next = '<h4 class="jh-pjt__mrh">다음 달 계획 (초안)</h4>' + ((r && r.nextPlan && r.nextPlan.text) ? '<div class="jh-pjt__mrtext">' + esc(r.nextPlan.text) + '</div><div class="jh-field__hint">' + esc(md(r.nextPlan.from)) + ' 공사일보의 "내일 작업"</div>' : '<div class="jh-empty">공사일보에 "내일 작업"이 적힌 날이 없습니다.</div>');
  return card('공정', prog, '공정 체크 데이터 기준(날짜마다 새로 체크한 칸의 합이 아니라 월말 상태 − 전월 말 상태)')
    + card('마감 완성도', closeoutHtml(d.closeout), '시공검측 이후 프로젝트가 정한 마감 단계의 완료 현황입니다(항목 이름은 프로젝트마다 다릅니다).')
  + card('출역 · 공수', mand)
    + card('생산성 수율', '<div class="jh-pjt__mrgrid">' + tile('이번 달 설치 완료 ÷ 투입 공수', yv.main, yv.sub, yv.tone) + '</div>', '수율은 분자·분모를 항상 같이 봅니다. 공정 체크가 없는 달은 숫자를 내지 않습니다(입력 누락 가능).')
    + card('공사일보 · 특이사항 · 다음 달 계획', rpt + next)
    + card('이력 요약 (변경 · 결정 · 요청)', logSummaryHtml(d.log), '프로젝트 "이력" 탭에 기록된 내용을 모은 것입니다.');
}
/** 직접 입력 칸(특이사항 보완·다음 달 계획) — PJT 권한자·관리자만 고치고 나머지는 읽기만 */
function notesHtml(st) {
  const rep = st.report, nt = rep.notes || {}, dr = st.notesDraft || { remarks: nt.remarks || '', nextPlan: nt.nextPlan || '' };
  const warn = (hasMoney(dr.remarks) || hasPersonal(dr.remarks) || hasMoney(dr.nextPlan) || hasPersonal(dr.nextPlan)) ? '금액·단가·전화번호·메일 주소는 적지 않습니다.' : '';
  if (!st.canEdit) return card('직접 입력 (보완)', ((nt.remarks || nt.nextPlan) ? '<div class="jh-pjt__mrtext">' + esc(nt.remarks) + '</div><div class="jh-pjt__mrtext">' + esc(nt.nextPlan) + '</div>' : '<div class="jh-empty">직접 입력한 내용이 없습니다.</div>'), 'PJT 권한자·관리자가 적을 수 있습니다.');
  return card('직접 입력 (보완)', '<div class="jh-field"><label class="jh-field__label" for="mr-remarks">특이사항 보완</label><textarea id="mr-remarks" class="jh-input" rows="3" maxlength="2000" data-mr-notes="remarks">' + esc(dr.remarks) + '</textarea></div>'
    + '<div class="jh-field"><label class="jh-field__label" for="mr-next">다음 달 계획</label><textarea id="mr-next" class="jh-input" rows="3" maxlength="2000" data-mr-notes="nextPlan">' + esc(dr.nextPlan) + '</textarea>'
    + '<div class="jh-field__error" role="alert" data-mr-hint' + (warn ? '' : ' hidden') + '>' + esc(warn) + '</div></div>'
    + '<div class="jh-pjt__inbar"><button type="button" class="jh-btn" data-variant="primary" data-mr-save' + (warn || st.busy ? ' disabled' : '') + '>저장</button><span class="jh-field__hint">자동으로 채운 내용은 초안입니다. 다시 만들어도 여기에 적은 내용은 그대로 남습니다.</span></div>', '');
}
/* 폰 폭에서 .jh-actionbar 는 화면 아래에 고정되고(전자결재 디자인 — 한 화면에 하나) 같은 자리에 겹치면 아래 것이 위 것을 덮는다. 이 탭에서는 월 선택·만들기 막대(mrbar)만 고정 막대로 두고, 카드 안의 저장 줄은 jh-pjt__inbar(일반 줄)로 둔다 — 실제 Edge 폰 폭에서 세 막대가 겹쳐 월 선택·만들기가 가려지는 것을 확인해 고침 */
/** 마감 체크리스트 편집 카드 — PJT 권한자·관리자만(서버가 다시 막는다). 항목 이름은 프로젝트가 정한다(코드에 단계 이름 없음). 입력 중 안내는 마운트가 서버 호출 없이 갱신한다(입력칸은 다시 그리지 않음) */
function closeoutEditHtml(st) {
  const ck = st.ck; if (!st.canEdit || !ck || typeof ck !== 'object' || Array.isArray(ck)) return '';
  if (ck.state === 'loading') return card('마감 체크리스트', '<div class="jh-field__hint" aria-busy="true">체크리스트를 불러오는 중입니다…</div>');
  if (ck.state === 'error') return card('마감 체크리스트', '<div class="jh-alert" data-tone="danger" role="alert">' + esc(typeof ck.error === 'string' && ck.error ? ck.error : '체크리스트를 불러오지 못했습니다.') + '</div>');
  if (ck.state !== 'ok') return '';
  const rows = Array.isArray(st.ckRows) ? ckRowsFrom(st.ckRows) : ckRowsFrom(ck.items); const today = typeof st.today === 'string' ? st.today : ''; const err = ckCheck(rows, today); const dirty = st.ckRows != null && ckDirty(st.ckRows, ck.items);
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z')) ? v : ''); const dis = (b) => (b ? ' disabled' : '');
  const meta = ck.version ? '<span class="jh-field__hint">저장된 버전 ' + esc(ck.version) + (ck.updatedByName ? ' · ' + esc(ck.updatedByName) : '') + '</span>' : '';
  if (!rows.length) return card('마감 체크리스트', '<div class="jh-field"><label class="jh-field__label" for="ck-names">항목 이름 — 한 줄에 하나씩 적습니다(프로젝트마다 정합니다)</label><textarea id="ck-names" class="jh-input" rows="5" maxlength="1500" data-ck-names></textarea></div><div class="jh-pjt__inbar"><button type="button" class="jh-btn" data-variant="primary" data-ck-seed' + dis(st.busy) + '>항목 만들기</button><span class="jh-field__hint">만든 뒤 완료일·담당·메모를 적고 순서를 바꿀 수 있습니다.</span></div>');
  const row = (r, i) => '<div class="jh-pjt__ckrow" data-ck-row="' + i + '"><div class="jh-field"><label class="jh-field__label" for="ck-n' + i + '">항목 ' + (i + 1) + '</label><input id="ck-n' + i + '" class="jh-input" type="text" maxlength="40" data-ck-f="name" data-ck-i="' + i + '" value="' + esc(r.name) + '"></div>'
    + '<div class="jh-field"><label class="jh-field__label" for="ck-d' + i + '">완료일</label><input id="ck-d' + i + '" class="jh-input" type="date" max="' + esc(today) + '" data-ck-f="doneDate" data-ck-i="' + i + '" value="' + esc(day(r.doneDate)) + '"></div>'
    + '<div class="jh-field"><label class="jh-field__label" for="ck-a' + i + '">담당</label><input id="ck-a' + i + '" class="jh-input" type="text" maxlength="20" data-ck-f="assignee" data-ck-i="' + i + '" value="' + esc(r.assignee) + '"></div>'
    + '<div class="jh-field"><label class="jh-field__label" for="ck-m' + i + '">메모</label><input id="ck-m' + i + '" class="jh-input" type="text" maxlength="200" data-ck-f="memo" data-ck-i="' + i + '" value="' + esc(r.memo) + '"></div>'
    + '<div class="jh-pjt__ckbtns"><button type="button" class="jh-btn" data-variant="ghost" data-ck-up="' + i + '" aria-label="항목 ' + (i + 1) + ' 위로"' + dis(i === 0 || st.busy) + '>↑</button><button type="button" class="jh-btn" data-variant="ghost" data-ck-down="' + i + '" aria-label="항목 ' + (i + 1) + ' 아래로"' + dis(i === rows.length - 1 || st.busy) + '>↓</button><button type="button" class="jh-btn" data-variant="ghost" data-ck-today="' + i + '"' + dis(st.busy) + '>오늘</button><button type="button" class="jh-btn" data-variant="ghost" data-ck-del="' + i + '"' + dis(st.busy) + '>삭제</button></div></div>';
  return card('마감 체크리스트', rows.map(row).join('') + '<div class="jh-field__error" role="alert" data-ck-hint' + (err ? '' : ' hidden') + '>' + esc(err) + '</div>'
    + '<div class="jh-pjt__inbar"><button type="button" class="jh-btn" data-variant="ghost" data-ck-add' + dis(rows.length >= CK_MAX || st.busy) + '>항목 추가</button><button type="button" class="jh-btn" data-variant="primary" data-ck-save' + dis(!dirty || !!err || st.busy) + '>저장</button>' + meta + '</div>'
    + '<div class="jh-field__hint">저장해도 이미 만든 보고서는 바뀌지 않습니다. 보고서에 반영하려면 "다시 만들기"를 누르세요(그 달 말 기준으로 담깁니다).</div>');
}
/** 탭 전체 */
export function monthlyHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "월간 보고서" 탭을 여세요(참여자로 지정된 프로젝트만 열립니다).</div></div>';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label || '') + '</span><span class="jh-field__hint">월간 보고서</span></div>';
  if (st.error && !st.months) return '<div class="jh-pjt">' + head + '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.error) + '</div></div>';
  if (st.loading && !st.months) return '<div class="jh-pjt" aria-busy="true">' + head + '<div class="jh-skeleton" style="height:var(--u-220)"></div></div>';
  const made = st.months || [], opts = monthOptions(st.today, made), cur = made.find((x) => x.ym === st.ym), rep = st.report;
  const sel = '<select class="jh-select" data-mr-ym aria-label="월 선택">' + opts.map((ym) => { const mm = made.find((x) => x.ym === ym); return '<option value="' + esc(ym) + '"' + (ym === st.ym ? ' selected' : '') + '>' + esc(monthLabel(ym)) + (mm ? ' ✓' + (mm.partial ? ' (중간)' : '') : '') + '</option>'; }).join('') + '</select>';
  const gen = '<button type="button" class="jh-btn" data-variant="' + (rep ? 'secondary' : 'primary') + '" data-mr-gen' + (st.busy ? ' disabled' : '') + '>' + (rep ? '다시 만들기' : '만들기') + '</button>';
  const prn = rep ? '<button type="button" class="jh-btn" data-variant="ghost" data-mr-print>PDF 저장(인쇄)</button>' : '';
  const info = rep ? '<span class="jh-field__hint">' + (rep.partial ? '중간 보고서(오늘까지) · ' : '') + '버전 ' + esc(rep.version) + (rep.generatedByName ? ' · ' + esc(rep.generatedByName) : '') + '</span>' : (cur ? '' : '<span class="jh-field__hint">아직 만들지 않은 달입니다.</span>');
  const bar = '<div class="jh-actionbar jh-pjt__mrbar">' + sel + gen + prn + info + '</div>';
  const msg = st.msg ? '<div class="jh-alert" data-tone="info" role="status">' + esc(st.msg) + '</div>' : '';
  const err = st.error ? '<div class="jh-alert" data-tone="warn" role="status">' + esc(st.error) + '</div>' : '';
  const body = st.reportLoading ? '<div class="jh-skeleton" style="height:var(--u-220)" aria-busy="true"></div>' : rep ? reportBodyHtml(rep) + notesHtml(st) + closeoutEditHtml(st) : closeoutEditHtml(st) + '<div class="jh-empty">' + esc(monthLabel(st.ym)) + ' 보고서가 아직 없습니다. "만들기"를 누르면 공정·출역·공수·공사일보를 모아 한 장으로 만듭니다.</div>';
  return '<div class="jh-pjt jh-pjt__mr">' + head + msg + err + bar + body + '</div>';
}

/* ───────── 인쇄(PDF 저장) 문서 — 별도 창에 쓰는 한 장짜리 HTML. 파일 이름은 문서 파일 이름 규칙(월 단위 문서: "2026-07 월간 보고서 - 프로젝트") ───────── */
export const printTitle = (rep, label) => docFileName({ group: 'month', ym: rep && rep.ym, kind: '월간 보고서', project: label });
const PCSS = '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.55 "Malgun Gothic","Noto Sans KR",sans-serif;color:#111;margin:0}h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #333}.sub{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%;margin:4px 0}td,th{border:1px solid #999;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f1f3f5;width:30%}ul{margin:4px 0 4px 18px;padding:0}li{margin:2px 0}.note{color:#666;font-size:11px;margin-top:4px}.warn{color:#a5342a;font-weight:700}';
const row = (a, b) => '<tr><th>' + esc(a) + '</th><td>' + b + '</td></tr>';
function printLog(L) {
  if (!L) return '';
  const st = L.byStatus || {}, ch = L.changes || {}, ov = L.overdue || {}, nx = L.dueNext || {}; const cats = Object.keys(L.byCategory || {}).filter((k) => n(L.byCategory[k]) > 0).map((k) => esc(k) + ' ' + fmt(L.byCategory[k])).join(' · ');
  const li = (arr, fn) => (arr && arr.length ? '<ul>' + arr.map(fn).join('') + '</ul>' : '');
  const due = (x) => '<li>' + esc(md(x.dueDate)) + (x.daysOver ? ' (' + esc(x.daysOver) + '일 지남)' : '') + (x.claimedByName ? ' · ' + esc(x.claimedByName) : ' · 맡은 사람 없음') + ' — ' + esc(x.title) + '</li>';
  return '<h2>이력 요약 (변경 · 결정 · 요청)</h2><table>' + row('이번 달 기록된 이력', fmt(L.total) + '건 (직접 입력 ' + fmt(L.manual) + ' · 자동 기록 ' + fmt(L.auto) + ')' + (cats ? ' — ' + cats : '')) + row('처리 상태', '처리 중 ' + fmt(st.open) + ' · 완료 ' + fmt(st.done) + ' · 종결 ' + fmt(st.closed) + ' · 보류 ' + fmt(st.hold)) + row('변경사항', fmt(ch.total) + '건 (영향 확인 전 ' + fmt(ch.unchecked) + '건)') + '</table>'
    + (ov.items && ov.items.length ? '<div><b>기한이 지났는데 처리 중인 요청 (' + fmt(ov.total) + '건)</b></div>' + li(ov.items, due) : '') + (nx.items && nx.items.length ? '<div><b>다음 달에 기한이 오는 요청 (' + fmt(nx.total) + '건)</b></div>' + li(nx.items, due) : '')
    + '<div class="note">보고서를 만든 날(' + esc(L.asOf || '') + ')의 처리 상태입니다. 후보·대외비 항목은 포함하지 않습니다.</div>';
}
function printCloseout(c) { // 항목이 있을 때만(빈 구역으로 종이를 채우지 않는다). 현장 층 — 금액 없음
  if (!c || typeof c !== 'object' || Array.isArray(c) || !(Number.isInteger(c.total) && c.total > 0)) return '';
  const items = (Array.isArray(c.items) ? c.items : []).filter((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.name === 'string' && x.name.trim()); if (!items.length) return '';
  return '<h2>마감 완성도</h2><table>' + row('마감 완성도', fmt(c.done) + ' / ' + fmt(c.total) + '항목 (' + (typeof c.rate === 'number' && isFinite(c.rate) ? pct(c.rate) : '—') + ')') + row('이번 달 완료', signed(c.doneThisMonth) + '항목') + items.map((x) => row(x.name, esc((x.done === true ? '완료' + (x.doneDate ? ' ' + md(x.doneDate) : '') : '미완료') + (x.assignee ? ' · ' + x.assignee : '') + (x.memo ? ' — ' + x.memo : '')))).join('') + '</table>';
}
export function printHtml(rep, label) {
  const d = rep.data || {}, p = d.progress, m = d.manday, r = d.reports, yv = yieldView(d.yield), nt = rep.notes || {};
  const rem = (r && r.remarks || []).map((x) => '<li>' + esc(md(x.date)) + (x.author ? ' (' + esc(x.author) + ')' : '') + ' — ' + esc(x.text) + '</li>').join('');
  const body = '<h1>' + esc(label || '') + ' 월간 보고서</h1><div class="sub">' + esc(monthLabel(rep.ym)) + (rep.partial ? ' (중간 보고서 — 오늘까지)' : '') + ' · 현장 층(금액 없음) · 버전 ' + esc(rep.version) + '</div>'
    + '<h2>공정</h2>' + (p ? '<table>' + row('설치 완료 (누적)', fmt(p.end.installed) + ' / ' + fmt(p.end.total) + '품목 (' + pct(p.end.installRate) + ')') + row('이번 달 새로 설치 완료', signed(p.delta.installed) + '품목 — 시공검측 직전까지 모든 설치 단계가 끝난 품목') + row('시공검측 통과 (누적)', fmt(p.end.inspected) + '품목 · 이번 달 ' + signed(p.delta.inspected) + ' · 통과율 ' + pct(p.end.inspectRate)) + row('참고: 반입 · 입고검사', '이번 달 ' + signed((p.delta.byStage || {})['반입']) + ' · ' + signed((p.delta.byStage || {})['입고검사']) + ' (누적 ' + fmt((p.end.byStage || {})['반입']) + ' · ' + fmt((p.end.byStage || {})['입고검사']) + '품목)') + '</table>' : '<div class="note">공정 구조가 없어 공정을 집계하지 않았습니다.</div>')
    + printCloseout(d.closeout)
  + '<h2>출역 · 공수</h2>' + (m ? '<table>' + row('투입 공수 합', fmt(m.manday, 1) + ' (공수 입력 ' + fmt(m.mandayDays) + '일 · 인원 ' + fmt(m.workers) + '명)') + row('출역', fmt(m.attendDays) + '일 · 일평균 ' + fmt(m.avgHeads, 1) + '명') + '</table>' : '')
    + '<h2>생산성 수율</h2><table>' + row('이번 달 설치 완료 ÷ 투입 공수', '<b' + (yv.tone === 'warn' ? ' class="warn"' : '') + '>' + esc(yv.main) + '</b> — ' + esc(yv.sub)) + '</table><div class="note">수율은 분자·분모를 항상 같이 봅니다. 공정 체크가 없는 달은 숫자를 내지 않습니다(입력 누락 가능).</div>'
    + '<h2>공사일보 · 특이사항</h2>' + (r ? '<table>' + row('공사일보 작성', fmt(r.written) + '일 / ' + fmt(r.span) + '일') + row('미작성 (달력 전체)', fmt(r.missing) + '일 (휴무·주말·공휴일 포함 · 출역이 있는데 미작성 ' + fmt(r.attendMissing) + '일)') + '</table>' + (rem ? '<ul>' + rem + '</ul>' : '<div class="note">비고가 적힌 날이 없습니다.</div>') : '')
    + '<h2>다음 달 계획</h2>' + ((r && r.nextPlan && r.nextPlan.text) ? '<div>' + esc(r.nextPlan.text) + '</div><div class="note">' + esc(md(r.nextPlan.from)) + ' 공사일보의 "내일 작업" (초안)</div>' : '<div class="note">공사일보에 "내일 작업"이 적힌 날이 없습니다.</div>')
    + printLog(d.log)
    + ((nt.remarks || nt.nextPlan) ? '<h2>직접 입력 (보완)</h2>' + (nt.remarks ? '<div><b>특이사항 보완</b> — ' + esc(nt.remarks) + '</div>' : '') + (nt.nextPlan ? '<div><b>다음 달 계획</b> — ' + esc(nt.nextPlan) + '</div>' : '') + (nt.byName ? '<div class="note">' + esc(nt.byName) + ' 작성</div>' : '') : '');
  return '<!doctype html><meta charset="utf-8"><title>' + esc(printTitle(rep, label) || '월간 보고서') + '</title><style>' + PCSS + '</style>' + body + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr' + 'ipt>';
}
