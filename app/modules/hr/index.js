import { auth, functions, httpsCallable, getDoc, db, orderBy, limit, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, query, where, serverTimestamp, writeBatch } from '../../core/firebase.js?v=20261031c';
import { confirmDialog } from '../../core/dialog.js?v=20261031c';
import { IS_TEST } from '../../core/config.js?v=20261031c';
import { holidayName } from '../../shared/holidays.js?v=20261031c';
import { esc, toast } from '../../core/ui.js?v=20261031c';
import { retireLeavePay, retireCalc } from './retire.js?v=20261031c';
import { homeStats, fitSize, validateSeal, SEAL_MAX_BYTES } from './home.js?v=20261031c';
import { saveJumin, revealJumin, maskedView } from './identity.js?v=20261031c';
import { lpTargets, lpFormNew, lpFormCtx, lpValidateIssue, lpBuildRecord, lpReplyUpdate, lpReceivedUpdate, lpDay, LP_STAGE } from './leave-promo.js?v=20261031c';
import { configureLeavePromoDocs, leavePromoHtmlByVer } from './leave-promo-docs.js?v=20261031c';
import { weekdayDays, defaultDays, adminLeaveNew, adminLeaveFromDoc, buildAdminLeave, entryEditFromDoc, buildEntryEdit } from './leave-admin.js?v=20261031c';
import { createDocLink, syncSignedLinks, loadSendLog, showLinkModal, sendDocLinkByEmail } from './sign-io.js?v=20261031c';
import { annualNewForm, annualEnd, annualFillFromWorker, annualValidate, annualRecord, annualContractId, annualSummary, payBasisChange, payValueInput } from './annual.js?v=20261031c';
import { annualSalary } from './offer.js?v=20261031c';
import { __ANNUAL_TPL, __LABOR_TPL } from './frozen-docs.js?v=20261031c';
import { laborNewForm, laborFillFromWorker, laborRecord } from './labor.js?v=20261031c';
import { psPayDate, techAllowance, attendanceData, travelFromTrips, travelTotal, travelSet, payslipRecord } from './payslip.js?v=20261031c';
import { docHtmlByVer } from './frozen-docs.js?v=20261031c';
import { configureLaborDocs, laborDocHtml, annualDocHtml } from './labor-doc.js?v=20261031c';
import { v7Check, v7Calc, v7HourlyFromPay, periodTypeOf, MAX_EXTRA } from './contract-v7.js?v=20261031c';
import { c7SumHtml } from './contract-v7-view.js?v=20261031c';
import { shortInit, shortCheck, shortRecord, SHORT_SIGN_ERROR } from './short-doc.js?v=20261031c';
import { shortSummaryHtml } from './short-view.js?v=20261031c';
import { psHtml } from './payslip-doc.js?v=20261031c';
import { buildAttRecord, attDefaultBreak, attKey, holidaySetOf } from './attendance.js?v=20261031c';
import { readSpreadsheet } from '../../shared/xls-read.js?v=20261031c';
import { makeCapsIo, capsActions } from './caps-io.js?v=20261031c';
import { otYm, otMoveMonth, otSyncPlan, otWage, otNewForm, otFormFromRecord, buildOvertime, otAmount } from './overtime.js?v=20261031c';
import { dsNewForm, dsFindHourly, dsCalc, dsValidate, dsBuildData, dsFormFromDraft, dsHtmlByVer } from './dismissal.js?v=20261031c';
import { offerNewForm, offerCalc, offerSwitchMode, offerPayload, offerFormFromSaved, offerCalendar, offerFillCurrent, offerBuildHtml } from './offer.js?v=20261031c';
import { certsFromWorker, mergeWorker, salNormalize, salRegenerate, salSetField, salSetTenure, salEditCell, appStatusOf, joinInterview, splitInterview, interviewCalendar, prefillFromApplicant, resumePrintHtml, NEW_EVAL, buildEval, evalLatestRegular, buildStepInput, hcMove, hcMonthRange, hcValidate, hcExpandLeaves, hcResignPlan, rrqFindWorker, resignPrintHtml, rrqKindOf, NEW_INTERVIEW, buildInterview, latestInterview, JOB_HOME_BASE, jobHomeBase, jobCompose, jobFormOf, buildJob, normalizeOpt, buildChange, salaryEvents, historyEvent, leaveRows, kstToday, WP_FIELDS, buildEdit, stepNow, NEW_FORM, buildNew, newWorkerId, buildResign, resignAccountPlan, resignSyncMessage, linkCandidate } from './logic.js?v=20261031c';
import { listHtml, tableHtml, leaveHtml, changeHtml, postingsHtml, interviewsHtml, resignReqHtml, calendarHtml, evalsHtml, applicantsHtml, salaryHtml, offersHtml, offerResultHtml, offerStateText, retireHtml, dismissalHtml, dsCalcHtml, attendCalHtml, payslipHtml2, payslipCalcOf, annualHtml, laborHtml, leavePromoHtml, homeHtml, homeSealHtml, homeListHtml, homeAlertHtml, homeKpiHtml } from './view.js?v=20261031c';
import { openDocWindow, withDocTitle } from '../../shared/doc-title.js?v=20261031c';
import { makeLedgerIo } from './ledger-io.js?v=20261031c';
import { makeWeeklyIo } from './weekly-io.js?v=20261031c';
import { weeklyReport, weekStart as wkStart } from './weekly.js?v=20261031c';
import { weeklyHomeHtml } from './weekly-view.js?v=20261031c';
import { renewItems } from './renew.js?v=20261031c';
import { makeInsuranceIo } from './insurance-io.js?v=20261031c';
import { insurancePageHtml } from './insurance-view.js?v=20261031c';
import { insuranceShellHtml } from './insurance-edi-view.js?v=20261031c';
import { makeEdiIo, ediActions, copyToClipboard } from './insurance-edi-io.js?v=20261031c';
import { makePurgeIo } from './recruit-purge-io.js?v=20261031c';
import { purgeReport } from './recruit-purge.js?v=20261031c';
import { purgeHomeHtml } from './recruit-purge-view.js?v=20261031c';
import { workforceStats } from './workforce.js?v=20261031c';
import { workforceHtml } from './workforce-view.js?v=20261031c';
import { makeHistoryIo } from './history-io.js?v=20261031c';
import { historyInnerHtml, historyPrintHtml } from './history-view.js?v=20261031c';
import { ledgerPageHtml } from './ledger-view.js?v=20261031c';
import { isYm, ledgerCsv, ledgerHtml } from './ledger.js?v=20261031c';
import { contractDocTitle, payslipDocTitle, dismissalDocTitle, resignDocTitle, leavePromoDocTitle, offerDocTitle, resumeDocTitle } from './doc-titles.js?v=20261031c';

