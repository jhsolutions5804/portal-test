import { db, collection, doc, getDoc, getDocs } from '../../core/firebase.js?v=20261031c';
import { partsEnabled } from './compose.js?v=20261031c';

/* 작성 화면이 쓰는 기준 정보: 직원 명단, 정책(필수 결재자·대리 권한자), 권장 결재선, 프로젝트 */
let cache = null;
export async function loadDirectory(force) {
  if (cache && !force) return cache;
  const [us, pol, gd, vh, pj, pt] = await Promise.all([
    getDocs(collection(db, 'portal_users')),
    getDoc(doc(db, 'edoc_settings', 'policy')),
    getDoc(doc(db, 'edoc_settings', 'guides')),
    getDoc(doc(db, 'edoc_settings', 'vehicles')).catch(() => null),   // 운행일지 차량 목록 — 없거나 못 읽어도 다른 문서 작성은 그대로
    getDocs(collection(db, 'gihoek_projects')),
  getDoc(doc(db, 'edoc_settings', 'parts')).catch(() => null) // 참여 프로젝트 스위치 — 없거나 못 읽으면 꺼짐(지금 쓰는 업무일지는 그대로)
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
  const partsOn = !!(pt && pt.exists && pt.exists() && partsEnabled(pt.data()));
  cache = { partsOn, users, policy: { required: Array.isArray(policy.required) ? policy.required : [], proxy: Array.isArray(policy.proxy) ? policy.proxy : [] }, guides: gd.exists() ? gd.data() : {}, projects, vehicles: vh && vh.exists() && Array.isArray(vh.data().list) ? vh.data().list.filter((x) => x && x.id && x.name) : [] };
  return cache;
}
export function resetDirectory() { cache = null; }
