/* 근로자 상세 「경력관리」 카드의 입출력 — 서버 함수(careerAct)와 프로젝트 기록 읽기(파이어베이스 함수는 밖에서 주입, 시험: tests/hr-career-io.test.mjs).
 * 프로젝트 이력은 저장하지 않고 명단·공수 기록에서 계산한다(shared/career.js careerProjects). 읽기에 실패한 자료는 errors 에 이름을 담아 돌려준다. */
import { careerProjects, careerSummary } from '../../shared/career.js?v=20261113a';

export function makeCareerIo(fb) {
  const { db, collection, getDocs, getDoc, doc, query, where, call, callDeploy } = fb;   // callDeploy(선택): 서버 함수 deployAct — 직원 한 명의 투입 확인 현황(관리자 조회)
  /** 프로젝트별로 이 사람의 명단 문서와 공수 있는 날짜만 읽는다(공수 문서 id = 날짜, md 에 근로자 id → 공수). 시험 프로젝트 표시는 없으므로 모두 포함 */
  async function loadProjects(masterId, today) {
    const errors = []; const projects = [];
    let regs = []; try { const s = await getDocs(collection(db, 'pjt_registry')); s.forEach((d) => regs.push(Object.assign({ id: d.id }, d.data()))); } catch (e) { return { list: [], summary: careerSummary([]), errors: ['프로젝트 목록'] }; }
    await Promise.all(regs.map(async (r) => {
      const label = r.code || r.name || r.id; let w = null; const rows = [];
      try { const s = await getDoc(doc(db, 'pjt_registry/' + r.id + '/workers/' + masterId)); w = s.exists() ? s.data() : null; } catch (e) { errors.push(label + ' 명단'); }
      try { const s = await getDocs(query(collection(db, 'pjt_registry/' + r.id + '/manday'), where('md.' + masterId, '>', 0))); s.forEach((d) => { const md = (d.data() || {}).md || {}; rows.push([d.id, { [masterId]: md[masterId] }]); }); } catch (e) { errors.push(label + ' 공수'); }
      if (w || rows.length) projects.push({ key: r.id, name: label, ended: r.status === 'ended', roster: w ? { [masterId]: w } : {}, rows });
    }));
    const list = careerProjects(masterId, projects, { today }); const meta = {}; regs.forEach((r) => { meta[r.id] = r; }); list.forEach((x) => { const r = meta[x.pjtKey] || {}; x.client = String(r.client || ''); x.contractor = String(r.contractor || ''); });   // 이력서 프로젝트이력 표(발주처·시공사)용
    return { list, summary: careerSummary(list), errors };
  }
  /** 한 직원의 경력관리 자료: 서버 읽기 + 연명부 목록(연결 후보) + 연결돼 있으면 프로젝트 이력 */
  async function load(worker, today) {
    const data = (await call({ action: 'get', workerId: worker.id })); const errors = [];
    let masters = []; try { const s = await getDocs(collection(db, 'master_workers')); s.forEach((d) => { const x = d.data() || {}; masters.push({ id: d.id, name: x.name || '', birth: x.birth || '', resigned: !!x.resigned }); }); } catch (e) { errors.push('연명부 목록'); }
    let projects = null; if (data.masterId) { projects = await loadProjects(data.masterId, today); errors.push.apply(errors, projects.errors); }
    let deploy; if (callDeploy) { try { deploy = await loadDeploy(worker); } catch (e) { deploy = null; errors.push('투입 확인'); } }
    return { data, masters, projects, errors, deploy };
  }
  /** 외부용 소개서 자료(서버 deployAct provide — 동의한 프로젝트만, 제공 이력이 남음) + 그 직원의 프로젝트 이력(제공받는 자 칸용) */
  async function provide(worker, pjtId, masterId, today) {
    const data = await callDeploy({ action: 'provide', workerId: worker.id, pjtId }); let projects = { list: [] }; if (masterId) { try { projects = await loadProjects(masterId, today); } catch (e) { projects = { list: [] }; } }
    return { data, projects };
  }
  /** 직원 한 명의 투입 확인 현황(서버 deployAct adminList) — 연결 해제·연결 뒤에도 다시 읽는다 */
  async function loadDeploy(worker) { return callDeploy ? callDeploy({ action: 'adminList', workerId: worker.id }) : undefined; }
  const act = (action, worker, extra) => call(Object.assign({ action, workerId: worker.id }, extra || {}));
  return { load, loadProjects, loadDeploy, provide, act };
}
