/* 인사평가 — 수시평가(프로젝트 종료 시) 화면(테섭 미리보기). 마크업만 만든다(저장·불러오기는 adhoc-io.js). 설계서 docs/hr-evaluation-design.md 5·6절 */
import { pageTableHtml } from '../../shared/pager.js?v=20261031h';
import { withManage } from '../../shared/eval-perm.js?v=20261031h';
import { esc } from '../../core/ui.js?v=20261031h';
import { evalAccess, adhocSummary, adhocProjectPerf, adhocParticipants, pickAdhocEvaluator, emptyAdhoc, ADHOC_LABELS, ADHOC_ENTRY_ITEMS, PEER_ITEMS, STATUS_LABEL } from './evaluation.js?v=20261031h';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const gtone = (g) => (g === 'S' || g === 'A' ? 'accent' : g === 'C' ? 'danger' : 'muted');
const stone = (s) => (s === 'confirmed' || s === 'team_done' ? 'accent' : s === 'rating' ? 'warn' : 'muted');
const fmt = (n) => (n == null ? '-' : String(n));
const won = (n) => (n == null || !isFinite(n) ? '-' : Math.round(n).toLocaleString('ko-KR') + '원');
const BAND_TEXT = '목표 대비 +3%p 이상 5점 · +1%p 이상 4점 · ±1%p 미만 3점 · −3%p 이상 2점 · −3%p 미만 1점';

