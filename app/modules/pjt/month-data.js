/* 월간 공수 데이터 불러오기(공용) — 월간 공수 보기(연명부)와 내 팀 공수표가 같이 쓴다. 모든 프로젝트(종료 포함)가 pjt_registry/<id>/{workers,manday} 한 구조다.
 * 순수 집계는 roster-tools.js(aggregateMonth). 여기는 읽기만 한다. */
import { db, collection, getDocs, query, where, documentId } from '../../core/firebase.js?v=20261031a';
import { canAccessProject } from '../../shared/pjt-access.js?v=20261031a';
import { pathsFor } from './adapter.js?v=20261031a';
import { monthRange, endedYmOf } from './roster-tools.js?v=20261031a';
const ts = (d) => (d.createdAt && d.createdAt.seconds) || 0;
/** 프로젝트(종료 포함, 진행 중 먼저·등록 순)와 각 프로젝트 명단, 마스터 명부.
 *  me 를 주면 내가 열 수 있는 프로젝트만(연명부 도구), 안 주면 전체(팀장은 자기 팀의 공수를 모든 프로젝트에서 봐야 한다) → { projects:[{key,name,ended,roster,rows:[]}], masters:{id:{name,birth,leaderId,resigned,resignedDate}}, failed[] } */
export async function loadBase(me) {
  const failed = []; const regs = []; (await getDocs(collection(db, 'pjt_registry'))).forEach((d) => regs.push(Object.assign({}, d.data(), { id: d.id, name: d.data().name || 'PJT' })));
  const vis = regs.filter((r) => !me || canAccessProject(me, r)).sort((a, b) => ((a.status === 'ended') - (b.status === 'ended')) || (ts(a) - ts(b)));
  const projects = await Promise.all(vis.map(async (r) => { const roster = {}; try { (await getDocs(collection(db, pathsFor(r.id).roster))).forEach((d) => { const w = d.data(); roster[d.id] = { name: w.name || '', birth: w.birth || '' }; }); } catch (e) { failed.push(r.name + ' 명단'); } return { key: r.id, name: r.name, ended: r.status === 'ended', endedYm: endedYmOf(r.endedAt), doc: r, roster, rows: [] }; }));
  const masters = {}; try { (await getDocs(collection(db, 'master_workers'))).forEach((d) => { const w = d.data(); masters[d.id] = { name: w.name || '', birth: w.birth || '', leaderId: w.leaderId || '', resigned: !!w.resigned, resignedDate: w.resignedDate || '' }; }); } catch (e) { failed.push('마스터 명부'); }
  return { projects, masters, failed };
}
/** 그 달의 공수 문서를 각 프로젝트(p.rows)에 채우고 실패한 프로젝트 이름 목록을 돌려준다(문서 id 가 날짜라서 범위 조회) */
export async function loadRows(projects, y, m) {
  const { lo, hi } = monthRange(y, m); const failed = [];
  await Promise.all(projects.map(async (p) => { try { const rows = []; (await getDocs(query(collection(db, pathsFor(p.key).manday), where(documentId(), '>=', lo), where(documentId(), '<=', hi)))).forEach((d) => rows.push([d.id, d.data().md || {}])); p.rows = rows; } catch (e) { p.rows = []; failed.push(p.name + ' 공수'); } }));
  return failed;
}
