/* 인사평가 — 정기평가 운영: 불러오기·저장·클릭/입력 처리. 저장 위치 = evaluations/{근로자}/cycles/{연도} (기존 관리자 전용 컬렉션 안이라 보안 규칙 변경 없음, 설계서 docs/hr-evaluation-design.md) */
import { withManage } from '../../shared/eval-perm.js?v=20261031a';
import { isEvalTarget, emptyCycle, setRating, evalAccess, cycleSummary, areaItems, teamTypeOf, saveBody } from './evaluation.js?v=20261031a';
const clone = (o) => JSON.parse(JSON.stringify(o));
/** deps: { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, toast, confirmDialog, paint, st, ctx } */
export function createCycleController(deps) {
  const { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, toast, confirmDialog, paint, st, ctx } = deps;
  const me = (ctx && ctx.me) || {};
  st.ec = { year: 2026, me, meWorkerId: '', eligible: [], cycles: {}, users: [], sel: '', draft: null, loaded: false };
  const path = (wid) => 'evaluations/' + wid + '/cycles/' + st.ec.year;
  const load = async () => {
    const ec = st.ec;
    const us = await getDocs(collection(db, 'portal_users')); const users = []; us.forEach((d) => users.push(Object.assign({ uid: d.id }, d.data()))); ec.users = users;
    ec.eligible = (st.evWorkers || []).filter((w) => isEvalTarget(w, ec.year)); ec.cycles = {};
    await Promise.all(ec.eligible.map(async (w) => { try { const s = await getDoc(doc(db, path(w.id))); ec.cycles[w.id] = s.exists() ? s.data() : null; } catch (e) { ec.cycles[w.id] = null; } }));
    const mine = (st.evWorkers || []).find((w) => (w.portalUid && w.portalUid === me.uid) || (w.empNo && me.empNo && String(w.empNo) === String(me.empNo))); ec.meWorkerId = mine ? mine.id : ''; ec.loaded = true;
  };
  const access = () => evalAccess(withManage(me), { id: st.ec.sel }, {});
  const target = () => (st.ec.eligible || []).find((w) => w.id === st.ec.sel);
  const save = async () => {
    const ec = st.ec; const w = target(); if (!w || !ec.draft) return; const a = access();
    if (!a.edit && !a.confirm) { toast('평가를 저장할 권한이 없습니다.'); return; }
    try { await setDoc(doc(db, path(w.id)), Object.assign(saveBody(ec.draft), { updatedAt: serverTimestamp(), updatedBy: me.uid || '' }), { merge: true }); ec.cycles[w.id] = clone(ec.draft); toast('저장했습니다.'); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  /** 클릭 처리: 처리했으면 true */
  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const ec = st.ec;
    const op = t.closest('[data-ec-open]'); if (op) { const wid = op.getAttribute('data-ec-open'); const w = (ec.eligible || []).find((x) => x.id === wid); if (!w) return true; ec.sel = wid; ec.draft = clone(ec.cycles[wid] || emptyCycle(w, ec.year)); paint(); return true; }
    const sc = t.closest('[data-ec-score]'); if (sc) {
      const a = access(); if (!a.edit || ec.draft.confirmed) return true; const [key, idx, val] = sc.getAttribute('data-ec-score').split('|'); const [who, area] = key.split(':');
      if (who === 'team') ec.draft.team = Object.assign({}, ec.draft.team, { by: me.uid || '', areas: setRating(ec.draft.team && ec.draft.team.areas, area, Number(idx), Number(val)) });
      else { ec.draft.exec = ec.draft.exec || {}; const cur = ec.draft.exec[me.uid || 'me'] || { name: me.name || '', areas: null }; const w = target(); const base = cur.areas || emptyCycle(w, ec.year).team.areas; ec.draft.exec[me.uid || 'me'] = { name: me.name || '', areas: setRating(base, area, Number(idx), Number(val)) }; }
      paint(); return true;
    }
    const ac = t.closest('[data-ec-act]'); if (!ac) return false; const act = ac.getAttribute('data-ec-act');
    if (act === 'back') { ec.sel = ''; ec.draft = null; paint(); return true; }
    if (act === 'save') { await save(); return true; }
    if (act === 'approve' || act === 'confirm') {
      const a = access(); if (!a.confirm) { toast('최종 확정은 대표만 할 수 있습니다.'); return true; } const w = target(); const sm = cycleSummary(ec.draft, { teamType: teamTypeOf(w.dept), items: areaItems(w.dept, w.rank) });
      if (sm.teamScore == null) { toast('팀 점수가 아직 완성되지 않았습니다(모든 항목과 동료평가가 필요합니다).'); return true; }
      if (act === 'approve') ec.draft.ceo = Object.assign({}, ec.draft.ceo, { approved: true, score: null });
      else { const n = Number(ec.draft.ceo && ec.draft.ceo.score); if (!(isFinite(n) && n >= 0 && n <= 100) || ec.draft.ceo.score === '' || ec.draft.ceo.score == null) { toast('대표 점수를 0~100 사이로 입력해 주세요.'); return true; } ec.draft.ceo = Object.assign({}, ec.draft.ceo, { approved: false, score: n }); }
      ec.draft.confirmed = true; ec.draft.ceo.by = me.uid || ''; await save(); return true;
    }
    if (act === 'unconfirm') { const a = access(); if (!a.confirm) return true; const ok = await confirmDialog({ title: '확정 취소', body: '확정을 취소하고 다시 수정할 수 있게 합니다.', confirmLabel: '확정 취소' }); if (!ok.ok) return true; ec.draft.confirmed = false; await save(); return true; }
    return false;
  };
  const onInput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const ec = st.ec; if (!ec.draft) return false;
    if (t.matches('[data-ec-self]')) { ec.draft.self = { text: t.value }; return true; }
    const c = t.matches('[data-ec-ceo]') ? t.getAttribute('data-ec-ceo') : ''; if (c) { ec.draft.ceo = Object.assign({}, ec.draft.ceo, { [c]: t.value }); return true; }
    return false;
  };
  const onChange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const ec = st.ec; if (!ec.draft) return false;
    return false;
  };
  return { load, onClick, onInput, onChange };
}
