/* 전자결재 관리자 설정 — 화면 상태와 편집 규칙(순수 함수). 저장은 서버 함수가 다시 검증한다. */
export const GUIDE_TYPES = [
  { key: 'leave', label: '연차신청서', icon: '🏖️' },
  { key: 'spend', label: '구매·지출 결의서', icon: '🧾' },
  { key: 'daily', label: '업무일지', icon: '📝' },
  { key: 'cert', label: '재직증명서', icon: '🪪' },
  { key: 'resign', label: '휴직/퇴직', icon: '📤' },
  { key: 'attend', label: '근태 기록 수정 요청', icon: '⏰' }
];
export const LIMITS = { required: 3, proxy: 3, approvers: 5, cc: 10 };
const clone = (x) => JSON.parse(JSON.stringify(x));
const arr = (v) => (Array.isArray(v) ? v.filter((u) => typeof u === 'string' && u) : []);
export const isGuest = (u) => !!u && /^guest/i.test(String(u.empNo || '').trim());

/** dir = loadDirectory 결과(users·policy·guides), company = 회사 정보 문서 */
export function initState(dir, company, me) {
  const byUid = {}; (dir.users || []).forEach((u) => { byUid[u.uid] = u; });
  const policy = { required: arr(dir.policy && dir.policy.required), proxy: arr(dir.policy && dir.policy.proxy) };
  const guides = {}; GUIDE_TYPES.forEach((t) => { const g = (dir.guides && dir.guides[t.key]) || {}; guides[t.key] = { steps: arr(g.steps), cc: arr(g.cc), note: typeof g.note === 'string' ? g.note : '' }; });
  const co = { name: (company && company.name) || '', ceo: (company && company.ceo) || '', bizNo: (company && company.bizNo) || '', address: (company && company.address) || '' };
  const s = { me, users: dir.users || [], byUid, policy, guides, company: co, saving: '', open: '' };
  s.orig = { policy: clone(policy), guides: clone(guides), company: clone(co) };
  return s;
}
/** 정책은 현재 필수 결재자(대표)만 바꾼다. 정책이 비어 있을 때만 관리자가 처음 채울 수 있다. */
export function canEditPolicy(me, policy) {
  const req = arr(policy && policy.required);
  return req.length ? req.indexOf(me.uid) !== -1 : me.admin === true;
}
export function addTo(list, uid, max) {
  if (!uid) return { list, error: '추가할 사람을 고르세요.' };
  if (list.indexOf(uid) !== -1) return { list, error: '이미 들어 있는 사람입니다.' };
  if (list.length >= max) return { list, error: '최대 ' + max + '명까지 지정할 수 있습니다.' };
  return { list: list.concat(uid), error: '' };
}
export const removeFrom = (list, uid) => list.filter((u) => u !== uid);
export function moveIn(list, uid, dir) {
  const i = list.indexOf(uid); const j = i + dir; if (i < 0 || j < 0 || j >= list.length) return list;
  const out = list.slice(); out[i] = list[j]; out[j] = uid; return out;
}
/** 고를 수 있는 사람: 결재자는 승인된 비-GUEST, 참조는 승인된 모두. 이미 어느 목록에 있는 사람은 제외 */
export function candidates(state, exclude, asApprover) {
  return state.users.filter((u) => exclude.indexOf(u.uid) === -1 && !(asApprover && isGuest(u)));
}
export const personLabel = (state, uid) => { const u = state.byUid[uid]; return u ? u.name + (u.rank ? ' ' + u.rank : '') : '(알 수 없음)'; };

/** 권장 결재선에 대한 안내(저장을 막지는 않는다 — 서버가 정말 안 되는 것만 막는다) */
export function guideNotes(g, policy, state) {
  const notes = [];
  const missing = arr(policy.required).filter((u) => g.steps.indexOf(u) === -1);
  if (g.steps.length && missing.length) notes.push('필수 결재자(' + missing.map((u) => personLabel(state, u)).join(', ') + ')는 작성 화면에서 마지막 결재자로 자동 추가됩니다.');
  if (!g.steps.length && g.cc.length) notes.push('결재자가 없으면 권장 결재선으로 쓰이지 않습니다. 결재자를 한 명 이상 넣어 주세요.');
  return notes;
}
export const isDirty = (state, section, key) => {
  if (section === 'policy') return JSON.stringify(state.policy) !== JSON.stringify(state.orig.policy);
  if (section === 'company') return JSON.stringify(state.company) !== JSON.stringify(state.orig.company);
  return JSON.stringify(state.guides[key]) !== JSON.stringify(state.orig.guides[key]);
};
export function payloadFor(section, state, key) {
  if (section === 'policy') return { action: 'saveSettings', kind: 'policy', policy: { required: state.policy.required.slice(), proxy: state.policy.proxy.slice() } };
  if (section === 'company') return { action: 'saveSettings', kind: 'company', company: { name: state.company.name.trim(), ceo: state.company.ceo.trim(), bizNo: state.company.bizNo.trim(), address: state.company.address.trim() } };
  const g = state.guides[key];
  return { action: 'saveSettings', kind: 'guides', guides: { [key]: { steps: g.steps.slice(), cc: g.cc.slice(), note: g.note.trim() } } };
}
/** 저장이 끝난 뒤 기준값(원본)을 현재 값으로 */
export function markSaved(state, section, key) {
  if (section === 'policy') state.orig.policy = clone(state.policy);
  else if (section === 'company') state.orig.company = clone(state.company);
  else state.orig.guides[key] = clone(state.guides[key]);
}
/** 저장 전 화면 검사(서버 규칙과 같은 기준의 빠른 안내) */
export function validateSection(state, section, key) {
  if (section === 'policy') {
    if (!state.policy.required.length) return '필수 결재자는 1명 이상이어야 합니다.';
    if (state.policy.required.indexOf(state.me.uid) === -1) return '본인을 필수 결재자에서 뺄 수 없습니다.';
  }
  if (section === 'company') {
    const c = state.company; if (c.name.length > 60 || c.ceo.length > 40 || c.bizNo.length > 30 || c.address.length > 200) return '글자 수가 너무 깁니다. (상호 60·대표자 40·사업자번호 30·주소 200자)';
  }
  if (section === 'guides') { const g = state.guides[key]; if (g.note.length > 100) return '메모는 100자 이내로 입력해 주세요.'; }
  return '';
}
