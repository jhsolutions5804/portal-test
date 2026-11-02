/* 포털 문의·건의 창(2026-11-02 대표님 요청) — 순수 규칙(화면·네트워크 없이 시험 가능).
 * 직원이 사용 중 불편한 점을 우측 하단 떠 있는 버튼으로 바로 남기면 portal_feedback 컬렉션에 쌓이고, 관리자가 목록으로 보며 춘식이가 추려 보고한다.
 * 보안 규칙: 승인된 사용자는 자기 이름으로 만들기만 가능, 읽기·상태 변경·삭제는 관리자만. 규칙이 게시되기 전까지 본섭에서는 닫아 둔다(feedbackEnabledFor). */
export const FB_COL = 'portal_feedback';
export const FB_CATEGORIES = [['inconvenience', '불편해요'], ['bug', '오류예요'], ['idea', '건의해요']];
export const FB_STATUS = [['new', '신규'], ['seen', '확인'], ['done', '완료']];
export const FB_MIN = 2, FB_MAX = 2000, FB_COOLDOWN_MS = 20000;
/** 테섭(/portal-test/…)과 본섭(/app/…)에서 켠다. 본섭은 보안 규칙(portal_feedback)이 게시된 뒤인 2026-11-02 에 열었다(대표님 「지금 바로 반영」 — 직원 QC 중 불편 사항 수집) */
export const feedbackEnabledFor = (pathname) => /^\/(portal-test|app)(\/|$)/.test(String(pathname || ''));
const catRow = (k) => FB_CATEGORIES.find((c) => c[0] === k);
export const categoryLabel = (k) => (catRow(k) || ['', k || ''])[1];
export const statusLabel = (k) => (FB_STATUS.find((s) => s[0] === k) || ['', k || '신규'])[1];
export const nextStatus = (k) => (k === 'new' ? 'seen' : k === 'seen' ? 'done' : 'done');
/** 브라우저 이름·운영체제를 짧게(예: "Edge 129 · Windows") — 원문 userAgent 전체는 저장하지 않는다 */
export function browserLabel(ua) {
  const s = String(ua || ''); let b = '';
  let m;
  if ((m = /Edg(?:e|A|iOS)?\/(\d+)/.exec(s))) b = 'Edge ' + m[1];
  else if ((m = /(?:CriOS|Chrome)\/(\d+)/.exec(s))) b = 'Chrome ' + m[1];
  else if ((m = /(?:FxiOS|Firefox)\/(\d+)/.exec(s))) b = 'Firefox ' + m[1];
  else if ((m = /Version\/(\d+)[^ ]* .*Safari/.exec(s))) b = 'Safari ' + m[1];
  else if (/Safari/.test(s)) b = 'Safari';
  const os = /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : '';
  return [b, os].filter(Boolean).join(' · ') || '알 수 없음';
}
/** 입력 → 저장할 문서(검증). 오류면 { error }. input: { category, text }, me: { uid, name, email }, env: { hash, build, userAgent, width, height } */
export function buildFeedbackDoc(input, me, env) {
  const i = input || {}; const text = String(i.text == null ? '' : i.text).trim();
  if (!me || !me.uid) return { error: '로그인 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' };
  if (text.length < FB_MIN) return { error: '내용을 입력해 주세요.' };
  if (text.length > FB_MAX) return { error: '내용은 ' + FB_MAX + '자까지 쓸 수 있습니다. (현재 ' + text.length + '자)' };
  const cat = catRow(i.category) ? i.category : 'inconvenience'; const e = env || {};
  return { doc: {
    uid: me.uid, name: String(me.name || '').slice(0, 40), email: String(me.email || '').slice(0, 80),
    category: cat, text, page: String(e.hash || '').slice(0, 160), build: String(e.build || '').slice(0, 24),
    ua: browserLabel(e.userAgent), viewport: (e.width && e.height) ? Math.round(e.width) + 'x' + Math.round(e.height) : '', status: 'new',
  } };
}
/** 연속 전송 방지: 마지막 전송 뒤 남은 대기(ms), 0 이면 보낼 수 있음 */
export const cooldownLeft = (lastAt, now) => (lastAt && now - lastAt < FB_COOLDOWN_MS ? FB_COOLDOWN_MS - (now - lastAt) : 0);
/** 목록: 최신 먼저(createdAt 초 단위 → 없으면 맨 뒤) */
export const sortNewestFirst = (rows) => (rows || []).slice().sort((a, b) => ((b.d && b.d.createdSec) || 0) - ((a.d && a.d.createdSec) || 0));
export const countByStatus = (rows) => { const c = { new: 0, seen: 0, done: 0 }; (rows || []).forEach((r) => { const s = (r.d && r.d.status) || 'new'; c[s] = (c[s] || 0) + 1; }); return c; };
/** 보고용 요약 재료: 분류별 건수와 같은 화면(page)에서 모인 건수 — 춘식이가 묶어 보고할 때 쓴다 */
export function digest(rows) {
  const cat = {}, page = {}; (rows || []).forEach((r) => { const d = r.d || {}; cat[d.category] = (cat[d.category] || 0) + 1; const p = (d.page || '').replace(/\?.*$/, '') || '(알 수 없음)'; page[p] = (page[p] || 0) + 1; });
  return { total: (rows || []).length, byCategory: cat, byPage: Object.entries(page).sort((a, b) => b[1] - a[1]).slice(0, 8) };
}
export const dayText = (sec) => { if (!sec) return ''; const d = new Date((sec + 9 * 3600) * 1000); return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCDate()).padStart(2, '0') + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

