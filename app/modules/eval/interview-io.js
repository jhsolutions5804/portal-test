/* 인사평가 면담 — 불러오기·저장·클릭/입력 처리. 읽는 것: 근로자 명부(평가 대상자), interviews/{근로자}/evidence·review, 직원 자기평가(eval_submissions kind=self → 없으면 evaluations/{근로자}/cycles/{연도}.self).
 * 쓰는 것: 모두 관리자 전용 interviews/{근로자} 아래(새 보안 규칙 없음 — 컬렉션 interviews 의 기존 관리자 전용 규칙이 보호). 완료 처리하면 interviews/{근로자}/records/eval-{연도} 에 인사 면담 이력 한 건을 남긴다.
 * deps: { db, collection, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx, year?, today?, openWindow? } */
import { isEvalTarget } from './evaluation.js?v=20261109i';
import { sortByEmpNo } from '../../shared/worker-order.js?v=20261109i';
import { resultPrintHtml } from './result-report.js?v=20261109i';
import { reviewHtml, reviewPrintTitle } from './interview-report.js?v=20261109i';
import { evalYearNow, kstToday, evidencePath, reviewDocPath, hrRecordPath, reviewFromDoc, prepOf, newEvidence, buildEvidence, buildReview, hrRecordOf, rowSummary, reviewStatusOf, evidenceSorted } from './interview-logic.js?v=20261109i';

