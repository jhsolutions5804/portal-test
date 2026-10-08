import { auth, db, doc, getDoc, getDocs, collection, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase.js?v=20261008g';
import { accessibleKeys } from '../shared/pjt-access.js?v=20261008g';
import { DOMAIN } from './config.js?v=20261008g';

export function authErrorMessage(code) {
  const m = {
    'auth/invalid-credential': '아이디 또는 비밀번호가 올바르지 않습니다.',
    'auth/wrong-password': '아이디 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '아이디 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.'
  };
  return m[code] || '로그인에 실패했습니다.';
}

export function buildMe(uid, email, data) {
  const empNo = typeof data.empNo === 'string' ? data.empNo.trim() : '';
  return {
    uid, email: email || data.email || '',
    name: data.name || '', rank: data.rank || '', dept: data.dept || '', empNo,
    admin: data.admin === true,
    isGuest: /^guest/i.test(empNo),
    perms: data.perms || {},
    teamLeaderIds: Array.isArray(data.teamLeaderIds) ? data.teamLeaderIds.slice() : []
  };
}

export async function login(idOrEmail, pw) {
  const id = String(idOrEmail || '').trim().toLowerCase();
  const email = id.includes('@') ? id : id + DOMAIN;
  await signInWithEmailAndPassword(auth, email, pw);
}
export function logout() { return signOut(auth); }

/** 종료되지 않은 프로젝트 중 이 사람이 접근할 수 있는 것의 key 목록(p4ph2·p4ph4·reg_<id>). 읽기에 실패하면 빈 목록(PJT 권한자는 perms.pjt 로 그대로 들어간다) */
export async function loadPjtAccess(me) {
  try {
    const [ss, rs] = await Promise.all([getDocs(collection(db, 'pjt_settings')), getDocs(collection(db, 'pjt_registry'))]); const projects = [];
    ss.forEach((d) => projects.push(Object.assign({ key: d.id }, d.data()))); rs.forEach((d) => projects.push(Object.assign({ key: 'reg_' + d.id }, d.data())));
    return accessibleKeys(me, projects.filter((p) => p.status !== 'ended'));
  } catch (e) { console.warn('프로젝트 접근 목록 읽기 실패', e); return []; }
}
/** 로그인 상태 구독. cb(me | null, reason). reason: 'signed-out' | 'not-registered' | 'not-approved' */
export function watchMe(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { cb(null, 'signed-out'); return; }
    try {
      const snap = await getDoc(doc(db, 'portal_users', user.uid));
      if (!snap.exists()) { await signOut(auth); cb(null, 'not-registered'); return; }
      const data = snap.data();
      if (data.status !== 'approved') { await signOut(auth); cb(null, 'not-approved'); return; }
      const me = buildMe(user.uid, user.email, data); me.pjtKeys = await loadPjtAccess(me); cb(me, 'ok');
    } catch (e) { console.error('내 정보 조회 오류', e); cb(null, 'error'); }
  });
}
