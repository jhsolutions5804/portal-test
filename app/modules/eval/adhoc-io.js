/* 인사평가 — 수시평가 운영: 불러오기·저장·클릭/입력 처리.
 * 프로젝트 마진율(목표·실현)은 영업기획 프로젝트의 값을 읽기만 한다(입력·계산은 영업기획 → 프로젝트 상세).
 * 저장 위치(기존 관리자 전용 컬렉션 evaluations 안이라 보안 규칙 변경 없음):
 *   프로젝트 성과 = evaluations/_pjt/adhoc/{프로젝트 id}   (사장단의 프로젝트 성과 점수만)
 *   참여자 평가   = evaluations/{근로자}/adhoc/{프로젝트 id} (현장 항목·동료 점수·사장단의 개인 점수·확정) */
import { withManage } from '../../shared/eval-perm.js?v=20261030a';
import { setRating, evalAccess, adhocParticipants, emptyAdhoc, adhocSummary } from './evaluation.js?v=20261030a';
import { pjtSummary } from '../../shared/pjt-summary.js?v=20261030a';   // 청구·지급 집계(영업기획과 공용)
const clone = (o) => JSON.parse(JSON.stringify(o));
/** deps: { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, toast, confirmDialog, paint, st, ctx } */
export function createAdhocController(deps) {
  const { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, toast, confirmDialog, paint, st, ctx } = deps;
  const me = (ctx && ctx.me) || {};
  st.ad = { me, projects: [], sel: '', pdraft: null, msel: '', mdraft: null, recs: {}, loaded: false };
  const pPath = (pid) => 'evaluations/_pjt/adhoc/' + pid;
  const mPath = (wid, pid) => 'evaluations/' + wid + '/adhoc/' + pid;
  const rows = async (path) => { const s = await getDocs(collection(db, path)); const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  const load = async () => {
    const ad = st.ad; const reg = await rows('pjt_registry');
    let gp = [], gs = [], ge = []; try { gp = await rows('gihoek_projects'); gs = await rows('gihoek_settlements'); ge = await rows('gihoek_estimates'); } catch (e) { /* 영업기획 데이터를 못 읽어도 직접 입력으로 평가할 수 있다 */ }
    /* 영업기획에서 저장한 평가용 마진(서버 getEval) — 평가는 값(실현 마진율·확인일·추정 표시)만 받고 재무 상세는 못 본다. 권한이 없거나 서버가 없거나 응답이 이상해도 평가는 잠정으로 계속한다 */
    const evalSaved = {}; if (typeof deps.callMargin === 'function') { try { const r = await deps.callMargin({ action: 'getEval' }); if (r && r.ok === true && Array.isArray(r.items)) r.items.forEach((x) => { if (x && typeof x === 'object' && typeof x.pjtId === 'string' && x.pjtId && typeof x.actual === 'number' && Number.isFinite(x.actual)) evalSaved[x.pjtId] = { actual: x.actual, asOf: typeof x.asOf === 'string' ? x.asOf : '', estimated: x.estimated === true }; }); } catch (e) { /* 저장값 없이 잠정으로 */ } }
    const out = [];
    for (const r of reg) {
      const link = gp.find((p) => p.linkPjt === r.id); let snapshot = {}; let targetMargin = null; if (link) { const sm = pjtSummary(link.id, ge, gs); snapshot = { billed: sm.billed, done: sm.done, paid: sm.paid }; targetMargin = link.targetMargin == null ? null : link.targetMargin; }   // 마진율은 영업기획 프로젝트의 값을 읽기만 한다
      let roster = []; try { roster = await rows('pjt_registry/' + r.id + '/workers'); } catch (e) { roster = []; }
      let saved = null; try { const s = await getDoc(doc(db, pPath(r.id))); saved = s.exists() ? s.data() : null; } catch (e) { saved = null; }
      const memberWorkers = adhocParticipants(roster, st.evWorkers || []);
      out.push({ id: r.id, name: r.name || r.id, status: r.status === 'ended' ? 'ended' : 'active', linked: !!link, planId: link ? link.id : '', members: memberWorkers, memberWorkers, snapshot, evalMargin: evalSaved[r.id] || null, targetMargin, eval: { exec: (saved && saved.exec) || {} } });
    }
    out.sort((a, b) => (a.status === 'ended' ? 0 : 1) - (b.status === 'ended' ? 0 : 1) || String(a.name).localeCompare(String(b.name), 'ko'));
    ad.projects = out; ad.loaded = true;
  };
  const access = () => evalAccess(withManage(me), { id: '' }, {});
  const proj = () => (st.ad.projects || []).find((p) => p.id === st.ad.sel);
  const loadRecs = async (p) => { const recs = {}; await Promise.all((p.memberWorkers || []).map(async (w) => { try { const s = await getDoc(doc(db, mPath(w.id, p.id))); recs[w.id] = s.exists() ? s.data() : null; } catch (e) { recs[w.id] = null; } })); st.ad.recs = recs; };
  const saveProject = async () => {
    const ad = st.ad; const p = proj(); if (!p || !ad.pdraft) return; if (!access().edit) { toast('저장할 권한이 없습니다.'); return; }
    try { await setDoc(doc(db, pPath(p.id)), { pjtId: p.id, pjtName: p.name, exec: ad.pdraft.exec || {}, updatedAt: serverTimestamp(), updatedBy: me.uid || '' }, { merge: true }); p.eval = { exec: clone(ad.pdraft.exec || {}) }; toast('프로젝트 성과 점수를 저장했습니다.'); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  const saveMember = async () => {
    const ad = st.ad; const p = proj(); if (!p || !ad.mdraft) return; const a = access(); if (!a.edit && !a.confirm) { toast('저장할 권한이 없습니다.'); return; }
    try { await setDoc(doc(db, mPath(ad.msel, p.id)), Object.assign({}, ad.mdraft, { updatedAt: serverTimestamp(), updatedBy: me.uid || '' }), { merge: true }); ad.recs[ad.msel] = clone(ad.mdraft); toast('저장했습니다.'); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const ad = st.ad;
    const op = t.closest('[data-ad-open]'); if (op) { const p = (ad.projects || []).find((x) => x.id === op.getAttribute('data-ad-open')); if (!p) return true; ad.sel = p.id; ad.msel = ''; ad.mdraft = null; ad.pdraft = { exec: clone((p.eval && p.eval.exec) || {}) }; try { await loadRecs(p); } catch (e) { ad.recs = {}; } paint(); return true; }
    const sc = t.closest('[data-ad-score]'); if (sc) {
      if (!access().edit) return true; const [key, val] = sc.getAttribute('data-ad-score').split('|'); const n = Number(val);
      if (key === 'pexec') { ad.pdraft.exec = Object.assign({}, ad.pdraft.exec, { [me.uid || 'me']: { name: me.name || '', project: n } }); }
      else if (ad.mdraft && !ad.mdraft.confirmed) {
        if (key === 'person') ad.mdraft.exec = Object.assign({}, ad.mdraft.exec, { [me.uid || 'me']: { name: me.name || '', person: n } });
        else if (key.startsWith('item:')) { const k = key.slice(5); ad.mdraft.items = Object.assign({}, ad.mdraft.items, { [k]: n }); }
      }
      paint(); return true;
    }
    const mb = t.closest('[data-ad-member]'); if (mb) { const w = (proj().memberWorkers || []).find((x) => x.id === mb.getAttribute('data-ad-member')); if (!w) return true; ad.msel = w.id; ad.mdraft = clone(ad.recs[w.id] || emptyAdhoc(w, proj())); paint(); return true; }
    const ac = t.closest('[data-ad-act]'); if (!ac) return false; const act = ac.getAttribute('data-ad-act');
    if (act === 'back') { ad.sel = ''; ad.pdraft = null; ad.msel = ''; ad.mdraft = null; paint(); return true; }
    if (act === 'mback') { ad.msel = ''; ad.mdraft = null; paint(); return true; }
    if (act === 'psave') { await saveProject(); return true; }
    if (act === 'msave') { await saveMember(); return true; }
    if (act === 'mconfirm') { const a = access(); if (!a.confirm) { toast('수시 평가 확정은 대표만 할 수 있습니다.'); return true; } const sm = adhocSummary(ad.mdraft, ad.pdraft); if (sm.site == null || sm.exec == null) { toast('현장 점수와 사장단 점수가 모두 있어야 확정할 수 있습니다(항목·동료 2명 이상·사장단 점수).'); return true; } ad.mdraft.confirmed = true; await saveMember(); return true; }
    if (act === 'munconfirm') { if (!access().confirm) return true; const ok = await confirmDialog({ title: '확정 취소', body: '확정을 취소하고 다시 수정할 수 있게 합니다.', confirmLabel: '확정 취소' }); if (!ok.ok) return true; ad.mdraft.confirmed = false; await saveMember(); return true; }
    return false;
  };
  const onInput = () => false;   // 수시평가에는 숫자 입력칸이 없다(마진율은 영업기획에서 입력·계산, 여기서는 점수 버튼만)
  const onChange = (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.ad.mdraft) return false;
    if (t.matches('[data-ad-peer]')) { if (!access().edit || st.ad.mdraft.confirmed) return true; const [pid, idx] = t.getAttribute('data-ad-peer').split('|'); const cur = (st.ad.mdraft.peers && st.ad.mdraft.peers[pid]) ? st.ad.mdraft.peers[pid].slice() : [null, null, null]; const n = Number(t.value); cur[Number(idx)] = n >= 1 && n <= 5 ? n : null; st.ad.mdraft.peers = Object.assign({}, st.ad.mdraft.peers, { [pid]: cur }); paint(); return true; }
    return false;
  };
  return { load, onClick, onInput, onChange };
}
