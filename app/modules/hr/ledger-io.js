/* 임금대장 입출력 — 급여명세서·명부·출퇴근 기록을 읽어 임금대장을 만들고 마감·해제를 저장한다.
 * 파이어베이스 함수는 밖에서 주입받는다(시험은 가짜 저장소로: tests/hr-ledger-io.test.mjs). 마감 후 수정 차단·권한은 서버 보안 규칙이 강제한다(설계서 payroll-ledger-design.md, 규칙 시험 payroll_close.test.mjs). */
import { isYm, ledgerRow, closeChecks, closeDoc, versionDoc, unlockPatch, isClosed } from './ledger.js?v=20261031d';

export function makeLedgerIo(fb) {
  const { db, doc, getDoc, getDocs, collection, query, where, updateDoc, writeBatch, serverTimestamp } = fb;
  const lst = (snap) => { const a = []; snap.forEach((d) => a.push(Object.assign({ id: d.id }, d.data()))); return a; };
  const closeRef = (ym) => doc(db, 'payroll_close', ym);
  const readClose = async (ym) => { const s = await getDoc(closeRef(ym)); return s.exists() ? s.data() : null; };
  const order = (a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz')) || String(a.name || '').localeCompare(String(b.name || ''));
  const whoOf = (by) => { const w = String(by || '').trim().toLowerCase(); if (!w) throw new Error('작업하는 사람의 이메일을 알 수 없습니다. 다시 로그인해 주세요.'); return w; };

  /** 직원 목록(명부 + 비공개 명부 합침 — 급여명세서 화면과 같은 방식). 퇴사자도 포함한다(그 달에 급여를 받았을 수 있다) */
  async function loadWorkers() {
    const [wsn, psn] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'worker_private')).catch(() => null)]);
    const priv = new Map(); if (psn) psn.forEach((d) => priv.set(d.id, d.data()));
    return lst(wsn).map((w) => Object.assign({}, w, priv.get(w.id) || {}));
  }

  /** 한 달 임금대장 — 급여명세서가 있는 직원마다 한 줄. 읽기에 실패하면 빈 표로 보이지 않도록 예외를 그대로 던진다 */
  async function loadMonth(ym) {
    if (!isYm(ym)) throw new Error('귀속월이 올바르지 않습니다.');
    const workers = await loadWorkers();
    const found = await Promise.all(workers.map(async (w) => { const s = await getDoc(doc(db, 'payslips/' + w.id + '/months', ym)); return s.exists() ? Object.assign({}, s.data(), { workerId: w.id }) : null; }));
    const slips = {}; workers.forEach((w, i) => { if (found[i]) slips[w.id] = found[i]; });
    const dayMap = {};
    await Promise.all(workers.filter((w) => slips[w.id] && (slips[w.id].workDays === undefined || slips[w.id].workDays === null)).map(async (w) => {
      const snap = await getDocs(query(collection(db, 'worker_attendance_log'), where('workerId', '==', w.id), where('yearMonth', '==', ym)));
      const days = new Set(); snap.forEach((d) => { const x = d.data(); if (x && x.date) days.add(x.date); }); dayMap[w.id] = days.size ? days.size : null; }));
    const rows = workers.filter((w) => slips[w.id]).sort(order).map((w) => ledgerRow(slips[w.id], w, dayMap[w.id]));
    const checks = closeChecks(ym, workers, slips, rows);
    return { ym, workers, slips, rows, checks, close: await readClose(ym) };
  }

  /** 마감 — 누르는 순간 다시 읽어(화면을 열어 둔 사이 바뀐 값 방지) 점검을 통과해야 한다. 스냅샷(versions/{n})과 마감 문서를 한 번에 저장 */
  async function closeMonth(ym, loaded, by) {
    const who = whoOf(by);
    if (!loaded || loaded.ym !== ym) throw new Error('불러온 내용이 이 달이 아닙니다. 다시 불러와 주세요.');
    const fresh = await loadMonth(ym);
    if (!fresh.checks.ok) throw new Error('점검을 통과하지 못했습니다: ' + fresh.checks.blockers.map((b) => b.msg).join(' / '));
    if (isClosed(fresh.close)) throw new Error('이미 마감된 달입니다.');
    const version = fresh.close ? Number(fresh.close.version) + 1 : 1;
    const batch = writeBatch(db);
    batch.set(doc(db, 'payroll_close/' + ym + '/versions', String(version)), versionDoc(ym, fresh.rows, version, who, serverTimestamp()));
    batch.set(closeRef(ym), closeDoc(ym, fresh.rows, fresh.checks, who, serverTimestamp(), version, fresh.close));
    await batch.commit();
    return { version, count: fresh.rows.length, warnings: fresh.checks.warnings.length };
  }

  /** 마감 해제 — 사유 필수, 이력 한 줄 추가. 규칙이 관리자 + 인사 일정 담당자만 허용한다 */
  async function unlockMonth(ym, by, reason) {
    const who = whoOf(by); const cur = await readClose(ym);
    const r = unlockPatch(cur, who, reason, new Date().toISOString()); if (!r.ok) throw new Error(r.error);
    await updateDoc(closeRef(ym), r.patch); return true;
  }
  return { loadMonth, closeMonth, unlockMonth };
}
