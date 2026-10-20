/* 프로젝트 변경·결정 이력 로그 — 화면용 순수 규칙(설계 docs/pjt-log-design.md r1, 대표님 2026-10-16 Q1~Q7).
 * 서버 함수 pjtLogAct(portal-functions/functions/pjt-log-act.js)와 **같은 규칙**을 쓴다: 분류·출처·상태·금액·연락처 감지. 서버가 최종 판단이고, 이 파일은 입력하는 중에 바로 알려 주기 위한 것이다(제출한 뒤에야 거절되지 않게).
 * 규칙이 바뀌면 두 곳을 같이 고친다 — tests/pjt-log.test.mjs 가 서버 파일의 값과 같은지 대조한다(서버 파일이 옆에 있을 때). */
export const CATEGORIES = ['발주처 요청·지시', '일정 변경', '범위·수량 변경', '현장 이슈', '회의 결정'];
export const SOURCES = ['회의', '카톡', '전화', '현장', '메일', '일정', '공사일보']; // 서버 pjt-log-act.js SOURCES 와 같게 — 공사일보는 "이력으로 올리기" 버튼 전용
export const INPUT_SOURCES = ['회의', '카톡', '전화', '현장'];              // 직접 입력 칩(메일·일정은 자동 기록 전용)
export const TITLE_MAX = 80;
export const CATEGORY_ICON = { '발주처 요청·지시': '📨', '일정 변경': '📅', '범위·수량 변경': '📐', '현장 이슈': '⚠️', '회의 결정': '🗣️' };
export const STATUS_LABEL = { candidate: '후보', confirmed: '확정', claimed: '처리 중', done: '완료', closed: '종결', hold: '보류' };
export const STATUS_TONE = { candidate: 'info', confirmed: '', claimed: 'accent', done: 'accent', closed: '', hold: 'warn' };
export const CHANGE_CATEGORIES = ['일정 변경', '범위·수량 변경'];

/** 금액·단가로 보이는 글자(수량·사양·일정은 허용). 서버 pjt-log-act.js MONEY 와 같은 식 */
const MONEY = [/\d[\d,.]*\s*(?:원|만원|천원|억원|억|만\s*원)/, /[₩￦]\s*\d/, /(?:단가|금액|대금|견적가|계약금|공사비|기성금|청구액|지급액|인상|인하)[^\n]{0,8}\d/];
const PERSONAL = [/\b\d{6}[-\s]?[1-8]\d{6}\b/, /(?:\+82[-\s]?)?0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/];
export const hasMoney = (s) => MONEY.some((re) => re.test(String(s == null ? '' : s)));
export const hasPersonal = (s) => PERSONAL.some((re) => re.test(String(s == null ? '' : s)));