/** 인사(플랫폼 기본 모듈): 근로자 명부 새 화면. 인사총무 틀 안의 구역으로만 열린다(modules/index.js 의 hostNative). 구포털 인사 화면은 그대로 두고 하나씩 옮기는 중이다. 관리자 전용 */
/** 다른 모듈이 인사 모듈의 "본인 확인 링크" 발송 흐름을 쓸 수 있게 내보낸다 — modules/index.js 가 평가 결과 통보 화면에 주입한다(모듈 규약 R4: 등록부는 각 모듈의 index.js 만 불러온다) */
export { sendDocLinkByEmail, showLinkModal, createResultLink } from './sign-io.js?v=20261031c';
export const manifest = { id: 'hr', order: 21, title: '인사', icon: '👥', defaultHash: '#/hr/workers', perm: (me) => !!me && me.admin === true };
const FORM_KEYS = ['name', 'empNo', 'dept', 'rank', 'empType', 'job', 'phone', 'email', 'address', 'bankAccount', 'hireDate', 'taxFamily', 'taxChildren', 'taxRate'];
const toForm = (w) => { const f = {}; FORM_KEYS.forEach((k) => { f[k] = w[k] == null ? '' : String(w[k]); }); f.certs = certsFromWorker(w); f.step = stepNow(w) == null ? '' : String(stepNow(w)); f.reason = ''; return f; };
const fmtTs = (ts) => { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') : '-'; };
export const mountWorkers = (root, route, ctx) => mount(root, route, ctx, { base: '#/hr/workers' });
export async function mount(root, route, ctx, opts) {
  const BASE = (opts && opts.base) || '#/hr/workers'; const openId = (route.segs && route.segs[0]) || '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), workers: [], contracts: {}, view: 'active', q: '', sel: null, reg: null };
  root.innerHTML = '<div class="jh-hr"><div id="w-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#w-body');
  const load = async () => {
    const [ws, ps] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'worker_private')).catch(() => null)]);
    const priv = new Map(); if (ps) ps.forEach((d) => priv.set(d.id, d.data()));
    const list = []; ws.forEach((d) => list.push(mergeWorker(Object.assign({ id: d.id }, d.data()), priv.get(d.id)))); st.workers = list;   // 주민번호 전체는 읽지 않는다(마스킹 값·생년월일 6자리만)
    const end = (snap) => { let last = '', lc = '', lp = ''; snap.forEach((c) => { const x = c.data() || {}; const e = x.endDate || ''; if (e > last) last = e; const cd = x.contractDate || ''; if (cd >= lc) { lc = cd; lp = (x.periodType === 'open' || x.periodType === 'project') ? x.periodType : ''; } }); return { end: lp ? '' : last, n: snap.size, period: lp }; };   // 가장 최근 계약이 종료일 없는 방식이면 그 방식을 상태로
    await Promise.all(list.map(async (w) => { try { const [a, b] = await Promise.all([getDocs(collection(db, 'labor_contracts/' + w.id + '/contracts')), getDocs(collection(db, 'annual_contracts/' + w.id + '/contracts'))]); const l = end(a), n = end(b); st.contracts[w.id] = { laborEnd: l.end, laborN: l.n, laborP: l.period, annualEnd: n.end, annualN: n.n, annualP: n.period }; } catch (e) { st.contracts[w.id] = { laborEnd: '', laborN: 0, annualEnd: '', annualN: 0 }; } }));
  };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  // 직원 상세도 주소를 가진다(#/hr/workers/<번호>): 계약서 등 다른 화면에 갔다가 뒤로가기를 누르면 직원 상세로 돌아온다. 주소 표시만 바꾸고 화면은 다시 그리지 않는다(pushState 는 화면 전환 이벤트를 일으키지 않음)
  const setUrl = (h, push) => { if (location.hash === h) return; try { history[push ? 'pushState' : 'replaceState'](history.state, '', h); } catch (e) { /* 주소 표시만 못 바꾼다 */ } };
  let urlSync = false;   // 처음 그릴 때(주소로 직원 상세를 연 경우 포함)는 주소를 건드리지 않는다 — 상세를 연 뒤부터만 닫을 때 목록 주소로 정리
  const paint = () => { body.innerHTML = listHtml(st); if (urlSync && !st.sel && location.hash.indexOf(BASE + '/') === 0) setUrl(BASE, false); };   // 상세를 닫으면(닫기·저장·퇴직·삭제 모두) 주소도 목록으로 — 뒤로가기 기록은 쌓지 않는다
  const histIo = makeHistoryIo({ db, collection, getDocs, query, where });
  const paintHist = () => { const el = body.querySelector('#w-hist'); if (el && st.sel) el.innerHTML = historyInnerHtml(st.sel.hist); }; // 이력 카드 자리만 다시 그린다(상세의 입력 중인 칸을 건드리지 않으려고)
  const loadHist = async (id) => { const w = st.workers.find((x) => x.id === id); if (!w) return; try { const r = await histIo.load(w); if (st.sel && st.sel.id === id) { Object.assign(st.sel.hist, { loading: false, items: r.items, errors: r.errors, skipped: r.skipped }); paintHist(); } } catch (e) { if (st.sel && st.sel.id === id) { Object.assign(st.sel.hist, { loading: false, items: [], errors: ['이력 전체'], skipped: 0 }); paintHist(); } } };
  const open = (id, fromUrl) => { const w = st.workers.find((x) => x.id === id); if (!w) return; st.sel = { id, orig: w, form: toForm(w), history: null, hist: { loading: true, filter: 'all', limit: 30, shown: {} } }; if (!fromUrl) setUrl(BASE + '/' + encodeURIComponent(id), true); if (st.workers.find((x) => x.id === id) && isRes(w) && st.view !== 'resigned') st.view = 'resigned'; paint(); loadHist(id); const f = body.querySelector('[data-w-f]'); if (f) f.scrollIntoView({ block: 'center' }); };
  const isRes = (w) => w.status === 'resigned';
  /** 퇴직 처리·재직 복구 뒤 포털 계정을 맞춘다(서버 adminAct). 서버 호출이 실패해도 명부 처리는 이미 끝났으므로 그 사실과 직접 처리 방법을 알린다 */
  const syncAccount = async (action, name, workerId) => {
    try {
      const r = (await httpsCallable(functions, 'adminAct')(action === 'restoreResigned' ? { action, workerId } : { action })).data || {};
      if (action === 'restoreResigned') { if (r.restored) toast(name + '님의 포털 계정을 다시 사용하도록 되돌렸습니다.'); return; }
      const m = resignSyncMessage(r, name); if (m.text) toast(m.text);
    } catch (e) {
      const code = String((e && e.code) || ''); toast((/not-found|unimplemented/.test(code) ? '서버 함수가 아직 배포되지 않아' : '서버에 연결하지 못해') + ' 포털 계정은 자동으로 처리하지 못했습니다. 직원 관리에서 직접 사용 ' + (action === 'restoreResigned' ? '재개' : '중지') + '해 주세요.');
    }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const hf = t.closest('[data-h-filter]'); if (hf && st.sel && st.sel.hist) { st.sel.hist.filter = hf.getAttribute('data-h-filter'); st.sel.hist.limit = 30; paintHist(); return; }
  const hm = t.closest('[data-h-more]'); if (hm && st.sel && st.sel.hist) { st.sel.hist.limit = (st.sel.hist.limit || 30) + 30; paintHist(); return; }
  const hs = t.closest('[data-h-show]'); if (hs && st.sel && st.sel.hist) { st.sel.hist.shown[hs.getAttribute('data-h-show')] = true; paintHist(); return; }
  if (t.closest('[data-h-print]') && st.sel && st.sel.hist && st.sel.hist.items) { const w0 = st.sel.orig; openDocWindow({ html: historyPrintHtml(w0, st.sel.hist.items, st.today), title: '인사기록카드 - ' + (w0.name || ''), toast }); return; }
  const v = t.closest('[data-w-view]'); if (v) { st.view = v.getAttribute('data-w-view'); st.sel = null; paint(); return; }
    const o = t.closest('[data-w-open]'); if (o) { open(o.getAttribute('data-w-open')); return; }
    const a0 = t.closest('[data-w-act]'); const act0 = a0 && a0.getAttribute('data-w-act');
    if (act0 === 'reg-new') { st.sel = null; st.reg = { form: NEW_FORM() }; paint(); const f0 = body.querySelector('[data-w-rf]'); if (f0) f0.scrollIntoView({ block: 'center' }); return; }
    if (act0 === 'cert-add' && st.sel) { st.sel.form.certs = (st.sel.form.certs || []).concat(['']); paint(); const ci = body.querySelectorAll('[data-w-cert]'); if (ci.length) ci[ci.length - 1].focus(); return; }
    const cd = t.closest('[data-w-certdel]'); if (cd && st.sel) { st.sel.form.certs.splice(Number(cd.getAttribute('data-w-certdel')), 1); paint(); return; }
    if (act0 === 'reg-cancel') { st.reg = null; paint(); return; }
    if (act0 === 'reg-save' && st.reg) {
      const r = buildNew(st.reg.form, st.workers, { today: st.today }); if (!r.ok) { toast(r.errors[0]); return; }
      try {
        const id = newWorkerId(crypto.getRandomValues(new Uint8Array(8))); await setDoc(doc(db, 'workers', id), Object.assign({}, r.pub, { updatedAt: serverTimestamp() })); await setDoc(doc(db, 'worker_private', id), r.priv, { merge: true });
        let jiNote = ''; try { await saveJumin(id, r.jumin); } catch (e) { jiNote = ' 다만 주민번호는 저장하지 못했습니다: ' + ((e && e.message) || '') + ' (정보 수정에서 번호를 다시 입력해 주세요)'; }   // 번호는 문서에 쓰지 않고 서버가 암호화 보관
        let linked = ''; try { const us = await getDocs(query(collection(db, 'portal_users'), where('name', '==', r.pub.name))); const c = linkCandidate(us.docs.map((d) => Object.assign({ id: d.id }, d.data())), r.pub.name); if (c.state === 'one') { await updateDoc(doc(db, 'workers', id), { portalUid: c.user.id }); await setDoc(doc(db, 'worker_private', id), { portalUid: c.user.id }, { merge: true }); await updateDoc(doc(db, 'portal_users', c.user.id), { workerId: id, empNo: r.empNo }); linked = ' 포털 계정과 연동했습니다.'; } } catch (e) { /* 연동 실패는 등록에 영향 없음 */ }
        toast('등록했습니다. 사원번호 ' + r.empNo + '.' + linked + jiNote); st.reg = null; await load(); paint();
      } catch (e) { toast('등록하지 못했습니다: ' + ((e && e.message) || '')); }
      return;
    }
    const jb = t.closest('[data-w-ji]'); if (jb && st.sel) { const r = await revealJumin(st.sel.id); if (!r) return; const el = body.querySelector('#w-ji-view'); if (!el) return; el.textContent = r.found ? r.jumin : '(저장된 번호 없음)'; clearTimeout(st.jiTimer); st.jiTimer = setTimeout(() => { const e2 = body.querySelector('#w-ji-view'); if (e2) e2.textContent = maskedView(st.sel && st.sel.orig.juminMasked) || '없음'; }, 30000); return; }   // 30초 뒤 다시 가림
    const a = a0; if (!a || !st.sel) return; const act = a.getAttribute('data-w-act');
    if (act === 'resign') { const rr = buildResign(st.sel.form.resignDate || st.today); if (!rr.ok) { toast(rr.error); return; } const ok = await confirmDialog({ title: '퇴직 처리', body: (st.sel.orig.name || '') + '님을 ' + rr.patch.resignDate + ' 자로 퇴직 처리합니다. 명부에서 지워지지 않고 "퇴직"으로 표시됩니다.\n' + resignAccountPlan(rr.patch.resignDate, st.today).text, confirmLabel: '퇴직 처리' }); if (!ok.ok) return; try { await setDoc(doc(db, 'workers', st.sel.id), Object.assign({}, rr.patch, { updatedAt: serverTimestamp() }), { merge: true }); const rnm = st.sel.orig.name || ''; toast('퇴직 처리했습니다.'); st.sel = null; await load(); paint(); await syncAccount('syncResigned', rnm); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'unresign') { const ok = await confirmDialog({ title: '재직 복구', body: (st.sel.orig.name || '') + '님을 재직 상태로 되돌립니다.', confirmLabel: '복구' }); if (!ok.ok) return; try { await setDoc(doc(db, 'workers', st.sel.id), { status: 'active', resignDate: deleteField(), updatedAt: serverTimestamp() }, { merge: true }); const rid = st.sel.id, rnm2 = st.sel.orig.name || ''; toast('재직 상태로 복구했습니다.'); st.view = 'active'; st.sel = null; await load(); paint(); await syncAccount('restoreResigned', rnm2, rid); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'delete') { const ok = await confirmDialog({ title: '명부에서 삭제', body: (st.sel.orig.name || '') + '님을 명부에서 삭제합니다(개인정보 문서 포함). 계약서 자료는 남습니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'workers', st.sel.id)); try { await deleteDoc(doc(db, 'worker_private', st.sel.id)); } catch (e) { /* 개인정보 문서가 없어도 계속 */ } toast('삭제했습니다.'); st.sel = null; await load(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'link') { try { const nm = st.sel.orig.name; const us = await getDocs(query(collection(db, 'portal_users'), where('name', '==', nm))); const c = linkCandidate(us.docs.map((d) => Object.assign({ id: d.id }, d.data())), nm); if (c.state !== 'one') { toast(c.message); return; } await updateDoc(doc(db, 'workers', st.sel.id), { portalUid: c.user.id }); await setDoc(doc(db, 'worker_private', st.sel.id), { portalUid: c.user.id }, { merge: true }); await updateDoc(doc(db, 'portal_users', c.user.id), { workerId: st.sel.id, empNo: st.sel.orig.empNo || c.user.empNo || '' }); toast('"' + nm + '" 포털 계정과 연동했습니다.'); st.sel = null; await load(); paint(); } catch (e) { toast('연동하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'close') { st.sel = null; paint(); return; }
    if (act === 'history') {
      try { const s = await getDocs(collection(db, 'workers/' + st.sel.id + '/history')); const h = []; s.forEach((d) => { const x = d.data(); h.push(Object.assign({}, x, { date: fmtTs(x.changedAt), ms: x.changedAt && x.changedAt.toMillis ? x.changedAt.toMillis() : 0 })); }); h.sort((p, q) => q.ms - p.ms); st.sel.history = h; paint(); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } return;
    }
    if (act === 'save') {
      const sel = st.sel; const res = buildEdit(sel.orig, sel.form, { others: st.workers });
      if (!res.ok) { toast(res.errors[0]); return; }
      try {
        const id = sel.id; const stamp = { updatedAt: serverTimestamp() };
        await setDoc(doc(db, 'workers', id), Object.assign({}, res.pub, stamp), { merge: true });
        const changedPriv = {}; ['address', 'bankAccount', 'taxFamily', 'taxChildren', 'taxRate'].forEach((k) => { if (String(res.priv[k] == null ? '' : res.priv[k]) !== String(sel.orig[k] == null ? '' : sel.orig[k])) changedPriv[k] = res.priv[k]; });
        if (Object.keys(changedPriv).length) await setDoc(doc(db, 'worker_private', id), Object.assign({}, changedPriv, sel.orig.portalUid ? { portalUid: sel.orig.portalUid } : {}), { merge: true });
        if (res.history) await addDoc(collection(db, 'workers/' + id + '/history'), Object.assign({}, res.history, { changedAt: serverTimestamp() }));
        if (res.portal) { try { await updateDoc(doc(db, 'portal_users', res.portal.uid), res.portal.fields); } catch (e) { toast('저장했지만 포털 계정 정보는 갱신하지 못했습니다: ' + ((e && e.message) || '')); } }
        let jiNote = ''; if (res.newJumin) { try { await saveJumin(id, res.newJumin); jiNote = ' 주민번호를 변경했습니다.'; } catch (e) { jiNote = ' 다만 주민번호는 저장하지 못했습니다: ' + ((e && e.message) || ''); } }
        toast((res.stepReset ? '저장했습니다. 직급이 바뀌어 호봉을 1로 초기화했습니다.' : '저장했습니다.') + jiNote); st.sel = null; await load(); paint();
      } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-w-cert]') && st.sel) { st.sel.form.certs[Number(t.getAttribute('data-w-cert'))] = t.value; return; }
    if (t.matches('[data-w-f]') && st.sel) { st.sel.form[t.getAttribute('data-w-f')] = t.value; return; }
    if (t.matches('[data-w-rf]') && st.reg) { st.reg.form[t.getAttribute('data-w-rf')] = t.value; return; }
    if (t.matches('[data-w-q]')) { st.q = t.value; const tb = body.querySelector('#w-table'); if (tb) tb.innerHTML = tableHtml(st); }
  };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-w-rf]') && st.reg) { st.reg.form[t.getAttribute('data-w-rf')] = t.value; if (t.getAttribute('data-w-rf') === 'hireDate') paint(); return; } if (t instanceof Element && t.matches('[data-w-f]') && st.sel) { st.sel.form[t.getAttribute('data-w-f')] = t.value; if (t.getAttribute('data-w-f') === 'hireDate') paint(); } };
  paint(); if (openId) open(openId, true); urlSync = true;
}

/** 연차 현황(새 화면) — 근로자 명부 + 전자결재 연차신청서 + 관리자 연차 등록·수정·삭제(사용촉진은 연차사용촉진 화면) */
export async function mountLeaves(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), workers: [], docs: [], leaveAll: false, leaveRows: [], leaveSel: (route.segs && route.segs[0]) || '', lvForm: null, lvEdit: null };
  root.innerHTML = '<div class="jh-hr"><div id="l-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#l-body');
  const loadDocs = async () => { st.docs = []; (await getDocs(collection(db, 'edoc_leave'))).forEach((d) => st.docs.push(Object.assign({ id: d.id }, d.data()))); };
  try {
    const ws = await getDocs(collection(db, 'workers')); ws.forEach((d) => st.workers.push(Object.assign({ id: d.id }, d.data()))); await loadDocs();
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const calc = () => { st.leaveRows = leaveRows(st.workers, st.docs, st.today, st.leaveAll); };
  const paint = () => { calc(); body.innerHTML = leaveHtml(st); };
  const selectByName = (name) => { const w = st.workers.find((x) => x.name === name); if (w) st.leaveSel = w.id; };
  try { const pf = sessionStorage.getItem('jh_leave_prefill'); if (pf) { sessionStorage.removeItem('jh_leave_prefill'); const p = JSON.parse(pf); if (p.editId) { const d = st.docs.find((x) => x.id === p.editId); if (d && d.adminCreated) { st.lvForm = adminLeaveFromDoc(d); selectByName(st.lvForm.workerName); } else if (d) { st.lvEdit = entryEditFromDoc(d); selectByName(d.authorName || d.name); } } else { st.lvForm = adminLeaveNew({ workerName: p.workerName, date: p.date }); selectByName(p.workerName); } } } catch (e) { /* 미리 채우기 없음 */ }   // 출퇴근 달력 → 연차 등록·수정
  const reload = async () => { try { await loadDocs(); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-l-open]'); if (o) { st.leaveSel = o.getAttribute('data-l-open'); paint(); const k = body.querySelector('.jh-kpi'); if (k) k.scrollIntoView({ block: 'center' }); return; }
    if (t.closest('[data-l-close]')) { st.leaveSel = ''; paint(); return; }
    const nw = t.closest('[data-l-new]'); if (nw) { st.lvEdit = null; st.lvForm = adminLeaveNew({ workerName: nw.getAttribute('data-l-new') || '' }); paint(); return; }
    const ed = t.closest('[data-l-edit]'); if (ed) { const d = st.docs.find((x) => x.id === ed.getAttribute('data-l-edit')); if (d) { st.lvForm = null; st.lvEdit = entryEditFromDoc(d); paint(); } return; }
    const dl = t.closest('[data-l-del]'); if (dl) { const d = st.docs.find((x) => x.id === dl.getAttribute('data-l-del')); if (!d) return; const ok = await confirmDialog({ title: '연차 기록 삭제', body: '이 연차 기록을 삭제할까요? (' + (d.authorName || '') + ' ' + (d.startDate || '') + ' ' + (d.leaveType || '') + ')', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'edoc_leave', d.id)); toast('삭제했습니다.'); st.lvForm = null; await reload(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const la = t.closest('[data-lv-act]'); if (la && st.lvForm) { const act = la.getAttribute('data-lv-act'); if (act === 'cancel') { st.lvForm = null; paint(); return; }
      if (act === 'delete') { const ok = await confirmDialog({ title: '연차 기록 삭제', body: '이 연차 기록을 삭제할까요?', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'edoc_leave', st.lvForm.id)); toast('삭제했습니다.'); st.lvForm = null; await reload(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
      const r = buildAdminLeave(st.lvForm, st.lvForm.id ? undefined : serverTimestamp()); if (!r.ok) { toast(r.errors[0]); return; }
      try { if (st.lvForm.id) await setDoc(doc(db, 'edoc_leave', st.lvForm.id), r.data, { merge: true }); else await addDoc(collection(db, 'edoc_leave'), r.data); toast(st.lvForm.id ? '수정했습니다.' : '등록했습니다.'); selectByName(st.lvForm.workerName); st.lvForm = null; await reload(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const ea = t.closest('[data-le-act]'); if (ea && st.lvEdit) { if (ea.getAttribute('data-le-act') === 'cancel') { st.lvEdit = null; paint(); return; }
      const r = buildEntryEdit(st.lvEdit); if (!r.ok) { toast(r.errors[0]); return; } try { await updateDoc(doc(db, 'edoc_leave', st.lvEdit.id), r.data); toast('수정했습니다.'); st.lvEdit = null; await reload(); } catch (e) { toast('수정하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (st.lvForm && t.matches('[data-lv-f]')) { st.lvForm[t.getAttribute('data-lv-f')] = t.value; if (t.getAttribute('data-lv-f') === 'days') st.lvForm.daysTouched = true; } else if (st.lvEdit && t.matches('[data-le-f]')) st.lvEdit[t.getAttribute('data-le-f')] = t.value; };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-l-all]')) { st.leaveAll = t.checked; paint(); return; }
    if (st.lvForm && t.matches('[data-lv-f]')) { const k = t.getAttribute('data-lv-f'); st.lvForm[k] = t.value; if (k === 'days') st.lvForm.daysTouched = true; if ((k === 'startDate' || k === 'endDate') && !st.lvForm.daysTouched) { const dd = weekdayDays(st.lvForm.startDate, st.lvForm.endDate || st.lvForm.startDate, st.lvForm.leaveType); if (dd > 0 && dd !== Number(st.lvForm.days)) { st.lvForm.days = dd; paint(); } } return; }   // 기간을 바꾸면 일수를 평일 수로 자동 계산(직접 고친 일수는 그대로 둔다) — 2일 연차를 1일로 차감하던 문제
    if (st.lvForm && t.matches('[data-lv-type]')) { st.lvForm.leaveType = t.value; st.lvForm.days = defaultDays(t.value); paint(); return; }
    if (st.lvEdit && t.matches('[data-le-f]')) { st.lvEdit[t.getAttribute('data-le-f')] = t.value; }
  };
  paint();
}

/** 인사 변동(새 화면) — 직급·소속 변경(이력·호봉 초기화·포털 반영)과 변동 현황 */
export async function mountChange(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), chWorkers: [], chEvents: [], chSalary: {}, chSel: (route.segs && route.segs[0]) || '', chForm: { rank: '', dept: '', date: kstToday(), reason: '' }, chType: 'all', chOnlySel: false };
  root.innerHTML = '<div class="jh-hr"><div id="c-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#c-body');
  const load = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); });
    list.sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); const events = []; const salary = {};
    await Promise.all(list.map(async (w) => {
      try { const hs = await getDocs(collection(db, 'workers/' + w.id + '/history')); hs.forEach((d) => { const h = d.data(); const e = historyEvent(w, h, fmtTs(h.changedAt)); if (e) events.push(e); }); } catch (e) { /* 이력이 없거나 못 읽으면 건너뜀 */ }
      try { const as = await getDocs(collection(db, 'annual_contracts/' + w.id + '/contracts')); const cs = []; as.forEach((d) => cs.push(d.data())); const r = salaryEvents(w, cs); r.events.forEach((e) => events.push(e)); if (r.current) salary[w.id] = r.current; } catch (e) { /* 연봉계약서 없음 */ }
    }));
    st.chWorkers = list; st.chEvents = events; st.chSalary = salary;
  };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const select = (id) => { st.chSel = id; const w = st.chWorkers.find((x) => x.id === id); st.chForm = { rank: w ? w.rank || '' : '', dept: w ? w.dept || '' : '', date: st.today, reason: '' }; };
  const paint = () => { body.innerHTML = changeHtml(st); };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-c-sel]')) { select(t.value); paint(); return; }
    if (t.matches('[data-c-f]')) { st.chForm[t.getAttribute('data-c-f')] = t.value; if (['rank', 'dept'].includes(t.getAttribute('data-c-f'))) paint(); return; }
    if (t.matches('[data-c-type]')) { st.chType = t.value; paint(); return; }
    if (t.matches('[data-c-only]')) { st.chOnlySel = t.checked; paint(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-c-f]')) st.chForm[t.getAttribute('data-c-f')] = t.value; };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !t.closest('[data-c-act="save"]')) return;
    const w = st.chWorkers.find((x) => x.id === st.chSel); const r = buildChange(w, st.chForm, st.today); if (!r.ok) { toast(r.errors[0]); return; }
    const ok = await confirmDialog({ title: '인사 변동 저장', body: (w.name || '') + '님: ' + r.label + ' (시행일 ' + r.history.effectiveDate + ')' + (r.stepReset ? '. 직급 변경으로 호봉이 1호봉으로 초기화됩니다.' : '.'), confirmLabel: '저장' }); if (!ok.ok) return;
    try {
      await setDoc(doc(db, 'workers', w.id), Object.assign({}, r.patch, { updatedAt: serverTimestamp() }), { merge: true });
      await addDoc(collection(db, 'workers/' + w.id + '/history'), Object.assign({}, r.history, { changedAt: serverTimestamp() }));
      if (r.portal) { try { await updateDoc(doc(db, 'portal_users', r.portal.uid), r.portal.fields); } catch (e) { toast('저장했지만 포털 계정 정보는 갱신하지 못했습니다: ' + ((e && e.message) || '')); } }
      toast('인사 변동을 저장했습니다.' + (r.stepReset ? ' 호봉을 1호봉으로 초기화했습니다.' : '')); const keep = w.id; await load(); select(keep); paint();
    } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  if (st.chSel) select(st.chSel); paint();
}

/** 공고 관리(새 화면) — job_postings 등록·수정·마감/게시·삭제. 홈페이지가 open 공고만 읽어 보여 준다 */
export async function mountPostings(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { jobs: [], jf: null };
  root.innerHTML = '<div class="jh-hr"><div id="j-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#j-body');
  const load = async () => { const s = await getDocs(collection(db, 'job_postings')); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); st.jobs = l; };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const preview = () => { if (!st.jf) return; const c = jobCompose(normalizeOpt(st.jf.o)); [['career', c.career], ['empType', c.empType], ['workTime', c.workTime]].forEach(([k, v]) => { const e = body.querySelector('#jp-pv-' + k); if (e) e.textContent = '홈페이지 표시: ' + (v || '(선택 없음)'); }); };
  const paint = () => { body.innerHTML = postingsHtml(st); preview(); };
  const openForm = (id) => { const j = id ? st.jobs.find((x) => x.id === id) : null; if (id && !j) return; const r = jobFormOf(j); st.jf = { id: id || '', f: r.f, o: r.o }; paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const pg = t.closest('[data-j-page]'); if (pg) { const [file, id] = pg.getAttribute('data-j-page').split(':'); window.open(jobHomeBase(IS_TEST) + '/' + file + (id ? '?job=' + encodeURIComponent(id) : ''), '_blank', 'noopener'); return; }
    if (t.closest('[data-j-new]')) { openForm(''); return; }
    const ed = t.closest('[data-j-edit]'); if (ed) { openForm(ed.getAttribute('data-j-edit')); return; }
    const tg = t.closest('[data-j-toggle]'); if (tg) { const j = st.jobs.find((x) => x.id === tg.getAttribute('data-j-toggle')); if (!j) return; const next = j.status === 'open' ? 'closed' : 'open'; const ok = await confirmDialog({ title: next === 'open' ? '공고 게시' : '공고 마감', body: '「' + (j.title || '') + '」 공고를 ' + (next === 'open' ? '게시' : '마감 처리') + '합니다.', confirmLabel: next === 'open' ? '게시' : '마감 처리' }); if (!ok.ok) return; try { await updateDoc(doc(db, 'job_postings', j.id), { status: next, updatedAt: serverTimestamp() }); toast(next === 'open' ? '게시했습니다.' : '마감 처리했습니다.'); await load(); paint(); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const dl = t.closest('[data-j-del]'); if (dl) { const j = st.jobs.find((x) => x.id === dl.getAttribute('data-j-del')); if (!j) return; const ok = await confirmDialog({ title: '공고 삭제', body: '「' + (j.title || '') + '」 공고를 삭제합니다. 홈페이지에서도 사라지고 되돌릴 수 없습니다(이미 접수된 지원서는 그대로 유지됩니다).', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'job_postings', j.id)); toast('삭제했습니다.'); await load(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const ch = t.closest('[data-j-chip]'); if (ch && st.jf) { const [g, val] = ch.getAttribute('data-j-chip').split(':'); const o = st.jf.o; if (g === 'career') o.careerType = val; else if (g === 'emp') { const s = new Set(o.emp || []); if (s.has(val)) s.delete(val); else s.add(val); o.emp = [...s]; } paint(); return; }
    const a = t.closest('[data-j-act]'); if (!a || !st.jf) return;
    if (a.getAttribute('data-j-act') === 'cancel') { st.jf = null; paint(); return; }
    const r = buildJob(st.jf.f, st.jf.o); if (!r.ok) { toast(r.errors[0]); return; }
    try { const data = Object.assign({}, r.data, { updatedAt: serverTimestamp() }); if (st.jf.id) await setDoc(doc(db, 'job_postings', st.jf.id), data, { merge: true }); else await addDoc(collection(db, 'job_postings'), Object.assign(data, { createdAt: serverTimestamp() })); toast('저장했습니다.'); st.jf = null; await load(); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.jf) return; if (t.matches('[data-j-f]')) { st.jf.f[t.getAttribute('data-j-f')] = t.value; return; } if (t.matches('[data-j-o]') && t.tagName === 'INPUT') { st.jf.o[t.getAttribute('data-j-o')] = t.value; preview(); } };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.jf) return; if (t.matches('[data-j-f]')) { st.jf.f[t.getAttribute('data-j-f')] = t.value; return; } if (t.matches('[data-j-o]')) { st.jf.o[t.getAttribute('data-j-o')] = t.value; paint(); return; } if (t.matches('[data-j-oc]')) { st.jf.o[t.getAttribute('data-j-oc')] = t.checked; paint(); } };
  paint();
}

/** 근로자 면담(새 화면) — interviews/{근로자}/records. 재직자 목록(최근 면담)과 근로자별 이력·신규 기록·삭제 */
export async function mountInterviews(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), ivWorkers: [], ivLatest: {}, ivSel: '', ivForm: NEW_INTERVIEW(kstToday()), ivRecords: [] };
  root.innerHTML = '<div class="jh-hr"><div id="i-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#i-body');
  const loadList = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); });
    list.sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); const latest = {};
    await Promise.all(list.map(async (w) => { try { const s = await getDocs(query(collection(db, 'interviews/' + w.id + '/records'), orderBy('date', 'desc'), limit(1))); latest[w.id] = s.empty ? null : s.docs[0].data(); } catch (e) { latest[w.id] = null; } }));
    st.ivWorkers = list; st.ivLatest = latest;
  };
  const loadRecords = async (wid) => { const s = await getDocs(query(collection(db, 'interviews/' + wid + '/records'), orderBy('date', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); st.ivRecords = l; };
  try { await loadList(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = interviewsHtml(st); };
  const open = async (wid) => { st.ivSel = wid; st.ivForm = NEW_INTERVIEW(st.today); st.ivRecords = []; try { await loadRecords(wid); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-i-open]'); if (o) { await open(o.getAttribute('data-i-open')); return; }
    const a = t.closest('[data-i-act]');
    if (a && a.getAttribute('data-i-act') === 'back') { st.ivSel = ''; await loadList(); paint(); return; }
    if (a && a.getAttribute('data-i-act') === 'save') { const r = buildInterview(st.ivForm, st.today); if (!r.ok) { toast(r.errors[0]); return; } try { await addDoc(collection(db, 'interviews/' + st.ivSel + '/records'), Object.assign({}, r.data, { createdAt: serverTimestamp() })); toast('면담을 기록했습니다.'); st.ivForm = NEW_INTERVIEW(st.today); await loadRecords(st.ivSel); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const d = t.closest('[data-i-del]'); if (d) { const ok = await confirmDialog({ title: '면담 기록 삭제', body: '이 면담 기록을 삭제합니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'interviews/' + st.ivSel + '/records', d.getAttribute('data-i-del'))); toast('삭제했습니다.'); await loadRecords(st.ivSel); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-i-f]')) st.ivForm[t.getAttribute('data-i-f')] = t.value; };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-i-f]')) st.ivForm[t.getAttribute('data-i-f')] = t.value; if (t.matches('[data-i-fc]')) st.ivForm[t.getAttribute('data-i-fc')] = t.checked; };
  paint(); if (route.segs && route.segs[0]) await open(route.segs[0]);
}

/** 휴직/퇴직 원서(새 화면) — 전자결재 edoc_resign 을 읽어 목록·상세·원서 출력. 결재 처리는 전자결재에서. 승인된 퇴직원서의 인사 캘린더 퇴사 일정 반영은 기존대로 인사 홈·캘린더를 열 때 처리된다 */
export async function mountResignReq(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), rrDocs: [], rrKind: 'all', rrStat: 'active', rrSel: (route.segs && route.segs[0]) || '' };
  root.innerHTML = '<div class="jh-hr"><div id="r-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#r-body');
  try { const s = await getDocs(query(collection(db, 'edoc_resign'), orderBy('createdAt', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { filed: fmtTs(x.createdAt).replace(/\./g, '-'), approvalLine: (x.approvalLine || []).map((a) => Object.assign({}, a, { approvedDate: a.approvedAt ? fmtTs(a.approvedAt).replace(/\./g, '-') : '' })) })); }); st.rrDocs = l; }
  catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '<br>전자결재 문서 열람은 관리자 권한이 필요합니다.</div>'; return; }
  body.removeAttribute('aria-busy');
  try { const wl = []; (await getDocs(collection(db, 'workers'))).forEach((d) => wl.push(Object.assign({ id: d.id }, d.data()))); st.rrWorkers = wl; } catch (e) { st.rrWorkers = []; }   // 원서 작성자 → 근로자 명부 연결용
  const paint = () => { body.innerHTML = resignReqHtml(st); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const k = t.closest('[data-r-kind]'); if (k) { st.rrKind = k.getAttribute('data-r-kind'); paint(); return; }
    const s2 = t.closest('[data-r-stat]'); if (s2) { st.rrStat = s2.getAttribute('data-r-stat'); paint(); return; }
    const o = t.closest('[data-r-open]'); if (o) { st.rrSel = o.getAttribute('data-r-open'); paint(); const f = body.querySelector('.jh-hr__line'); if (f) f.scrollIntoView({ block: 'center' }); return; }
    const a = t.closest('[data-r-act]'); if (!a) return; const act = a.getAttribute('data-r-act');
    if (act === 'close') { st.rrSel = ''; paint(); return; }
    if (act === 'retire' || act === 'roster') {   // 원서 작성자를 명부에서 찾아 퇴직금 정산(퇴직일은 원서의 퇴직 예정일)·근로자 명부로 이동
      const d0 = st.rrDocs.find((x) => x.id === st.rrSel); if (!d0) return; const w0 = rrqFindWorker(st.rrWorkers, d0); if (!w0) { toast('근로자 명부에서 ' + (d0.authorName || '') + '님을 찾지 못했습니다. 명부에 등록되어 있는지 확인해 주세요.'); return; }
      if (act === 'retire') { try { sessionStorage.setItem('jh_retire_prefill', JSON.stringify({ workerId: w0.id, retireDate: d0.lastDate || '' })); } catch (e) { /* 미리 채우기 실패해도 이동 */ } location.hash = '#/hr/retire'; } else location.hash = '#/hr/workers/' + w0.id; return;
    }
    if (act === 'print') {
      const d = st.rrDocs.find((x) => x.id === st.rrSel); if (!d) return; const win = window.open('', '_blank'); if (!win) { toast('팝업이 차단되어 출력 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.'); return; }
      win.document.write('<p style="font-family:sans-serif;padding:24px;">문서를 준비하는 중...</p>'); let w = null; try { const ws = []; (await getDocs(collection(db, 'workers'))).forEach((x) => ws.push(Object.assign({ id: x.id }, x.data()))); w = rrqFindWorker(ws, d); } catch (e) { /* 명부를 못 읽어도 원서는 출력 */ }
      win.document.open(); win.document.write(withDocTitle(resignPrintHtml(d, w, d.filed, st.today), resignDocTitle(d, rrqKindOf(d)))); win.document.close();
    }
  };
  paint();
}

