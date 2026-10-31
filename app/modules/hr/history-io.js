/* 인사 이력 입출력 — 한 직원의 이력 자료를 읽는다(파이어베이스 함수는 밖에서 주입, 시험: tests/hr-history-io.test.mjs). 새로 저장하는 것은 없다.
 * 읽기에 실패한 자료는 errors 에 이름을 담아 돌려준다 — 빈 칸으로 숨기지 않고 화면이 "일부를 불러오지 못했습니다"로 알린다. */
import { buildHistory } from './history.js?v=20261031c';

export function makeHistoryIo(fb) {
  const { db, collection, getDocs, query, where } = fb;
  const lst = (s) => { const a = []; s.forEach((d) => a.push(Object.assign({ id: d.id }, d.data()))); return a; };
  /** worker: 명부 문서(id·name 필요). 반환: { items, skipped, errors:[읽지 못한 자료 이름] } */
  async function load(worker) {
    const w = worker || {}; const id = w.id; const errors = [];
    if (!id) return { items: [], skipped: 0, errors: ['직원 번호 없음'] }; // 번호 없이 읽으면 'undefined' 라는 이름의 경로를 읽게 된다
    const rd = async (label, fn) => { try { return lst(await fn()); } catch (e) { errors.push(label); return []; } };
    const nm = String(w.name || '');
    const [annual, labor, changes, interviews, evals, severance, promos, payslips, dismissals, sends, leaves, resigns] = await Promise.all([
      rd('연봉계약서', () => getDocs(collection(db, 'annual_contracts/' + id + '/contracts'))),
      rd('근로계약서', () => getDocs(collection(db, 'labor_contracts/' + id + '/contracts'))),
      rd('인사 변동', () => getDocs(collection(db, 'workers/' + id + '/history'))),
      rd('면담', () => getDocs(collection(db, 'interviews/' + id + '/records'))),
      rd('평가', () => getDocs(collection(db, 'evaluations/' + id + '/records'))),
      rd('퇴직 정산', () => getDocs(collection(db, 'severance/' + id + '/records'))),
      rd('연차촉진', () => getDocs(collection(db, 'leave_promotions/' + id + '/records'))),
      rd('급여명세서', () => getDocs(collection(db, 'payslips/' + id + '/months'))),
      rd('해고예고', () => getDocs(query(collection(db, 'dismissal_notices'), where('workerId', '==', id)))),
      rd('서류 발송', () => getDocs(query(collection(db, 'doc_send_log'), where('workerId', '==', id)))),
      nm ? rd('연차·휴가', () => getDocs(query(collection(db, 'edoc_leave'), where('authorName', '==', nm)))) : Promise.resolve([]),
      nm ? rd('퇴직원서', () => getDocs(query(collection(db, 'edoc_resign'), where('authorName', '==', nm)))) : Promise.resolve([])
    ]);
    const r = buildHistory({ worker: w, annual, labor, changes, interviews, evals, severance, promos, payslips, dismissals, sends, leaves, resigns });
    return { items: r.items, skipped: r.skipped, errors };
  }
  return { load };
}
