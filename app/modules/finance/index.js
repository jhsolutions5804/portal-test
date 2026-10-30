import { esc, toast } from '../../core/ui.js?v=20261030a';
import { buildPendingRows, groupByMonth, confirmItems, autoProposeAfterImport, splitDraft, splitLeftText, buildConfirmedRows, ruleDraft } from './pjt-tag-logic.js?v=20261030a';
import { proposeNewPjt, setPjtTag, clearPjtTag, listPjtRules, savePjtRule } from './data.js?v=20261030a';
import { confirmDialog } from '../../core/dialog.js?v=20261030a';
import { readSpreadsheet } from '../../shared/xls-read.js?v=20261030a';
import { parseTaxInvoiceWorkbook } from '../../shared/hometax-import.js?v=20261030a';
import { CHOICE_ACCOUNT } from '../../shared/merchant-table.js?v=20261030a';
import { parseBankSheets } from '../../shared/bank-import.js?v=20261030a';
import { ownerSettlementKeys } from '../../shared/bank-classify.js?v=20261030a';
import { parseCardWorkbook } from '../../shared/card-import.js?v=20261030a';
import { monthlyView, monthlyCsv, MP_SEED, npayPlan, npayGuess, summarize, filterEntries, statements, statementCsv, openingFromForm, previewTaxInvoices, previewBank, previewCards, parseEntriesJson, manualEntry, expenseEntryFromForm, accountName, entryDocId, monthEnd, kstToday, receiptFileProblem, receiptToForm, previewPayroll, applyMerchantTable, mergeRules, purchaseKey, gapEntry, reclassLines, forecastBase, forecastAssume, forecastRun, forecastCsv, vatPick, vatReport, vatForm, vatCsv, accountLedger, partnerBalances, bankReconcile, ledgerCsv, bankRuleFromForm, ruleReclassPlan, netByAccount, verifyReclass, reclassDefaultDate, bulkReclassPlan, entryDebit, openingToForm, closeCheck, merchantTableCsv, parseCsvRows, arByMonth, taxSalesSupplyByMonth, revenueTriple, reportPrintTitle } from './logic.js?v=20261030a';
import { loadLedger, loadProjects, loadPjtTags, confirmPjtTags, postEntries, markReviewed, reverseEntry, lockThrough, saveSettings, saveMerchantRules, recordImport, readReceipt, readNpay, saveMonthlyPlan, getReceiptFile, readPayroll, reclassifyEntry, savePurchaseRules, saveBankRules, attachEvidence, getAttachment, assignEntries, loadInvoiceMonthly } from './data.js?v=20261030a';
import { pjtTagHtml, pjtSplitDialogHtml, pjtRuleDialogHtml, monthlyHtml, forecastHtml, homeHtml, entriesHtml, entryDialogHtml, manualDialogHtml, importHtml, reportsHtml, openingHtml, settingsHtml, expenseHtml, gapHtml, rulesHtml, reclassHtml, bulkReclassHtml } from './view.js?v=20261030a';

/** 재무회계 — 복식 원장·가져오기·재무제표. 영업기획·인사총무와 분리된 영역(관리자·재무회계팀·perms.finance). 설계: 기획_재무제표_설계_r1.md */
import { financePerm } from '../../shared/finance-perm.js?v=20261030a';
import { printWithTitle } from '../../shared/print-title.js?v=20261030a';
/** 실제 메뉴 등록은 공용 틀(modules/legacy/list.js 의 finance 정의 — 인사총무와 같은 사이드바·내용 영역). 여기의 값은 규약(manifest+mount)용이며 권한은 같은 함수를 쓴다 */
export const manifest = { id: 'finance', order: 25, title: '재무회계', icon: '📒', defaultHash: '#/finance/home', perm: financePerm };
const S = { data: null, filter: { from: '', to: '', source: '', review: false, reviewed: false, assignee: '', q: '' }, limit: 100, imp: { kind: 'taxsales', busy: false, error: '', preview: null, userRules: {}, acctBySupplier: {}, raw: null }, rep: { kind: 'is', from: '', to: '', acct: '2010', pacct: '2010', q: '', zero: false, vatKey: '', vatForm: (() => { try { return JSON.parse(localStorage.getItem('jh_fin_vatform_v1') || '{}') || {}; } catch (e) { return {}; } })() }, openDate: '2026-01-01', admin: false, rl: null, chk: null, chkDate: '', openEditId: '', sel: new Set(), mp: { ym: kstToday().slice(0, 7), manage: false, draft: null, view: null }, fc: { over: (() => { try { return JSON.parse(localStorage.getItem('jh_fin_fc_v1') || '{}') || {}; } catch (e) { return {}; } })(), scen: 'base' } };
const existingIds = () => new Set(S.data.entries.map((e) => e.id));
const lastDate = () => S.data.entries.reduce((m, e) => (e.date > m ? e.date : m), '');
function stmNow() {
  if (!S.rep.to) { const last = lastDate() || kstToday(); S.rep.from = last.slice(0, 4) + '-01-01'; S.rep.to = monthEnd(last.slice(0, 7)); }
  return statements(S.data.entries, S.rep.from, S.rep.to);
}
async function readBuf(file) { if (file.arrayBuffer) return new Uint8Array(await file.arrayBuffer()); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = rej; r.readAsArrayBuffer(file); }); }
async function readText(file) { if (file.text) return file.text(); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file); }); }
function download(name, text) { const b = new Blob([text], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

/* 대화창(전표 상세·수기 전표) — 확인 창(core/dialog)과 같은 모양 */
function openPanel(title, bodyHtml, actions) {
  const wrap = document.createElement('div'); wrap.className = 'jh-dialog jh-finance__dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel"><h3 class="jh-dialog__title">' + esc(title) + '</h3><div class="jh-dialog__body">' + bodyHtml + '<div data-panel-msg></div></div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-close>닫기</button>' + (actions || []).map((a) => '<button type="button" class="jh-btn" data-variant="' + (a.variant || 'primary') + '" data-act="' + a.act + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
  document.body.appendChild(wrap); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const close = () => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev; };
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  document.addEventListener('keydown', onKey, true); wrap.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); });
  return { el: wrap, close, msg: (html) => { wrap.querySelector('[data-panel-msg]').innerHTML = html; } };
}
const msgHtml = (tone, t) => '<div class="jh-alert" data-tone="' + tone + '" role="alert">' + esc(t) + '</div>';

