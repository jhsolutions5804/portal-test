/* 내 평가 — 불러오기·저장·클릭/입력 처리. 읽는 것: 내 과제(eval_tasks/{연도}__{내 uid})·평가 회차(eval_cycles/{연도})·내 제출(eval_submissions, 내 uid 로 조회)·근로자 명부(이름·내 근로자 찾기).
 * 쓰는 것: 내 제출 문서 하나(eval_submissions/{연도}__{내 uid}__{대상}__{종류}) — 점수를 누르면 임시저장, 제출하면 잠긴다(보안 규칙이 같은 약속을 강제한다). */
import { tasksOf, statusOf, canSubmit, buildSubmission, withScore, withText, myWorker, subId, itemsOf } from './mine-logic.js?v=20261030a';
const clone = (o) => JSON.parse(JSON.stringify(o));
const DEBOUNCE_MS = 900;     // 서술은 입력이 멈춘 뒤 저장(느린 모바일 회선에서 글자마다 저장하지 않게)
/** deps: { db, collection, getDocs, getDoc, setDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx, year } */
export function createMineController(deps) {
  const { db, collection, getDocs, getDoc, setDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx } = deps; const me = (ctx && ctx.me) || {}; const year = deps.year || 2026;
  st.mine = { year, worker: null, cycle: null, tasks: [], subs: {}, sel: '', draft: null, dirty: false, saving: false, loaded: false, error: '' };
  let timer = null;
  const load = async () => {
    const m = st.mine; m.error = '';
    // 근로자 명부: 내 근로자와 대상 이름. 명부 읽기 권한이 없으면 이름은 "(이름 없음)"으로 보이고 계속 쓸 수 있다
    let workers = []; try { const ws = await getDocs(collection(db, 'workers')); ws.forEach((d) => workers.push(Object.assign({ id: d.id }, d.data()))); } catch (e) { workers = []; }
    m.worker = myWorker(me, workers); const names = {}; workers.forEach((w) => { names[w.id] = w.name || ''; });
    try { const c = await getDoc(doc(db, 'eval_cycles/' + year)); m.cycle = c.exists() ? c.data() : null; } catch (e) { m.cycle = null; }
    let taskDoc = null; try { const t = await getDoc(doc(db, 'eval_tasks/' + year + '__' + me.uid)); taskDoc = t.exists() ? t.data() : null; } catch (e) { m.error = '평가 과제를 불러오지 못했습니다.'; }
    m.tasks = tasksOf(taskDoc, names); m.subs = {};
    try { const s = await getDocs(query(collection(db, 'eval_submissions'), where('raterUid', '==', me.uid), where('year', '==', year))); s.forEach((d) => { const x = d.data(); if (x && x.targetWid && x.kind) m.subs[year + '__' + x.kind + '__' + x.targetWid] = x; }); } catch (e) { m.error = m.error || '내 제출 내용을 불러오지 못했습니다.'; }
    m.loaded = true;
  };
  const task = () => st.mine.tasks.find((t) => t.key === st.mine.sel);
  const editable = () => !!(st.mine.cycle && st.mine.cycle.status === 'open') && statusOf(st.mine.subs[st.mine.sel]) !== 'submitted';
  /** 저장(임시저장 또는 제출). 실패하면 화면에 그대로 알리고 저장된 것처럼 보이지 않는다 */
  const save = async (status, quiet) => {
    const m = st.mine; const t = task(); if (!t || !m.draft) return false; if (!editable()) { toast('지금은 저장할 수 없습니다.'); return false; }
    if (status === 'submitted') { const c = canSubmit(t.kind, m.draft); if (!c.ok) { toast(c.reason); return false; } }
    clearTimeout(timer); m.saving = true;
    try {
      await setDoc(doc(db, 'eval_submissions/' + subId(year, me.uid, t.target, t.kind)), buildSubmission(year, me.uid, t.target, t.kind, m.draft, status, serverTimestamp()));
      m.subs[t.key] = Object.assign({}, m.draft, { status, year, raterUid: me.uid, targetWid: t.target, kind: t.kind }); m.dirty = false; m.saving = false;
      if (!quiet) toast(status === 'submitted' ? '제출했습니다.' : '임시저장했습니다.'); return true;
    } catch (e) { m.saving = false; toast('저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.' + (e && e.code === 'permission-denied' ? ' (권한이 없습니다 — 평가 기간이거나 배정된 평가인지 확인해 주세요)' : '')); return false; }
  };
  const autosave = () => { const m = st.mine; m.dirty = true; clearTimeout(timer); timer = setTimeout(() => { save('draft', true); }, DEBOUNCE_MS); };
  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const m = st.mine;
    const op = t.closest('[data-ev-open]'); if (op) { const k = op.getAttribute('data-ev-open'); const tk = m.tasks.find((x) => x.key === k); if (!tk) return true; m.sel = k; m.draft = clone(m.subs[k] || { scores: {}, text: '' }); paint(); return true; }
    const sc = t.closest('[data-ev-score]'); if (sc) { if (!editable()) return true; const [key, val] = sc.getAttribute('data-ev-score').split('|'); m.draft = withScore(m.draft, key, Number(val)); paint(); await save('draft', true); return true; }   // 점수는 누르는 즉시 임시저장
    const ac = t.closest('[data-ev-act]'); if (!ac) return false; const act = ac.getAttribute('data-ev-act');
    if (act === 'back') { clearTimeout(timer); if (m.dirty && editable()) await save('draft', true); m.sel = ''; m.draft = null; paint(); return true; }
    if (act === 'save') { await save('draft', false); paint(); return true; }
    if (act === 'submit') {
      const tk = task(); if (!tk) return true; const c = canSubmit(tk.kind, m.draft); if (!c.ok) { toast(c.reason); return true; }
      const ok = await confirmDialog({ title: '제출할까요?', body: '제출하면 수정할 수 없습니다.' + (tk.kind === 'peer' ? ' 동료평가는 익명으로 처리됩니다.' : ''), confirmLabel: '제출' }); if (!ok || !ok.ok) return true;
      if (await save('submitted', false)) { m.sel = ''; m.draft = null; } paint(); return true;
    }
    return false;
  };
  const onInput = (ev) => { const t = ev.target; if (!(t instanceof Element) || !t.matches('[data-ev-text]')) return false; if (!editable()) return true; st.mine.draft = withText(st.mine.draft, t.value); autosave(); return true; };
  return { load, onClick, onInput, flush: async () => { clearTimeout(timer); if (st.mine.dirty && st.mine.sel && editable()) await save('draft', true); } };
}