/* ── 2026-11-02 추가: 완료 탭 · 댓글(조치 내용) · 건의자 알림 ── */
export const FB_REPLY_MAX = 1000;
const MY_STATUS = { new: '접수', seen: '확인 중', done: '조치 완료' };
export const myStatusLabel = (k) => MY_STATUS[k] || '접수';
/** 댓글 글 검사 — 빈 글은 허용(「조치 완료」만 누를 때), 너무 길면 오류 */
export function validateReply(text) { const t = String(text == null ? '' : text).trim(); if (t.length > FB_REPLY_MAX) return { error: '댓글은 ' + FB_REPLY_MAX + '자까지 쓸 수 있습니다. (현재 ' + t.length + '자)' }; return { text: t }; }
/** 댓글 문서(서브컬렉션 replies) — kind: reply(일반 댓글) | done(조치 완료와 함께 남긴 댓글). 빈 글이면 만들지 않는다 */
export function buildReplyDoc(text, me, kind) {
  const v = validateReply(text); if (v.error) return { error: v.error }; if (!v.text) return { error: '댓글 내용을 입력해 주세요.' };
  if (!me || !me.uid) return { error: '로그인 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' };
  return { doc: { uid: me.uid, name: String(me.name || '').slice(0, 40), text: v.text, kind: kind === 'done' ? 'done' : 'reply' } };
}
/** 받은 건의 → 처리 중(신규·확인)과 완료로 나눈다. 처리 중은 최신 접수순, 완료는 최근 처리순 */
export function splitInbox(rows) {
  const all = (rows || []).slice(); const open = sortNewestFirst(all.filter((r) => ((r.d && r.d.status) || 'new') !== 'done'));
  const done = all.filter((r) => r.d && r.d.status === 'done').sort((a, b) => ((b.d.handledSec || b.d.createdSec || 0) - (a.d.handledSec || a.d.createdSec || 0)));
  return { open, done };
}
/** 건의자 알림: 내 건의 중 읽지 않은 답변(userUnread)이 있는 건수 */
export const unreadCount = (rows) => (rows || []).filter((r) => r.d && r.d.userUnread === true).length;
export const hasUnread = (rows) => unreadCount(rows) > 0;