/** 인사 캘린더(새 화면) — 지정 담당자(hr_calendar_access/config 의 emails)만. 일정 등록·수정·삭제, 연차 표시(읽기), 승인된 퇴직원서의 퇴사 일정 자동 반영(1분 간격) */
let lastResignSync = 0;
export async function mountCalendar(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const today = kstToday(); const st = { today, hcYm: today.slice(0, 7), hcSel: today, hcEvents: [], hcLeaves: {}, hcLeaveOn: true, hcLeaveErr: false, hcOk: false, hcForm: null };
  root.innerHTML = '<div class="jh-hr' + (root.closest && root.closest('.jh-hr__home') ? ' jh-hr--wide' : '') + '"><div id="h-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#h-body'); const me = String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  const syncResign = async () => {
    if (Date.now() - lastResignSync < 60000) return; lastResignSync = Date.now();
    try { const ds = await getDocs(collection(db, 'edoc_resign')); const docs = []; ds.forEach((d) => docs.push(Object.assign({ id: d.id }, d.data()))); const existing = {};
      await Promise.all(docs.filter((d) => (d.leaveKind || '퇴직') === '퇴직').map(async (d) => { try { const sn = await getDoc(doc(db, 'hr_calendar_events', 'resign_' + d.id)); if (sn.exists()) existing['resign_' + d.id] = sn.data(); } catch (e) { /* 없음 */ } }));
      const plan = hcResignPlan(docs, existing); const now = new Date().toISOString();
      for (const u of plan.upserts) await setDoc(doc(db, 'hr_calendar_events', u.id), Object.assign({}, u.data, { createdAt: (existing[u.id] || {}).createdAt || now, createdBy: (existing[u.id] || {}).createdBy || me, updatedAt: now, updatedBy: me }));
      for (const id of plan.deletes) await deleteDoc(doc(db, 'hr_calendar_events', id));
    } catch (e) { /* 전자결재 문서를 읽을 권한이 없으면 조용히 건너뜀 */ }
  };
  const load = async () => {
    const { a, b } = hcMonthRange(st.hcYm); const s = await getDocs(query(collection(db, 'hr_calendar_events'), where('date', '>=', a), where('date', '<=', b))); const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); st.hcEvents = l;
    st.hcLeaves = {}; st.hcLeaveErr = false; try { const back = new Date(a + 'T00:00:00Z'); back.setUTCDate(back.getUTCDate() - 45); const from = back.toISOString().slice(0, 10); const ss = await getDocs(query(collection(db, 'company_schedules'), where('sdate', '>=', from), where('sdate', '<=', b))); const sc = []; ss.forEach((d) => sc.push(d.data())); st.hcLeaves = hcExpandLeaves(sc, a, b, (ds) => !!holidayName(ds)); } catch (e) { st.hcLeaveErr = true; }
  };
  try {
    let emails = []; try { const cfg = await getDoc(doc(db, 'hr_calendar_access', 'config')); emails = ((cfg.exists() && cfg.data().emails) || []).map((x) => String(x).toLowerCase()); } catch (e) { emails = []; }
    st.hcOk = !!me && emails.includes(me); if (st.hcOk) { await syncResign(); await load(); }
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = calendarHtml(st); };
  const reload = async () => { try { await load(); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const mv = t.closest('[data-hc-move]'); if (mv) { const n = Number(mv.getAttribute('data-hc-move')); if (n === 0) { st.hcYm = st.today.slice(0, 7); st.hcSel = st.today; } else { st.hcYm = hcMove(st.hcYm, n); st.hcSel = st.hcYm === st.today.slice(0, 7) ? st.today : ''; } st.hcForm = null; await reload(); return; }
    const ed = t.closest('[data-hc-edit]'); if (ed) { const e = st.hcEvents.find((x) => x.id === ed.getAttribute('data-hc-edit')); if (e) { st.hcForm = Object.assign({}, e); paint(); } return; }
    const ad = t.closest('[data-hc-add]'); if (ad) { st.hcForm = { id: '', type: 'interview', title: '', person: '', date: ad.getAttribute('data-hc-add'), time: '', endTime: '', note: '' }; paint(); const f0 = body.querySelector('[data-hc-f]'); if (f0) f0.scrollIntoView({ block: 'center' }); return; }
    const sl = t.closest('[data-hc-sel]'); if (sl) { st.hcSel = sl.getAttribute('data-hc-sel'); paint(); return; }
    const a = t.closest('[data-hc-act]'); if (!a || !st.hcForm) return; const act = a.getAttribute('data-hc-act');
    if (act === 'cancel') { st.hcForm = null; paint(); return; }
    if (act === 'delete') { const ok = await confirmDialog({ title: '일정 삭제', body: '이 일정을 삭제합니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'hr_calendar_events', st.hcForm.id)); toast('삭제했습니다.'); st.hcForm = null; await reload(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'save') {
      const r = hcValidate(st.hcForm); if (!r.ok) { toast(r.errors[0]); return; }
      try { const now = new Date().toISOString(); const old = st.hcForm.id ? (st.hcEvents.find((x) => x.id === st.hcForm.id) || {}) : {}; const ref = st.hcForm.id ? doc(db, 'hr_calendar_events', st.hcForm.id) : doc(collection(db, 'hr_calendar_events'));
        await setDoc(ref, Object.assign({}, r.data, { createdAt: old.createdAt || now, createdBy: old.createdBy || me, updatedAt: now, updatedBy: me }));
        toast('저장했습니다.'); if (r.data.date.slice(0, 7) !== st.hcYm) st.hcYm = r.data.date.slice(0, 7); st.hcSel = r.data.date; st.hcForm = null; await reload(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-hc-f]') && st.hcForm) st.hcForm[t.getAttribute('data-hc-f')] = t.value; };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-hc-f]') && st.hcForm) { st.hcForm[t.getAttribute('data-hc-f')] = t.value; return; } if (t.matches('[data-hc-leave]')) { st.hcLeaveOn = t.checked; paint(); } };
  paint();
}

/** 인사평가(새 화면) — evaluations/{근로자}/records. 재직자 목록(호봉 직접 수정·최근 정기평가), 근로자별 평가 작성(정기·수시, 초안/확정)·확정 처리·삭제 */
export async function mountEvals(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), evWorkers: [], evLatest: {}, evSel: '', evForm: NEW_EVAL(), evRecords: [] };
  root.innerHTML = '<div class="jh-hr"><div id="e-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#e-body');
  const recsOf = async (wid) => { const s = await getDocs(collection(db, 'evaluations/' + wid + '/records')); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); return l; };
  const loadList = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); }); list.sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); const latest = {};
    await Promise.all(list.map(async (w) => { try { latest[w.id] = evalLatestRegular(await recsOf(w.id)); } catch (e) { latest[w.id] = null; } })); st.evWorkers = list; st.evLatest = latest;
  };
  try { await loadList(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = evalsHtml(st); };
  const open = async (wid) => { st.evSel = wid; st.evForm = NEW_EVAL(); st.evRecords = []; try { st.evRecords = await recsOf(wid); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  const save = async (confirmed) => { const r = buildEval(st.evForm, confirmed); if (!r.ok) { toast(r.errors[0]); return; } try { await addDoc(collection(db, 'evaluations/' + st.evSel + '/records'), Object.assign({}, r.data, { createdAt: serverTimestamp(), confirmedAt: confirmed ? serverTimestamp() : null })); toast(confirmed ? '확정 저장했습니다.' : '초안으로 저장했습니다.'); st.evForm = NEW_EVAL(); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-e-open]'); if (o) { await open(o.getAttribute('data-e-open')); return; }
    const ty = t.closest('[data-e-type]'); if (ty) { st.evForm.type = ty.getAttribute('data-e-type'); paint(); return; }
    const gr = t.closest('[data-e-grade]'); if (gr) { st.evForm.grade = gr.getAttribute('data-e-grade'); paint(); return; }
    const cf = t.closest('[data-e-confirm]'); if (cf) { try { await updateDoc(doc(db, 'evaluations/' + st.evSel + '/records', cf.getAttribute('data-e-confirm')), { status: 'confirmed', confirmedAt: serverTimestamp() }); toast('확정 처리했습니다.'); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('확정 처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const dl = t.closest('[data-e-del]'); if (dl) { const ok = await confirmDialog({ title: '평가 기록 삭제', body: '이 평가 기록을 삭제합니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'evaluations/' + st.evSel + '/records', dl.getAttribute('data-e-del'))); toast('삭제했습니다.'); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const a = t.closest('[data-e-act]'); if (!a) return; const act = a.getAttribute('data-e-act');
    if (act === 'back') { st.evSel = ''; try { await loadList(); } catch (e) { /* 목록은 이전 값 유지 */ } paint(); } else if (act === 'draft') await save(false); else if (act === 'confirm') await save(true);
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-e-f]')) st.evForm[t.getAttribute('data-e-f')] = t.value; };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-e-f]')) { st.evForm[t.getAttribute('data-e-f')] = t.value; return; }
    if (t.matches('[data-e-step]')) { const r = buildStepInput(t.value); if (!r.ok) { toast(r.error); return; } try { await setDoc(doc(db, 'workers', t.getAttribute('data-e-step')), r.patch, { merge: true }); toast('호봉을 저장했습니다.'); await loadList(); paint(); } catch (e) { toast('호봉을 저장하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  paint(); if (route.segs && route.segs[0]) await open(route.segs[0]);
}

/** 채용 지원자(새 화면) — recruit_applicants 목록·상태·면접 일정(인사 캘린더 자동 등록)·이력서 보기/인쇄·명부 등록 이동·삭제 */
export async function mountApplicants(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { apList: [], apFilter: 'all', apSel: (route.segs && route.segs[0]) || '' };
  root.innerHTML = '<div class="jh-hr jh-hr--wide"><div id="a-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#a-body'); const me = String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  const dt = (ts) => { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '-'; };
  const load = async () => { const s = await getDocs(query(collection(db, 'recruit_applicants'), orderBy('createdAt', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { created: dt(x.createdAt) })); }); const pj = []; try { const ps = await getDocs(collection(db, 'job_postings')); ps.forEach((d) => pj.push(Object.assign({ id: d.id }, d.data()))); } catch (e) { /* 공고를 못 읽으면 파기 관리 카드만 비운다 */ } st.rawApps = l; st.pj = pj; recompute(); }; /* 파기된 지원서(최소 기록만 남음)는 목록에서 빼고 파기 관리 카드에서 건수만 보여 준다 */ function recompute() { const pj2 = st.pj || [], l2 = st.rawApps || []; st.purge = pj2.length || l2.length ? purgeReport(l2, pj2, kstToday()) : null; const infoOf = new Map((st.purge ? st.purge.rows : []).map((r) => [r.applicant.id, r.info])); st.apList = l2.filter((a) => a.status !== 'destroyed').map((a) => Object.assign(a, { purgeInfo: infoOf.get(a.id) })); } const purgeIo = makePurgeIo({ db, doc, getDoc, updateDoc, writeBatch, serverTimestamp });
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = applicantsHtml(st); };
  const calSync = async (a, v) => {   // 면접 일정을 인사 캘린더에 반영(성공 여부)
    try { const c = interviewCalendar(a, v); const ref = doc(db, 'hr_calendar_events', c.id); if (c.remove) { await deleteDoc(ref); return true; } let old = {}; try { const sn = await getDoc(ref); if (sn.exists()) old = sn.data(); } catch (e) { /* 새 일정 */ } const now = new Date().toISOString(); await setDoc(ref, Object.assign({}, c.data, { createdAt: old.createdAt || now, createdBy: old.createdBy || me, updatedAt: now, updatedBy: me })); return true; } catch (e) { return false; }
  };
  const setInterview = async (a, v) => { try { await updateDoc(doc(db, 'recruit_applicants', a.id), { interviewAt: v }); a.interviewAt = v; } catch (e) { toast('면접일을 저장하지 못했습니다: ' + ((e && e.message) || '')); return; } const ok = await calSync(a, v); if (!ok) toast('면접일은 저장됐지만 인사 캘린더에는 반영하지 못했습니다(캘린더 접근 권한을 확인해 주세요).'); else toast(v ? '면접 일정을 인사 캘린더에 등록했습니다.' : '면접 일정을 해제했습니다.'); paint(); };
  root.onclick = async (ev) => { const t = ev.target; if (!(t instanceof Element)) return;
  const pgs = t.closest('[data-pg-save]'); if (pgs) { const pid = pgs.getAttribute('data-pg-save'); const dEl = body.querySelector('[data-pg-date="' + pid + '"]'), nEl = body.querySelector('[data-pg-days="' + pid + '"]'); pgs.disabled = true; pgs.textContent = '저장 중…'; /* 저장 응답이 3초쯤 걸릴 수 있어 바로 표시 */ try { const r1 = await purgeIo.saveSettings(pid, dEl ? dEl.value : '', nEl ? nEl.value : ''); const po = (st.pj || []).find((x) => x.id === pid); if (po) Object.assign(po, r1); recompute(); paint(); toast('채용 확정일·보관기간을 저장했습니다.'); load().then(paint).catch(() => { /* 서버 내용 확인은 실패해도 화면은 그대로 */ }); } catch (e) { pgs.disabled = false; pgs.textContent = '저장'; toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
  const pgr = t.closest('[data-pg-run]'); if (pgr) { if (pgr.disabled) return; const ids = (st.purge ? st.purge.rows : []).filter((r) => r.info.state === 'due').map((r) => r.applicant.id); if (!ids.length) return; const c0 = await confirmDialog({ title: '지원서 ' + ids.length + '건 파기', body: '보관기간이 지난 지원서 ' + ids.length + '건의 이름·연락처·주소·생년월일·이력을 모두 지웁니다. 접수일·공고·파기일·파기한 사람만 남고 되돌릴 수 없습니다(합격자는 제외됩니다).', confirmLabel: '파기', variant: 'danger' }); if (!c0 || !c0.ok) return; pgr.disabled = true; pgr.textContent = '파기 중…'; try { const r0 = await purgeIo.destroy(ids, me, kstToday()); (r0.destroyedIds || []).forEach((id) => { const a0 = (st.rawApps || []).find((x) => x.id === id); if (a0) a0.status = 'destroyed'; }); recompute(); paint(); toast('🗑 ' + r0.destroyed + '건을 파기했습니다.' + (r0.skipped.length ? ' (' + r0.skipped.length + '건은 조건이 맞지 않아 건너뜀)' : '')); load().then(paint).catch(() => { /* 서버 내용 확인은 실패해도 화면은 그대로 */ }); } catch (e) { pgr.disabled = false; pgr.textContent = '🗑 기한 지난 ' + ids.length + '건 파기'; toast('파기하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const f = t.closest('[data-a-filter]'); if (f) { st.apFilter = f.getAttribute('data-a-filter'); paint(); return; }
    const o = t.closest('[data-a-open]'); if (o) { st.apSel = o.getAttribute('data-a-open'); paint(); return; }
    const ofr = t.closest('[data-a-offer]'); if (ofr) { const a0 = st.apList.find((x) => x.id === ofr.getAttribute('data-a-offer')); if (a0) { try { sessionStorage.setItem('jh_offer_prefill', JSON.stringify({ kind: 'new', applicantId: a0.id, name: a0.name || '', job: a0.jobTitle || '' })); } catch (e) { /* 저장소를 못 쓰면 빈 양식으로 열림 */ } location.hash = '#/hr/offers'; } return; }
    const dl = t.closest('[data-a-del]'); if (dl) { const a = st.apList.find((x) => x.id === dl.getAttribute('data-a-del')); if (!a) return; const ok = await confirmDialog({ title: '지원자 삭제', body: "'" + (a.name || '(이름 없음)') + "' 지원자를 삭제합니다. 이력서 내용과 면접 일정이 함께 삭제되며 되돌릴 수 없습니다." + (appStatusOf(a) === 'pass' ? ' ※ 합격 처리된 지원자입니다.' : ''), confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, 'recruit_applicants', a.id)); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); return; } const cal = await calSync(a, ''); st.apList = st.apList.filter((x) => x.id !== a.id); st.apSel = ''; paint(); toast(cal ? '삭제했습니다.' : '지원자는 삭제됐지만 인사 캘린더의 면접 일정은 지우지 못했습니다. 인사 캘린더에서 직접 확인해 주세요.'); return; }
    const a2 = t.closest('[data-a-act]'); if (!a2) return; const act = a2.getAttribute('data-a-act'); const a = st.apList.find((x) => x.id === st.apSel); if (act === 'back') { st.apSel = ''; paint(); return; } if (!a) return;
    if (act === 'roster') { try { sessionStorage.setItem('jh_roster_prefill', JSON.stringify(prefillFromApplicant(a))); } catch (e) { /* 저장소를 못 쓰면 빈 양식으로 열림 */ } location.hash = '#/hr/workers'; return; }
    if (act === 'print') { const win = window.open('', '_blank'); if (!win) { toast('팝업이 차단되어 출력 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.'); return; } win.document.write(withDocTitle(resumePrintHtml(a), resumeDocTitle(a))); win.document.close(); }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-a-status]')) { const a = st.apList.find((x) => x.id === t.getAttribute('data-a-status')); if (!a) return; try { await updateDoc(doc(db, 'recruit_applicants', a.id), { status: t.value }); a.status = t.value; toast('상태를 바꿨습니다.'); paint(); } catch (e) { toast('상태를 바꾸지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const idD = t.getAttribute('data-a-ivd'), idT = t.getAttribute('data-a-ivt'); const id = idD || idT; if (!id) return; const a = st.apList.find((x) => x.id === id); if (!a) return;
    const row = t.closest('tr'); const d = (row.querySelector('[data-a-ivd]') || {}).value || ''; const tm = (row.querySelector('[data-a-ivt]') || {}).value || '';
    if (!d) { if (a.interviewAt) await setInterview(a, ''); return; }   // 날짜를 지우면 면접 일정 해제(이미 등록된 경우만)
    const v = joinInterview(d, tm); if (!v) return; await setInterview(a, v);   // 날짜·시간이 모두 올바를 때만 저장
  };
  paint();
}

/** 급여테이블(새 화면) — company_settings/salaryTable. 표준 시급 호봉표(내규용), 저장해도 급여명세서 계산에는 영향 없음 */
export async function mountSalary(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { sal: null };
  root.innerHTML = '<div class="jh-hr"><div id="s-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#s-body');
  try { const sn = await getDoc(doc(db, 'company_settings', 'salaryTable')); st.sal = salNormalize(sn.exists() ? sn.data() : null); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = salaryHtml(st); };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-s-field]')) { st.sal = salSetField(st.sal, t.getAttribute('data-s-field'), t.value); paint(); return; }
    if (t.matches('[data-s-tenure]')) { st.sal = salSetTenure(st.sal, t.getAttribute('data-s-tenure'), t.value); paint(); return; }
    if (t.matches('[data-s-cell]')) { const [tid, key] = t.getAttribute('data-s-cell').split('|'); st.sal = salEditCell(st.sal, tid, key, t.value); paint(); }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const a = t.closest('[data-s-act]'); if (!a) return; const act = a.getAttribute('data-s-act');
    if (act === 'regen') { const ok = await confirmDialog({ title: '표 다시 생성', body: '직접 수정한 값을 포함해 전체 표를 표준공식 기준으로 다시 계산합니다.', confirmLabel: '다시 생성' }); if (!ok.ok) return; st.sal = salRegenerate(st.sal, true); paint(); return; }
    if (act === 'save') { try { await setDoc(doc(db, 'company_settings', 'salaryTable'), st.sal); toast('저장했습니다.'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  paint();
}

/** 연봉 제안서(새 화면) — 작성·자동 계산·A4 출력(미리보기, 저장 안 됨)·저장(salary_offers, 같은 건은 덮어쓰기)·인사 캘린더 회신기한 연동·지난 제안서(재출력·열어서 수정·삭제). 이메일 발송(확인 링크) */
export async function mountOffers(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const today = kstToday(); const st = { view: 'form', of: offerNewForm(today), hint: '', workers: [], applicants: [], minWage: 0, perCert: 50000, stamp: '', allOffers: [], allWorkers: [], allApplicants: [], histTab: 'active', person: null };
  root.innerHTML = '<div class="jh-hr"><div id="o-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#o-body'); const me = String((auth.currentUser && auth.currentUser.email) || '').toLowerCase(); const logo = new URL('../../theme/assets/jh-logo.png', import.meta.url).href;
  const snapList = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  try {
    const [ws, as] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'recruit_applicants')).catch(() => null)]);
    st.workers = snapList(ws).filter((w) => !w.resignDate || w.resignDate >= today).sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); st.applicants = as ? snapList(as).filter((a) => ['review', 'pass'].includes(a.status || 'new')) : [];
    try { const sn = await getDoc(doc(db, 'company_settings', 'salaryTable')); if (sn.exists()) { st.minWage = Number(sn.data().minWage) || 0; st.perCert = Number(sn.data().techAllowancePerCert) || 50000; } } catch (e) { /* 기본값 */ }
    try { const sg = await getDoc(doc(db, 'company_settings', 'signatures')); if (sg.exists()) st.stamp = sg.data().kjh || ''; } catch (e) { /* 직인 없이 출력 */ }
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  try { const pf = sessionStorage.getItem('jh_offer_prefill'); if (pf) { sessionStorage.removeItem('jh_offer_prefill'); const p = JSON.parse(pf); st.of = Object.assign(offerNewForm(today), { kind: p.kind || 'new', applicantId: p.applicantId || '', workerId: p.workerId || '', name: p.name || '', job: p.job || '' }); } } catch (e) { /* 프리필 없음 */ }   // 채용 지원자 → 연봉 제안서
  const paint = () => { body.innerHTML = offersHtml(st); };
  const refresh = () => { const r = body.querySelector('#o-result'); if (r) r.innerHTML = offerResultHtml(st); const s = body.querySelector('#o-state'); if (s) s.textContent = offerStateText(st.of); };
  const contractsOf = async (wid) => { try { return snapList(await getDocs(collection(db, 'annual_contracts/' + wid + '/contracts'))); } catch (e) { return []; } };
  const fillCurrent = async () => { const res = offerFillCurrent(st.of, st.of.kind !== 'new' && st.of.workerId ? await contractsOf(st.of.workerId) : []); st.of = res.form; st.hint = res.hint; paint(); };
  const ctxOf = () => ({ worker: st.workers.find((x) => x.id === st.of.workerId), perCert: st.perCert, stamp: st.stamp, logo });
  const openPrint = (f, o) => { const r = offerCalc(f); if (r.err) { toast(r.err); return; } if (!r.ok) { toast('연봉 또는 시급을 먼저 입력해 주세요.'); return; } openDocWindow({ html: offerBuildHtml(f, r, ctxOf()), title: offerDocTitle(f, o), toast }); };
  const calSync = async (f) => { try { const c = offerCalendar(f); if (!c) return false; const ref = doc(db, 'hr_calendar_events', c.id); if (c.remove) { await deleteDoc(ref); return true; } let old = {}; try { const sn = await getDoc(ref); if (sn.exists()) old = sn.data(); } catch (e) { /* 새 일정 */ } const now = new Date().toISOString(); await setDoc(ref, Object.assign({}, c.data, { createdAt: old.createdAt || now, createdBy: old.createdBy || me, updatedAt: now, updatedBy: me })); return true; } catch (e) { return false; } };
  const saveDoc = async (f) => { const data = offerPayload(f); if (f._id) await setDoc(doc(db, 'salary_offers', f._id), Object.assign({}, data, { updatedAt: serverTimestamp() }), { merge: true }); else { const ref = await addDoc(collection(db, 'salary_offers'), Object.assign({}, data, { createdAt: serverTimestamp() })); f._id = ref.id; } f._saved = true; return calSync(f); };
  const loadHist = async () => { const [os, ws, as] = await Promise.all([getDocs(query(collection(db, 'salary_offers'), orderBy('createdAt', 'desc'))), getDocs(collection(db, 'workers')), getDocs(collection(db, 'recruit_applicants')).catch(() => null)]); st.allOffers = snapList(os); st.allWorkers = snapList(ws); st.allApplicants = as ? snapList(as) : []; };
  const showPerson = (kind, id) => { if (kind === 'w') { const w = st.allWorkers.find((x) => x.id === id); st.person = { kind, id, name: w ? w.name || '' : '', ref: w, list: st.allOffers.filter((o) => o.workerId === id) }; } else { const a = st.allApplicants.find((x) => x.id === id); st.person = { kind, id, name: a ? a.name || '' : '', ref: a, list: st.allOffers.filter((o) => o.applicantId === id) }; } st.view = 'person'; paint(); };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element) || st.view !== 'form') return;
    if (t.matches('[data-o-f]')) { st.of[t.getAttribute('data-o-f')] = t.value; st.of._saved = false; refresh(); return; }
    if (t.matches('[data-o-m]')) { st.of[t.getAttribute('data-o-m')] = t.value.replace(/,/g, '').replace(/[^0-9.]/g, ''); st.of._saved = false; refresh(); }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || st.view !== 'form') return;
    if (t.matches('[data-o-m]')) { paint(); return; }   // 입력이 끝나면 천 단위 쉼표로 다시 그림
    if (t.matches('[data-o-ck]')) { st.of[t.getAttribute('data-o-ck')] = t.checked; st.of._saved = false; refresh(); return; }
    if (t.matches('[data-o-r]')) { const [key, val] = t.getAttribute('data-o-r').split('|'); st.of._saved = false;
      if (key === 'kind') { st.of.kind = val; st.of.workerId = ''; st.of.applicantId = ''; st.hint = ''; await fillCurrent(); return; }
      if (key === 'mode') { st.of = offerSwitchMode(st.of, val); paint(); return; }
      st.of[key] = val; if (key === 'wageType') paint(); else refresh(); return; }
    if (t.matches('[data-o-pick]')) { const f = st.of; f._saved = false; const id = t.value;
      if (f.kind === 'new') { f.applicantId = id || ''; f.workerId = ''; const a = st.applicants.find((x) => x.id === id); if (a) { f.name = a.name || ''; f.job = a.jobTitle || f.job; } paint(); return; }
      f.workerId = id || ''; f.applicantId = ''; const w = st.workers.find((x) => x.id === id); if (w) { f.name = w.name || ''; f.empNo = w.empNo || ''; f.dept = w.dept || ''; f.rank = w.rank || ''; f.job = w.job || f.job; f.hireDate = w.hireDate || f.hireDate; f.curRank = w.rank || ''; } await fillCurrent(); }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const tab = t.closest('[data-o-tab]'); if (tab) { st.histTab = tab.getAttribute('data-o-tab'); paint(); return; }
    const per = t.closest('[data-o-person]'); if (per) { const [k, id] = per.getAttribute('data-o-person').split('|'); showPerson(k, id); return; }
    const rp = t.closest('[data-o-reprint]'); if (rp) { const o = st.allOffers.find((x) => x.id === rp.getAttribute('data-o-reprint')); if (o) openPrint(o); return; }
    const ed = t.closest('[data-o-edit]'); if (ed) { const o = st.allOffers.find((x) => x.id === ed.getAttribute('data-o-edit')); if (o) { st.of = offerFormFromSaved(o, today); st.hint = ''; st.view = 'form'; paint(); } return; }
    const dl = t.closest('[data-o-del]'); if (dl) { const o = st.allOffers.find((x) => x.id === dl.getAttribute('data-o-del')); if (!o) return; const ok = await confirmDialog({ title: '제안서 삭제', body: "'" + (o.name || '(이름 없음)') + "' 연봉 제안서(" + (o.offerDate || '-') + ")를 삭제합니다. 인사 캘린더의 회신기한 일정도 함께 삭제되며 되돌릴 수 없습니다.", confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, 'salary_offers', o.id)); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); return; } let cal = true; try { await deleteDoc(doc(db, 'hr_calendar_events', 'offerreply_' + o.id)); } catch (e) { cal = false; } st.allOffers = st.allOffers.filter((x) => x.id !== o.id); if (st.person) st.person.list = st.person.list.filter((x) => x.id !== o.id); paint(); toast(cal ? '삭제했습니다.' : '제안서는 삭제됐지만 인사 캘린더의 회신기한 일정은 지우지 못했습니다. 인사 캘린더에서 직접 확인해 주세요.'); return; }
    const a = t.closest('[data-o-act]'); if (!a) return; const act = a.getAttribute('data-o-act');
    if (act === 'hist') { try { await loadHist(); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); return; } st.histTab = 'active'; st.view = 'hist'; paint(); return; }
    if (act === 'form') { st.view = 'form'; paint(); return; }
    if (act === 'histback') { st.view = 'hist'; paint(); return; }
    if (act === 'newfor') { const p = st.person; if (!p) return; st.of = offerNewForm(today); if (p.kind === 'w') Object.assign(st.of, { kind: 'renew', workerId: p.id, name: p.name, dept: p.ref ? p.ref.dept || '' : '', rank: p.ref ? p.ref.rank || '' : '' }); else Object.assign(st.of, { kind: 'new', applicantId: p.id, name: p.name, job: p.ref ? p.ref.jobTitle || '' : '' }); st.view = 'form'; st.hint = ''; await fillCurrent(); return; }
    if (act === 'reset') { const ok = await confirmDialog({ title: '초기화', body: '입력한 내용을 모두 지우고 처음 상태로 되돌릴까요?', confirmLabel: '초기화' }); if (!ok.ok) return; st.of = offerNewForm(today); st.hint = ''; paint(); return; }
    if (act === 'print') { if (!String(st.of.name || '').trim()) { const ok = await confirmDialog({ title: '성명 없음', body: '성명이 비어 있습니다. 빈칸으로 출력할까요?', confirmLabel: '출력' }); if (!ok.ok) return; } openPrint(st.of, { preview: true }); return; }
    if (act === 'mail') {
      const r = offerCalc(st.of); if (r.err) { toast(r.err); return; } if (!r.ok) { toast('연봉 또는 시급을 먼저 입력해 주세요.'); return; }
      try { await saveDoc(st.of); refresh(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); return; }   // 발송은 실제 전달이므로 저장(같은 건이면 덮어쓰기) + 캘린더 반영
      const isNew = st.of.kind === 'new'; await sendDocLinkByEmail({ kind: isNew ? 'applicant' : 'worker', id: isNew ? st.of.applicantId : st.of.workerId, toName: st.of.name, docLabel: '연봉제안서', linkParams: { docType: 'offer', offerId: st.of._id } }); return;
    }
    if (act === 'save') {
      const r = offerCalc(st.of); if (r.err) { toast(r.err); return; } if (!r.ok) { toast('연봉 또는 시급을 먼저 입력해 주세요.'); return; }
      if (!String(st.of.name || '').trim()) { const ok = await confirmDialog({ title: '성명 없음', body: '성명이 비어 있습니다. 이대로 저장할까요?', confirmLabel: '저장' }); if (!ok.ok) return; }
      try { const calOk = await saveDoc(st.of); refresh(); toast(calOk ? '저장했습니다. 회신기한이 인사 캘린더에 반영되었습니다.' : '저장했습니다. (인사 캘린더에는 반영하지 못했습니다 — 캘린더 접근 권한을 확인해 주세요)'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  paint(); if (st.of.kind !== 'new' && st.of.workerId) await fillCurrent();
}

/** 퇴직금 정산(새 화면) — 퇴직 전 3개월 급여명세서(payslips)와 최근 연봉계약서로 평균임금·통상임금을 비교해 계산하고 severance/{근로자}/records/{퇴직일} 에 저장. 참고용 */
export async function mountRetire(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { rtWorkers: [], rtWid: '', rtDate: kstToday(), rtResult: null, rtRecords: [], rtOpt: { bonus12: '', leave12: '' }, rtLeavePay: null };
  root.innerHTML = '<div class="jh-hr"><div id="t-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#t-body'); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  try { st.rtWorkers = lst(await getDocs(collection(db, 'workers'))).sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = retireHtml(st); };
  const loadRecords = async () => { st.rtRecords = []; if (!st.rtWid) return; try { st.rtRecords = lst(await getDocs(collection(db, 'severance/' + st.rtWid + '/records'))); } catch (e) { st.rtRecords = []; } };
  const compute = async () => {
    st.rtResult = null; st.rtLeavePay = null; if (!st.rtWid || !st.rtDate) { paint(); return; }
    try { const w = st.rtWorkers.find((x) => x.id === st.rtWid); const [ps, cs] = await Promise.all([getDocs(collection(db, 'payslips/' + st.rtWid + '/months')).catch(() => null), getDocs(collection(db, 'annual_contracts/' + st.rtWid + '/contracts')).catch(() => null)]);
      const pays = []; if (ps) ps.forEach((d) => pays.push(Object.assign({ month: d.id }, d.data()))); st.rtResult = retireCalc(w, st.rtDate, pays, cs ? lst(cs) : [], { bonus12: Number(String(st.rtOpt.bonus12).replace(/[^0-9.]/g, '')) || 0, leave12: Number(String(st.rtOpt.leave12).replace(/[^0-9.]/g, '')) || 0 });
      if (st.rtResult && st.rtResult.ok) { try { const [ls, pr] = await Promise.all([getDocs(collection(db, 'edoc_leave')).catch(() => null), getDocs(collection(db, 'leave_promotions/' + st.rtWid + '/records')).catch(() => null)]); st.rtLeavePay = retireLeavePay(w, st.rtResult.legalRetire, ls ? lst(ls) : [], pr ? lst(pr) : [], st.rtResult.ordDaily); } catch (e) { st.rtLeavePay = null; } }   // 미사용 연차 정산(참고) — 연차 현황·촉진 기록 기준
    } catch (e) { st.rtResult = { ok: false, error: '계산 중 오류가 발생했습니다: ' + ((e && e.message) || '') }; }
    await loadRecords(); paint();
  };
  root.onchange = async (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-t-worker]')) { st.rtWid = t.value; await compute(); return; } if (t.matches('[data-t-date]')) { st.rtDate = t.value; await compute(); return; } if (t.matches('[data-t-opt]')) { const v = String(t.value).replace(/[^0-9]/g, ''); st.rtOpt[t.getAttribute('data-t-opt')] = v ? Number(v).toLocaleString('ko-KR') : ''; await compute(); } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const lf = t.closest('[data-t-leavefill]'); if (lf && st.rtLeavePay && st.rtLeavePay.ok) { st.rtOpt.leave12 = st.rtLeavePay.amount ? Math.round(st.rtLeavePay.amount).toLocaleString('ko-KR') : ''; await compute(); toast('연차수당 합계에 넣었습니다. 퇴직금 평균임금에 × 3/12 로 가산되는지는 노무사 확인 후 사용하세요.'); return; }
    const dl = t.closest('[data-t-del]'); if (dl) { const ok = await confirmDialog({ title: '정산 내역 삭제', body: '이 정산 내역을 삭제하시겠습니까?', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'severance/' + st.rtWid + '/records', dl.getAttribute('data-t-del'))); toast('삭제했습니다.'); await loadRecords(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const a = t.closest('[data-t-act="save"]'); if (!a) return; const r = st.rtResult; if (!r || !r.ok) { toast('먼저 근로자와 퇴직일을 선택해 주세요.'); return; }
    const ok = await confirmDialog({ title: '정산 내역 저장', body: r.record.name + '님 퇴직금 정산(퇴직일 ' + r.record.retireDate + ')을 저장하시겠습니까? 같은 퇴직일의 기존 내역은 덮어씁니다.', confirmLabel: '저장' }); if (!ok.ok) return;
    try { await setDoc(doc(db, 'severance/' + r.record.wid + '/records', r.record.retireDate), Object.assign({}, r.record, { savedAt: new Date().toISOString() })); toast('✅ 퇴직금 정산 저장 완료!'); await loadRecords(); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  try { const pf = sessionStorage.getItem('jh_retire_prefill'); if (pf) { sessionStorage.removeItem('jh_retire_prefill'); const p = JSON.parse(pf); if (p.workerId && st.rtWorkers.some((x) => x.id === p.workerId)) st.rtWid = p.workerId; if (/^\d{4}-\d{2}-\d{2}$/.test(p.retireDate || '')) st.rtDate = p.retireDate; } } catch (e) { /* 미리 채우기 없음 */ }   // 휴직/퇴직 원서 → 퇴직금 정산
  if (st.rtWid) await compute(); else paint();
}

/** 해고예고통지서(새 화면) — dismissal_notices 에 임시저장·발행(양식 버전 d1 동결, 발행분은 삭제 불가)하고 A4 로 출력. 이메일 발송 기능은 없음(종이 교부 원칙) */
export async function mountDismissal(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const today = kstToday(); const st = { dsView: 'form', ds: dsNewForm(today), dsWorkers: [], dsHist: [], stamp: '' };
  root.innerHTML = '<div class="jh-hr"><div id="x-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#x-body'); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  try { st.dsWorkers = lst(await getDocs(collection(db, 'workers'))).filter((w) => w.status !== 'resigned').sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); try { const sg = await getDoc(doc(db, 'company_settings', 'signatures')); if (sg.exists()) st.stamp = sg.data().kjh || ''; } catch (e) { /* 직인 없이 출력 */ } }
  catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = dismissalHtml(st); };
  const recalc = () => { const el = body.querySelector('#d-calc'); if (el) el.innerHTML = dsCalcHtml(st); };
  const openPrint = (d) => { openDocWindow({ html: dsHtmlByVer(d, { stamp: st.stamp }), title: dismissalDocTitle(d), toast }); };
  const loadHist = async () => { st.dsHist = lst(await getDocs(query(collection(db, 'dismissal_notices'), orderBy('createdAt', 'desc')))); };
  const hourlyOf = async (wid) => { const get = async (coll) => { try { return lst(await getDocs(collection(db, coll + '/' + wid + '/contracts'))); } catch (e) { return []; } }; return dsFindHourly(await get('annual_contracts'), await get('labor_contracts')); };
  const save = async (issue) => {
    const f = st.ds; const w = st.dsWorkers.find((x) => x.id === f.workerId); const c = dsCalc(f, w); const v = dsValidate(f, w, c, issue); if (!v.ok) { toast(v.error); return; }
    if (issue) { const ok = await confirmDialog({ title: '통지서 발행', body: w.name + '님 해고예고통지서를 발행하시겠습니까? · 해고는 정당한 이유가 있어야 유효합니다(제23조). 이 서류만으로 정당해지지 않습니다. · 취업규칙상 징계 절차(소명 기회 등)를 거쳤는지 확인하셨나요?', confirmLabel: '발행' }); if (!ok.ok) return; }
    const data = dsBuildData(f, w, c, issue);
    try { if (f.id) await setDoc(doc(db, 'dismissal_notices', f.id), Object.assign({}, data, { updatedAt: serverTimestamp() }), { merge: true }); else { const r = await addDoc(collection(db, 'dismissal_notices'), Object.assign({}, data, { createdAt: serverTimestamp() })); f.id = r.id; }
      if (issue) { toast('발행했습니다. 출력 창을 확인하세요.'); openPrint(data); } else toast('✅ 임시저장 되었습니다.'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || st.dsView !== 'form') return; if (t.matches('[data-d-f]')) { st.ds[t.getAttribute('data-d-f')] = t.value; return; } if (t.matches('[data-d-hourly]')) { st.ds.hourly = String(t.value || '').replace(/[^0-9.]/g, ''); recalc(); } };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || st.dsView !== 'form') return;
    if (t.matches('[data-d-f]')) { st.ds[t.getAttribute('data-d-f')] = t.value; recalc(); return; }
    if (t.matches('[data-d-ex]')) { st.ds.exemptType = t.getAttribute('data-d-ex'); recalc(); return; }
    if (t.matches('[data-d-rs]')) { st.ds.reasonType = t.getAttribute('data-d-rs'); return; }
    if (t.matches('[data-d-pick]')) { const id = t.value; st.ds.workerId = id; st.ds.hourly = ''; paint(); if (id) { try { const h = await hourlyOf(id); if (h && st.ds.workerId === id) { st.ds.hourly = String(h); paint(); } } catch (e) { /* 시급은 직접 입력 */ } } }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const rp = t.closest('[data-d-reprint]'); if (rp) { const d = st.dsHist.find((x) => x.id === rp.getAttribute('data-d-reprint')); if (d) openPrint(d); return; }
    const ed = t.closest('[data-d-edit]'); if (ed) { const d = st.dsHist.find((x) => x.id === ed.getAttribute('data-d-edit')); if (d) { st.ds = dsFormFromDraft(d, today); st.dsView = 'form'; paint(); } return; }
    const dl = t.closest('[data-d-del]'); if (dl) { const d = st.dsHist.find((x) => x.id === dl.getAttribute('data-d-del')); if (!d || d.status === 'issued') return; const ok = await confirmDialog({ title: '임시저장 삭제', body: '이 임시저장을 삭제할까요?', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'dismissal_notices', d.id)); await loadHist(); toast('삭제했습니다.'); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const a = t.closest('[data-d-act]'); if (!a) return; const act = a.getAttribute('data-d-act');
    if (act === 'hist') { try { await loadHist(); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); return; } st.dsView = 'hist'; paint(); return; }
    if (act === 'form') { st.dsView = 'form'; paint(); return; }
    if (act === 'reset') { const ok = await confirmDialog({ title: '초기화', body: '입력한 내용을 모두 지우고 새로 시작할까요?', confirmLabel: '초기화' }); if (!ok.ok) return; st.ds = dsNewForm(today); paint(); return; }
    if (act === 'draft') await save(false); else if (act === 'issue') await save(true);
  };
  paint();
}

