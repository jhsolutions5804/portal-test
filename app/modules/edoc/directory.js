import { db, collection, doc, getDoc, getDocs } from '../../core/firebase.js?v=20261004k';

/* 작성 화면이 쓰는 기준 정보: 직원 명단, 정책(필수 결재자·대리 권한자), 권장 결재선, 프로젝트 */
let cache = null;
export async function loadDirectory(force) {
  if (cache && !force) return cache;
  const [us, pol, gd, pj] = await Promise.all([
    getDocs(collection(db, 'portal_users')),
    getDoc(doc(db, 'edoc_settings', 'policy')),
    getDoc(doc(db, 'edoc_settings', 'guides')),
    getDocs(collection(db, 'gihoek_projects'))
  ]);
  const users = [];
  us.forEach((d) => {
    const x = d.data();
    if (x.status !== 'approved') return;
    users.push({ uid: d.id, name: x.name || '', rank: x.rank || '', dept: x.dept || '', empNo: x.empNo || '', status: x.status, admin: x.admin === true });
  });
  users.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const policy = pol.exists() ? pol.data() : {};
  const projects = [];
  pj.forEach((d) => { const x = d.data(); if (x.status && x.status !== 'run') return; projects.push({ id: d.id, code: x.code || '', pjtCode: x.code || '', name: x.name || '' }); });
  projects.sort((a, b) => (a.code + a.name).localeCompare(b.code + b.name, 'ko'));
  cache = { users, policy: { required: Array.isArray(policy.required) ? policy.required : [], proxy: Array.isArray(policy.proxy) ? policy.proxy : [] }, guides: gd.exists() ? gd.data() : {}, projects };
  return cache;
}
export function resetDirectory() { cache = null; }