function RC_RESET() { if (S.rc) S.rc.current = null; }
export async function mount(root, route, ctx) {
  const me = (ctx && ctx.me) || {}; S.admin = me.admin === true;
  const tab = ['home', 'entries', 'expense', 'import', 'reports', 'monthly', 'forecast', 'gap', 'rules', 'opening', 'settings', 'pjt'].includes(route.segs[0]) ? route.segs[0] : 'home';
  root.onclick = null; root.onchange = null; root.oninput = null; root.ondragover = null; root.ondragleave = null; root.ondrop = null; if (root.__finFocusOut) { root.removeEventListener('focusout', root.__finFocusOut); root.__finFocusOut = null; } root.onkeydown = null;
  root.innerHTML = '<div class="jh-finance' + (tab === 'home' ? ' jh-finance--wide' : '') + '"><div id="fin-body" class="jh-finance__body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';   // 사이드바는 공용 틀(인사총무와 같은 모양)이 그린다
  const body = root.querySelector('#fin-body');
  const paint = () => {
    S.data.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0)));
    const sum = summarize(S.data.entries); const stm = stmNow(); const st = Object.assign({}, S, S.data, { projects: S.projects || [], sum, stm, list: filterEntries(S.data.entries, S.filter) });
    if (tab === 'monthly') { S.data.plan = S.data.plan || { items: [], overrides: {} }; S.mp.view = monthlyView(S.data.entries, S.data.plan, S.mp.ym); st.mp = S.mp; st.plan = S.data.plan; }
    if (tab === 'gap') { st.inv = S.inv; st.revT = revenueTriple(arByMonth(S.data.entries), taxSalesSupplyByMonth(S.data.entries), S.inv.data); }
  if (tab === 'forecast') { const base = forecastBase(S.data.entries); const as = forecastAssume(base, S.fc.over); const runs = {}; as.scen.forEach((sc) => { runs[sc.key] = forecastRun(base, as.A, sc); }); st.fc = S.fc; st.fcm = { base, A: as.A, auto: as.auto, scen: as.scen, runs }; S.fcm = st.fcm; }
    body.innerHTML = tab === 'home' ? homeHtml(st) : tab === 'entries' ? entriesHtml(st) : tab === 'expense' ? expenseHtml(st) : tab === 'import' ? importHtml(st) : tab === 'reports' ? reportsHtml(st) : tab === 'monthly' ? monthlyHtml(st) : tab === 'forecast' ? forecastHtml(st) : tab === 'opening' ? openingHtml(st) : tab === 'gap' ? gapHtml(st) : tab === 'pjt' ? pjtTagHtml(S.pt) : tab === 'rules' ? rulesHtml(st) : settingsHtml(st);
    body.removeAttribute('aria-busy');
  };
  /* 월별 매출 세 숫자(이엔지 정산 탭): 청구서 합계는 서버(marginAct invoiceMonthly, 정산서만 읽는 가벼운 동작)에서 받고 세금계산서·통장 입금은 이미 읽은 전표에서 계산한다. 이 탭을 열 때 한 번만 부르고(기다리지 않고 화면을 먼저 그린다) 부르는 중에는 다시 부르지 않는다. 실패해도 세금계산서·통장 입금은 그대로 보인다 */
  const invLoad = async () => {
    if (S.inv.state === 'loading') return;
    S.inv = { state: 'loading', data: null, error: '' }; paint();
    try { const d = await loadInvoiceMonthly(); S.inv = { state: 'ok', data: d, error: '' }; }
    catch (e) { const code = String((e && e.code) || '').replace(/^functions\//, ''); S.inv = code === 'permission-denied' ? { state: 'denied', data: null, error: '' } : { state: 'error', data: null, error: String((e && e.message) || '').replace(/^(functions\/)?[a-z-]+:\s*/i, '') || '청구서 매출을 불러오지 못했습니다.' }; }
    if (tab === 'gap') paint();
  };
  /* 날짜 입력: 한 글자·한 칸마다 화면을 다시 그리면 입력이 끊기므로, 올바른 날짜가 된 뒤 잠깐 멈추거나(0.7초) 칸을 나갈 때 한 번만 적용 */
  let dTimer = 0, dPending = null;
  const validDate = (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990 && Number(v.slice(0, 4)) <= 2100);
  const dateFlush = () => { clearTimeout(dTimer); dTimer = 0; const el = dPending; dPending = null; const sel = el && (el.getAttribute('data-f') ? '[data-f="' + el.getAttribute('data-f') + '"]' : '[data-rep="' + el.getAttribute('data-rep') + '"]'); const had = !!el && document.activeElement === el; paint(); if (had && sel) { const n = body.querySelector(sel); if (n) n.focus(); } };
  const dateApply = (t, apply) => { dPending = t; clearTimeout(dTimer); dTimer = 0; if (!validDate(t.value)) return; apply(); dTimer = setTimeout(dateFlush, 700); };
  const rlInit = () => { S.rl = { rr: (S.rl && S.rl.rr) || {}, merchant: S.data.rules.map((r) => Object.assign({}, r)), purchase: (S.data.purchaseRules || []).map((r) => Object.assign({}, r)), bank: (S.data.bankRules || []).map((r) => Object.assign({}, r)), q: '', dirtyM: false, dirtyP: false, dirtyB: false, upload: null, error: '' }; };
  const reload = async () => { S.data = await loadLedger(); if (tab === 'rules') rlInit(); if (!S.chkDate) S.chkDate = monthEnd((lastDate() || kstToday()).slice(0, 7)); };
  /* ───── 프로젝트 표시(대기 목록): 읽기 → 계산(pjt-tag-logic) → 화면(pjtTagHtml) → 확정(서버 pjtTagBatch) ───── */
  if (!S.inv) S.inv = { state: 'idle', data: null, error: '' };
  if (!S.pt) S.pt = { busy: false, msg: '', sel: {}, open: {}, rows: [], months: [], names: {}, tags: {}, proposals: {}, doneGroups: [], doneOpen: false, ruleOpen: false, ruleState: 'ok', rules: [], ruleWarnings: [], ruleLoaded: false };
  const ptRebuild = () => { const rows = buildPendingRows(S.data.entries, S.pt.proposals, S.pt.tags); S.pt.rows = rows; S.pt.months = groupByMonth(rows); S.pt.doneGroups = buildConfirmedRows(S.data.entries, S.pt.tags, { grouped: true }); const alive = new Set(rows.map((r) => r.id)); Object.keys(S.pt.sel).forEach((k) => { if (!alive.has(k)) delete S.pt.sel[k]; }); };
  async function ptLoad() { const d = await loadPjtTags(); S.pt.tags = d.tags; S.pt.proposals = d.proposals; S.pt.names = d.names; ptRebuild(); }
  async function ptConfirm(rows, label) {
    const items = confirmItems(rows); if (!items.length) { S.pt.msg = '확정할 수 있는 줄이 없습니다. 제안이 없거나 직접 지정이 필요한 줄은 확정할 수 없습니다.'; paint(); return; }
    const ok = await confirmDialog({ title: '프로젝트 확정', body: label + ' ' + items.length + '줄을 제안대로 확정합니다. 전표의 금액·계정은 바뀌지 않고 프로젝트 표시만 저장되며, 나중에 바꾸거나 해제할 수 있습니다(이전 지정은 이력에 남습니다).', confirmLabel: '확정' }); if (!ok.ok) return;
    S.pt.busy = true; S.pt.msg = ''; paint();
    try { const r = await confirmPjtTags(items); await ptLoad(); S.pt.msg = r.saved + '줄을 확정했습니다.' + (r.rejected.length ? ' ' + r.rejected.length + '줄은 서버가 받지 않았습니다: ' + r.rejected.slice(0, 3).map((x) => x.message).join(' / ') : ''); } catch (e) { S.pt.msg = '확정하지 못했습니다. ' + ((e && e.message) || ''); } finally { S.pt.busy = false; paint(); }
  }
  const ptCount = () => { const el = root.querySelector('[data-pt-selcount]'); if (el) el.textContent = '선택 ' + S.pt.rows.filter((r) => S.pt.sel[r.id]).length + '줄'; };
  /* 줄 직접 지정 패널(서버 pjtTagSet) — 프로젝트·금액 칸을 직접 채워 한 줄을 하나 이상의 프로젝트로 지정한다. 입력 검사는 순수 함수 splitDraft(서버 규칙과 같음, 최종 판단은 서버).
   * 열려 있는 동안 서버 호출 없음 · 저장 중에는 잠가 두 번 눌러도 한 번만 · 서버가 거절하면 패널·입력을 그대로 두고 사유를 보여 준다 · 닫기·Esc 는 아무것도 저장하지 않는다 */
  function openSplit(row, redo) {
    const amount = Math.abs(Number(row.amount) || 0); let working = false;
    const p = openPanel((redo ? '프로젝트 다시 지정 — ' : '프로젝트 지정 — ') + row.no, pjtSplitDialogHtml(row, S.pt.names), [{ act: 'save', label: '저장' }]);
    if (redo) p.msg(msgHtml('info', '이미 확정된 줄입니다. 저장하면 지정이 바뀌고 이전 지정은 기록에 남습니다.'));
    const gather = () => [...p.el.querySelectorAll('.jh-fin__spcell')].map((c) => ({ pjt: c.querySelector('[data-sp-pjt]').value, amount: c.querySelector('[data-sp-amt]').value }));
    const refresh = () => { const rows = gather(); const d = splitDraft(amount, rows); const el = p.el.querySelector('[data-sp-left]'); el.textContent = splitLeftText(amount, rows); el.setAttribute('data-tone', d.ok ? 'ok' : (d.remaining < 0 ? 'warn' : 'info')); return d; };
    p.el.addEventListener('input', refresh); p.el.addEventListener('change', refresh);
    p.el.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-sp-add]')) { const box = p.el.querySelector('[data-sp-cells]'); if (box.children.length >= 12) { p.msg(msgHtml('info', '한 줄은 최대 12개 프로젝트까지 나눌 수 있습니다.')); return; } const last = box.lastElementChild; box.insertAdjacentHTML('beforeend', last.outerHTML.replace(/ selected/g, '')); const c = box.lastElementChild; c.querySelector('[data-sp-amt]').value = ''; c.querySelector('[data-sp-pjt]').selectedIndex = 0; refresh(); return; }
      const sv = ev.target.closest('[data-act="save"]'); if (!sv) return; if (working) return;
      const d = refresh(); if (!d.ok) { p.msg(msgHtml('danger', d.error)); return; }
      working = true; sv.disabled = true; p.msg('');
      try { await setPjtTag({ entryId: row.entryId, lineIdx: row.lineIdx, method: d.method, splits: d.splits, note: (p.el.querySelector('[data-sp-note]').value || '').trim() }); toast('프로젝트를 지정했습니다.'); p.close(); S.pt.msg = '프로젝트를 지정했습니다(' + row.no + ').'; await ptLoad(); paint(); }
      catch (e) { working = false; sv.disabled = false; p.msg(msgHtml('danger', (e && e.message) || '저장하지 못했습니다.')); }
    });
  }
  /* 거래처 규칙(서버 pjtRuleList·pjtRuleSave) — 규칙은 제안의 입력일 뿐 확정이 아니다. 구역을 처음 펼칠 때 한 번 읽고(접었다 펴도 다시 읽지 않음, 못 읽었을 때만 [다시 불러오기]), 저장 뒤에는 다시 읽는다.
   * 패널은 입력 검사(ruleDraft — 서버 규칙과 같음)를 통과해야 서버를 부르고, 저장 중에는 잠그며, 서버가 거절하면 패널·입력을 그대로 두고 이유를 보여 준다 */
  async function loadRules() { S.pt.ruleState = 'loading'; paint(); try { const d = await listPjtRules(); S.pt.rules = Array.isArray(d && d.rules) ? d.rules : []; S.pt.ruleWarnings = Array.isArray(d && d.warnings) ? d.warnings : []; S.pt.ruleLoaded = true; S.pt.ruleState = 'ok'; } catch (e) { S.pt.ruleState = 'error'; } paint(); }
  function openRule(rule) {
    let working = false; const p = openPanel(rule ? '거래처 규칙 수정 — ' + rule.partner : '거래처 규칙 추가', pjtRuleDialogHtml(rule, S.pt.names), [{ act: 'save', label: '저장' }]);
    const gather = () => ({ partner: p.el.querySelector('[data-rd-partner]').value, accounts: [...p.el.querySelectorAll('[data-rd-acc]:checked')].map((c) => c.value), mode: (p.el.querySelector('[data-rd-mode]:checked') || {}).value || '', pjt: p.el.querySelector('[data-rd-pjt]').value, note: p.el.querySelector('[data-rd-note]').value, active: p.el.querySelector('[data-rd-active]').checked });
    p.el.addEventListener('change', (ev) => { if (ev.target.closest('[data-rd-mode]')) p.el.querySelector('[data-rd-pjtbox]').hidden = gather().mode === 'manday'; });
    p.el.addEventListener('click', async (ev) => {
      const sv = ev.target.closest('[data-act="save"]'); if (!sv || working) return;
      const d = ruleDraft(gather()); if (!d.ok) { p.msg(msgHtml('danger', d.error)); return; }
      working = true; sv.disabled = true; p.msg('');
      try { await savePjtRule(d.rule); toast('거래처 규칙을 저장했습니다.'); p.close(); S.pt.msg = '거래처 규칙을 저장했습니다(' + d.rule.partner + '). 새 전표부터 적용되고 이미 만든 제안은 바뀌지 않습니다.'; await loadRules(); }
      catch (e) { working = false; sv.disabled = false; p.msg(msgHtml('danger', (e && e.message) || '저장하지 못했습니다.')); }
    });
  }
  async function ptClick(ev) {
    if (tab !== 'pjt') return false; const t = ev.target; if (!t || !t.closest) return false;
    const rt = t.closest('[data-pt-rules-toggle]'); if (rt) { ev.preventDefault(); S.pt.ruleOpen = !S.pt.ruleOpen; if (S.pt.ruleOpen && !S.pt.ruleLoaded && S.pt.ruleState !== 'loading') await loadRules(); else paint(); return true; }
  const rr = t.closest('[data-pt-rules-retry]'); if (rr) { ev.preventDefault(); if (!S.pt.busy && S.pt.ruleState !== 'loading') await loadRules(); return true; }
  const ra = t.closest('[data-pt-rule-add]'); if (ra) { ev.preventDefault(); if (!S.pt.busy) openRule(null); return true; }
  const re = t.closest('[data-pt-rule-edit]'); if (re) { ev.preventDefault(); if (!S.pt.busy) { const r = S.pt.rules.find((x) => x.id === re.getAttribute('data-pt-rule-edit')); if (r) openRule(r); } return true; }
  const rg = t.closest('[data-pt-rule-toggle]'); if (rg) { ev.preventDefault(); if (S.pt.busy) return true; const r = S.pt.rules.find((x) => x.id === rg.getAttribute('data-pt-rule-toggle')); if (!r) return true;
    S.pt.busy = true; S.pt.msg = ''; paint();
    try { await savePjtRule({ partner: r.partner, accounts: r.accounts, mode: r.mode, pjt: r.pjt, note: r.note, active: r.active === false }); await loadRules(); S.pt.msg = '거래처 규칙을 ' + (r.active === false ? '켰습니다' : '껐습니다') + '(' + r.partner + ').'; } catch (e) { S.pt.msg = '규칙을 바꾸지 못했습니다. ' + ((e && e.message) || ''); }
    S.pt.busy = false; paint(); return true; }
  const dt = t.closest('[data-pt-done-toggle]'); if (dt) { ev.preventDefault(); S.pt.doneOpen = !S.pt.doneOpen; paint(); return true; }
  const rd = t.closest('[data-pt-redo]'); if (rd) { ev.preventDefault(); if (!S.pt.busy) { const id = rd.getAttribute('data-pt-redo'); const row = (S.pt.doneGroups || []).flatMap((g) => g.rows).find((r) => r.id === id); if (row) openSplit(row, true); } return true; }
  const ud = t.closest('[data-pt-undo]'); if (ud) { ev.preventDefault(); if (S.pt.busy) return true; const id = ud.getAttribute('data-pt-undo'); const row = (S.pt.doneGroups || []).flatMap((g) => g.rows).find((r) => r.id === id); if (!row) return true;
    const okd = await confirmDialog({ title: '프로젝트 표시 해제', body: row.no + ' 줄의 프로젝트 표시를 해제합니다.\n해제하면 대기 목록으로 돌아가고, 영업기획 마진율·월간 보고서 값이 바뀔 수 있습니다. 이전 지정은 기록에 남습니다.', confirmLabel: '해제' }); if (!okd || !okd.ok) return true;
    if (S.pt.busy) return true; S.pt.busy = true; S.pt.msg = ''; paint();
    try { await clearPjtTag({ entryId: row.entryId, lineIdx: row.lineIdx }); await ptLoad(); S.pt.msg = row.no + ' 줄의 프로젝트 표시를 해제했습니다. 대기 목록으로 돌아갔습니다.'; } catch (e) { S.pt.msg = '해제하지 못했습니다. ' + ((e && e.message) || ''); }
    S.pt.busy = false; paint(); return true; }
  const ed = t.closest('[data-pt-edit]'); if (ed) { ev.preventDefault(); if (!S.pt.busy) { const row = S.pt.rows.find((r) => r.id === ed.getAttribute('data-pt-edit')); if (row) openSplit(row); } return true; }
  const cm = t.closest('[data-pt-confirm-month]'); const cs = t.closest('[data-pt-confirm-sel]'); const ck = t.closest('[data-pt-row]'); const cl = t.closest('[data-pt-clear]'); const pm = t.closest('[data-pt-pick-month]');
    if (ck) { if (!S.pt.busy) { const id = ck.getAttribute('data-pt-row'); if (ck.checked) S.pt.sel[id] = true; else delete S.pt.sel[id]; ptCount(); } return true; }
    if (pm) { ev.preventDefault(); if (!S.pt.busy) { const m = S.pt.months.find((x) => x.month === pm.getAttribute('data-pt-pick-month')); if (m) { m.rows.filter((r) => r.confirmable).forEach((r) => { S.pt.sel[r.id] = true; }); root.querySelectorAll('[data-pt-row]').forEach((c) => { c.checked = !!S.pt.sel[c.getAttribute('data-pt-row')]; }); ptCount(); } } return true; }
    if (cl) { ev.preventDefault(); if (!S.pt.busy) { S.pt.sel = {}; root.querySelectorAll('[data-pt-row]').forEach((c) => { c.checked = false; }); ptCount(); } return true; }
    if (!cm && !cs) return false; ev.preventDefault(); if (S.pt.busy) return true;
    if (cm) { const m = S.pt.months.find((x) => x.month === cm.getAttribute('data-pt-confirm-month')); if (m) await ptConfirm(m.rows, m.month + '의'); return true; }
    const picked = S.pt.rows.filter((r) => S.pt.sel[r.id]); if (!picked.length) { S.pt.msg = '확정할 줄을 먼저 선택해 주세요.'; paint(); return true; }
    await ptConfirm(picked, '선택한'); return true;
  }
  RC_RESET();
  try { await reload(); if (tab === 'expense' && !S.projects) S.projects = await loadProjects(); if (tab === 'pjt') await ptLoad(); paint(); if (tab === 'gap' && S.inv.state === 'idle') invLoad(); if (tab === 'expense') setTimeout(() => { rcShow(); rcRender(); }, 0); } catch (e) { console.error('재무회계 불러오기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 재무회계 권한이 있는 계정인지 확인해 주세요. (' + esc(e.code || e.message) + ')</div>'; return; }

  /* ───── 가져오기 ───── */
  const setImp = (patch) => { Object.assign(S.imp, patch); paint(); };
  async function buildPreview() {
    const k = S.imp.kind; const raw = S.imp.raw; if (!raw) return;
    const have = existingIds();
    if (k === 'taxsales' || k === 'taxpurchase') { const p = previewTaxInvoices(raw.parsed, k === 'taxsales' ? 'sales' : 'purchase', S.data.settings.ownBiz, have, S.imp.acctBySupplier, S.data.purchaseRules); S.imp.preview = p; }
    else if (k === 'bank') { const ctx2 = { ownerSettle: raw.nh ? ownerSettlementKeys(raw.bank.txns, raw.nh.txns) : undefined, userRules: S.data.bankRules || [] }; const p = previewBank(raw.bank.txns, ctx2, have); p.bank = raw.bank; p.warnings = []; if (raw.bank.balanceBreaks) p.warnings.push('통장 잔액이 이어지지 않는 곳이 ' + raw.bank.balanceBreaks + '곳 있습니다 — 빠진 거래가 있는지 확인해 주세요.'); if (raw.bank.totalsOk === false) p.warnings.push('파일의 합계 줄과 거래 합계가 다릅니다.'); if (raw.nh) p.warnings.push('농협 개인 계좌 거래내역을 참고해 개인카드 대금 정산 이체를 짝지었습니다.'); S.imp.preview = p; }
    else if (k === 'card') { const merged = {}; S.data.rules.forEach((r) => { merged[r.issuer + '|' + r.key] = r; }); Object.assign(merged, S.imp.userRules); const p = previewCards(raw.items, Object.values(merged), have); p.warnings = raw.warnings || []; S.imp.preview = p; }
    else if (k === 'payroll') { S.imp.preview = previewPayroll(raw.payroll, have, S.data.entries); }
    else if (k === 'json') { const have2 = have; const fresh = raw.entries.filter((e) => { const id = entryDocId(e); return !(id && have2.has(id)); }); S.imp.preview = { entries: raw.entries, errors: raw.errors, fresh, dupCount: raw.entries.length - fresh.length }; }
  }
  /* ───── 월간 수지: 고정지출 항목·월별 조정 저장(서버 함수 경유, 순서대로) ───── */
  let mpChain = Promise.resolve();
  const mpPlan = () => { S.data.plan = S.data.plan || { items: [], overrides: {} }; S.data.plan.overrides = S.data.plan.overrides || {}; return S.data.plan; };
  const mpSave = () => { const plan = JSON.parse(JSON.stringify(mpPlan())); mpChain = mpChain.then(() => saveMonthlyPlan(plan)).then(() => toast('월간 수지를 저장했습니다.'), (e) => toast((e && e.message) || '저장하지 못했습니다.')); return mpChain; };
  const mpOv = (ym) => { const p = mpPlan(); p.overrides[ym] = p.overrides[ym] || {}; p.overrides[ym].items = p.overrides[ym].items || {}; return p.overrides[ym]; };
  const mpClean = (ym) => { const p = mpPlan(); const o = p.overrides[ym]; if (!o) return; Object.keys(o.items || {}).forEach((id) => { const e = o.items[id]; if (!e || (e.amount === undefined && !e.skip && !e.note)) delete o.items[id]; }); if (o.items && !Object.keys(o.items).length) delete o.items; if (o.rev === undefined && !o.items) delete p.overrides[ym]; };
  const mpNum = (v) => { const n = Number(String(v).replace(/[,\s원]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
  const mpDraftRead = () => { const d = S.mp.draft; if (!d) return null; body.querySelectorAll('[data-mpf]').forEach((i) => { d[i.getAttribute('data-mpf')] = i.value; }); return d; };
  /* ───── 네이버페이 영수증 여러 장 읽기(서버가 한 장씩 읽어 값만 돌려줌 — 동시에 3장) ───── */
  const NPAY_MAX = 200;
  function npayRebuild() { const n = S.imp.npay; if (!n) return; const plan = npayPlan(n.items, S.data.entries); S.imp.preview = { npay: true, plan, fresh: plan.entries, dupCount: plan.counts.dup + plan.counts.dupfile, warnings: [] }; S.imp.raw = { fileName: '네이버페이 영수증 ' + n.items.length + '장' }; }
  async function npayRun(list) {   // list: [{ f: File, idx }]
    const n = S.imp.npay; const queue = list.slice(); let fatal = '', streak = 0, last = '', done = 0; const total = list.length;
    const prog = () => { const el = body.querySelector('[data-np-prog]'); if (el) el.textContent = '영수증을 읽는 중… ' + done + ' / ' + total + '장'; };
    const worker = async () => {
      while (queue.length && !fatal) {
        const { f, idx } = queue.shift(); const it = { idx, fileName: f.name, file: f };
        try { const prob = receiptFileProblem(f); if (prob) throw new Error(prob); const pf = await prepare(f); const r = await readNpay(pf.name, pf.mime, pf.b64); it.status = 'ok'; it.ex = r.extracted; it.warnings = r.warnings || []; it.choice = npayGuess(it.ex.item, it.ex.seller) || 'ask'; streak = 0; last = ''; }
        catch (e) { it.status = 'error'; it.error = e.message || '읽지 못했습니다.'; if (it.error === last) streak++; else { last = it.error; streak = 1; } if (streak >= 3 && /키|설정|크레딧|한도|권한|서비스|연결/.test(it.error)) fatal = it.error; }
        n.items = n.items.filter((x) => x.idx !== idx); n.items.push(it); done++; prog();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    queue.forEach(({ f, idx }) => { n.items = n.items.filter((x) => x.idx !== idx); n.items.push({ idx, fileName: f.name, file: f, status: 'error', error: '읽지 않음(중단됨)' }); });
    return fatal;
  }
  async function onNpay(files) {
    if (files.length > NPAY_MAX) { setImp({ error: '한 번에 ' + NPAY_MAX + '장까지 읽을 수 있습니다(' + files.length + '장을 골랐습니다). 나눠서 올려 주세요.' }); return; }
    S.imp.npay = { items: [] }; setImp({ busy: true, error: '', preview: null, raw: null });
    const fatal = await npayRun(files.map((f, idx) => ({ f, idx })));
    npayRebuild(); setImp({ busy: false, error: fatal ? fatal + ' (남은 영수증은 읽지 않았습니다. 해결한 뒤 "다시 읽기"를 누르세요.)' : '' });
  }
  async function npayRetry() {
    const n = S.imp.npay; if (!n) return; const bad = n.items.filter((x) => x.status === 'error' && x.file); if (!bad.length) return; setImp({ busy: true, error: '' });
    const fatal = await npayRun(bad.map((x) => ({ f: x.file, idx: x.idx }))); npayRebuild(); setImp({ busy: false, error: fatal || '' });
  }
  async function onFile(input) {
    const files = [...(input.files || [])]; if (!files.length) return; if (S.imp.kind === 'npay') { await onNpay(files); return; } setImp({ busy: true, error: '', preview: null, raw: null });
    try {
      const k = S.imp.kind; let raw;
      if (k === 'taxsales' || k === 'taxpurchase') { const wb = await readSpreadsheet(await readBuf(files[0])); const parsed = parseTaxInvoiceWorkbook(wb); if (parsed.error) throw new Error(parsed.error); raw = { parsed, fileName: files[0].name }; }
      else if (k === 'bank') { const wb = await readSpreadsheet(await readBuf(files[0])); const bank = parseBankSheets(wb.sheets); if (bank.error) throw new Error(bank.error); raw = { bank, fileName: files[0].name }; }
      else if (k === 'card') { const items = []; const warnings = []; for (const f of files) { const r = parseCardWorkbook(await readSpreadsheet(await readBuf(f))); if (r.error) { warnings.push(f.name + ': ' + r.error); continue; } if (r.issuer === 'ibk_approval') { warnings.push(f.name + ': IBK 승인내역은 대조용이라 건너뜁니다(매출내역 파일을 올려 주세요).'); continue; } items.push(...r.items); } if (!items.length) throw new Error('읽을 수 있는 카드 이용내역이 없습니다. ' + warnings.join(' ')); raw = { items, warnings, fileName: files.map((f) => f.name).join(', ') }; }
      else { const r = parseEntriesJson(await readText(files[0])); if (!r.entries.length) throw new Error(r.errors[0] || '읽을 수 있는 전표가 없습니다.'); raw = { entries: r.entries, errors: r.errors, fileName: files[0].name }; }
      S.imp.raw = raw; S.imp.userRules = {}; S.imp.acctBySupplier = {}; await buildPreview(); setImp({ busy: false });
    } catch (e) { setImp({ busy: false, error: e.message || '파일을 읽지 못했습니다.' }); }
  }
  async function onFile2(input) {
    const f = input.files && input.files[0]; if (!f || !S.imp.raw || S.imp.kind !== 'bank') return;
    try { const nh = parseBankSheets((await readSpreadsheet(await readBuf(f))).sheets); if (nh.error) throw new Error(nh.error); S.imp.raw.nh = nh; await buildPreview(); paint(); } catch (e) { setImp({ error: e.message }); }
  }
  async function commit() {
    const p = S.imp.preview; if (!p || !p.fresh.length) return; const btn = body.querySelector('[data-act="commit"]'); if (btn) btn.disabled = true;
    try {
      if (S.imp.kind === 'card') { const merged = {}; S.data.rules.forEach((r) => { merged[r.issuer + '|' + r.key] = r; }); Object.assign(merged, S.imp.userRules); if (Object.keys(S.imp.userRules).length) await saveMerchantRules(Object.values(merged)); }
      if (S.imp.kind === 'taxpurchase' && S.imp.remember && Object.keys(S.imp.remember).length) { const add = []; p.rows.forEach((row) => { if (S.imp.remember[row.supKey]) add.push({ key: purchaseKey(row.inv), name: row.inv.supplier.name, account: S.imp.acctBySupplier[row.supKey] || row.account, memo: '가져오기에서 저장' }); }); if (add.length) { const merged = mergeRules(S.data.purchaseRules || [], add, (x) => x.key); await savePurchaseRules(merged); S.imp.remember = {}; } }
      const r = await postEntries(p.fresh); const msg = '저장 ' + r.posted + '건 · 이미 있어 건너뜀 ' + r.duplicates + '건' + (r.rejected.length ? ' · 거부 ' + r.rejected.length + '건(' + r.rejected[0].errors[0] + ')' : '');
      try { await recordImport({ kind: S.imp.kind, fileName: (S.imp.raw && S.imp.raw.fileName) || '', rows: p.fresh.length + (p.dupCount || 0), posted: r.posted, duplicates: r.duplicates }); } catch (e) { /* 이력 기록 실패는 무시 */ }
      toast(msg); await reload(); S.imp.preview = null; S.imp.raw = null; S.imp.npay = null; S.imp.error = ''; S.imp.done = msg; paint(); body.insertAdjacentHTML('afterbegin', '<div class="jh-alert" data-tone="info" role="status">✅ ' + esc(msg) + '</div>');
  /* 가져오기 직후 자동 제안(결정 2026-10-20): 가져오기 결과는 위에서 이미 보여 줬다 — 제안은 그 뒤에 만들고, 실패해도 가져오기는 그대로다(순수 함수가 던지지 않음). 서버 동작이 멱등이라 반복해도 안전 */
  const ap = await autoProposeAfterImport((payload) => proposeNewPjt(payload.dryRun === true), r.posted); if (ap.note) { toast(ap.note); body.insertAdjacentHTML('afterbegin', '<div class="jh-alert" data-tone="info" role="status">' + esc(ap.note) + '</div>'); }
    } catch (e) { setImp({ error: e.message }); }
  }

  /* ───── 전표: 상세·역분개·수기 입력 ───── */
  const ATT_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  async function showAttachment(entryId, aid) {
    const r = await getAttachment(entryId, aid); const bin = atob(r.dataBase64); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); const url = URL.createObjectURL(new Blob([u8], { type: r.mime }));
    const inner = /^image\//.test(r.mime) ? '<img src="' + url + '" alt="' + esc(r.name) + '" style="max-width:100%">' : (r.mime === 'application/pdf' ? '<iframe src="' + url + '" title="' + esc(r.name) + '" style="width:100%;height:60vh;border:0"></iframe>' : '<a class="jh-btn" data-variant="primary" href="' + url + '" download="' + esc(r.name) + '">내려받기 — ' + esc(r.name) + '</a>');
    const pn = openPanel(r.name, inner, []); const old = pn.close; pn.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) URL.revokeObjectURL(url); });
  }
  function openEntry(id) {
    const cur = () => S.data.entries.find((x) => x.id === id); const first = cur(); if (!first) return; const locked = () => S.data.settings.lockedThrough || '';
    const p = openPanel('전표 ' + (first.no || ''), entryDialogHtml(first, !first.reversedBy && !first.reverses, locked()), []);
    /** 저장한 뒤 창을 닫지 않고 그 자리에서 내용만 새로 고침(여러 가지를 이어서 쓸 수 있게) */
    const refresh = async (note) => {
      await reload(); paint(); const e2 = cur(); if (!e2) { p.close(); return; } const panel = p.el.querySelector('.jh-dialog__panel'); const bodyEl = p.el.querySelector('.jh-dialog__body'); const sc = panel.scrollTop, sb = bodyEl.scrollTop;
      bodyEl.innerHTML = entryDialogHtml(e2, !e2.reversedBy && !e2.reverses, locked()) + '<div data-panel-msg></div>'; panel.scrollTop = sc; bodyEl.scrollTop = sb; if (note) p.msg(msgHtml('info', note));
    };
    p.el.addEventListener('change', async (ev) => {
      const f = ev.target.closest('[data-att-file]'); if (!f || !f.files || !f.files[0]) return; const file = f.files[0]; const st = p.el.querySelector('[data-att-status]'); const ext = (file.name.split('.').pop() || '').toLowerCase(); const mime = ATT_EXT[ext] || file.type;
      if (!Object.values(ATT_EXT).includes(mime)) { st.textContent = '사진·PDF·엑셀(.xlsx)·워드(.docx)만 붙일 수 있습니다.'; f.value = ''; return; } if (file.size > 7 * 1024 * 1024) { st.textContent = '파일이 너무 큽니다(7MB 이하).'; f.value = ''; return; }
      st.textContent = '올리는 중…'; try { await attachEvidence(id, file.name, mime, await toB64(file)); toast('증빙을 붙였습니다.'); await refresh('증빙을 붙였습니다: ' + file.name); } catch (er) { st.textContent = er.message; f.value = ''; }
    });
    p.el.addEventListener('click', async (ev) => {
      const av = ev.target.closest('[data-att-view]'); if (av) { try { await showAttachment(id, av.getAttribute('data-att-view')); } catch (er) { p.msg(msgHtml('danger', er.message)); } return; }
      if (ev.target.closest('[data-act="rc-view"]')) { await viewReceipt(cur(), p.el); return; }
      if (ev.target.closest('[data-act="assign"]')) { const nm = p.el.querySelector('[data-assignee]').value.trim(); try { await assignEntries([id], nm); toast(nm ? '담당자를 ' + nm + '(으)로 지정했습니다.' : '담당자를 해제했습니다.'); await refresh(nm ? '담당자를 ' + nm + '(으)로 지정했습니다.' : '담당자를 해제했습니다.'); } catch (er) { p.msg(msgHtml('danger', er.message)); } return; }
      if (ev.target.closest('[data-act="reviewed"]')) { const note = (p.el.querySelector('[data-review-note]') || { value: '' }).value; try { await markReviewed([id], true, note); toast('확인 완료로 표시했습니다.'); await refresh('확인 완료로 표시했습니다.'); } catch (er) { p.msg(msgHtml('danger', er.message)); } return; }
      if (ev.target.closest('[data-act="reclass-open"]')) { const box = p.el.querySelector('[data-reclass]'); if (box.innerHTML) { box.innerHTML = ''; return; } const lk = locked(); const nextOk = lk ? new Date(Date.parse(lk + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10) : ''; const today = kstToday(); box.innerHTML = reclassHtml(cur(), reclassDefaultDate(cur(), lk, today)); return; }
      if (ev.target.closest('[data-act="reclass-save"]')) {
        const e = cur(); const changes = {}; p.el.querySelectorAll('[data-rc-acc]').forEach((sel) => { const k = Number(sel.getAttribute('data-rc-acc')); if (sel.value !== e.lines[k].account) changes[k] = sel.value; }); const partners = {}; p.el.querySelectorAll('[data-rc-partner]').forEach((inp) => { const k = Number(inp.getAttribute('data-rc-partner')); if (inp.value.trim() !== (inp.getAttribute('data-rc-init') || '')) partners[k] = inp.value.trim(); }); const r = reclassLines(e, changes, partners); if (!r.ok) { p.msg(msgHtml('danger', r.errors[0])); return; }
        const date = p.el.querySelector('[data-rc-date]').value; if (!date) { p.msg(msgHtml('danger', '새 전표 일자를 입력해 주세요.')); return; } const memo = p.el.querySelector('[data-rc-memo]').value.trim();
        const ok = await confirmDialog({ title: '계정 바꾸기(재분류)', body: e.no + ' 전표의 ' + r.changed + '줄(계정·거래처)을 바꿉니다. 원 전표는 ' + date + ' 자로 역분개되고 같은 날짜의 새 전표가 만들어집니다.', confirmLabel: '재분류' }); if (!ok.ok) return;
        try { const res = await reclassifyEntry(id, date, memo, r.lines); toast('재분류했습니다 — 새 전표 ' + res.no); await refresh('재분류했습니다 — 새 전표 ' + res.no + '. 이 전표는 역분개되었습니다.'); } catch (er) { p.msg(msgHtml('danger', er.message)); } return;
      }
      if (!ev.target.closest('[data-act="reverse"]')) return; const e = cur(); const date = p.el.querySelector('[data-rev-date]').value; const memo = p.el.querySelector('[data-rev-memo]').value;
      if (!date) { p.msg(msgHtml('danger', '역분개 일자를 입력해 주세요.')); return; }
      const ok = await confirmDialog({ title: '역분개', body: e.no + ' 전표를 ' + date + ' 자로 역분개합니다. 원 전표는 그대로 남고 차변·대변을 뒤집은 새 전표가 생깁니다.', confirmLabel: '역분개', variant: 'danger' }); if (!ok.ok) return;
      try { await reverseEntry(id, date, memo); toast('역분개했습니다.'); await refresh('역분개했습니다.'); } catch (er) { p.msg(msgHtml('danger', er.message)); }
    });
  }
  /* ───── 규칙·이엔지 정산·마감 점검·개시 수정 ───── */
  
  /* 규칙으로 기존 카드 전표 다시 분류 — 전표마다 서버 재분류(역분개 + 새 전표)를 한 건씩 부르고, 규칙과 계정이 같은 전표는 확인 완료로 표시한 뒤, 계정별 변화가 계획과 같은지 점검한다 */
  async function rrRun() {
    const R = S.rl; if (R.rr && R.rr.running) return; const plan = ruleReclassPlan(S.data.entries, S.data.rules, { lockedThrough: (S.data.settings || {}).lockedThrough || '', today: kstToday() });
    if (!plan.items.length && !plan.same.length) { toast('다시 분류할 전표가 없습니다.'); return; }
    const fm = (n) => Number(n || 0).toLocaleString('ko-KR');
    const ok = await confirmDialog({ title: '규칙으로 기존 카드 전표 다시 분류', body: '계정을 바꾸는 전표 ' + plan.items.length + '건(전표마다 역분개 + 새 전표)과, 규칙과 계정이 같아 확인 완료로 표시할 전표 ' + plan.same.length + '건을 처리합니다.' + (plan.personal.count ? ' 개인 지출(인출금)으로 넘어가는 ' + plan.personal.count + '건(' + fm(plan.personal.amount) + '원)이 포함됩니다.' : '') + (plan.vat && plan.vat.merged ? ' 부가세 불공제(접대비 등)로 부가세를 합산하는 전표 ' + plan.vat.merged + '건.' : '') + (plan.shifted ? ' 마감일 때문에 일자가 조정되는 전표 ' + plan.shifted + '건.' : '') + ' 시간이 걸리니 끝날 때까지 이 화면을 닫지 마세요.', confirmLabel: '실행' }); if (!ok.ok) return;
    R.rr = { running: true, progress: '준비 중…', result: null }; paint(); const before = netByAccount(S.data.entries); const done = [], failed = [];
    for (let k = 0; k < plan.items.length; k++) { const it = plan.items[k]; const msg = (k + 1) + '/' + plan.items.length + ' 재분류 중… ' + it.entry.no; R.rr.progress = msg; const el = body.querySelector('[data-rr-progress]'); if (el) el.textContent = msg; try { await reclassifyEntry(it.entry.id, it.date, '', it.lines); done.push(it); } catch (er) { failed.push(it.entry.no + ': ' + er.message); if (failed.length >= 5 && !done.length) break; } }
    let marked = 0, markErr = ''; if (plan.same.length && (done.length || !failed.length)) { try { marked = await markReviewed(plan.same.map((x) => x.entry.id), true, '가맹점 분류표 규칙과 계정이 같아 확인'); } catch (er) { markErr = er.message; } }
    await reload(); const verify = verifyReclass(before, netByAccount(S.data.entries), done); S.rl.rr = { running: false, progress: '', result: { done: done.length, marked, failed, markErr, verify } }; paint(); toast('규칙 재분류 ' + done.length + '건 · 확인 완료 ' + marked + '건' + (failed.length ? ' · 실패 ' + failed.length + '건' : '') + (verify.ok ? ' — 장부 점검 통과' : ' — 장부 점검 결과를 확인하세요'));
  }
  async function onRulesFile(input) {
    const f = (input.files || [])[0]; if (!f) return; S.rl.error = ''; S.rl.upload = null;
    try { const isCsv = /\.csv$/i.test(f.name || ''); const sheets = isCsv ? [parseCsvRows(await readText(f))] : (await readSpreadsheet(await readBuf(f))).sheets.map((s) => s.rows); const r = applyMerchantTable(sheets, S.rl.merchant); if (r.error) S.rl.error = r.error; else S.rl.upload = r; } catch (e) { S.rl.error = '파일을 읽지 못했습니다: ' + e.message; }
    paint();
  }
  function gapRead() { const g = (k) => body.querySelector('[data-g="' + k + '"]').value; return gapEntry(g('type'), g('date'), g('amount'), g('memo'), g('evidence')); }
  function gapPreview() { const out = body.querySelector('[data-g-result]'); if (!out) return; const r = gapRead(); out.setAttribute('data-tone', r.ok ? 'info' : 'warn'); out.textContent = r.ok ? '차변 ' + accountName(r.entry.lines[0].account) + ' ' + r.entry.lines[0].amount.toLocaleString('ko-KR') + '원 / 대변 외상매출금 ' + r.entry.lines[1].amount.toLocaleString('ko-KR') + '원' : r.errors[0]; }
  function refocus(sel) { const el = body.querySelector(sel); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

  function openManual() {
    let rows = 4; const p = openPanel('수기 전표', manualDialogHtml(rows), [{ act: 'save', label: '전표 저장' }]);
    const gather = () => [...p.el.querySelectorAll('tbody tr')].map((tr) => ({ account: tr.querySelector('[data-ml="account"]').value, side: tr.querySelector('[data-ml="side"]').value, amount: tr.querySelector('[data-ml="amount"]').value, partner: tr.querySelector('[data-ml="partner"]').value }));
    const refresh = () => { const m = manualEntry(p.el.querySelector('[data-m="date"]').value, p.el.querySelector('[data-m="memo"]').value, gather()); p.el.querySelector('[data-m-sum]').textContent = '차변 ' + m.debit.toLocaleString('ko-KR') + ' · 대변 ' + m.credit.toLocaleString('ko-KR') + (m.debit === m.credit && m.debit ? ' (일치)' : ' (차이 ' + Math.abs(m.debit - m.credit).toLocaleString('ko-KR') + ')'); return m; };
    p.el.addEventListener('input', refresh); p.el.addEventListener('change', refresh);
    p.el.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-act="addline"]')) { const tb = p.el.querySelector('tbody'); tb.insertAdjacentHTML('beforeend', tb.querySelector('tr').outerHTML.replace(/ selected/g, '')); const tr = tb.lastElementChild; tr.querySelectorAll('input').forEach((i) => { i.value = ''; }); tr.querySelectorAll('select').forEach((s) => { s.selectedIndex = 0; }); rows++; return; }
      if (!ev.target.closest('[data-act="save"]')) return; const m = refresh(); if (!m.ok) { p.msg(msgHtml('danger', m.errors[0])); return; }
      try { const r = await postEntries([m.entry]); if (r.rejected.length) throw new Error(r.rejected[0].errors[0]); toast('전표를 저장했습니다.'); p.close(); await reload(); paint(); } catch (er) { p.msg(msgHtml('danger', er.message)); }
    });
  }

  /* ───── 영수증 사진·PDF ───── */
  const RC = S.rc || (S.rc = { items: [], current: null, total: 0, done: 0, log: [] }); if (!RC.log) RC.log = [];
  const RC_STATE = { read: ['⏳', '읽는 중'], ok: ['📝', '읽음 — 확인 대기'], done: ['✅', '저장함'], skip: ['↷', '건너뜀'], err: ['⚠', '읽지 못함'] };
  function rcRender() { const el = body.querySelector('[data-rc-list]'); if (!el) return; el.innerHTML = RC.log.length ? '<ul class="jh-finance__list">' + RC.log.slice(-8).map((g) => '<li class="jh-finance__li"><div><strong>' + (RC_STATE[g.state] || ['', ''])[0] + ' ' + esc(g.name) + '</strong>' + (g.msg ? '<span class="jh-field__hint">' + esc(g.msg) + '</span>' : '') + '</div><span class="jh-field__hint">' + esc((RC_STATE[g.state] || ['', ''])[1]) + '</span></li>').join('') + '</ul>' : ''; }
  const rcStatus = (t) => { const el = body.querySelector('[data-rc-status]'); if (el) el.textContent = t; };
  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  /** 사진은 긴 변 1800px·JPEG 로 줄여 올린다(전송·읽기 비용 절약). 줄일 수 없으면 원본 그대로 */
  async function prepare(file) {
    const mime = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg');
    if (mime !== 'application/pdf' && typeof createImageBitmap === 'function' && typeof document.createElement('canvas').getContext === 'function') {
      try { const bmp = await createImageBitmap(file); const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); const g = c.getContext('2d'); if (g) { g.drawImage(bmp, 0, 0, c.width, c.height); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); if (blob && blob.size < file.size * 1.2) return { name: file.name, mime: 'image/jpeg', b64: await toB64(blob), blob }; } } catch (e) { /* 줄이기 실패 → 원본 */ }
    }
    return { name: file.name, mime, b64: await toB64(file), blob: file };
  }
  const blobUrl = (b) => { try { return b && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(b) : ''; } catch (e) { return ''; } };   // 미리보기 주소를 못 만들어도 읽기는 계속
  function rcShow() {
    if (RC.current) return; const item = RC.items.find((x) => !x.done && !x.error); if (!item || !body.querySelector('[data-rc-banner]')) return; RC.current = item;
    const f = receiptToForm(item.extracted); const set = (k, v) => { const el = body.querySelector('[data-x="' + k + '"]'); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } };
    ['date', 'what', 'account', 'pay', 'total', 'vat', 'evidence'].forEach((k) => set(k, f[k])); set('deduct', f.deduct); set('memo', ''); set('pjt', '');
    const pending = RC.items.filter((x) => !x.done && !x.error).length; const warn = (item.warnings || []).concat(f.cardNote ? [f.cardNote] : []).map((w) => '<div class="jh-alert" data-tone="warn" role="status">⚠ ' + esc(w) + '</div>').join('');
    const thumb = item.url && item.mime !== 'application/pdf' ? '<img class="jh-finance__thumb" src="' + esc(item.url) + '" alt="영수증 원본">' : '<div class="jh-field__hint">📄 ' + esc(item.name) + ' (PDF — 저장 뒤 전표 상세에서 원본을 볼 수 있습니다)</div>';
    body.querySelector('[data-rc-banner]').innerHTML = '<div class="jh-alert" data-tone="info" role="status">📷 영수증 ' + (RC.done + 1) + '/' + RC.total + ' · ' + esc(item.name) + ' — 아래 양식에 읽은 값을 채웠습니다. 원본과 비교해 고친 뒤 <strong>전표로 저장</strong>하세요. <span data-rc-rest></span> <button type="button" class="jh-btn" data-variant="ghost" data-act="rc-skip">이 영수증 건너뛰기</button></div>' + warn + thumb;
    rcRest(); expPreview();
  }
  /** "남은 영수증 N장" — 뒤 장이 읽히는 대로 갱신 */
  function rcRest() { const el = body.querySelector('[data-rc-rest]'); if (!el) return; const left = RC.items.filter((x) => !x.done && !x.error && x !== RC.current).length; el.textContent = left ? '(남은 영수증 ' + left + '장)' : ''; }
  function rcFinish(item, how) { item.done = true; RC.done++; RC.current = null; if (item.log) item.log.state = how || 'done'; const b = body.querySelector('[data-rc-banner]'); if (b) b.innerHTML = ''; }
  async function onReceipts(input) {
    const files = [...(input.files || [])]; if (!files.length) return; const todo = []; const notes = [];
    files.forEach((f) => { const p = receiptFileProblem(f); if (p) { notes.push(p); RC.log.push({ name: f.name, state: 'err', msg: p }); } else todo.push(f); });
    if (!RC.items.some((x) => !x.done && !x.error)) { RC.items = []; RC.total = 0; RC.done = 0; RC.current = null; }   // 앞 묶음을 다 처리했으면 번호를 처음부터
    RC.total += todo.length; let n = 0;
    for (const f of todo) {
      n++; const lg = { name: f.name, state: 'read', msg: '' }; RC.log.push(lg); rcRender(); rcStatus('읽는 중 ' + n + '/' + todo.length + ' — ' + f.name + (notes.length ? ' · ' + notes.join(' · ') : ''));
      try { const prep = await prepare(f); const r = await readReceipt(prep.name, prep.mime, prep.b64); lg.state = 'ok'; RC.items.push({ log: lg, id: r.id, name: f.name, mime: prep.mime, extracted: r.extracted, warnings: r.warnings, url: blobUrl(prep.blob) }); rcShow(); rcRest(); }
      catch (e) { RC.items.push({ name: f.name, error: e.message }); RC.total--; notes.push(f.name + ': ' + e.message); lg.state = 'err'; lg.msg = e.message; }
    }
    rcRender(); rcStatus((todo.length ? todo.length + '장 읽기를 마쳤습니다.' : '') + (notes.length ? ' ' + notes.join(' · ') : ''));
  }
  async function viewReceipt(entry, scope) {
    try { const f = await getReceiptFile(String(entry.source.id).replace(/^rc_/, '')); const url = 'data:' + f.mime + ';base64,' + f.dataBase64; const p = openPanel('원본 영수증 — ' + (f.fileName || ''), f.mime === 'application/pdf' ? '<iframe class="jh-finance__pdf" title="영수증 PDF" src="' + url + '"></iframe>' : '<img class="jh-finance__thumb" src="' + url + '" alt="영수증 원본">', []); return p; } catch (e) { toast(e.message); }
  }
  /* ───── 비용 입력 ───── */
  const expRead = () => { const g = (k) => { const el = body.querySelector('[data-x="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; }; return expenseEntryFromForm({ date: g('date'), what: g('what'), account: g('account'), pay: g('pay'), total: g('total'), vat: g('vat'), deduct: g('deduct'), pjt: g('pjt'), evidence: g('evidence'), memo: g('memo'), receiptId: RC.current ? RC.current.id : '' }); };
  const expShow = (tone, text) => { const out = body.querySelector('[data-x-result]'); if (out) { out.setAttribute('data-tone', tone); out.textContent = text; } };
  const expPreview = () => { const m = expRead(); if (!m.ok) { expShow('info', m.errors[0]); return; } expShow('info', '차변 ' + m.entry.lines.filter((l) => l.side === 'D').map((l) => accountName(l.account) + ' ' + l.amount.toLocaleString('ko-KR')).join(' + ') + ' / 대변 ' + accountName(m.entry.lines[m.entry.lines.length - 1].account) + ' ' + m.total.toLocaleString('ko-KR')); };
  /* ───── 이벤트(위임) ───── */
  root.onclick = async (ev) => {
    if (await ptClick(ev)) return;
    const t = ev.target;
    const mpn = t.closest('[data-mp-nav]'); if (mpn) { const k = Number(mpn.getAttribute('data-mp-nav')); if (k === 0) S.mp.ym = kstToday().slice(0, 7); else { const [y, m] = S.mp.ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); S.mp.ym = d.toISOString().slice(0, 7); } paint(); return; }
    const mpe = t.closest('[data-mp-edit]'); if (mpe) { const it = mpPlan().items.find((x) => x.id === mpe.getAttribute('data-mp-edit')); if (it) { S.mp.manage = true; S.mp.draft = Object.assign({ isNew: false }, it); paint(); } return; }
    const mpd = t.closest('[data-mp-del]'); if (mpd) { const p = mpPlan(); const it = p.items.find((x) => x.id === mpd.getAttribute('data-mp-del')); if (!it) return; const ok = await confirmDialog({ title: '고정지출 항목 삭제', body: '"' + it.name + '" 항목을 목록에서 지웁니다. 장부 전표에는 영향이 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; p.items = p.items.filter((x) => x.id !== it.id); Object.keys(p.overrides).forEach((ym) => { if (p.overrides[ym].items) delete p.overrides[ym].items[it.id]; mpClean(ym); }); await mpSave(); paint(); return; }
    const mpa = t.closest('[data-mp-addfrom]'); if (mpa) { S.mp.manage = true; S.mp.draft = { isNew: true, id: '', name: mpa.getAttribute('data-mp-addfrom'), group: '기타', amount: Number(mpa.getAttribute('data-mp-amount')) || 0, day: 0, method: '', match: mpa.getAttribute('data-mp-addfrom'), note: '', active: true, from: '', to: '' }; paint(); return; }
    const npa = t.closest('[data-np-all]'); if (npa) { const n = S.imp.npay; if (n) { const v = npa.getAttribute('data-np-all'); n.items.forEach((it) => { if (it.status === 'ok' && (!it.choice || it.choice === 'ask')) it.choice = v; }); npayRebuild(); paint(); } return; }
    const vfa = t.closest('[data-vf-apply]'); if (vfa) { const pk = vatPick(S.data.entries, S.rep.vatKey).key; S.rep.vatForm = Object.assign({}, S.rep.vatForm); S.rep.vatForm[pk] = Object.assign({}, S.rep.vatForm[pk], { f14a: Number(vfa.getAttribute('data-vf-amt')) || 0, f14t: Number(vfa.getAttribute('data-vf-tax')) || 0 }); try { localStorage.setItem('jh_fin_vatform_v1', JSON.stringify(S.rep.vatForm)); } catch (e) { /* 무시 */ } paint(); return; }
    if (t.closest('[data-inv-reload]')) { invLoad(); return; }
  const fcr = t.closest('[data-fc-reset]'); if (fcr) { delete S.fc.over[fcr.getAttribute('data-fc-reset')]; try { localStorage.setItem('jh_fin_fc_v1', JSON.stringify(S.fc.over)); } catch (e) { /* 무시 */ } paint(); return; }
    const fcs = t.closest('[data-fc-scen]'); if (fcs) { S.fc.scen = fcs.getAttribute('data-fc-scen'); paint(); return; }
    if (t.closest('[data-sel]')) return; const row = t.closest('[data-entry]'); if (row) { openEntry(row.getAttribute('data-entry')); return; }
    const ik = t.closest('[data-imp-kind]'); if (ik) { S.imp = { kind: ik.getAttribute('data-imp-kind'), busy: false, error: '', preview: null, userRules: {}, acctBySupplier: {}, raw: null }; paint(); return; }
    const md = t.closest('[data-mr-del]'); if (md) { S.rl.merchant.splice(Number(md.getAttribute('data-mr-del')), 1); S.rl.dirtyM = true; paint(); return; }
    const bg = t.closest('[data-bk-go]'); if (bg) { const dd = bg.getAttribute('data-bk-go'); S.filter = { from: dd, to: dd, source: '', review: false, reviewed: false, assignee: '', q: '' }; S.limit = 100; location.hash = '#/finance/entries'; return; }
    const bd = t.closest('[data-br-del]'); if (bd) { S.rl.bank.splice(Number(bd.getAttribute('data-br-del')), 1); S.rl.dirtyB = true; paint(); return; }
    const pd = t.closest('[data-pr-del]'); if (pd) { S.rl.purchase.splice(Number(pd.getAttribute('data-pr-del')), 1); S.rl.dirtyP = true; paint(); return; }
    const rk = t.closest('[data-rep-kind]'); if (rk) { S.rep.kind = rk.getAttribute('data-rep-kind'); paint(); return; }
    const a = t.closest('[data-act]'); if (!a) return; const act = a.getAttribute('data-act');
    if (act === 'manual') openManual();
    else if (act === 'more') { S.limit += 200; paint(); }
    else if (act === 'sel-all') { filterEntries(S.data.entries, S.filter).filter((e) => !e.reversedBy && !e.reverses).forEach((e) => S.sel.add(e.id)); paint(); }
    else if (act === 'sel-clear') { S.sel.clear(); paint(); }
    else if (act === 'vat-clear') { const pk = vatPick(S.data.entries, S.rep.vatKey).key; const ok = await confirmDialog({ title: '입력값 지우기', body: '이 과세기간에 직접 입력한 신고서 칸을 모두 지웁니다.', confirmLabel: '지우기', variant: 'danger' }); if (!ok.ok) return; S.rep.vatForm = Object.assign({}, S.rep.vatForm); delete S.rep.vatForm[pk]; try { localStorage.setItem('jh_fin_vatform_v1', JSON.stringify(S.rep.vatForm)); } catch (e) { /* 무시 */ } paint(); }
    else if (act === 'fc-reset-all') { S.fc.over = {}; try { localStorage.removeItem('jh_fin_fc_v1'); } catch (e) { /* 무시 */ } paint(); }
    else if (act === 'fc-csv') { const m = S.fcm; if (m) { const sc = m.scen.find((s) => s.key === S.fc.scen) || m.scen[1]; download('예측_' + sc.name + '_' + m.runs[sc.key].labels[0] + '_' + m.runs[sc.key].labels[11] + '.csv', forecastCsv(m.runs[sc.key], sc.name)); } }
    else if (act === 'bulk-reclass') {
      const sel = S.data.entries.filter((e) => S.sel.has(e.id) && !e.reversedBy && !e.reverses); if (!sel.length) return;
      const cnt = {}; sel.forEach((e) => e.lines.forEach((l) => { cnt[l.account] = (cnt[l.account] || 0) + 1; }));
      const fromOptions = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map((c) => ({ code: c, name: accountName(c), n: cnt[c] }));
      const defaultFrom = cnt['1110'] ? '1110' : ((fromOptions.find((o) => o.code !== '1020') || fromOptions[0]).code);
      const lk = S.data.settings.lockedThrough || '';
      const pn = openPanel('일괄 재분류 — ' + sel.length + '건', bulkReclassHtml({ count: sel.length, total: sel.reduce((s, e) => s + entryDebit(e), 0), fromOptions, defaultFrom, lockedNote: lk ? '마감일(' + lk + ') 이전 일자는 마감일 다음 날로 자동 조정됩니다.' : '' }), []);
      pn.el.addEventListener('change', (ev) => { if (ev.target.matches('[data-bk-datemode]')) { const fx = pn.el.querySelector('[data-bk-datemode][value="fixed"]').checked; pn.el.querySelector('[data-bk-date]').disabled = !fx; } });
      pn.el.addEventListener('click', async (ev) => {
        if (!ev.target.closest('[data-bk-run]')) return;
        const q = (s) => pn.el.querySelector(s); const memo = q('[data-bk-memo]').value.trim();
        const plan = bulkReclassPlan(sel, { from: q('[data-bk-from]').value, to: q('[data-bk-to]').value, partner: q('[data-bk-partner]').value, dateMode: q('[data-bk-datemode][value="fixed"]').checked ? 'fixed' : 'keep', fixedDate: q('[data-bk-date]').value, lockedThrough: S.data.settings.lockedThrough || '', today: kstToday() });
        if (plan.errors.length) { pn.msg(msgHtml('danger', plan.errors[0])); return; }
        if (!plan.items.length) { pn.msg(msgHtml('danger', '바꿀 수 있는 전표가 없습니다(' + (plan.skipped[0] ? plan.skipped[0].reason : '') + ').')); return; }
        const shifted = plan.items.filter((i) => i.shifted).length;
        const ok = await confirmDialog({ title: '일괄 재분류', body: plan.items.length + '건을 ' + accountName(q('[data-bk-from]').value) + ' → ' + accountName(q('[data-bk-to]').value) + '(으)로 바꿉니다. 전표마다 역분개 전표와 새 전표가 만들어집니다.' + (plan.skipped.length ? ' 제외 ' + plan.skipped.length + '건.' : '') + (shifted ? ' 마감일 때문에 일자가 조정되는 전표 ' + shifted + '건.' : ''), confirmLabel: '실행' }); if (!ok.ok) return;
        const run = q('[data-bk-run]'); run.disabled = true; const prog = q('[data-bk-progress]'); const done = [], failed = [];
        for (let k = 0; k < plan.items.length; k++) { const it = plan.items[k]; prog.textContent = (k + 1) + '/' + plan.items.length + ' 처리 중… ' + it.entry.no; try { const res = await reclassifyEntry(it.entry.id, it.date, memo, it.lines); done.push(it.entry.id); } catch (er) { failed.push(it.entry.no + ': ' + er.message); } }
        done.forEach((d) => S.sel.delete(d)); await reload(); paint(); run.disabled = false; prog.textContent = '';
        toast('일괄 재분류 ' + done.length + '건 완료' + (failed.length ? ', 실패 ' + failed.length + '건' : ''));
        pn.msg(msgHtml(failed.length ? 'danger' : 'info', '성공 ' + done.length + '건' + (failed.length ? ' · 실패 ' + failed.length + '건 — ' + failed.slice(0, 3).join(' / ') : '') + (plan.skipped.length ? ' · 제외 ' + plan.skipped.length + '건' : '')));
      });
    }
    else if (act === 'assign-all') {
      const ids = S.filter.review ? filterEntries(S.data.entries, S.filter).map((e) => e.id) : []; if (!ids.length) return;
      const pn = openPanel('담당자 지정 — ' + ids.length + '건', '<div class="jh-field"><label class="jh-field__label">담당자 이름</label><input class="jh-input" data-asg-name maxlength="30" placeholder="예: 김민서"><span class="jh-field__hint">지금 거른 확인 필요 전표 ' + ids.length + '건에 같은 담당자를 지정합니다. 빈 칸으로 저장하면 해제됩니다.</span></div><div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-asg-save>저장</button></div>', []);
      pn.el.addEventListener('click', async (ev) => { if (!ev.target.closest('[data-asg-save]')) return; const nm = pn.el.querySelector('[data-asg-name]').value.trim(); try { for (let k = 0; k < ids.length; k += 200) await assignEntries(ids.slice(k, k + 200), nm); toast('담당자를 지정했습니다.'); pn.close(); await reload(); paint(); } catch (er) { pn.msg(msgHtml('danger', er.message)); } });
    }
    else if (act === 'review-all') {
      const ids = filterEntries(S.data.entries, S.filter).filter((e) => e.needsReview).map((e) => e.id); if (!ids.length) return;
      const ok = await confirmDialog({ title: '확인 완료로 표시', body: '지금 목록의 ' + ids.length + '건을 모두 확인 완료로 표시합니다. 전표의 금액·계정은 바뀌지 않습니다.', confirmLabel: '표시' }); if (!ok.ok) return;
      try { const n = await markReviewed(ids, true); toast(n + '건을 확인 완료로 표시했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); }
    }
    else if (act === 'vat10') { const t = Number(String(body.querySelector('[data-x="total"]').value).replace(/[,\s원]/g, '')); if (t > 0) { body.querySelector('[data-x="vat"]').value = Math.round(t / 11).toLocaleString('ko-KR'); body.querySelector('[data-x="deduct"]').checked = true; expPreview(); } }
    else if (act === 'exp-save') {
      if (a.disabled) return; const m = expRead(); if (!m.ok) { expShow('danger', m.errors[0]); return; } a.disabled = true;
      try { const r = await postEntries([m.entry]); if (r.rejected.length) throw new Error(r.rejected[0].errors[0]); toast(r.duplicates ? '이미 저장된 영수증입니다.' : '전표로 저장했습니다.'); if (RC.current) rcFinish(RC.current, 'done'); await reload(); paint(); rcShow(); rcRender(); } catch (e) { a.disabled = false; expShow('danger', e.message); }
    }
    else if (act === 'rc-skip') { if (RC.current) { rcFinish(RC.current, 'skip'); paint(); rcShow(); rcRender(); } }
    else if (act === 'pay-load') {
      const m = body.querySelector('[data-pay-month]').value; if (!m) { toast('귀속월을 골라 주세요.'); return; } setImp({ busy: true, error: '', preview: null });
      try { const res = await readPayroll(m); S.imp.raw = { payroll: res, fileName: '포털 급여명세서 ' + m }; await buildPreview(); setImp({ busy: false }); } catch (e) { setImp({ busy: false, error: e.message }); }
    }
    else if (act === 'commit') await commit();
    else if (act === 'np-retry') await npayRetry();
    else if (act === 'mp-manage') { S.mp.manage = !S.mp.manage; S.mp.draft = null; paint(); }
    else if (act === 'mp-add') { S.mp.draft = { isNew: true, id: '', name: '', group: '기타', amount: 0, day: 0, method: '', match: '', note: '', active: true, from: '', to: '' }; paint(); }
    else if (act === 'mp-cancel') { S.mp.draft = null; paint(); }
    else if (act === 'mp-seed') { const p = mpPlan(); if (p.items.length) return; p.items = JSON.parse(JSON.stringify(MP_SEED)); await mpSave(); paint(); }
    else if (act === 'mp-save-item') {
      const d = mpDraftRead(); if (!d || !String(d.name || '').trim()) { toast('내용(이름)을 입력해 주세요.'); return; } const p = mpPlan(); const amt = mpNum(d.amount); const day = Number(String(d.day || 0).replace(/\D/g, '')) || 0; if (amt === null) { toast('금액이 올바르지 않습니다.'); return; } if (day < 0 || day > 31) { toast('결제일은 1~31 사이로 입력해 주세요.'); return; }
      const ymOk = (v) => !v || /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v).trim()); if (!ymOk(d.from) || !ymOk(d.to)) { toast('시작·끝 월은 YYYY-MM 형식으로 입력해 주세요.'); return; }
      const item = { id: d.id || ('m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), name: String(d.name).trim(), group: d.group, amount: amt, day, method: String(d.method || '').trim(), match: String(d.match || '').trim(), note: String(d.note || '').trim(), active: d.active !== false, from: String(d.from || '').trim(), to: String(d.to || '').trim() };
      const i = p.items.findIndex((x) => x.id === item.id); if (i >= 0) p.items[i] = item; else p.items.push(item); S.mp.draft = null; await mpSave(); paint();
    }
    else if (act === 'mp-csv') { const v = S.mp.view; if (v) download('월간수지_' + v.ym + '.csv', monthlyCsv(v)); }
    else if (act === 'csv' && S.rep.kind === 'vat') { const P = vatPick(S.data.entries, S.rep.vatKey); { const vr = vatReport(S.data.entries, P.from, P.to, 0); download('부가세신고서_' + P.from + '_' + P.to + '.csv', vatCsv(vr, vatForm(vr, (S.rep.vatForm && S.rep.vatForm[P.key]) || {}))); } }
    else if (act === 'csv' && S.rep.kind === 'bk') { download('통장대사_월별.csv', ledgerCsv('bk', bankReconcile(S.data.entries))); }
    else if (act === 'csv' && (S.rep.kind === 'gl' || S.rep.kind === 'pt')) { const gl = S.rep.kind === 'gl'; const data = gl ? accountLedger(S.data.entries, S.rep.acct, S.rep.from, S.rep.to, S.rep.q) : partnerBalances(S.data.entries, S.rep.pacct, S.rep.to, S.rep.zero); download((gl ? '계정별원장_' + data.account + '_' + (S.rep.from || '처음') + '_' + S.rep.to : '거래처별잔액_' + data.account + '_' + S.rep.to) + '.csv', ledgerCsv(S.rep.kind, data)); }
    else if (act === 'csv') { const st = stmNow(); const kind = S.rep.kind; download(({ is: '손익계산서', bs: '재무상태표', cf: '현금흐름표', tb: '합계잔액시산표' })[kind] + '_' + S.rep.from + '_' + S.rep.to + '.csv', statementCsv(st, kind)); }
    else if (act === 'print') { const vr = S.rep.kind === 'vat' ? vatPick(S.data.entries, S.rep.vatKey) : null; const pr = printWithTitle(reportPrintTitle(S.rep, { accountName, vatRange: vr ? { from: vr.from, to: vr.to } : null })); if (!pr.ok) toast('인쇄를 시작하지 못했습니다.'); }
    else if (act === 'open-save') {
      const vals = {}; body.querySelectorAll('[data-open]').forEach((i) => { vals[i.getAttribute('data-open')] = i.value; }); const r = openingFromForm(body.querySelector('[data-open-date]').value, vals);
      if (r.errors) { body.querySelector('[data-open-result]').setAttribute('data-tone', 'danger'); body.querySelector('[data-open-result]').textContent = r.errors[0]; return; }
      const ok = await confirmDialog({ title: S.openEditId ? '개시 전표 정정' : '개시 전표 저장', body: '개시 일자 ' + r.entry.date + ' · 자본(차액) ' + r.equity.toLocaleString('ko-KR') + '원으로 ' + (S.openEditId ? '정정합니다. 기존 개시 전표는 역분개로 남고 같은 일자의 새 개시 전표가 만들어집니다.' : '저장합니다. 저장한 전표는 고치거나 지울 수 없고 역분개로만 바로잡습니다.'), confirmLabel: S.openEditId ? '정정' : '저장' }); if (!ok.ok) return;
      try { if (S.openEditId) { const res = await reclassifyEntry(S.openEditId, r.entry.date, '개시 정정 — 숫자 수정', r.entry.lines); S.openEditId = ''; toast('개시 전표를 정정했습니다(' + res.no + ').'); await reload(); location.hash = '#/finance/home'; return; } const res = await postEntries([r.entry]); if (res.rejected.length) throw new Error(res.rejected[0].errors[0]); toast(res.duplicates ? '같은 날짜의 개시 전표가 이미 있어 건너뛰었습니다.' : '개시 전표를 저장했습니다.'); await reload(); location.hash = '#/finance/home'; } catch (e) { body.querySelector('[data-open-result]').setAttribute('data-tone', 'danger'); body.querySelector('[data-open-result]').textContent = e.message; }
    }
    else if (act === 'table-csv') { const p = S.imp.preview; if (!p || !p.groups) return; download('가맹점_분류표_' + kstToday() + '.csv', merchantTableCsv(p.groups)); toast('분류표를 내려받았습니다. 엑셀에서 "대표님 분류" 칸을 채워 규칙 탭에 올려 주세요.'); }
    else if (act === 'rules-apply') { try { await saveMerchantRules(S.rl.upload.rules); toast('가맹점 규칙 ' + S.rl.upload.rules.length + '개를 저장했습니다.'); await reload(); paint(); } catch (e) { S.rl.error = e.message; paint(); } } else if (act === 'rr-run') { await rrRun(); } else if (act === 'rules-save-m') { try { await saveMerchantRules(S.rl.merchant); toast('가맹점 규칙을 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); } }
    else if (act === 'br-add') {
      const r = bankRuleFromForm(body.querySelector('[data-br-key]').value, body.querySelector('[data-br-dir]').value, body.querySelector('[data-br-acc]').value, body.querySelector('[data-br-partner]').value, body.querySelector('[data-br-memo]').value); if (!r.ok) { toast(r.errors[0]); return; }
      const k = S.rl.bank.findIndex((x) => x.key === r.rule.key && x.dir === r.rule.dir); if (k >= 0) S.rl.bank[k] = r.rule; else S.rl.bank.push(r.rule); S.rl.dirtyB = true; paint();
    }
    else if (act === 'rules-save-b') { try { await saveBankRules(S.rl.bank); toast('통장 거래처 규칙을 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); } }
    else if (act === 'rules-save-p') { try { await savePurchaseRules(S.rl.purchase); toast('매입 거래처 규칙을 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); } }
    else if (act === 'pr-add') {
      const raw = body.querySelector('[data-pr-key]').value.trim(); if (!raw) { toast('사업자번호나 상호를 입력해 주세요.'); return; } const digits = raw.replace(/\D/g, ''); const key = digits.length === 10 ? digits : raw.replace(/\(주\)|주식회사|\s/g, '').slice(0, 30); const account = body.querySelector('[data-pr-acc]').value;
      const k = S.rl.purchase.findIndex((r) => r.key === key); const item = { key, name: digits.length === 10 ? '' : raw, account, memo: '' }; if (k >= 0) S.rl.purchase[k] = Object.assign(S.rl.purchase[k], item); else S.rl.purchase.push(item); S.rl.dirtyP = true; paint();
    }
    else if (act === 'gap-save') {
      const r = gapRead(); if (!r.ok) { toast(r.errors[0]); return; } const ok = await confirmDialog({ title: '이엔지 정산 차액 처리', body: r.entry.memo + ' — ' + r.entry.lines[0].amount.toLocaleString('ko-KR') + '원을 외상매출금에서 처리합니다. 저장한 전표는 고치거나 지울 수 없고 역분개로만 바로잡습니다.', confirmLabel: '저장', variant: r.entry.needsReview ? 'danger' : undefined }); if (!ok.ok) return;
      try { const res = await postEntries([r.entry]); if (res.rejected.length) throw new Error(res.rejected[0].errors[0]); toast(res.duplicates ? '같은 일자·금액·방식의 처리 전표가 이미 있어 건너뛰었습니다.' : '처리 전표를 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); }
    }
    else if (act === 'chk-run') { const d = body.querySelector('[data-chk-date]').value; if (!d) { toast('점검 기준일을 입력해 주세요.'); return; } S.chkDate = d; S.chk = closeCheck(S.data.entries, d); paint(); }
    else if (act === 'open-edit') {
      const en = S.data.entries.find((x) => x.id === a.getAttribute('data-open-id')); if (!en) return; const vals = openingToForm(en); body.querySelectorAll('[data-open]').forEach((inp) => { inp.value = vals[inp.getAttribute('data-open')] || ''; }); body.querySelector('[data-open-date]').value = en.date; S.openEditId = en.id;
      const btn = body.querySelector('[data-act="open-save"]'); if (btn) btn.textContent = '정정 개시 전표 저장(기존 전표는 역분개)'; body.querySelector('[data-open-date]').dispatchEvent(new window.Event('input', { bubbles: true })); body.querySelector('[data-open-date]').scrollIntoView && body.querySelector('[data-open-date]').scrollIntoView({ block: 'center' });
    }
    else if (act === 'set-save') { try { await saveSettings(body.querySelector('[data-set="ownBiz"]').value, body.querySelector('[data-set="ownName"]').value); toast('설정을 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); } }
    else if (act === 'lock') {
      const d = body.querySelector('[data-lock-date]').value; if (!d) { toast('마감일을 입력해 주세요.'); return; }
      const cc = closeCheck(S.data.entries, d); S.chkDate = d; S.chk = cc; if (cc.bad) { paint(); toast('마감 전 점검에 문제 ' + cc.bad + '건이 있습니다. 위 점검 결과를 확인해 주세요.'); return; }
      const ok = await confirmDialog({ title: '결산 마감', body: d + ' 까지의 전표를 잠급니다. 이 날짜 이전으로는 새 전표를 만들 수 없고, 마감일은 앞당길 수 없습니다.' + (cc.warn ? ' (점검에서 확인할 것 ' + cc.warn + '건이 남아 있습니다.)' : ' 점검은 모두 통과했습니다.'), confirmLabel: '마감', variant: 'danger' }); if (!ok.ok) return;
      try { await lockThrough(d); toast('마감했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); }
    }
  };
  root.onchange = async (ev) => {
    const t = ev.target;
    if (t.matches('[data-rc-file]')) { await onReceipts(t); return; }
    if (t.matches('[data-rules-file]')) { await onRulesFile(t); return; }
    if (t.matches('[data-mr]')) { const k = Number(t.getAttribute('data-mr')); S.rl.merchant[k].label = t.value; S.rl.merchant[k].account = CHOICE_ACCOUNT[t.value] || S.rl.merchant[k].account; S.rl.dirtyM = true; paint(); return; }
    if (t.matches('[data-fc],[data-fc-pct],[data-fc-scn]')) {
      const saveFc = () => { try { localStorage.setItem('jh_fin_fc_v1', JSON.stringify(S.fc.over)); } catch (e) { /* 저장 실패는 무시 */ } };
      const num = (v) => { const n = Number(String(v).replace(/[,\s원%]/g, '')); return Number.isFinite(n) ? n : null; };
      if (t.matches('[data-fc]')) { const k = t.getAttribute('data-fc'); const n = num(t.value); if (t.value.trim() === '') delete S.fc.over[k]; else if (n !== null) S.fc.over[k] = k === 'method' ? Math.min(3, Math.max(1, Math.round(n))) : n; }
      else if (t.matches('[data-fc-pct]')) { const k = t.getAttribute('data-fc-pct'); const n = num(t.value); if (t.value.trim() === '') delete S.fc.over[k]; else if (n !== null) S.fc.over[k] = Math.min(1000, Math.max(-100, n)) / 100; }
      else { const [sk, f] = t.getAttribute('data-fc-scn').split('.'); const n = num(t.value); if (n !== null && n > 0) { S.fc.over.scn = S.fc.over.scn || {}; S.fc.over.scn[sk] = Object.assign({}, S.fc.over.scn[sk], { [f]: n }); } }
      saveFc(); setTimeout(() => { const ae = document.activeElement; const key = ae && ae.getAttribute ? (ae.getAttribute('data-fc') || ae.getAttribute('data-fc-pct') || ae.getAttribute('data-fc-scn')) : ''; paint(); if (key) { const nn = body.querySelector('[data-fc="' + key + '"],[data-fc-pct="' + key + '"],[data-fc-scn="' + key + '"]'); if (nn) nn.focus(); } }, 0); return;
    }
    if (t.matches('[data-mp-ym]')) { if (/^\d{4}-\d{2}$/.test(t.value)) { S.mp.ym = t.value; paint(); } return; }
    if (t.matches('[data-mp-amt]')) { const id = t.getAttribute('data-mp-amt'); const it = mpPlan().items.find((x) => x.id === id); const n = t.value.trim() === '' ? null : mpNum(t.value); const o = mpOv(S.mp.ym); o.items[id] = o.items[id] || {}; if (n === null || (it && n === Number(it.amount))) delete o.items[id].amount; else o.items[id].amount = n; mpClean(S.mp.ym); mpSave(); paint(); return; }
    if (t.matches('[data-mp-skip]')) { const id = t.getAttribute('data-mp-skip'); const o = mpOv(S.mp.ym); o.items[id] = o.items[id] || {}; if (t.checked) o.items[id].skip = true; else delete o.items[id].skip; mpClean(S.mp.ym); mpSave(); paint(); return; }
    if (t.matches('[data-mp-rev]')) { const n = t.value.trim() === '' ? null : mpNum(t.value); const p = mpPlan(); p.overrides[S.mp.ym] = p.overrides[S.mp.ym] || {}; if (n === null) delete p.overrides[S.mp.ym].rev; else p.overrides[S.mp.ym].rev = n; mpClean(S.mp.ym); mpSave(); paint(); return; }
    if (t.matches('[data-mpf]')) { mpDraftRead(); return; }
    if (t.matches('[data-np]')) { const n = S.imp.npay; const it = n && n.items.find((x) => x.idx === Number(t.getAttribute('data-np'))); if (it) { it.choice = t.value; it.touched = true; npayRebuild(); paint(); } return; }
    if (t.matches('[data-vat]')) { S.rep.vatKey = t.value; paint(); return; }
    if (t.matches('[data-vf]')) {
      const pk = vatPick(S.data.entries, S.rep.vatKey).key; const f = t.getAttribute('data-vf'); const n = Number(String(t.value).replace(/[,\s원]/g, '')); S.rep.vatForm = Object.assign({}, S.rep.vatForm); S.rep.vatForm[pk] = Object.assign({}, S.rep.vatForm[pk]);
      if (Number.isFinite(n) && n !== 0) S.rep.vatForm[pk][f] = n; else delete S.rep.vatForm[pk][f];
      try { localStorage.setItem('jh_fin_vatform_v1', JSON.stringify(S.rep.vatForm)); } catch (e) { /* 저장 실패는 무시 */ }
      setTimeout(() => { const ae = document.activeElement; const key = ae && ae.getAttribute ? ae.getAttribute('data-vf') : ''; paint(); if (key) { const nn = body.querySelector('[data-vf="' + key + '"]'); if (nn) nn.focus(); } }, 0); return;
    }
    if (t.matches('[data-gl]')) { const k = t.getAttribute('data-gl'); S.rep[k] = t.type === 'checkbox' ? t.checked : t.value; paint(); if (k === 'q') { const qq = body.querySelector('[data-gl="q"]'); if (qq) { qq.focus(); qq.setSelectionRange(qq.value.length, qq.value.length); } } return; }
    if (t.matches('[data-br]')) { S.rl.bank[Number(t.getAttribute('data-br'))].account = t.value; S.rl.dirtyB = true; paint(); return; }
    if (t.matches('[data-pr]')) { S.rl.purchase[Number(t.getAttribute('data-pr'))].account = t.value; S.rl.dirtyP = true; paint(); return; }
    if (t.matches('[data-sup-remember]')) { S.imp.remember = S.imp.remember || {}; if (t.checked) S.imp.remember[t.getAttribute('data-sup-remember')] = true; else delete S.imp.remember[t.getAttribute('data-sup-remember')]; return; }
    if (t.matches('[data-g]')) { if (t.matches('[data-g="amount"]')) { const n = Number(String(t.value).replace(/[,\s원]/g, '')); if (t.value.trim() !== '' && Number.isFinite(n)) t.value = n.toLocaleString('ko-KR'); } gapPreview(); return; }
    if (t.matches('[data-file]')) { await onFile(t); return; }
    if (t.matches('[data-file2]')) { await onFile2(t); return; }
    if (t.matches('[data-sup]')) { S.imp.acctBySupplier[t.getAttribute('data-sup')] = t.value; await buildPreview(); paint(); return; }
    if (t.matches('[data-merch]')) { const [issuer, key] = t.getAttribute('data-merch').split('|'); S.imp.userRules[issuer + '|' + key] = { issuer, key, account: t.value, label: '화면에서 선택', memo: '' }; await buildPreview(); paint(); return; }
    if (t.matches('[data-x="total"],[data-x="vat"],[data-open]')) { const n = Number(String(t.value).replace(/[,\s원]/g, '')); if (t.value.trim() !== '' && Number.isFinite(n)) t.value = n.toLocaleString('ko-KR'); }   // 금액 칸은 천 단위 쉼표
    if (t.matches('[data-x]')) { expPreview(); return; }
    if (t.matches('[data-sel]')) { const sid = t.getAttribute('data-sel'); if (t.checked) S.sel.add(sid); else S.sel.delete(sid); paint(); return; }
    if (t.matches('[data-f]') && t.type === 'date') { const k = t.getAttribute('data-f'); dateApply(t, () => { S.filter[k] = t.value; S.limit = 100; }); return; }
    if (t.matches('[data-f]')) { const k = t.getAttribute('data-f'); S.filter[k] = t.type === 'checkbox' ? t.checked : t.value; S.limit = 100; paint(); if (k === 'q') { const q = body.querySelector('[data-f="q"]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } return; }
    if (t.matches('[data-rep]')) { const k = t.getAttribute('data-rep'); dateApply(t, () => { S.rep[k] = t.value; }); return; }
  };
  if (root.__finFocusOut) root.removeEventListener('focusout', root.__finFocusOut); root.__finFocusOut = (ev) => { if (dTimer && ev.target === dPending) dateFlush(); }; root.addEventListener('focusout', root.__finFocusOut);   // 입력을 마치고 칸을 나가면 바로 적용(브라우저에 onfocusout 속성이 없어 이벤트 등록)
  root.onkeydown = (ev) => { if (ev.key === 'Enter' && dTimer && ev.target === dPending) dateFlush(); };
  root.ondragover = (ev) => { const z = ev.target.closest && ev.target.closest('[data-drop]'); if (z) { ev.preventDefault(); z.classList.add('is-over'); } };
  root.ondragleave = (ev) => { const z = ev.target.closest && ev.target.closest('[data-drop]'); if (z) z.classList.remove('is-over'); };
  root.ondrop = async (ev) => {   // 파일을 끌어다 놓기 — 영수증 칸이면 영수증으로, 가져오기 칸이면 그 종류의 파일로
    const z = ev.target.closest && ev.target.closest('[data-drop]'); if (!z) return; ev.preventDefault(); z.classList.remove('is-over');
    const files = [...((ev.dataTransfer && ev.dataTransfer.files) || [])]; if (!files.length) return;
    if (z.getAttribute('data-drop') === 'rc') await onReceipts({ files }); else if (z.getAttribute('data-drop') === 'rules') await onRulesFile({ files: files.slice(0, 1) }); else await onFile({ files: (S.imp.kind === 'card' || S.imp.kind === 'npay') ? files : files.slice(0, 1) });
  };
  root.oninput = (ev) => {
    const t = ev.target;
    if (t.matches('[data-x]')) { expPreview(); return; }
    if (t.matches('[data-g]')) { gapPreview(); return; }
    if (t.matches('[data-rl-q]')) { S.rl.q = t.value; paint(); refocus('[data-rl-q]'); return; }
    if (t.matches('[data-open],[data-open-date]')) { const vals = {}; body.querySelectorAll('[data-open]').forEach((i) => { vals[i.getAttribute('data-open')] = i.value; }); const r = openingFromForm(body.querySelector('[data-open-date]').value, vals); const out = body.querySelector('[data-open-result]'); out.setAttribute('data-tone', r.errors ? 'warn' : 'info'); out.textContent = r.errors ? r.errors[0] : '자본(차액) ' + r.equity.toLocaleString('ko-KR') + '원' + (r.equity < 0 ? ' — 마이너스(자본잠식)입니다' : ''); }
  };
}