/** 초과근로 현황(새 화면, 1단계) — overtime 월별 전체 현황·직원별 조회·삭제, 그리고 전자결재 승인 초과근로의 자동연동(이 화면이 맡는다: 문서 번호 고정 번호로 한 번만 반영) */
/** 출퇴근 달력 + 초과근로(새 화면) — 3단: 근로자 명단 | 달력 | 근로 내역 추가·수정(+ 그 달 초과근로). "월 초과근로 현황"은 같은 화면의 다른 보기(#/hr/attendcal?view=ot, 옛 주소 #/hr/overtimes 도 여기로).
 *  worker_attendance_log 는 출퇴근 모듈과 같은 문서(근로자번호_날짜), overtime 은 초과근로 기록 — 전자결재에서 승인된 건은 이 화면을 열 때 자동 반영된다 */
export async function mountAttendCal(root, route, ctx, opts) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const now = new Date(); const q0 = (route && route.query) || {}; const wkQ = /^\d{4}-\d{2}-\d{2}$/.test(q0.week || '') ? q0.week : ''; const weeklyIo = makeWeeklyIo({ db, collection, getDocs, query, where });
  const st = { today: kstToday(), workers: [], acWorkers: [], acW: (route && route.segs && route.segs[0]) || '', acMode: (opts && opts.mode) || (q0.view === 'ot' ? 'ot' : 'cal'), acY: wkQ ? Number(wkQ.slice(0, 4)) : now.getFullYear(), acM: wkQ ? Number(wkQ.slice(5, 7)) : now.getMonth() + 1, acAdj: [], acWeek: wkQ ? wkStart(wkQ) : '', acRows: [], acLeaves: [], acHol: new Set(), acSel: '', acForm: null, acDaily: null, otRows: [], otWage: null, otOpen: '', otBanner: null, otForm: null, otFormWage: null };
  root.innerHTML = '<div class="jh-hr jh-hr--wide"><div id="ac-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#ac-body'); const lst = (s2) => { const l = []; s2.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  const syncFromEdoc = async () => {
    try {
      const plan = otSyncPlan(lst(await getDocs(collection(db, 'edoc_overtime')))); if (!plan.items.length && !plan.skipped.length) return null; let ok = 0, firstErr = '';
      for (const it of plan.items) { try { await setDoc(doc(db, 'overtime', it.otId), Object.assign({}, it.record, { savedAt: serverTimestamp() })); await setDoc(doc(db, 'edoc_overtime', it.id), { linkedToOvertime: true }, { merge: true }); ok++; } catch (e) { if (!firstErr) firstErr = (e && (e.code || e.message)) || String(e); } }
      if (firstErr) return { tone: 'danger', text: '⚠️ 전자결재 자동연동 중 ' + (plan.items.length - ok) + '건을 반영하지 못했습니다: ' + firstErr };
      if (ok) return { tone: 'accent', text: '✅ 전자결재에서 승인된 초과근로 ' + ok + '건을 자동으로 반영했습니다.' + (plan.skipped.length ? ' (날짜가 올바르지 않은 ' + plan.skipped.length + '건은 건너뜀)' : '') };
      return plan.skipped.length ? { tone: 'warn', text: '⚠️ 날짜가 올바르지 않은 승인 건 ' + plan.skipped.length + '건은 반영하지 못했습니다. 전자결재 문서를 확인해 주세요.' } : null;
    } catch (e) { return { tone: 'danger', text: '⚠️ 전자결재 자동연동을 확인하지 못했습니다: ' + ((e && (e.code || e.message)) || String(e)) }; }
  };
  const wageOf = async (wid) => { if (!wid) return null; try { const s2 = await getDocs(query(collection(db, 'annual_contracts/' + wid + '/contracts'), orderBy('contractDate', 'desc'), limit(1))); return s2.empty ? null : otWage(s2.docs[0].data(), wid); } catch (e) { return null; } };
  try {
    st.workers = lst(await getDocs(collection(db, 'workers'))).sort((a2, b2) => String(a2.empNo || 'zzz').localeCompare(String(b2.empNo || 'zzz'))); st.acWorkers = st.workers.filter((w) => w.status !== 'resigned');
    if (!st.acW && st.acMode === 'cal' && st.acWorkers.length) st.acW = st.acWorkers[0].id;   // 3단 화면이 비어 보이지 않게 첫 근로자를 미리 선택
    st.otBanner = await syncFromEdoc();
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { const y = window.scrollY; body.innerHTML = attendCalHtml(st); window.scrollTo(0, y); };
  const capsAct = capsActions({ st, io: makeCapsIo({ db, collection, getDocs, query, where, writeBatch, doc, serverTimestamp, readSpreadsheet }), paint, toast, reload: () => reload(), workers: () => st.workers, today: () => st.today }); // 캡스 근태 업로드(1-3-25)
  const loadOt = async () => { st.otRows = lst(await getDocs(query(collection(db, 'overtime'), where('yearMonth', '==', otYm(st.acY, st.acM))))); };
  const loadAtt = async () => {
    st.acHol = holidaySetOf(st.acY, st.acM, (ds) => !!holidayName(ds)); st.acRows = []; st.acAdj = []; st.acLeaves = []; const w = st.acWorkers.find((x) => x.id === st.acW); if (!w) return;
    st.acRows = lst(await getDocs(query(collection(db, 'worker_attendance_log'), where('workerId', '==', w.id), where('yearMonth', '==', st.acY + '-' + String(st.acM).padStart(2, '0')))));
    try { st.acAdj = await weeklyIo.adjacentRows(w.id, st.acY, st.acM); } catch (e) { st.acAdj = []; } // 달 경계에 걸친 주의 합계용(앞·뒤 달 기록) — 실패해도 달력은 그대로
    try { st.acLeaves = lst(await getDocs(collection(db, 'edoc_leave'))).filter((l) => (l.authorName || l.name || '') === w.name && ['approved', 'posted'].includes(l.status)); } catch (e) { st.acLeaves = []; }
  };
  const reload = async () => { try { await Promise.all([loadAtt(), loadOt()]); st.otWage = st.acW ? await wageOf(st.acW) : null; } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } };
  const openDay = (ds) => { const ex = st.acRows.find((r) => r.date === ds); st.acSel = ds; st.acDaily = null; st.acForm = ex ? { checkIn: ex.checkIn || '07:00', checkOut: ex.checkOut || '18:00', breakMinutes: String(ex.breakMinutes == null ? attDefaultBreak(ex.checkIn || '07:00', ex.checkOut || '18:00') : ex.breakMinutes), isBusinessTrip: !!ex.isBusinessTrip, tripType: ex.tripType || 'personal_near' } : { checkIn: '07:00', checkOut: '18:00', breakMinutes: String(attDefaultBreak('07:00', '18:00')), isBusinessTrip: false, tripType: 'personal_near' }; paint(); };
  const defaultOtDate = () => { const ym = otYm(st.acY, st.acM); if (st.acSel && st.acSel.slice(0, 7) === ym) return st.acSel; if (st.today.slice(0, 7) === ym) return st.today; return ym + '-01'; };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const cp = t.closest('[data-caps]'); if (cp) { await capsAct.click(cp.getAttribute('data-caps')); return; } // 캡스 업로드: 반영·다른 파일
  const md = t.closest('[data-ac-mode]'); if (md) { st.acMode = md.getAttribute('data-ac-mode'); st.otOpen = ''; st.otForm = null; st.acSel = ''; st.acForm = null; if (st.acMode === 'cal' && !st.acW && st.acWorkers.length) { st.acW = st.acWorkers[0].id; await reload(); } paint(); return; }
    const wk = t.closest('[data-ac-worker]'); if (wk) { st.acW = wk.getAttribute('data-ac-worker'); st.acMode = 'cal'; st.acSel = ''; st.acForm = null; st.otOpen = ''; st.otForm = null; await reload(); paint(); return; }
    const wkb = t.closest('[data-ac-week]'); if (wkb) { const v = wkb.getAttribute('data-ac-week'); st.acWeek = st.acWeek === v ? '' : v; paint(); return; }
    const mv = t.closest('[data-ac-month]'); if (mv) { const d = new Date(st.acY, st.acM - 1 + Number(mv.getAttribute('data-ac-month')), 1); st.acY = d.getFullYear(); st.acM = d.getMonth() + 1; st.acSel = ''; st.acForm = null; st.otOpen = ''; st.otForm = null; await reload(); paint(); return; }
    const lvb = t.closest('[data-ac-leave]'); if (lvb) { const [mode, eid] = lvb.getAttribute('data-ac-leave').split('|'); const w0 = st.acWorkers.find((x) => x.id === st.acW); try { sessionStorage.setItem('jh_leave_prefill', JSON.stringify(mode === 'edit' ? { editId: eid } : { workerName: w0 ? w0.name : '', date: st.acSel })); } catch (e) { /* 미리 채우기 실패해도 이동 */ } location.hash = '#/hr/leaves'; return; }
    const dy = t.closest('[data-ac-day]'); if (dy) { openDay(dy.getAttribute('data-ac-day')); return; }
    // ── 초과근로(같은 화면) ──
    const dl = t.closest('[data-ot-del]'); if (dl) { const r = st.otRows.find((x) => x.id === dl.getAttribute('data-ot-del')); if (!r) return; const ok = await confirmDialog({ title: '초과근로 내역 삭제', body: (r.name || '') + ' ' + (r.date || '') + ' ' + (r.hours || 0) + 'h 내역을 삭제하시겠습니까? 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'overtime', r.id)); toast('삭제했습니다.'); st.otOpen = ''; await loadOt(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (t.closest('[data-ot-new]')) { st.otForm = Object.assign(otNewForm(defaultOtDate()), { workerId: st.acMode === 'cal' ? st.acW : '' }); st.otFormWage = st.acMode === 'cal' ? st.otWage : null; st.otOpen = ''; paint(); const f0 = body.querySelector('[data-ot-f]'); if (f0) f0.scrollIntoView({ block: 'nearest' }); return; }
    const ed = t.closest('[data-ot-edit]'); if (ed) { const r = st.otRows.find((x) => x.id === ed.getAttribute('data-ot-edit')); if (!r) return; st.otForm = otFormFromRecord(r, st.workers); st.otFormWage = await wageOf(st.otForm.workerId); st.otOpen = ''; paint(); const f0 = body.querySelector('[data-ot-f]'); if (f0) f0.scrollIntoView({ block: 'nearest' }); return; }
    const fa = t.closest('[data-ot-act]'); if (fa && st.otForm) { const act = fa.getAttribute('data-ot-act'); if (act === 'cancel') { st.otForm = null; paint(); return; }
      const w = st.workers.find((x) => x.id === st.otForm.workerId); const r = buildOvertime(st.otForm, w, st.otFormWage); if (!r.ok) { toast(r.errors[0]); return; }
      if (r.noWage) { const ok = await confirmDialog({ title: '연봉계약서 없음', body: '연봉계약서가 없어 수당이 0원으로 저장됩니다. 계속하시겠습니까?', confirmLabel: '저장' }); if (!ok.ok) return; }
      try { if (st.otForm.id) await updateDoc(doc(db, 'overtime', st.otForm.id), r.data); else await addDoc(collection(db, 'overtime'), Object.assign({}, r.data, { savedAt: serverTimestamp() }));
        toast(st.otForm.id ? '수정되었습니다.' : '저장되었습니다.'); const [yy, mm] = r.data.yearMonth.split('-').map(Number); const moved = yy !== st.acY || mm !== st.acM; if (moved) { st.acY = yy; st.acM = mm; st.acSel = ''; st.acForm = null; } st.otForm = null; if (moved) await reload(); else await loadOt(); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const op = t.closest('[data-ot-open]'); if (op && !t.closest('button')) { st.otOpen = op.getAttribute('data-ot-open'); paint(); return; }
    if (t.closest('[data-ot-close]')) { st.otOpen = ''; paint(); return; }
    // ── 근로 내역(출퇴근) ──
    const a = t.closest('[data-ac-act]'); if (!a || !st.acSel) return; const act = a.getAttribute('data-ac-act'); const w = st.acWorkers.find((x) => x.id === st.acW); if (!w) return;
    if (act === 'close') { st.acSel = ''; st.acForm = null; paint(); return; }
    if (act === 'daily') { try { st.acDaily = lst(await getDocs(query(collection(db, 'edoc_daily'), where('authorName', '==', w.name), where('date', '==', st.acSel)))); } catch (e) { st.acDaily = []; toast('업무일지를 불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); return; }
    if (act === 'delete') { const ex = st.acRows.find((r) => r.date === st.acSel); if (!ex) return; const ok = await confirmDialog({ title: '근로 내역 삭제', body: w.name + '님 ' + st.acSel + ' 근로 내역을 삭제하시겠습니까?', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'worker_attendance_log', ex.id)); toast('삭제했습니다.'); st.acSel = ''; st.acForm = null; await loadAtt(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'save') { const r = buildAttRecord(w.id, w.name, st.acSel, st.acForm); if (!r.ok) { toast(r.errors[0]); return; } try { await setDoc(doc(db, 'worker_attendance_log', r.key), Object.assign({}, r.data, { updatedAt: serverTimestamp() }), { merge: true }); toast('저장했습니다.'); st.acSel = ''; st.acForm = null; await loadAtt(); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (st.otForm && t.matches('[data-ot-f]')) { const k = t.getAttribute('data-ot-f'); st.otForm[k] = t.value; if (k === 'hours') { const h = parseFloat(t.value); const box = body.querySelector('#ot-prevbox'); if (box) box.innerHTML = st.otFormWage && h > 0 ? '<div class="jh-alert" data-tone="info" role="status"><strong>예상 수당 ' + Math.round((Number(st.otFormWage.rate) || 0) * h).toLocaleString('ko-KR') + '원</strong></div>' : ''; } return; }
    if (st.acForm && t.matches('[data-ac-f]')) st.acForm[t.getAttribute('data-ac-f')] = t.value;
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
  if (t.matches('[data-caps-file],[data-caps-from],[data-caps-to]')) { await capsAct.change(t); return; } // 캡스 업로드: 파일·기간
    if (st.otForm && t.matches('[data-ot-f]')) { st.otForm[t.getAttribute('data-ot-f')] = t.value; return; }
    if (st.otForm && t.matches('[data-ot-fw]')) { st.otForm.workerId = t.value; st.otFormWage = await wageOf(t.value); paint(); return; }
    if (!st.acForm) return;
    if (t.matches('[data-ac-ck]')) { st.acForm[t.getAttribute('data-ac-ck')] = t.checked; paint(); return; }
    if (t.matches('[data-ac-f]')) { const k = t.getAttribute('data-ac-f'); st.acForm[k] = t.value; if (k === 'checkIn' || k === 'checkOut') { st.acForm.breakMinutes = String(attDefaultBreak(st.acForm.checkIn, st.acForm.checkOut)); paint(); } }   // 출퇴근 시각을 바꾸면 휴게 기본값을 다시 맞춘다(직접 고친 휴게는 시각을 바꾸기 전까지 유지)
  };
  await reload(); paint();
}
/** 옛 주소(#/hr/overtimes) — 초과근로 현황은 출퇴근 달력 화면의 "월 초과근로 현황" 보기로 합쳐졌다 */
export const mountOvertime = (root, route, ctx) => mountAttendCal(root, route, ctx, { mode: 'ot' });

/** 급여명세서(새 화면) — 근로자·기준월을 고르면 연봉계약서·출퇴근 기록·초과근로·휴가·자격증을 자동으로 불러와 계산하고(지급·공제 항목은 직접 고칠 수 있음), 미리보기(A4)·저장(payslips/{근로자}/months/{월})·조회·삭제. 메일 발송·열람 링크/QR */
export async function mountPayslip(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const now = new Date(); const ym0 = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const st = { pView: 'write', pMonth: ym0, pPayDate: psPayDate(ym0), pWorkers: [], pWid: '', pW: null, pAnnual: null, pBank: '', pHol: new Set(), pPerCert: 50000, pAtt: { attHours: 0, leaveHours: 0, nightHours: 0, attDates: new Set(), leaveDocs: [], holidayRecords: [], businessTrips: [] }, pIn: { bonus: '', specialBonus: '', extraPay: '', techAllowance: '', dormitory: '' }, pO: {}, pTravel: [], pTravelTotal: 0, pListWid: '', pSlips: [] };
  root.innerHTML = '<div class="jh-hr"><div id="p-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#p-body'); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; }; const logo = new URL('../../theme/assets/jh-logo.png', import.meta.url).href; configureLaborDocs({ logo }); const num = (v) => Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0;
  try { const [wsn, psn] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'worker_private')).catch(() => null)]); const privP = new Map(); if (psn) psn.forEach((d) => privP.set(d.id, d.data())); st.pWorkers = lst(wsn).map((w) => Object.assign({}, w, privP.get(w.id) || {})).filter((w) => w.status !== 'resigned').sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); try { const sn = await getDoc(doc(db, 'company_settings', 'salaryTable')); if (sn.exists()) st.pPerCert = Number(sn.data().techAllowancePerCert) || 50000; } catch (e) { /* 기본값 */ } }
  catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = payslipHtml2(st); };
  const recalcTravel = () => { st.pTravelTotal = travelTotal(st.pTravel); };
  const loadWorker = async () => {
    const w = st.pWorkers.find((x) => x.id === st.pWid); st.pW = w || null; st.pAnnual = null; st.pO = {}; st.pTravel = []; st.pTravelTotal = 0; st.pIn = { bonus: '', specialBonus: '', extraPay: '', techAllowance: '', dormitory: '' }; st.pAtt = { attHours: 0, leaveHours: 0, nightHours: 0, attDates: new Set(), leaveDocs: [], holidayRecords: [], businessTrips: [] };
    const [y, m] = st.pMonth.split('-').map(Number); st.pHol = new Set(); if (y && m) for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) { const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); if (holidayName(ds)) st.pHol.add(ds); }
    if (!w) return; st.pBank = w.bankAccount || ''; st.pIn.techAllowance = String(techAllowance(w, st.pPerCert) || '');
    try { const cs = await getDocs(query(collection(db, 'annual_contracts/' + w.id + '/contracts'), orderBy('contractDate', 'desc'), limit(1))); st.pAnnual = cs.empty ? null : cs.docs[0].data(); } catch (e) { st.pAnnual = null; }
    try { const os = await getDocs(query(collection(db, 'overtime'), where('workerId', '==', w.id), where('yearMonth', '==', st.pMonth))); let amt = 0; os.forEach((d) => { amt += Number(d.data().amount) || 0; }); if (amt > 0) st.pIn.bonus = String(amt); } catch (e) { /* 초과근로 없음 */ }
    try { const as = lst(await getDocs(query(collection(db, 'worker_attendance_log'), where('workerId', '==', w.id), where('yearMonth', '==', st.pMonth)))); let lv = []; try { lv = lst(await getDocs(collection(db, 'edoc_leave'))); } catch (e) { lv = []; } st.pAtt = attendanceData(as, lv, w.name, st.pMonth, st.pHol); } catch (e) { toast('출퇴근 기록을 불러오지 못했습니다: ' + ((e && e.message) || '')); }
  };
  const loadSlips = async () => { st.pSlips = []; st.pLog = {}; if (!st.pListWid) return; try { st.pSlips = lst(await getDocs(query(collection(db, 'payslips/' + st.pListWid + '/months'), orderBy('month', 'desc')))); st.pLog = await loadSendLog(st.pListWid); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } };
  const openWin = (html, title) => { openDocWindow({ html, title, toast }); };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || st.pView !== 'write') return;
    if (t.matches('[data-p-month]')) { if (!t.value) return; st.pMonth = t.value; st.pPayDate = psPayDate(st.pMonth); await loadWorker(); paint(); return; }
    if (t.matches('[data-p-paydate]')) { st.pPayDate = t.value; return; }
    if (t.matches('[data-p-worker]')) { st.pWid = t.value; await loadWorker(); paint(); return; }
    if (t.matches('[data-p-bank]')) { st.pBank = t.value; return; }
    if (t.matches('[data-p-in]')) { st.pIn[t.getAttribute('data-p-in')] = String(num(t.value) || ''); paint(); return; }
    if (t.matches('[data-p-o]')) { const k = t.getAttribute('data-p-o'); if (String(t.value).trim() === '') delete st.pO[k]; else st.pO[k] = num(t.value); paint(); return; }
    if (t.matches('[data-p-tr]')) { const [i, f] = t.getAttribute('data-p-tr').split('|'); st.pTravel[Number(i)] = travelSet(st.pTravel[Number(i)], f, t.value); recalcTravel(); paint(); }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const lw = t.closest('[data-p-listworker]'); if (lw) { st.pListWid = lw.getAttribute('data-p-listworker'); await loadSlips(); paint(); return; }
    const pr = t.closest('[data-p-print]'); if (pr) { const d = st.pSlips.find((x) => x.id === pr.getAttribute('data-p-print')); if (d) openWin(psHtml(d), payslipDocTitle(d)); return; }   // 저장본은 저장 당시 양식(동결) 그대로 — 재계산 없음
    const dl = t.closest('[data-p-del]'); if (dl) { const d = st.pSlips.find((x) => x.id === dl.getAttribute('data-p-del')); if (!d) return; const ok = await confirmDialog({ title: '급여명세서 삭제', body: (d.name || '') + ' ' + d.month + ' 급여명세서를 삭제하시겠습니까? 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'payslips/' + st.pListWid + '/months', d.id)); toast('삭제했습니다.'); await loadSlips(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const pm = t.closest('[data-p-mail]'); if (pm) { const d = st.pSlips.find((x) => x.id === pm.getAttribute('data-p-mail')); const w = st.pWorkers.find((x) => x.id === st.pListWid) || {}; if (d) { await sendDocLinkByEmail({ kind: 'worker', id: st.pListWid, toName: d.name || w.name || '', docLabel: '급여명세서', linkParams: { docType: 'payslip', payslipWid: st.pListWid, payslipMonth: d.id, viewOnly: true } }); st.pLog = await loadSendLog(st.pListWid); paint(); } return; }
    const pk = t.closest('[data-p-link]'); if (pk) { const d = st.pSlips.find((x) => x.id === pk.getAttribute('data-p-link')); const w = st.pWorkers.find((x) => x.id === st.pListWid) || {}; if (d) { try { const token = await createDocLink({ docType: 'payslip', payslipWid: st.pListWid, payslipMonth: d.id, workerName: d.name || w.name || '', recipient: { kind: 'worker', id: st.pListWid }, viewOnly: true }); showLinkModal(token, d.name || w.name, { view: true, label: '급여명세서' }); } catch (e) { toast('열람 링크 생성 오류: ' + ((e && e.message) || '')); } } return; }
    const td = t.closest('[data-p-trdel]'); if (td) { st.pTravel.splice(Number(td.getAttribute('data-p-trdel')), 1); recalcTravel(); paint(); return; }
    if (t.closest('[data-tpl-close]')) { st.pTpl = false; paint(); return; }
    const a = t.closest('[data-p-act]'); if (!a) return; const act = a.getAttribute('data-p-act');
    if (act === 'tpl') { st.pTpl = !st.pTpl; paint(); return; }
    if (act === 'list') { st.pView = 'list'; paint(); return; }
    if (act === 'write') { st.pView = 'write'; paint(); return; }
    if (act === 'travel-add') { st.pTravel.push({ type: '', days: 1, tripCount: 1, perTrip: 0, amount: 0 }); recalcTravel(); paint(); return; }
    if (act === 'travel-import') { if (!st.pW || !st.pMonth) { toast('근로자와 기준월을 먼저 선택해 주세요.'); return; } const trips = st.pAtt.businessTrips || []; if (!trips.length) { toast(st.pMonth + ' 출퇴근 기록에 출장으로 체크된 날짜가 없습니다. 출퇴근 달력에서 해당 날짜를 출장으로 체크해 주세요.'); return; } if (st.pTravel.length) { const ok = await confirmDialog({ title: '여비교통비 다시 채우기', body: '현재 등록된 여비교통비 항목 ' + st.pTravel.length + '개를 지우고, 출퇴근 기록의 출장 ' + trips.length + '일로 다시 채울까요?', confirmLabel: '다시 채우기' }); if (!ok.ok) return; } st.pTravel = travelFromTrips(trips); recalcTravel(); paint(); return; }
    if (act === 'preview' || act === 'save') {
      if (!st.pW) { toast('근로자를 선택해 주세요.'); return; } if (!st.pMonth) { toast('기준월을 선택해 주세요.'); return; } const c = payslipCalcOf(st);
      if (act === 'preview') { { const rec = payslipRecord(st.pW, st.pAnnual, st.pMonth, st.pPayDate, st.pBank, c, st.pTravel, undefined, st.pAtt && st.pAtt.attDates && st.pAtt.attDates.size > 0 ? st.pAtt.attDates.size : undefined); openWin(psHtml(rec), payslipDocTitle(rec, { preview: true })); return; } }   // 저장될 내용 그대로 같은 양식(v5)으로 미리보기
      if (!st.pAnnual) { const ok0 = await confirmDialog({ title: '연봉계약서 없음', body: '연봉계약서가 없어 급여가 0원으로 저장됩니다. 계속하시겠습니까?', confirmLabel: '저장' }); if (!ok0.ok) return; }
      const ok = await confirmDialog({ title: '급여명세서 저장', body: (st.pW.name || '') + '님의 ' + st.pMonth + ' 급여명세서를 저장하시겠습니까? 같은 월에 저장한 명세서는 덮어씁니다.', confirmLabel: '저장' }); if (!ok.ok) return;
      try { await setDoc(doc(db, 'payslips/' + st.pW.id + '/months', st.pMonth), payslipRecord(st.pW, st.pAnnual, st.pMonth, st.pPayDate, st.pBank, c, st.pTravel, undefined, st.pAtt && st.pAtt.attDates && st.pAtt.attDates.size > 0 ? st.pAtt.attDates.size : undefined)); toast('✅ 급여명세서 저장 완료!'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  paint();
}

/** 연봉계약서·근로계약서(새 화면, 같은 틀) — 목록(재직/퇴사·최신 계약일·만료 상태)·작성(시급/월급/연봉 입력, 비포괄/포괄, 현장 서명)·미리보기·저장(annual_contracts/{근로자}/contracts/{계약일})·근로자별 조회(동결 양식으로 PDF 출력)·삭제. 원격 서명 링크·QR·메일 발송 */
export async function mountContract(root, route, ctx, kind) {
  const K = contractKind(kind); root.onclick = null; root.oninput = null; root.onchange = null;
  const today = kstToday(); const st = { aView: 'list', aFilter: 'active', today, aWorkers: [], aInfo: {}, aForm: K.newForm(today), aSal: annualSalary(0), aV7: v7Calc({}), aProjects: [], aSel: '', aDocs: [], aSigning: false, aDocType: kind === 'labor' ? 'labor' : 'annual', aLog: {}, aLabel: K.label === '근로계약서' ? '근로계약서' : '연봉계약서' };
  root.innerHTML = '<div class="jh-hr jh-hr--wide"><div id="an-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#an-body'); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; }; const logo = new URL('../../theme/assets/jh-logo.png', import.meta.url).href; const num = (v) => String(v == null ? '' : v).replace(/[^0-9.]/g, '');
  try {
    const [wsn, psn] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'worker_private')).catch(() => null)]); const priv = new Map(); if (psn) psn.forEach((d) => priv.set(d.id, d.data()));
    st.aWorkers = lst(wsn).map((w) => Object.assign({}, w, priv.get(w.id) || {})).sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || '')));
    let sigs = {}; try { const sg = await getDoc(doc(db, 'company_settings', 'signatures')); if (sg.exists()) sigs = sg.data(); } catch (e) { /* 직인 없이 출력 */ } configureLaborDocs({ signatures: sigs, logo }); try { const prs = await getDocs(collection(db, 'gihoek_projects')); st.aProjects = lst(prs).filter((x) => x.status !== 'done').map((x) => ({ id: x.id, name: String(x.code || x.name || x.id), label: String(x.code || x.id) + (x.name ? ' · ' + x.name : '') })).sort((a, b) => a.name.localeCompare(b.name, 'ko')); } catch (e) { st.aProjects = []; /* 목록을 못 읽으면 프로젝트 이름을 직접 입력 */ }   // 영업기획에서 만든 프로젝트(완료 제외)를 따른다 — PJT 관리 등록 목록이 아님
    await Promise.all(st.aWorkers.map(async (w) => { try { st.aInfo[w.id] = annualSummary(lst(await getDocs(collection(db, K.coll + '/' + w.id + '/contracts')))); } catch (e) { st.aInfo[w.id] = { endDate: '', contractDate: '', cnt: 0 }; } }));
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  syncSignedLinks().then((r) => { if (r.applied) toast('원격 서명 ' + r.applied + '건을 계약서에 반영했습니다.'); if (r.conflict) toast('링크 생성 후 내용이 바뀐 서명 ' + r.conflict + '건은 자동 반영하지 않았습니다(충돌). 계약서를 확인해 주세요.'); if (r.applied) { if (st.aView === 'worker') loadDocs().then(paint); } }).catch(() => { /* 서명 반영은 다음 열람 때 다시 시도 */ });   // 근로자가 원격으로 서명한 결과를 계약서 원본에 반영
  const recalc = () => { const f = st.aForm; if (f.workType === 'short') { st.aSal = annualSalary(Number(f.hourly || 0)); if (f.hourly) f.salary = st.aSal.annual; return; }
 if ((f.payBasis || 'hourly') !== 'hourly') f.hourly = v7HourlyFromPay(f) || ''; // v7: 월급·연봉 입력은 고정수당·추가 항목을 뺀 금액으로 시급 역산
 st.aSal = annualSalary(Number(f.hourly || 0)); st.aV7 = v7Calc(f); if (f.hourly) f.salary = st.aV7.annual; /* 계약연봉 = 월 지급계 × 12(고정연장·야간·추가 항목 포함) */ };
 const refreshSum = () => { body.querySelectorAll('[data-c7-sum]').forEach((el) => { el.innerHTML = c7SumHtml(st.aForm); }); const top = body.querySelector('[data-c7-sum-top]'); if (top) top.innerHTML = c7SumHtml(st.aForm) + (st.aForm.wageType === 'comprehensive' ? '' : '<div class="jh-field__hint">※ 포괄임금제 미적용 — 연장·야간근로수당은 매달 실제 근무기록 기준으로 급여명세서 작성 시 별도 자동계산됩니다.</div>'); };
 const validYear = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900);   // 날짜 칸은 연도를 한 글자씩 칠 때마다 값이 바뀌었다고 알려 오므로 완성된 날짜만 받는다
  const paint = () => { body.innerHTML = K.html(st); if (st.aView === 'form' && st.aSigning && !st.aForm.signData) bindCanvas(); };
  const openWin = (html, title) => { openDocWindow({ html, title, toast }); };
  const loadDocs = async () => { st.aDocs = []; if (!st.aSel) return; try { st.aDocs = lst(await getDocs(collection(db, K.coll + '/' + st.aSel + '/contracts'))); st.aInfo[st.aSel] = annualSummary(st.aDocs); st.aLog = await loadSendLog(st.aSel); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } };
  const startForm = async (wid) => { st.aForm = K.newForm(today); st.aSigning = false; recalc(); if (wid) { await pickWorker(wid); } st.aView = 'form'; paint(); };
  const checkForm = (f, preview) => { if (f.workType === 'short') return shortCheck(f); const b = annualValidate(f, false); const v = v7Check(f, kind); const errors = b.errors.concat(v.errors); return { ok: !errors.length, errors }; };   const outHtml = (d) => (K.docHtml ? K.docHtml(d) : docHtmlByVer(K.tpl, d));
  const pickWorker = async (wid) => { const w = st.aWorkers.find((x) => x.id === wid); if (!w) return; let lab = []; if (K.inheritFromLabor) { try { lab = lst(await getDocs(collection(db, 'labor_contracts/' + wid + '/contracts'))); } catch (e) { lab = []; } } st.aForm = K.fill(st.aForm, w, lab); recalc();
 try { const ds = await getDoc(doc(db, K.coll + '/' + wid + '/drafts', 'current')); if (ds.exists()) { const d = ds.data() || {}; const at = String(d.savedAt || '').slice(0, 16).replace('T', ' '); const ok = await confirmDialog({ title: '임시저장 불러오기', body: (w.name || '') + '님의 ' + K.label + ' 임시저장 내용(' + at + ')이 있습니다. 불러올까요? 취소하면 새로 작성하며, 임시저장본은 그대로 남습니다.', confirmLabel: '불러오기' }); if (ok.ok && d.form && typeof d.form === 'object') { st.aForm = Object.assign(K.newForm(st.today), d.form, { workerId: wid, signData: null }); recalc(); } } } catch (e) { /* 임시저장을 못 읽어도 새 작성은 계속한다 */ } };
  function bindCanvas() {
    const cv = body.querySelector('#an-canvas'); if (!cv) return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); let drawing = false;
    const pt = (e) => { const r = cv.getBoundingClientRect(); const t = (e.touches && e.touches[0]) || e; return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) }; };
    const start = (e) => { e.preventDefault(); drawing = true; const p = pt(e); g.beginPath(); g.moveTo(p.x, p.y); }; const move = (e) => { if (!drawing) return; e.preventDefault(); g.lineWidth = 2.5; g.lineCap = 'round'; g.strokeStyle = '#1A2540'; const p = pt(e); g.lineTo(p.x, p.y); g.stroke(); cv.dataset.drawn = '1'; }; const end = () => { drawing = false; };
    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); cv.addEventListener('mouseup', end); cv.addEventListener('mouseleave', end); cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);
  }
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const fl = t.closest('[data-an-filter]'); if (fl) { st.aFilter = fl.getAttribute('data-an-filter'); paint(); return; }
    const op = t.closest('[data-an-open]'); if (op) { st.aSel = op.getAttribute('data-an-open'); await loadDocs(); st.aView = 'worker'; paint(); return; }
    const bs = t.closest('[data-an-basis]'); if (bs) { st.aForm = payBasisChange(st.aForm, bs.getAttribute('data-an-basis')); recalc(); paint(); return; }
  const ft = t.closest('[data-an-ftype]'); if (ft) { st.aErrs = []; st.aForm = ft.getAttribute('data-an-ftype') === 'short' ? shortInit(st.aForm) : Object.assign({}, st.aForm, { workType: 'regular' }); paint(); return; } // 근로 형태(일반 / 단시간)
  const sd = t.closest('[data-an-sday]'); if (sd) { const r = (st.aForm.sched || []).find((x) => x.day === sd.getAttribute('data-an-sday')); if (r) { r.on = !r.on; if (r.on && !r.start && !r.end) { const prev = st.aForm.sched.filter((x) => x.on && x !== r && x.start && x.end)[0]; if (prev) { r.start = prev.start; r.end = prev.end; r.breakMin = prev.breakMin; } } paint(); } return; } // 요일 켜기·끄기(먼저 켠 요일의 시각을 이어받음)
    const pr = t.closest('[data-an-print]'); if (pr) { const d = st.aDocs.find((x) => x.id === pr.getAttribute('data-an-print')); if (d) openWin(outHtml(d), contractDocTitle(K.label, d)); return; }   // 저장 당시 양식(동결) 그대로
    const dl = t.closest('[data-an-del]'); if (dl) { const d = st.aDocs.find((x) => x.id === dl.getAttribute('data-an-del')); if (!d) return; const w = st.aWorkers.find((x) => x.id === st.aSel) || {}; const ok = await confirmDialog({ title: K.label + ' 삭제', body: (w.name || '') + '님의 ' + K.label + '(' + d.id + ')를 삭제하시겠습니까? 서명·저장된 서류이며 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, K.coll + '/' + st.aSel + '/contracts', d.id)); toast('삭제했습니다.'); await loadDocs(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const lk = t.closest('[data-an-link]'); if (lk) { const w = st.aWorkers.find((x) => x.id === st.aSel) || {}; try { const token = await createDocLink({ docType: st.aDocType, workerId: st.aSel, contractId: lk.getAttribute('data-an-link'), workerName: w.name || '', recipient: { kind: 'worker', id: st.aSel }, viewOnly: true }); showLinkModal(token, w.name, { view: true, label: K.label }); } catch (e) { toast('열람 링크 생성 오류: ' + ((e && e.message) || '')); } return; }
    const rs = t.closest('[data-an-resend]'); if (rs) { const w = st.aWorkers.find((x) => x.id === st.aSel) || {}; await sendDocLinkByEmail({ kind: 'worker', id: st.aSel, toName: w.name || '', docLabel: K.label, linkParams: { docType: st.aDocType, workerId: st.aSel, contractId: rs.getAttribute('data-an-resend'), viewOnly: true } }); st.aLog = await loadSendLog(st.aSel); paint(); return; }
    if (t.closest('[data-tpl-close]')) { st.aTpl = false; st.pTpl = false; paint(); return; }
    const a = t.closest('[data-an-act]'); if (!a) return; const act = a.getAttribute('data-an-act'); if (act === 'draft-save') { const f = st.aForm; if (!f.workerId) { toast('근로자를 먼저 선택해 주세요.'); return; } try { const snap = JSON.parse(JSON.stringify(Object.assign({}, f, { signData: null }))); await setDoc(doc(db, K.coll + '/' + f.workerId + '/drafts', 'current'), { form: snap, kind, savedAt: new Date().toISOString(), savedBy: 'admin' }); toast('임시저장했습니다. 같은 근로자를 다시 선택하면 불러올 수 있습니다.'); } catch (e) { toast('임시저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
 if (act === 'c7-add') { const rows = Array.isArray(st.aForm.extraItems) ? st.aForm.extraItems : []; if (rows.length < MAX_EXTRA) st.aForm.extraItems = rows.concat([{ name: '', amount: '', ordinary: false, note: '' }]); paint(); return; }
 if (act === 'c7-del') { const i = Number(a.getAttribute('data-idx')); st.aForm.extraItems = (st.aForm.extraItems || []).filter((_, k) => k !== i); recalc(); paint(); return; }
 if (act === 'tpl') { st.aTpl = !st.aTpl; paint(); return; }
    if (act === 'sign-link' || act === 'mail') {
  if (st.aForm.workType === 'short') { toast(SHORT_SIGN_ERROR); return; } // 저장하기 전에 안내(서명 페이지가 단시간 양식을 아직 못 그림)
      const v0 = checkForm(st.aForm); if (!v0.ok) { st.aErrs = v0.errors; paint(); toast(v0.errors[0]); return; } st.aErrs = []; const cid = annualContractId(st.aForm.contractDate);
      try { await setDoc(doc(db, K.coll + '/' + st.aForm.workerId + '/contracts', cid), K.record(st.aForm), act === 'mail' ? { merge: true } : undefined); deleteDoc(doc(db, K.coll + '/' + st.aForm.workerId + '/drafts', 'current')).catch(() => {}); st.aInfo[st.aForm.workerId] = annualSummary(lst(await getDocs(collection(db, K.coll + '/' + st.aForm.workerId + '/contracts')))); }   // 링크·발송은 실제 전달이므로 먼저 저장(같은 계약일은 덮어씀)
      catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); return; }
      if (act === 'sign-link') { try { const token = await createDocLink({ docType: st.aDocType, workerId: st.aForm.workerId, contractId: cid, workerName: st.aForm.name, recipient: { kind: 'worker', id: st.aForm.workerId } }); showLinkModal(token, st.aForm.name); } catch (e) { toast('링크 생성 오류: ' + ((e && e.message) || '')); } return; }
      await sendDocLinkByEmail({ kind: 'worker', id: st.aForm.workerId, toName: st.aForm.name, docLabel: K.label, linkParams: { docType: st.aDocType, workerId: st.aForm.workerId, contractId: cid } }); return;
    }
    if (act === 'list') { st.aView = 'list'; st.aSigning = false; paint(); return; }
    if (act === 'new') { await startForm(''); return; }
    if (act === 'new-for') { await startForm(st.aSel); return; }
    if (act === 'sign-open') { st.aSigning = true; paint(); return; }
    if (act === 'sign-cancel') { st.aSigning = false; paint(); return; }
    if (act === 'sign-wipe') { const cv = body.querySelector('#an-canvas'); if (cv) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); delete cv.dataset.drawn; } return; }
    if (act === 'sign-ok') { const cv = body.querySelector('#an-canvas'); if (cv && cv.dataset.drawn) st.aForm.signData = cv.toDataURL(); else toast('서명을 그려 주세요.'); st.aSigning = false; paint(); return; }
    if (act === 'sign-clear') { st.aForm.signData = null; paint(); return; }
    if (act === 'preview' || act === 'save') {
      const v = checkForm(st.aForm, true); if ((act === 'save' || st.aForm.workType === 'short') && !v.ok) { st.aErrs = v.errors; paint(); toast(v.errors[0]); return; } st.aErrs = [];
      if (act === 'preview') { openWin(outHtml(K.record(st.aForm)), contractDocTitle(K.label, st.aForm, { preview: true })); return; }   // 저장될 문서를 현재 양식(v5)으로
      const ok = await confirmDialog({ title: K.label + ' 저장', body: st.aForm.name + '님의 ' + K.label + '를 저장하시겠습니까? 같은 계약일의 계약서는 덮어씁니다.', confirmLabel: '저장' }); if (!ok.ok) return;
      try { await setDoc(doc(db, K.coll + '/' + st.aForm.workerId + '/contracts', annualContractId(st.aForm.contractDate)), K.record(st.aForm)); deleteDoc(doc(db, K.coll + '/' + st.aForm.workerId + '/drafts', 'current')).catch(() => {}); toast('✅ ' + K.label + ' 저장 완료!'); st.aInfo[st.aForm.workerId] = annualSummary(lst(await getDocs(collection(db, K.coll + '/' + st.aForm.workerId + '/contracts')))); st.aView = 'list'; paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || st.aView !== 'form') return;
    if (t.matches('[data-an-worker]')) { if (t.value) { await pickWorker(t.value); paint(); } return; }
 if (t.matches('[data-c7-type]')) { const v = t.getAttribute('data-c7-type'); const f = st.aForm; f.contractType = v; if (kind === 'labor') { if (v === 'regular') f.periodType = 'open'; else if (periodTypeOf(f) === 'open') f.periodType = 'range'; } else if (v === 'fixed' && periodTypeOf(f) === 'open') f.periodType = 'range'; if (periodTypeOf(f) === 'range' && !f.endDate && kind === 'annual') f.endDate = annualEnd(f.startDate); recalc(); paint(); return; }
 if (t.matches('[data-c7-ptype]')) { const v = t.getAttribute('data-c7-ptype'); st.aForm.periodType = v; if (v === 'range' && !st.aForm.endDate && kind === 'annual') st.aForm.endDate = annualEnd(st.aForm.startDate); paint(); return; }
 if (t.matches('[data-c7-proj]')) { const pr = (st.aProjects || []).find((x) => x.id === t.value); st.aForm.projectId = pr ? pr.id : ''; st.aForm.projectName = pr ? pr.name : ''; paint(); return; }
 if (t.matches('[data-c7-f]')) { const k = t.getAttribute('data-c7-f'); let v = t.value; if (k === 'fixedOTHours' || k === 'fixedNightHours') v = num(v); if (k === 'expectedEnd' && !validYear(v)) return; st.aForm[k] = v; if (k === 'projectName') st.aForm.projectId = ''; refreshSum(); return; }
 if (t.matches('[data-c7-row]')) { const [i, key] = t.getAttribute('data-c7-row').split('|'); const rows = Array.isArray(st.aForm.extraItems) ? st.aForm.extraItems : (st.aForm.extraItems = []); const r = rows[Number(i)]; if (!r) return; if (key === 'amount') { r.amount = num(t.value); t.value = r.amount ? Number(r.amount).toLocaleString('ko-KR') : ''; } else if (key === 'ordinary') r.ordinary = t.checked; else r[key] = t.value; recalc(); refreshSum(); return; }
 if (t.matches('[data-an-start]')) { if (!validYear(t.value)) return; const f = st.aForm; const autoEnd = !f.endDate || f.endDate === annualEnd(f.startDate); f.startDate = t.value; if (periodTypeOf(f) === 'range' && autoEnd) { f.endDate = annualEnd(t.value); const e = body.querySelector('[data-an-f="endDate"]'); if (e) e.value = f.endDate; } return; }
 if (t.matches('[data-an-f]')) { if (t.type === 'date' && !validYear(t.value)) return; st.aForm[t.getAttribute('data-an-f')] = t.value; return; }
  if (t.matches('[data-an-sf]')) { const [day, field] = t.getAttribute('data-an-sf').split(':'); const r = (st.aForm.sched || []).find((x) => x.day === day); if (r) { r[field] = field === 'breakMin' ? (t.value === '' ? 0 : Number(t.value)) : t.value; const sw = body.querySelector('[data-an-sumwrap]'); if (sw) sw.innerHTML = shortSummaryHtml(st.aForm); } return; } // 요일별 시작·종료·휴게 — 화면을 다시 그리지 않고 합계만 갱신(포커스·입력 유지)
    if (t.matches('[data-an-wt]')) { st.aForm.wageType = t.getAttribute('data-an-wt'); recalc(); paint(); return; } if (t.matches('[data-an-m]')) { st.aForm[t.getAttribute('data-an-m')] = num(t.value); recalc(); paint(); return; }
    if (t.matches('[data-an-pay]')) { if (st.aForm.workType === 'short') { const n = Number(String(t.value).replace(/[^0-9]/g, '')); t.value = n ? n.toLocaleString('ko-KR') : ''; } else paint(); } // 단시간은 다시 그리지 않고 숫자 서식만 맞춘다 — 시급 칸에서 저장 단추를 누를 때 단추가 사라져 첫 클릭이 무시되는 것을 막는다
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || st.aView !== 'form') return; if (t.matches('[data-an-pay]')) { st.aForm = payValueInput(st.aForm, t.value); recalc(); refreshSum(); const el = body.querySelector('#an-conv'); if (el) { const tmp = document.createElement('div'); tmp.innerHTML = K.html(st); const n = tmp.querySelector('#an-conv'); if (n) el.outerHTML = n.outerHTML; } } };
  const w0 = (route.segs && route.segs[0]) || ''; st.aFrom = (route.query && route.query.from === 'workers' && w0) ? '#/hr/workers/' + encodeURIComponent(w0) : '';   // 근로자 명부 상세에서 왔으면 "← 직원 상세"로 돌아간다
     // 주소로 근로자 지정: #/hr/<laborc|annualc>/<근로자 번호> → 그 사람의 계약서, …/new → 새 계약서 작성(명부·인사 변동에서 이동)
  if (w0 && st.aWorkers.some((x) => x.id === w0)) { st.aSel = w0; if ((route.segs[1] || '') === 'new') { await startForm(w0); const sd = route.query && route.query.start; if (/^\d{4}-\d{2}-\d{2}$/.test(sd || '')) { st.aForm.startDate = sd; if (st.aDocType === 'annual') st.aForm.endDate = annualEnd(sd); paint(); } /* 계약 만료 알림의 [다음 계약]: 시작일 = 만료일 다음 날 */ } else { await loadDocs(); st.aView = 'worker'; } }
  paint();
}
const contractKind = (kind) => (kind === 'labor'
  ? { coll: 'labor_contracts', label: '근로계약서', tpl: __LABOR_TPL, newForm: () => laborNewForm(), fill: (f, w) => laborFillFromWorker(f, w), record: (f) => (f.workType === 'short' ? shortRecord(f) : laborRecord(f)), docHtml: laborDocHtml, html: laborHtml, inheritFromLabor: false }
  : { coll: 'annual_contracts', label: '연봉계약서', tpl: __ANNUAL_TPL, newForm: (t) => annualNewForm(t), fill: (f, w, lab) => annualFillFromWorker(f, w, lab), record: (f) => annualRecord(f), docHtml: annualDocHtml, html: annualHtml, inheritFromLabor: true });