const msgOf = (e) => (e && e.code === 'permission-denied' ? '권한이 없습니다(관리자 계정이 필요합니다).' : String((e && e.message) || ''));
export function createInterviewController(deps) {
  const { db, collection, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx } = deps;
  const me = (ctx && ctx.me) || {}; const year = deps.year || evalYearNow(); const today = deps.today || kstToday();
  st.iv = { year, today, rows: [], workers: [], loaded: false, error: '', sel: '', d: null };
  const ms = (x) => (x && x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0);
  const loadEvidence = async (wid) => { const s = await getDocs(collection(db, evidencePath(wid))); const l = []; s.forEach((x) => { const v = x.data(); if (!v || Number(v.evalYear) !== year) return; l.push(Object.assign({ id: x.id }, v, { createdMs: ms(v) })); }); return evidenceSorted(l); };
  const loadReview = async (wid) => { const s = await getDoc(doc(db, reviewDocPath(wid, year))); return s.exists() ? reviewFromDoc(s.data(), me) : reviewFromDoc(null, me); };
  /** 직원 자기평가 — 직원이 낸 제출(eval_submissions, kind=self)을 먼저, 없으면 사장단이 대신 입력해 둔 값(evaluations/{근로자}/cycles/{연도}.self) */
  const loadSelf = async (wid) => {
    try { const s = await getDocs(query(collection(db, 'eval_submissions'), where('year', '==', year), where('kind', '==', 'self'), where('targetWid', '==', wid))); let hit = null; s.forEach((x) => { const v = x.data(); if (!hit || (v && v.status === 'submitted')) hit = v; }); if (hit && String(hit.text || '').trim()) return { text: hit.text, status: hit.status === 'submitted' ? 'submitted' : 'draft', source: 'staff' }; } catch (e) { /* 아래에서 사장단 입력 값을 본다 */ }
    try { const c = await getDoc(doc(db, 'evaluations/' + wid + '/cycles/' + year)); const v = c.exists() ? c.data() : null; if (v && v.self && String(v.self.text || '').trim()) return { text: v.self.text, status: 'submitted', source: 'admin' }; } catch (e) { /* 없음 */ }
    return null;
  };
  const rowOf = async (w) => { let ev = [], rv = null; try { ev = await loadEvidence(w.id); } catch (e) { st.iv.error = st.iv.error || '불러오지 못했습니다: ' + msgOf(e); } try { rv = await loadReview(w.id); } catch (e) { st.iv.error = st.iv.error || '불러오지 못했습니다: ' + msgOf(e); } return rowSummary(w, ev, rv); };
  const load = async () => {
    const ws = await getDocs(collection(db, 'workers')); const all = []; ws.forEach((x) => all.push(Object.assign({ id: x.id }, x.data())));
    st.iv.workers = sortByEmpNo(all.filter((w) => w.name && isEvalTarget(w, year))); st.iv.rows = await Promise.all(st.iv.workers.map(rowOf)); st.iv.loaded = true;
  };
  const open = async (wid) => {
    const w = st.iv.workers.find((x) => x.id === wid); if (!w) return;
    try { const [evidence, rv, self] = await Promise.all([loadEvidence(wid), loadReview(wid), loadSelf(wid)]); st.iv.d = { worker: w, evidence, rv, self, ef: newEvidence(today), busy: false, today }; st.iv.sel = wid; paint(); if (typeof window !== 'undefined') window.scrollTo(0, 0); }
    catch (e) { toast('불러오지 못했습니다: ' + msgOf(e)); }
  };
  const back = async () => { const d = st.iv.d; if (d) { try { const i = st.iv.rows.findIndex((r) => r.id === d.worker.id); if (i >= 0) st.iv.rows[i] = rowSummary(d.worker, d.evidence, d.rv); } catch (e) { /* 목록은 다시 열 때 갱신 */ } } st.iv.sel = ''; st.iv.d = null; paint(); if (typeof window !== 'undefined') window.scrollTo(0, 0); };
  const busy = async (fn) => { const d = st.iv.d; if (!d || d.busy) return; d.busy = true; paint(); try { await fn(d); } catch (e) { toast('저장하지 못했습니다: ' + msgOf(e)); } d.busy = false; paint(); };
  const stampBody = () => ({ updatedAt: serverTimestamp(), updatedBy: me.uid || '', updatedByName: me.name || '' });

  const addEvidence = () => busy(async (d) => {
    const r = buildEvidence(d.ef, today, year); if (!r.ok) { toast(r.errors[0]); return; }
    await addDoc(collection(db, evidencePath(d.worker.id)), Object.assign({}, r.data, { createdAt: serverTimestamp(), createdBy: me.uid || '', createdByName: me.name || '' }));
    d.evidence = await loadEvidence(d.worker.id); d.ef = Object.assign(newEvidence(today), { date: d.ef.date, tone: d.ef.tone }); toast('근거 메모를 추가했습니다.');
  });
  const delEvidence = async (id) => {
    const d = st.iv.d; if (!d) return; const ok = await confirmDialog({ title: '근거 메모 삭제', body: '이 근거 메모를 삭제합니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok || !ok.ok) return;
    await busy(async (dd) => { await deleteDoc(doc(db, evidencePath(dd.worker.id) + '/' + id)); dd.evidence = await loadEvidence(dd.worker.id); toast('삭제했습니다.'); });
  };
  const saveReview = (status) => busy(async (d) => {
    const r = buildReview({ prep: d.rv.prep, record: d.rv.record }, status, today, year); if (!r.ok) { toast(r.errors[0]); return; }
    const body = Object.assign({}, r.data, stampBody()); if (status === 'done') body.doneAt = serverTimestamp();
    await setDoc(doc(db, reviewDocPath(d.worker.id, year)), body);
    if (status === 'done') await setDoc(doc(db, hrRecordPath(d.worker.id, year)), Object.assign(hrRecordOf(r.data.record, year, me.name), { createdAt: serverTimestamp() })); // 인사 근로자 면담 이력에도 한 건(같은 id 라 다시 저장해도 한 건)
    d.rv = reviewFromDoc(r.data, me); toast(status === 'done' ? '면담을 완료 처리했습니다. 인사 면담 이력에도 남았습니다.' : '임시저장했습니다.');
  });
  const reopen = async () => {
    const d = st.iv.d; if (!d) return; const ok = await confirmDialog({ title: '완료 취소', body: '완료를 취소하고 작성 중으로 되돌립니다. 인사 면담 이력의 이 면담 기록도 함께 지웁니다.', confirmLabel: '완료 취소', variant: 'danger' }); if (!ok || !ok.ok) return;
    await busy(async (dd) => { const r = buildReview({ prep: dd.rv.prep, record: dd.rv.record }, 'draft', today, year); if (!r.ok) { toast(r.errors[0]); return; } await setDoc(doc(db, reviewDocPath(dd.worker.id, year)), Object.assign({}, r.data, stampBody())); await deleteDoc(doc(db, hrRecordPath(dd.worker.id, year))); dd.rv = reviewFromDoc(r.data, me); toast('완료를 취소했습니다.'); });
  };
  const togglePrep = (key, on) => busy(async (d) => {
    const prep = prepOf(Object.assign({}, d.rv.prep, { [key]: !!on })); await setDoc(doc(db, reviewDocPath(d.worker.id, year)), Object.assign({ evalYear: year, prep, status: d.rv.status }, stampBody()), { merge: true });
    d.rv = Object.assign({}, d.rv, { exists: true, prep });
  });
  const print = () => {
    const d = st.iv.d; if (!d) return; const data = { year, worker: { name: d.worker.name, dept: d.worker.dept, rank: d.worker.rank }, record: d.rv.record, status: reviewStatusOf(d.rv) };
    try { const w = (deps.openWindow || ((u, n) => window.open(u, n)))('', '_blank'); if (!w) { toast('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러 주세요.'); return; } w.document.write(resultPrintHtml(reviewHtml(data), reviewPrintTitle(data))); w.document.close(); } catch (e) { toast('인쇄 창을 열지 못했습니다. 팝업을 허용했는지 확인해 주세요.'); }
  };

  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false;
    const op = t.closest('[data-iv-open]'); if (op) { await open(op.getAttribute('data-iv-open')); return true; }
    const d = st.iv.d; if (!d) return false;
    const tn = t.closest('[data-iv-tone]'); if (tn) { d.ef.tone = tn.getAttribute('data-iv-tone'); paint(); return true; }
    const dl = t.closest('[data-iv-ev-del]'); if (dl) { await delEvidence(dl.getAttribute('data-iv-ev-del')); return true; }
    const ac = t.closest('[data-iv-act]'); if (!ac) return false; const act = ac.getAttribute('data-iv-act');
    if (act === 'back') { await back(); return true; } if (act === 'ev-add') { await addEvidence(); return true; }
    if (act === 'rv-save') { await saveReview('draft'); return true; } if (act === 'rv-done') { await saveReview('done'); return true; }
    if (act === 'rv-reopen') { await reopen(); return true; } if (act === 'rv-print') { print(); return true; }
    return false;
  };
  const onInput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const d = st.iv.d; if (!d) return false;
    if (t.matches('[data-iv-ef]')) { d.ef[t.getAttribute('data-iv-ef')] = t.value; return true; }
    if (t.matches('[data-iv-rf]')) { d.rv.record[t.getAttribute('data-iv-rf')] = t.value; return true; }
    return false;
  };
  const onChange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; if (t.matches('[data-iv-prep]')) { await togglePrep(t.getAttribute('data-iv-prep'), t.checked); return true; }
    return onInput(ev);
  };
  return { load, open, onClick, onInput, onChange };
}