/** 프로젝트 목록(종료된 프로젝트 + 진행 중 프로젝트) */
function adhocBoardHtml_list(st) {
  const ad = st.ad; const acc = evalAccess(withManage(ad.me), { id: '' }, {});
  const head = '<div class="jh-hr__pad"><div class="jh-hr__bar">' + chip('프로젝트 종료 시마다 평가', 'muted') + chip('내 권한: ' + (acc.level === 'exec' ? '사장단' : acc.level === 'hr' ? '인사팀' : '권한 없음'), acc.level === 'none' ? 'danger' : 'accent') + '</div>'
    + '<div class="jh-field__hint">수시평가는 <strong>현장 평가(참여자 중 최상급자 + 동료) 50% + 사장단 평가(개인 60 · 프로젝트 성과 40) 50%</strong>입니다. 프로젝트 성과는 <strong>프로젝트마다 따로</strong> 정한 목표 마진율과 실현 마진율의 차이로 점수를 냅니다. 미리보기(테섭)에서는 사장단 계정이 현장 입력을 대신 입력합니다. 올해는 참고자료입니다.</div></div>';
  if (acc.level === 'none') return card('수시평가', head + '<div class="jh-empty">인사평가를 볼 수 있는 권한이 없습니다.</div>');
  const rows = (ad.projects || []).map((p) => { const perf = adhocProjectPerf({ target: p.targetMargin, snapshot: p.snapshot, saved: p.evalMargin });
    return '<tr><td><strong>' + esc(p.name || p.id) + '</strong></td><td>' + (p.status === 'ended' ? chip('종료', 'accent') : chip('진행 중', 'muted')) + '</td><td>' + esc(String((p.members || []).length)) + '명</td><td>' + esc(perf.target == null ? '목표 미입력' : perf.target + '%') + '</td><td>' + esc(perf.actual == null ? '-' : perf.actual + '%') + (perf.score != null ? ' ' + chip(perf.score + '점', perf.score >= 4 ? 'accent' : perf.score <= 2 ? 'danger' : 'muted') : '') + '</td><td><button type="button" class="jh-btn" data-variant="secondary" data-ad-open="' + esc(p.id) + '">' + (acc.edit ? '평가' : '보기') + '</button></td></tr>'; }).join('');
  return card('수시평가', head) + card('프로젝트', rows ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>프로젝트</th><th>상태</th><th>참여자</th><th>목표 마진율</th><th>실현 마진율 · 점수</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="jh-field__hint jh-hr__pad">종료된 프로젝트가 먼저 평가 대상입니다. 진행 중 프로젝트도 미리 열어 볼 수 있습니다.</div>' : '<div class="jh-empty">프로젝트가 없습니다.</div>');
}
function rateRow(label, cur, key, disabled) {
  let dots = ''; for (let n = 1; n <= 5; n++) dots += '<button type="button" class="jh-hr-ev__dot" data-ad-score="' + esc(key + '|' + n) + '" aria-pressed="' + (cur === n) + '"' + (disabled ? ' disabled' : '') + '>' + n + '</button>';
  return '<div class="jh-hr-ev__rate"><span>' + esc(label) + '</span><span class="jh-hr-ev__dots" role="group" aria-label="' + esc(label) + ' 점수">' + dots + '</span></div>';
}
const cell = (label, value, sub) => '<div class="jh-hr-ev__cell"><span class="jh-field__hint">' + esc(label) + '</span><strong>' + esc(value) + '</strong>' + (sub ? '<span class="jh-field__hint">' + esc(sub) + '</span>' : '') + '</div>';
/** 프로젝트 한 건: 프로젝트 성과 카드 + 참여자 목록(+ 선택한 참여자 평가 패널) */
function adhocProjectHtml_list(st) {
  const ad = st.ad; const p = (ad.projects || []).find((x) => x.id === ad.sel); if (!p) return '';
  const acc = evalAccess(withManage(ad.me), { id: '' }, {}); const dis = !acc.edit; const pe = ad.pdraft || {}; const snap = p.snapshot || {};
  const perf = adhocProjectPerf({ target: p.targetMargin, snapshot: snap, saved: p.evalMargin }); const meUid = (ad.me && ad.me.uid) || '';
  const myProj = pe.exec && pe.exec[meUid] ? pe.exec[meUid].project : null;
  const ro = (label, value, hint) => '<div class="jh-field"><span class="jh-field__label">' + esc(label) + '</span><strong>' + esc(value) + '</strong>' + (hint ? '<div class="jh-field__hint">' + esc(hint) + '</div>' : '') + '</div>';
  const plan = p.linked ? '<a href="#/plan/projects/' + esc(p.planId) + '">영업기획 → 프로젝트 상세</a>에서 입력·계산합니다' : '영업기획 프로젝트와 연결되어 있지 않습니다(영업기획 프로젝트의 "연동 PJT"에서 이 프로젝트를 연결하면 자동으로 읽어 옵니다)';
  const perfCard = card('프로젝트 성과 — ' + (p.name || p.id), '<div class="jh-hr__pad">'
    + '<div class="jh-hr__bar">' + (p.status === 'ended' ? chip('종료', 'accent') : chip('진행 중 — 잠정치', 'warn')) + (p.linked ? chip('영업기획 연결됨', 'accent') : chip('영업기획 연결 없음', 'warn')) + '</div>'
    + '<div class="jh-field__hint">마진율은 <strong>읽기 전용</strong>입니다 — ' + plan + '. 여기서는 사장단이 점수만 줍니다.</div>'
    + '<div class="jh-hr__grid">' + ro('목표 마진율', perf.target == null ? '미입력' : perf.target + '%', '프로젝트마다 영업기획에서 입력') + ro('청구 누계(공급가액)', p.linked ? won(snap.billed) : '-', '영업기획 청구서 집계') + ro('지급 누계(공급가액)', p.linked ? won(snap.paid) : '-', '영업기획 지급예정서 집계') + '</div>'
    + '<div class="jh-field__hint" data-tone="warn">잠정: 프로젝트 원가는 <strong>외주·자재(지급예정서)만</strong> 반영된 상태입니다. 현장경비(전표의 프로젝트 표시)와 자체 직접노무비가 영업기획에 연결되면 실제 마진율로 바뀝니다. 점수를 줄 때 이 점을 감안해 주세요.</div>'
    + '<div class="jh-hr-ev__score">' + cell('목표 마진율', perf.target == null ? '-' : perf.target + '%') + cell('실현 마진율 (' + (perf.confirmed ? '확인일 ' + (perf.asOf || '-') : '잠정') + ')', perf.actual == null ? '-' : perf.actual + '%', perf.confirmed ? '영업기획에서 확인·저장한 공헌이익(완결 청구 기준)' + (perf.estimated ? ' · 사업주 4대보험 추정 포함' : '') : '(완결 청구 − 지급) ÷ 완결 청구 — 현장경비·자체 직접노무비 미반영') + cell('목표 대비', perf.diff == null ? '-' : (perf.diff > 0 ? '+' : '') + perf.diff + '%p') + cell('마진율 점수', perf.score == null ? '-' : perf.score + ' / 5', '참고용 — ' + BAND_TEXT) + '</div>'
    + '<div class="jh-hr-ev__area"><div class="jh-hr__sub">사장단 평가 — 프로젝트 성과 <span class="jh-field__hint">' + esc((ad.me && ad.me.name) || '내 평가') + ' · 마진율 점수를 참고해 일정·품질·안전·추가공사를 함께 고려(5점)</span></div>' + rateRow('프로젝트 성과 종합', myProj, 'pexec', dis) + '</div>'
    + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-ad-act="psave"' + (dis ? ' disabled' : '') + '>프로젝트 성과 점수 저장</button><button type="button" class="jh-btn" data-variant="ghost" data-ad-act="back">← 프로젝트 목록</button></div></div>');
  const mem = p.memberWorkers || []; const lead = pickAdhocEvaluator(mem.map((w) => ({ id: w.id, name: w.name, rank: w.rank, hireDate: w.hireDate, empNo: w.empNo })));
  const rows = mem.map((w) => { const rec = (ad.recs || {})[w.id]; const sm = adhocSummary(rec, pe); return '<tr><td><strong>' + esc(w.name || '-') + '</strong> <span class="jh-field__hint">' + esc(w.rank || '') + '</span>' + (lead && lead.id === w.id ? ' ' + chip('평가자', 'accent') : '') + '</td><td>' + chip(STATUS_LABEL[sm.status], stone(sm.status)) + '</td><td>' + esc(fmt(sm.site)) + '</td><td>' + esc(fmt(sm.exec)) + '</td><td>' + esc(fmt(sm.final)) + (sm.grade ? ' ' + chip(sm.grade, gtone(sm.grade)) : '') + '</td><td><button type="button" class="jh-btn" data-variant="secondary" data-ad-member="' + esc(w.id) + '">' + (acc.edit ? '평가' : '보기') + '</button></td></tr>'; }).join('');
  const list = card('참여자 평가 · ' + mem.length + '명', '<div class="jh-hr__pad"><div class="jh-hr__bar">' + (lead ? chip('평가자(참여자 중 최상급자) ' + lead.name, 'accent') : chip('평가자 없음', 'danger') ) + '<span class="jh-field__hint">관리자·사장단·시스템 계정은 참여자에서 제외됩니다. 직급이 같으면 입사일이 빠른 사람이 평가자입니다.</span></div></div>' + (rows ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>참여자</th><th>진행</th><th>현장 점수</th><th>사장단 점수</th><th>수시 최종 · 등급</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">이 프로젝트의 참여자 명부가 비어 있습니다(PJT 관리의 명부를 확인해 주세요).</div>'));
  return perfCard + list + (ad.msel ? adhocMemberHtml(st, p, lead) : '');
}
function adhocMemberHtml(st, p, lead) {
  const ad = st.ad; const w = (p.memberWorkers || []).find((x) => x.id === ad.msel); if (!w) return '';
  const acc = evalAccess(withManage(ad.me), { id: '' }, {}); const d = ad.mdraft || emptyAdhoc(w, p); const lock = d.confirmed === true; const canEdit = acc.edit && !lock; const dis = !canEdit;
  const pe = ad.pdraft || {}; const sm = adhocSummary(d, pe); const meUid = (ad.me && ad.me.uid) || ''; const myPerson = d.exec && d.exec[meUid] ? d.exec[meUid].person : null;
  const peers = (p.memberWorkers || []).filter((x) => x.id !== w.id);
  const peerRows = peers.map((q) => { const v = (d.peers && d.peers[q.id]) || []; return '<div class="jh-hr-ev__peer"><span>' + esc(q.name || '-') + '</span>' + PEER_ITEMS.map((l, i) => '<select class="jh-select" aria-label="' + esc((q.name || '') + ' ' + l) + '" data-ad-peer="' + esc(q.id + '|' + i) + '"' + (dis ? ' disabled' : '') + '><option value="">' + esc(l) + '</option>' + [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (v[i] === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>').join('') + '</div>'; }).join('');
  const items = ADHOC_ENTRY_ITEMS.map((k) => rateRow(ADHOC_LABELS[k], d.items ? d.items[k] : null, 'item:' + k, dis)).join('');
  const result = '<div class="jh-hr-ev__score">' + cell('현장 점수', fmt(sm.site), '6항목 평균 · 협업=동료 평균 ' + fmt(sm.collab)) + cell('사장단 점수', fmt(sm.exec), '개인 60 + 프로젝트 성과 40 · ' + sm.execRaters + '명') + cell('수시 최종', fmt(sm.final), lock ? '확정됨' : '확정 전') + cell('등급', sm.grade || '-') + '</div>';
  const body = '<div class="jh-hr__pad">' + result
    + '<div class="jh-hr__sub">현장 평가 — ' + (lead ? '평가자 ' + esc(lead.name) : '평가자 없음') + ' <span class="jh-field__hint">(미리보기: 사장단 계정이 평가자 대신 입력 · 보고 충실도는 실제로는 공사일보·출역에서 자동 집계)</span></div><div class="jh-hr-ev__area">' + items + '</div>'
    + '<div class="jh-hr-ev__area"><div class="jh-hr__sub">동료평가 <span class="jh-field__hint">같은 프로젝트 참여자 · 평가자별 점수는 비공개, 평균만 반영(2명 미만이면 협업 항목을 채울 수 없음)</span></div>' + (peerRows || '<div class="jh-empty">동료가 없습니다.</div>') + '<div class="jh-field__hint">협업·소통(동료 평균): ' + esc(sm.collab == null ? '아직 반영할 수 없음(동료 2명 이상의 입력 필요)' : sm.collab + ' / 5') + '</div></div>'
    + '<div class="jh-hr-ev__area"><div class="jh-hr__sub">사장단 평가 — 개인 <span class="jh-field__hint">' + esc((ad.me && ad.me.name) || '내 평가') + ' · 이 사람의 프로젝트 기여(5점)</span></div>' + rateRow('개인 종합', myPerson, 'person', dis) + '</div>'
    + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-ad-act="msave"' + (canEdit ? '' : ' disabled') + '>저장</button><button type="button" class="jh-btn" data-variant="secondary" data-ad-act="mconfirm"' + (acc.confirm && !lock && sm.site != null && sm.exec != null ? '' : ' disabled') + '>수시 평가 확정(대표)</button>' + (lock && acc.confirm ? '<button type="button" class="jh-btn" data-variant="ghost" data-ad-act="munconfirm">확정 취소</button>' : '') + '<button type="button" class="jh-btn" data-variant="ghost" data-ad-act="mback">← 참여자 목록</button>' + (acc.level === 'hr' ? '<span class="jh-field__hint">인사팀은 열람·운영만 가능합니다.</span>' : '') + (lock ? '<span class="jh-field__hint">확정된 평가는 수정할 수 없습니다.</span>' : '') + '</div></div>';
  return card((w.name || '') + ' · 수시평가 · ' + (p.name || ''), body, chip(STATUS_LABEL[sm.status], stone(sm.status)));
}

/* ── 목록 페이지 나누기(shared/pager.js) — NAME_list 의 결과에 쪽 나누기를 씌운 함수 ── */
export function adhocBoardHtml(st) { return pageTableHtml(adhocBoardHtml_list(st), st.pg || (st.pg = {}), 'eval-adhoc-board', String(st.ad && st.ad.year || '')); }
export function adhocProjectHtml(st) { return pageTableHtml(adhocProjectHtml_list(st), st.pg || (st.pg = {}), 'eval-adhoc-project', String(st.ad && st.ad.sel && (st.ad.sel.id || st.ad.sel) || '')); }