export const mountAnnual = (root, route, ctx) => mountContract(root, route, ctx, 'annual');
export const mountLabor = (root, route, ctx) => mountContract(root, route, ctx, 'labor');

/** 연차사용촉진(새 화면, 근로기준법 제61조) — 대상 구간·일정·진행 상태, 1차·추가 1차·2차 통보서 발행(저장 + A4 출력, 양식 l1 동결)·기록만 등록, 이력(다시 출력·근로자 회신·수령 확인·삭제). 저장: leave_promotions/{근로자}/records */
export async function mountLeavePromo(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { lpToday: lpDay(kstToday()), lpWorkers: [], lpLeaves: [], lpRecs: {}, lpForm: null, lpHist: '', lpLog: {} };
  root.innerHTML = '<div class="jh-hr"><div id="lp-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#lp-body'); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  try {
    const [ws, ls] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'edoc_leave'))]); st.lpWorkers = lpTargets(lst(ws)); st.lpLeaves = lst(ls);
    await Promise.all(st.lpWorkers.map(async (w) => { try { st.lpRecs[w.id] = lst(await getDocs(collection(db, 'leave_promotions/' + w.id + '/records'))); } catch (e) { st.lpRecs[w.id] = []; } }));
    let sigs = {}; try { const sg = await getDoc(doc(db, 'company_settings', 'signatures')); if (sg.exists()) sigs = sg.data(); } catch (e) { /* 직인 없이 출력 */ } configureLeavePromoDocs({ signatures: sigs });
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = leavePromoHtml(st); };
  const openWin = (rec) => { openDocWindow({ html: leavePromoHtmlByVer(rec), title: leavePromoDocTitle(rec), toast }); };
  const ctxNow = () => lpFormCtx(st.lpForm, st.lpWorkers.find((x) => x.id === st.lpForm.wid) || {}, st.lpLeaves, st.lpRecs[st.lpForm.wid] || [], st.lpToday);
  const patchRec = async (wid, id, patch) => { await setDoc(doc(db, 'leave_promotions/' + wid + '/records', id), patch, { merge: true }); const r = (st.lpRecs[wid] || []).find((x) => x.id === id); if (r) Object.assign(r, patch); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const op = t.closest('[data-lp-open]'); if (op) { const [wid, stage, cat] = op.getAttribute('data-lp-open').split('|'); st.lpForm = lpFormNew(wid, stage, cat, kstToday()); st.lpHist = ''; paint(); return; }
    const hs = t.closest('[data-lp-hist]'); if (hs) { st.lpHist = hs.getAttribute('data-lp-hist'); st.lpForm = null; st.lpLog = await loadSendLog(st.lpHist); paint(); return; }
    const ml = t.closest('[data-lp-mail]'); if (ml) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === ml.getAttribute('data-lp-mail')); const w = st.lpWorkers.find((x) => x.id === st.lpHist) || {}; if (!r) return; await sendDocLinkByEmail({ kind: 'worker', id: st.lpHist, toName: w.name || '', docLabel: (LP_STAGE[r.stage] || '연차사용촉진') + ' 서면 통지', linkParams: { docType: 'leavepromo', workerId: st.lpHist, contractId: r.id, viewOnly: true } }); st.lpLog = await loadSendLog(st.lpHist); paint(); return; }   // 확인 링크 메일(저장 당시 양식 그대로, 문자 인증 후 열람) — 테섭은 메일이 막혀 있어 링크로 확인
    const lk = t.closest('[data-lp-link]'); if (lk) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === lk.getAttribute('data-lp-link')); const w = st.lpWorkers.find((x) => x.id === st.lpHist) || {}; if (!r) return; try { const token = await createDocLink({ docType: 'leavepromo', workerId: st.lpHist, contractId: r.id, workerName: w.name || '', recipient: { kind: 'worker', id: st.lpHist }, viewOnly: true }); showLinkModal(token, w.name, { view: true, label: (LP_STAGE[r.stage] || '연차사용촉진') + ' 서면 통지' }); } catch (e) { toast('열람 링크 생성 오류: ' + ((e && e.message) || '')); } return; }
    const dd = t.closest('[data-lp-datedel]'); if (dd && st.lpForm) { st.lpForm.dates.splice(Number(dd.getAttribute('data-lp-datedel')), 1); if (!st.lpForm.dates.length) st.lpForm.dates = ['']; paint(); return; }
    const rp = t.closest('[data-lp-reprint]'); if (rp) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === rp.getAttribute('data-lp-reprint')); if (r) openWin(r); return; }   // 저장 당시 양식(동결) 그대로
    const rl = t.closest('[data-lp-reply]'); if (rl) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === rl.getAttribute('data-lp-reply')); if (!r) return; const ask = await confirmDialog({ title: '근로자 회신 기록', body: '근로자가 회신한 연차 사용 예정일을 쉼표로 구분해 입력하세요. (예: 2026-11-10, 2026-11-11) 회신이 없었으면 비워 두고 확인을 누르세요. 현재: ' + ((r.replyDates || []).join(', ') || '없음'), confirmLabel: '저장', reason: { label: '사용 예정일', placeholder: '2026-11-10, 2026-11-11', required: false } }); if (!ask.ok) return; const u = lpReplyUpdate(r, ask.reason); if (!u.ok) { toast(u.error); return; } try { await patchRec(st.lpHist, r.id, u.patch); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const rc = t.closest('[data-lp-recv]'); if (rc) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === rc.getAttribute('data-lp-recv')); if (!r) return; const ask = await confirmDialog({ title: '수령 확인 기록', body: '근로자가 통보서를 수령(서명)한 날짜를 입력하세요. (YYYY-MM-DD)', confirmLabel: '저장', reason: { label: '수령일', placeholder: kstToday(), required: true } }); if (!ask.ok) return; const u = lpReceivedUpdate(ask.reason); if (!u.ok) { toast(u.error); return; } try { await patchRec(st.lpHist, r.id, u.patch); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const dl = t.closest('[data-lp-del]'); if (dl) { const r = (st.lpRecs[st.lpHist] || []).find((x) => x.id === dl.getAttribute('data-lp-del')); if (!r) return; const ok = await confirmDialog({ title: '촉진 기록 삭제', body: '이 촉진 기록을 삭제할까요? 삭제하면 촉진을 했다는 증빙이 사라질 수 있습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'leave_promotions/' + st.lpHist + '/records', r.id)); st.lpRecs[st.lpHist] = (st.lpRecs[st.lpHist] || []).filter((x) => x.id !== r.id); toast('삭제했습니다.'); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const a = t.closest('[data-lp-act]'); if (!a) return; const act = a.getAttribute('data-lp-act');
    if (act === 'cancel') { st.lpForm = null; paint(); return; } if (act === 'hist-close') { st.lpHist = ''; paint(); return; } if (act === 'date-add' && st.lpForm) { st.lpForm.dates.push(''); paint(); return; }
    if (act === 'issue' && st.lpForm) {
      const c = ctxNow(); const v = lpValidateIssue(c); if (!v.ok) { toast(v.errors[0]); return; }
      if (v.warns.length) { const ok = await confirmDialog({ title: '확인이 필요한 사항이 있습니다', body: v.warns.map((x) => '· ' + x).join('\n') + '\n\n그래도 ' + (st.lpForm.recordOnly ? '기록을 등록' : '발행') + '하시겠습니까?', confirmLabel: st.lpForm.recordOnly ? '기록 등록' : '발행' }); if (!ok.ok) return; }
      const rec = lpBuildRecord(c, v.dates);
      try { const r = await addDoc(collection(db, 'leave_promotions/' + st.lpForm.wid + '/records'), Object.assign({}, rec, { createdAt: serverTimestamp() })); (st.lpRecs[st.lpForm.wid] = st.lpRecs[st.lpForm.wid] || []).push(Object.assign({ id: r.id }, rec)); const only = st.lpForm.recordOnly, mailOn = !!st.lpForm.mailOn, wid0 = st.lpForm.wid; st.lpForm = null; paint(); if (!only) openWin(rec); toast(only ? '기록을 등록했습니다.' : '발행했습니다. 출력 창을 확인하세요.');
        if (mailOn && !only) { const w1 = st.lpWorkers.find((x) => x.id === wid0) || {}; await sendDocLinkByEmail({ kind: 'worker', id: wid0, toName: w1.name || '', docLabel: (LP_STAGE[rec.stage] || '연차사용촉진') + ' 서면 통지', linkParams: { docType: 'leavepromo', workerId: wid0, contractId: r.id, viewOnly: true } }); } } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.lpForm) return; if (t.matches('[data-lp-f="memo"]')) st.lpForm.memo = t.value; };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.lpForm) return;
    if (t.matches('[data-lp-f]')) { st.lpForm[t.getAttribute('data-lp-f')] = t.value; if (t.getAttribute('data-lp-f') === 'noticeDate') paint(); return; }
    if (t.matches('[data-lp-date]')) { st.lpForm.dates[Number(t.getAttribute('data-lp-date'))] = t.value; const el = body.querySelector('#lp-info'); if (el) { const tmp = document.createElement('div'); tmp.innerHTML = leavePromoHtml(st); const n = tmp.querySelector('#lp-info'); if (n) el.innerHTML = n.innerHTML; } return; }
    if (t.matches('[data-lp-rec]')) { st.lpForm.recordOnly = t.checked; if (t.checked) st.lpForm.mailOn = false; paint(); return; }
    if (t.matches('[data-lp-mailon]')) { st.lpForm.mailOn = t.checked; if (t.checked) st.lpForm.method = '이메일 + 수령 확인'; paint(); }
  };
  paint();
}