/** 입력 중에 보여 줄 안내(빈 문자열이면 문제 없음). 서버가 최종 거절하지만 제출 전에 알려 준다 */
export function titleHint(title) {
  const t = String(title == null ? '' : title).replace(/\s+/g, ' ').trim();
  if (hasMoney(t)) return '금액·단가는 이력에 적지 않습니다. 금액을 빼고 수량·사양·일정만 적어 주세요.';
  if (hasPersonal(t)) return '전화번호·메일 주소·주민번호는 이력에 적지 않습니다.';
  if (t.length > TITLE_MAX) return '한 줄 요약은 ' + TITLE_MAX + '자 이내로 적어 주세요. (지금 ' + t.length + '자)';
  return '';
}
/** 제출 가능 여부와 이유 — 버튼 비활성·안내에 쓴다. needProject = PJT 메인 홈처럼 프로젝트를 고르기 전 화면(프로젝트 선택이 필요) */
export function canSubmit(f, needProject) {
  const x = f || {};
  if (needProject && !String(x.pjtId || '')) return { ok: false, why: '프로젝트를 선택해 주세요.' };
  if (CATEGORIES.indexOf(x.category) === -1) return { ok: false, why: '분류를 선택해 주세요.' };
  if (INPUT_SOURCES.indexOf(x.source) === -1) return { ok: false, why: '출처를 선택해 주세요.' };
  if (!String(x.title || '').trim()) return { ok: false, why: '한 줄 요약을 적어 주세요.' };
  const h = titleHint(x.title); if (h) return { ok: false, why: h };
  if (x.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(x.dueDate))) return { ok: false, why: '기한 날짜 형식이 올바르지 않습니다.' };
  return { ok: true, why: '' };
}
const dayNum = (ymd) => Math.floor(Date.parse(ymd + 'T00:00:00Z') / 86400000);
/** 기한 표시: 서버가 준 due({daysLeft,tone})를 사람이 읽는 문구로. 지남은 "N일 지남", 오늘, 내일, D-N */
export function dueText(due) {
  if (!due || typeof due.daysLeft !== 'number') return '';
  const d = due.daysLeft; if (d < 0) return Math.abs(d) + '일 지남'; if (d === 0) return '오늘 마감'; if (d === 1) return '내일 마감'; return 'D-' + d;
}
export const DUE_TONE = { overdue: 'danger', today: 'danger', soon: 'warn', later: '' };
/** "YYYY-MM-DD" → "10. 17 (금)" */
export function shortDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return '';
  const [, m, d] = ymd.split('-').map(Number); return m + '. ' + d + ' (' + '일월화수목금토'[new Date(ymd + 'T00:00:00Z').getUTCDay()] + ')';
}
/** 한 항목에 누르는 버튼 — 맡은 사람·권한에 따라. me = { uid, manager }, e = 서버가 준 항목. 반환: [{ act, label }] */
export function actionsFor(e, me) {
  const out = []; if (!e || !me) return out; const mine = !!me.uid && e.claimedBy === me.uid;
  if (e.status === 'candidate') { if (me.manager) out.push({ act: 'confirm', label: '확정' }); return out; }
  if (e.status === 'confirmed' || e.status === 'claimed') {
    if (!e.claimedBy) out.push({ act: 'claim', label: '내가 맡기' });
    else if (mine) out.push({ act: 'release', label: '맡기 취소' });
    else if (me.manager) out.push({ act: 'claim', label: '내가 맡기(재배정)' });
    if (mine || me.manager) out.push({ act: 'done', label: '완료' });
  }
  if (e.status === 'done' && (me.manager || (e.createdByMe === true))) out.push({ act: 'closed', label: '종결' });
  if ((e.status === 'confirmed' || e.status === 'claimed') && me.manager) out.push({ act: 'hold', label: '보류' });
  if ((e.status === 'hold' || e.status === 'closed') && me.manager) out.push({ act: 'reopen', label: '다시 열기' });
  if (CHANGE_CATEGORIES.indexOf(e.category) !== -1 && e.status !== 'candidate') out.push({ act: 'impact', label: e.impactChecked ? '영향 확인 해제' : '영향 확인' });
  if (canAddCalendar(e, me)) out.push({ act: 'calendar', label: '캘린더에 넣기' });
  return out;
}
/* ── 이력의 기한을 캘린더로(설계 §8, 서버 calendarAdd 와 같은 규칙) ── */
const realDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || '')) && !isNaN(Date.parse(k + 'T00:00:00Z')) && new Date(k + 'T00:00:00Z').toISOString().slice(0, 10) === k;
/** 캘린더에 이미 넘긴 항목인가(서버가 calendarId 를 내려준다) */
export const inCalendar = (e) => !!e && typeof e.calendarId === 'string' && e.calendarId.length > 0;
/** "캘린더에 넣기" 를 보일지 — 관리 권한자·확정/처리 중/완료·기한이 실제 날짜·대외비 아님·아직 안 넘김. 후보·종결·보류는 제외(서버도 같은 이유로 거절). */
export function canAddCalendar(e, me) {
  if (!e || !me || !me.manager) return false;
  if (['confirmed', 'claimed', 'done'].indexOf(e.status) === -1 || e.restricted === true) return false;
  return realDay(e.dueDate) && !inCalendar(e);
}
/** 서버 오류 문구 → 사용자 안내(서버가 이미 한국어로 주므로 그대로, 없으면 기본 문구) */
export function friendlyError(e) { const m = String((e && (e.message || e.details)) || '').replace(/^FirebaseError:\s*/, '').trim(); return m && m.length < 160 ? m : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'; }

/* ── 미분류 메일 받은함(설계 §3) — 서버 mail-inbox-act.js 가 준 목록을 화면에서 쓰는 순수 규칙 ── */
/** 현장 표기(Ph2 등)가 든 프로젝트가 "정확히 하나"일 때만 미리 골라 준다(추천일 뿐 — 지정은 사람이 누른다). projects=[{id,name}] */
export function suggestProject(siteHint, projects) {
  const num = String(siteHint || '').replace(/\D/g, ''); if (!num) return '';
  const re = new RegExp('\\bph\\.?\\s*' + num + '\\b', 'i'); const hit = (projects || []).filter((p) => p && re.test(String(p.name || '')));
  return hit.length === 1 ? hit[0].id : '';
}
/** 받은함 한 줄이 지정 버튼을 낼 수 있는지 — 프로젝트를 골라야 한다 */
export const canAssign = (pjtId) => typeof pjtId === 'string' && pjtId.length > 0 && pjtId.length <= 128 && pjtId.indexOf('/') === -1;
/** 받은함 카드를 그릴지 — 권한이 없거나(서버가 거절) 비어 있으면 조용히 그리지 않는다 */
export const showInbox = (d) => !!d && Array.isArray(d.items) && d.items.length > 0;

/** 공사일보 \"이력으로 올리기\" 버튼 상태(화면 없이 판정) — o = { note: 저장된 일보의 특이사항(새 양식 note·옛 양식 remarks 를 fromStored 가 note 로 환산), manage: 작성 권한, logged: 올린 뒤 서버가 준 { id }, busy: 올리는 중 }.
 * 서버는 저장된 공사일보를 읽어 이력을 만들므로(요청의 글을 믿지 않음) 이 버튼은 저장된 일보(조회 화면)에만 둔다. 특이사항이 없거나 작성 권한이 없으면 숨긴다. */
export function reportLogState(o) {
  const x = o || {}; const note = String(x.note == null ? '' : x.note).trim();
  if (!x.manage || !note) return { show: false, state: 'hidden', label: '', disabled: true };
  if (x.logged) return { show: true, state: 'done', label: '이력에 올림 ✓', disabled: true };
  if (x.busy) return { show: true, state: 'busy', label: '올리는 중…', disabled: true };
  return { show: true, state: 'ready', label: '이력으로 올리기', disabled: false };
}
/** 서버 fromReport 응답 → 안내 문구. duplicate 가 참(true)일 때만 "이미"(이미 같은 날짜가 올라가 있어 서버가 새로 만들지 않은 경우) */
export const reportLogMessage = (r) => (r && r.duplicate === true ? '이미 이력에 올라가 있습니다.' : '이력에 올렸습니다.');

/** 공사일보 "이력으로 올리기" 서버 호출 — call = (payload) => Promise<응답>(pjtLogAct 호출). 서버에는 action·pjtId·date·category 만 보낸다(제목·출처·상태는 서버가 저장된 일보에서 직접 만든다).
 * 결과 = { ok, msg, logged: { id } | null }. 서버가 항상 ok:true 를 주므로 ok 가 아닌 응답은 실패로 본다. 프로젝트·날짜가 없거나 알 수 없는 분류는 서버에 보내지 않고 거절한다. */
export async function runReportLog(call, o) {
  const x = o || {}; const category = x.category ? String(x.category) : '현장 이슈';
  if (!x.pjtId || !x.date) return { ok: false, msg: '프로젝트와 날짜를 확인해 주세요.', logged: null };
  if (CATEGORIES.indexOf(category) === -1) return { ok: false, msg: '분류를 선택해 주세요.', logged: null };
  try {
    const r = await call({ action: 'fromReport', pjtId: String(x.pjtId), date: String(x.date), category });
    if (!r || r.ok !== true) return { ok: false, msg: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', logged: null };
    return { ok: true, msg: reportLogMessage(r), logged: { id: String(r.id || '') } };
  } catch (e) { return { ok: false, msg: friendlyError(e), logged: null }; }
}