/** 인사 홈(새 화면) — 요약 카드 4개(재직 인원·계약 갱신 필요·이번 달 급여명세서·이번 달 초과근로수당)와 카드별 목록, 연봉계약서 없는 재직자 알림, 인사 캘린더(인사 캘린더 화면을 그대로 끼워 넣음), 서명/도장(대표 직인) 등록·삭제. 업무 흐름 바로가기는 왼쪽 사이드바가 대신한다 */
export async function mountHome(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { stats: null, list: '', seals: {} }; const admin = !!(ctx && ctx.me && ctx.me.admin);
  root.innerHTML = '<div class="jh-hr jh-hr--wide">' + homeHtml() + '</div>';
  const q = (id) => root.querySelector(id); const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
  const paintSeal = () => { const el = q('#hm-seal'); if (el) el.innerHTML = homeSealHtml(st.seals, admin); }; const paintList = () => { const el = q('#hm-list'); if (el && st.stats) el.innerHTML = homeListHtml(st.list, st.stats); };
  try { const sg = await getDoc(doc(db, 'company_settings', 'signatures')); st.seals = sg.exists() ? sg.data() : {}; } catch (e) { st.seals = {}; } paintSeal();
  const today = kstToday(), ym = today.slice(0, 7);
  (async () => {   // 요약은 근로자마다 계약서·급여명세서를 확인하므로 시간이 걸린다 — 화면은 먼저 보여 주고 채운다
    try {
      const ws = lst(await getDocs(collection(db, 'workers'))); try { const wel = q('#hm-work'); if (wel) wel.innerHTML = workforceHtml(workforceStats(ws, today)); } catch (e) { /* 인력 현황은 보조 칸 */ } const contracts = {}, paySet = new Set(), annualDocs = {}, laborDocs = {}; const act = ws.filter((w) => w.status !== 'resigned');
      await Promise.all(act.map(async (w) => {
        try { const a = await getDocs(collection(db, 'annual_contracts/' + w.id + '/contracts')); let latest = ''; a.forEach((c) => { const e = (c.data() || {}).endDate || ''; if (e > latest) latest = e; }); contracts[w.id] = { cnt: a.size, latestEnd: latest }; annualDocs[w.id] = a.docs.map((c) => c.data()); } catch (e) { contracts[w.id] = { cnt: 0, latestEnd: '' }; }
        try { const lb = await getDocs(collection(db, 'labor_contracts/' + w.id + '/contracts')); laborDocs[w.id] = lb.docs.map((c) => c.data()); } catch (e) { laborDocs[w.id] = []; } // 기간제(단기) 근로계약서도 만료 알림에 넣는다
  try { const p = await getDoc(doc(db, 'payslips/' + w.id + '/months', ym)); if (p.exists()) paySet.add(w.id); } catch (e) { /* 없음 */ }
      }));
      let ot = []; try { ot = lst(await getDocs(query(collection(db, 'overtime'), where('yearMonth', '==', ym)))); } catch (e) { /* 초과근로 없음 */ }
      st.stats = homeStats({ workers: ws, contracts, paySet, overtime: ot, today, ym, renewItems: renewItems({ workers: act, annual: annualDocs, labor: laborDocs, today }) }); q('#hm-alert').innerHTML = homeAlertHtml(st.stats); q('#hm-kpi').innerHTML = homeKpiHtml(st.stats);
    } catch (e) { const k = q('#hm-kpi'); if (k) k.innerHTML = '<div class="jh-field__hint">현황을 불러오지 못했습니다.</div>'; }
  })();
  (async () => { const el = q('#hm-week'); if (!el) return; el.innerHTML = weeklyHomeHtml(null); try { const ws = lst(await getDocs(collection(db, 'workers'))); const rows = await makeWeeklyIo({ db, collection, getDocs, query, where }).reportRows(today); el.innerHTML = weeklyHomeHtml(weeklyReport(ws, rows, today)); } catch (e) { el.innerHTML = '<div class="jh-field__hint">주 근로시간을 불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; } })(); // 이번 주·지난주 44시간 이상 직원 — 새 저장 없이 계산만, 실패해도 홈은 그대로
  (async () => { const el = q('#hm-purge'); if (!el) return; el.innerHTML = purgeHomeHtml(null); try { const [as0, ps0] = await Promise.all([getDocs(collection(db, 'recruit_applicants')), getDocs(collection(db, 'job_postings'))]); el.innerHTML = purgeHomeHtml(purgeReport(lst(as0), lst(ps0), today)); } catch (e) { el.innerHTML = '<div class="jh-field__hint">지원서 파기 현황을 불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; } })(); // 지원서 파기 기한(기한 지남·임박·확정일 미입력) — 읽기만 한다
  const calRoot = q('#hm-cal'); if (calRoot) { try { await mountCalendar(calRoot, { segs: [], query: {} }, ctx); } catch (e) { calRoot.innerHTML = '<div class="jh-field__hint">인사 캘린더를 불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; } }
  const readSeal = (file) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onerror = () => reject(new Error('파일을 읽지 못했습니다.')); fr.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('이미지를 열지 못했습니다.')); img.onload = () => { const f = fitSize(img.naturalWidth, img.naturalHeight, 360); const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h; cv.getContext('2d').drawImage(img, 0, 0, f.w, f.h); resolve(cv.toDataURL('image/png')); }; img.src = fr.result; }; fr.readAsDataURL(file); });
  const saveSeal = async (key, dataUrl) => { if (dataUrl === null) await setDoc(doc(db, 'company_settings', 'signatures'), { [key]: deleteField() }, { merge: true }); else await setDoc(doc(db, 'company_settings', 'signatures'), { [key]: dataUrl }, { merge: true }); };   // 삭제는 필드를 실제로 지운다(구포털은 merge 저장이라 삭제가 반영되지 않았음)
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const wkh = t.closest('[data-hm-week]'); if (wkh) { const [wid, wst] = wkh.getAttribute('data-hm-week').split('|'); location.hash = '#/hr/attendcal/' + encodeURIComponent(wid) + '?week=' + wst; return; }
  const kp = t.closest('[data-hm-kpi]'); if (kp) { st.list = kp.getAttribute('data-hm-kpi'); paintList(); const el = q('#hm-list'); if (el) el.scrollIntoView({ block: 'nearest' }); return; }
    if (t.closest('[data-hm-close]')) { st.list = ''; paintList(); return; }
    const sb = t.closest('[data-hm-seal]'); if (sb && admin) { const key = sb.getAttribute('data-hm-seal'); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const url = await readSeal(f); const v = validateSeal(url); if (!v.ok) { toast(v.error); return; } await saveSeal(key, url); st.seals[key] = url; toast('서명/도장을 저장했습니다.'); paintSeal(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } }; inp.click(); return; }
    const sd = t.closest('[data-hm-sealdel]'); if (sd && admin) { const key = sd.getAttribute('data-hm-sealdel'); const ok = await confirmDialog({ title: '서명/도장 삭제', body: '이 서명/도장을 삭제할까요? 이미 저장된 계약서 문서에는 영향이 없고, 앞으로 출력하는 문서에 도장이 찍히지 않습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await saveSeal(key, null); delete st.seals[key]; toast('삭제했습니다.'); paintSeal(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
}

/** 임금대장 — 귀속월을 고르면 그 달 급여명세서를 법정 임금대장(근로기준법 제48조) 표로 정리하고, 점검을 통과하면 마감(수정 잠금 — 서버 규칙이 강제)·해제(사유 필수)·엑셀·인쇄를 한다. 설계서 payroll-ledger-design.md */
export async function mountInsurance(root, route, ctx) { // 4대보험 월별 대조(대기열 1-3-17 1단계) — 급여명세서 회사 월 합계와 공단 고지금액을 맞춰 본다
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { loading: true, error: '', busy: false, data: null, offset: 0, form: null, view: 'recon', edi: null, today: kstToday() };
  const io = makeInsuranceIo({ db, doc, getDocs, collection, setDoc, deleteDoc, serverTimestamp });
  const me = () => String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  root.innerHTML = '<div class="jh-hr"><div id="ins-body"></div></div>'; const body = root.querySelector('#ins-body'); const paint = () => { body.innerHTML = insuranceShellHtml(st); };
  const ediAct = ediActions({ st, io: makeEdiIo({ db, collection, getDocs, query, orderBy, limit }), paint, toast, revealJumin, copyText: copyToClipboard, today: () => st.today }); // 신고 입력표(1-3-17 2단계)
  const readForm = () => { const g = (k) => { const el = body.querySelector('[data-ins-f="' + k + '"]'); return el ? el.value : ''; }; return { ym: g('ym'), pension: g('pension'), health: g('health'), ltcare: g('ltcare'), unpaid: g('unpaid') }; };
  
  root.onchange = async (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-edi-worker],[data-edi-pay],[data-edi-hours],[data-edi-lpay],[data-edi-lprev],[data-edi-reason]')) { await ediAct.change(t); return; } if (t instanceof Element && t.matches('[data-ins-offset]')) { st.offset = Number(t.value) || 0; paint(); } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
  const vw = t.closest('[data-ins-view]'); if (vw) { st.view = vw.getAttribute('data-ins-view') === 'edi' ? 'edi' : 'recon'; if (st.view === 'edi') await ediAct.open(); else { ediAct.hide(); paint(); } return; } // 월별 대조 ↔ 신고 입력표
  const kd = t.closest('[data-edi-kind]'); if (kd) { await ediAct.setKind(kd.getAttribute('data-edi-kind')); return; } const eb = t.closest('[data-edi]'); if (eb) { await ediAct.click(eb.getAttribute('data-edi')); return; } const ec = t.closest('[data-edi-copy]'); if (ec) { await ediAct.copy(ec.getAttribute('data-edi-copy')); return; } const ek = t.closest('[data-edi-pick]'); if (ek) { await ediAct.pick(ek.getAttribute('data-edi-pick')); return; }
    const ed = t.closest('[data-ins-edit]'); if (ed) { const ym = ed.getAttribute('data-ins-edit'); const b = ym && st.data && st.data.bills[ym]; st.form = b ? { ym, pension: b.pension, health: b.health, ltcare: b.ltcare, unpaid: b.unpaid || '', exists: true } : { ym: ym || '', pension: '', health: '', ltcare: '', unpaid: '', exists: false }; paint(); const fe = body.querySelector('[data-ins-form]'); if (fe && fe.scrollIntoView) fe.scrollIntoView({ block: 'nearest' }); return; }
    const act = t.closest('[data-ins-act]'); if (!act || st.busy || !st.form) return; const a = act.getAttribute('data-ins-act');
    if (a === 'cancel') { st.form = null; paint(); return; }
    const v = readForm(); const ym = st.form.exists ? st.form.ym : v.ym;
    if (a === 'save') { st.form = Object.assign({}, st.form, v, { ym }); st.busy = true; paint(); try { await io.saveBill(ym, v, me()); st.data.bills = await io.loadBills(); st.form = null; toast('✅ ' + ym + ' 고지금액을 저장했습니다.'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } st.busy = false; paint(); return; }
    if (a === 'delete') { const c0 = await confirmDialog({ title: ym + ' 고지금액 삭제', body: ym + ' 고지금액(연금·건강·장기요양·미납액)을 지웁니다. 다시 입력하면 됩니다.', confirmLabel: '삭제', variant: 'danger' }); if (!c0 || !c0.ok) return; st.busy = true; paint(); try { await io.deleteBill(ym); st.data.bills = await io.loadBills(); st.form = null; toast('🗑 ' + ym + ' 고지금액을 삭제했습니다.'); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } st.busy = false; paint(); }
  };
  // 처리기를 먼저 연결한 뒤 불러온다 — 전환 단추는 로딩 중에도 보이므로 그 사이에 눌러도 사라지지 않게(실제 테섭 확인에서 발견)
  paint(); try { st.data = await io.load(); } catch (e) { st.error = (e && e.message) || String(e); } st.loading = false; paint();
}
export async function mountLedger(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const now = new Date(); const st = { ym: now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), loading: true, error: '', busy: false, data: null, unlockOpen: false, reason: '' };
  const io = makeLedgerIo({ db, doc, getDoc, getDocs, collection, query, where, updateDoc, writeBatch, serverTimestamp });
  const me = () => String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  root.innerHTML = '<div class="jh-hr"><div id="l-body"></div></div>'; const body = root.querySelector('#l-body');
  const paint = () => { body.innerHTML = ledgerPageHtml(st); };
  let seq = 0;
  const load = async () => { const my = ++seq; st.loading = true; st.error = ''; paint(); try { const d = await io.loadMonth(st.ym); if (my !== seq) return; st.data = d; } catch (e) { if (my !== seq) return; st.data = null; st.error = (e && e.message) || String(e); } st.loading = false; paint(); };
  const download = (name, text) => { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-l-month]') && isYm(t.value) && t.value !== st.ym) { st.ym = t.value; st.unlockOpen = false; st.reason = ''; load(); } };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-l-reason]')) st.reason = t.value; };
  root.onclick = async (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('[data-l-act]') : null; if (!t || t.disabled || st.busy) return; const act = t.getAttribute('data-l-act'); const d = st.data;
    if (act === 'csv' && d) { download('임금대장_' + st.ym + '.csv', ledgerCsv(d.rows, st.ym)); return; }
    if (act === 'print' && d) { openDocWindow({ html: ledgerHtml(d.rows, st.ym), title: '임금대장 ' + st.ym, toast }); return; }
    if (act === 'unlock') { st.unlockOpen = true; paint(); const ta = root.querySelector('[data-l-reason]'); if (ta) ta.focus(); return; }
    if (act === 'unlock-cancel') { st.unlockOpen = false; st.reason = ''; paint(); return; }
    if (act === 'close' && d) {
      const w = d.checks.warnings.length;
      const c = await confirmDialog({ title: st.ym + ' 임금대장 마감', body: d.rows.length + '명의 ' + st.ym + ' 급여명세서를 마감합니다. 마감하면 이 달 급여명세서를 고치거나 지울 수 없습니다(해제하려면 사유를 남겨야 하고 기록이 남습니다).' + (w ? ' 확인 사항이 ' + w + '건 있습니다.' : ''), confirmLabel: '마감' });
      if (!c || !c.ok) return;
      st.busy = true; try { const r = await io.closeMonth(st.ym, d, me()); toast('✅ ' + st.ym + ' 마감했습니다(v' + r.version + ', ' + r.count + '명)'); } catch (e) { toast('마감하지 못했습니다: ' + ((e && e.message) || '')); } st.busy = false; await load(); return;
    }
    if (act === 'unlock-do') { st.busy = true; try { await io.unlockMonth(st.ym, me(), st.reason); toast('🔓 마감을 해제했습니다. 이력에 남았습니다.'); st.unlockOpen = false; st.reason = ''; } catch (e) { toast('해제하지 못했습니다: ' + ((e && e.message) || '')); } st.busy = false; await load(); }
  };
  await load();
}
