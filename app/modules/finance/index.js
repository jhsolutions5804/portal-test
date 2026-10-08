import { esc, toast } from '../../core/ui.js?v=20261008a';
import { confirmDialog } from '../../core/dialog.js?v=20261008a';
import { readSpreadsheet } from '../../shared/xls-read.js?v=20261008a';
import { parseTaxInvoiceWorkbook } from '../../shared/hometax-import.js?v=20261008a';
import { parseBankRows } from '../../shared/bank-import.js?v=20261008a';
import { ownerSettlementKeys } from '../../shared/bank-classify.js?v=20261008a';
import { parseCardWorkbook } from '../../shared/card-import.js?v=20261008a';
import { summarize, filterEntries, statements, statementCsv, openingFromForm, previewTaxInvoices, previewBank, previewCards, parseEntriesJson, manualEntry, entryDocId, monthEnd, kstToday } from './logic.js?v=20261008a';
import { loadLedger, postEntries, markReviewed, reverseEntry, lockThrough, saveSettings, saveMerchantRules, recordImport } from './data.js?v=20261008a';
import { tabsHtml, homeHtml, entriesHtml, entryDialogHtml, manualDialogHtml, importHtml, reportsHtml, openingHtml, settingsHtml } from './view.js?v=20261008a';

/** 재무회계 — 복식 원장·가져오기·재무제표. 영업기획·인사총무와 분리된 영역(관리자·재무회계팀·perms.finance). 설계: 기획_재무제표_설계_r1.md */
export const manifest = {
  id: 'finance', order: 47, title: '재무회계', icon: '📒', defaultHash: '#/finance/home',
  perm: (me) => !!me && !me.isGuest && (me.admin === true || me.dept === '재무회계팀' || !!(me.perms && me.perms.finance === true))
};
const S = { data: null, filter: { from: '', to: '', source: '', review: false, q: '' }, limit: 100, imp: { kind: 'taxsales', busy: false, error: '', preview: null, userRules: {}, acctBySupplier: {}, raw: null }, rep: { kind: 'is', from: '', to: '' }, openDate: '2026-01-01', admin: false };
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
  const wrap = document.createElement('div'); wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel"><h3 class="jh-dialog__title">' + esc(title) + '</h3><div class="jh-dialog__body">' + bodyHtml + '<div data-panel-msg></div></div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-close>닫기</button>' + (actions || []).map((a) => '<button type="button" class="jh-btn" data-variant="' + (a.variant || 'primary') + '" data-act="' + a.act + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
  document.body.appendChild(wrap); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const close = () => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev; };
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  document.addEventListener('keydown', onKey, true); wrap.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); });
  return { el: wrap, close, msg: (html) => { wrap.querySelector('[data-panel-msg]').innerHTML = html; } };
}
const msgHtml = (tone, t) => '<div class="jh-alert" data-tone="' + tone + '" role="alert">' + esc(t) + '</div>';

export async function mount(root, route, ctx) {
  const me = (ctx && ctx.me) || {}; S.admin = me.admin === true;
  const tab = ['home', 'entries', 'import', 'reports', 'opening', 'settings'].includes(route.segs[0]) ? route.segs[0] : 'home';
  root.onclick = null; root.onchange = null; root.oninput = null;
  root.innerHTML = '<div class="jh-finance">' + tabsHtml(tab) + '<div id="fin-body" class="jh-finance__body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#fin-body');
  const paint = () => {
    S.data.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0)));
    const sum = summarize(S.data.entries); const stm = stmNow(); const st = Object.assign({}, S, S.data, { sum, stm, list: filterEntries(S.data.entries, S.filter) });
    body.innerHTML = tab === 'home' ? homeHtml(st) : tab === 'entries' ? entriesHtml(st) : tab === 'import' ? importHtml(st) : tab === 'reports' ? reportsHtml(st) : tab === 'opening' ? openingHtml(st) : settingsHtml(st);
    body.removeAttribute('aria-busy');
  };
  const reload = async () => { S.data = await loadLedger(); };
  try { await reload(); paint(); } catch (e) { console.error('재무회계 불러오기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 재무회계 권한이 있는 계정인지 확인해 주세요. (' + esc(e.code || e.message) + ')</div>'; return; }

  /* ───── 가져오기 ───── */
  const setImp = (patch) => { Object.assign(S.imp, patch); paint(); };
  async function buildPreview() {
    const k = S.imp.kind; const raw = S.imp.raw; if (!raw) return;
    const have = existingIds();
    if (k === 'taxsales' || k === 'taxpurchase') { const p = previewTaxInvoices(raw.parsed, k === 'taxsales' ? 'sales' : 'purchase', S.data.settings.ownBiz, have, S.imp.acctBySupplier); S.imp.preview = p; }
    else if (k === 'bank') { const ctx2 = { ownerSettle: raw.nh ? ownerSettlementKeys(raw.bank.txns, raw.nh.txns) : undefined }; const p = previewBank(raw.bank.txns, ctx2, have); p.bank = raw.bank; p.warnings = []; if (raw.bank.balanceBreaks) p.warnings.push('통장 잔액이 이어지지 않는 곳이 ' + raw.bank.balanceBreaks + '곳 있습니다 — 빠진 거래가 있는지 확인해 주세요.'); if (raw.bank.totalsOk === false) p.warnings.push('파일의 합계 줄과 거래 합계가 다릅니다.'); if (raw.nh) p.warnings.push('농협 개인 계좌 거래내역을 참고해 개인카드 대금 정산 이체를 짝지었습니다.'); S.imp.preview = p; }
    else if (k === 'card') { const merged = {}; S.data.rules.forEach((r) => { merged[r.issuer + '|' + r.key] = r; }); Object.assign(merged, S.imp.userRules); const p = previewCards(raw.items, Object.values(merged), have); p.warnings = raw.warnings || []; S.imp.preview = p; }
    else if (k === 'json') { const have2 = have; const fresh = raw.entries.filter((e) => { const id = entryDocId(e); return !(id && have2.has(id)); }); S.imp.preview = { entries: raw.entries, errors: raw.errors, fresh, dupCount: raw.entries.length - fresh.length }; }
  }
  async function onFile(input) {
    const files = [...(input.files || [])]; if (!files.length) return; setImp({ busy: true, error: '', preview: null, raw: null });
    try {
      const k = S.imp.kind; let raw;
      if (k === 'taxsales' || k === 'taxpurchase') { const wb = await readSpreadsheet(await readBuf(files[0])); const parsed = parseTaxInvoiceWorkbook(wb); if (parsed.error) throw new Error(parsed.error); raw = { parsed, fileName: files[0].name }; }
      else if (k === 'bank') { const wb = await readSpreadsheet(await readBuf(files[0])); const bank = parseBankRows(wb.sheets[0].rows); if (bank.error) throw new Error(bank.error); raw = { bank, fileName: files[0].name }; }
      else if (k === 'card') { const items = []; const warnings = []; for (const f of files) { const r = parseCardWorkbook(await readSpreadsheet(await readBuf(f))); if (r.error) { warnings.push(f.name + ': ' + r.error); continue; } if (r.issuer === 'ibk_approval') { warnings.push(f.name + ': IBK 승인내역은 대조용이라 건너뜁니다(매출내역 파일을 올려 주세요).'); continue; } items.push(...r.items); } if (!items.length) throw new Error('읽을 수 있는 카드 이용내역이 없습니다. ' + warnings.join(' ')); raw = { items, warnings, fileName: files.map((f) => f.name).join(', ') }; }
      else { const r = parseEntriesJson(await readText(files[0])); if (!r.entries.length) throw new Error(r.errors[0] || '읽을 수 있는 전표가 없습니다.'); raw = { entries: r.entries, errors: r.errors, fileName: files[0].name }; }
      S.imp.raw = raw; S.imp.userRules = {}; S.imp.acctBySupplier = {}; await buildPreview(); setImp({ busy: false });
    } catch (e) { setImp({ busy: false, error: e.message || '파일을 읽지 못했습니다.' }); }
  }
  async function onFile2(input) {
    const f = input.files && input.files[0]; if (!f || !S.imp.raw || S.imp.kind !== 'bank') return;
    try { const nh = parseBankRows((await readSpreadsheet(await readBuf(f))).sheets[0].rows); if (nh.error) throw new Error(nh.error); S.imp.raw.nh = nh; await buildPreview(); paint(); } catch (e) { setImp({ error: e.message }); }
  }
  async function commit() {
    const p = S.imp.preview; if (!p || !p.fresh.length) return; const btn = body.querySelector('[data-act="commit"]'); if (btn) btn.disabled = true;
    try {
      if (S.imp.kind === 'card') { const merged = {}; S.data.rules.forEach((r) => { merged[r.issuer + '|' + r.key] = r; }); Object.assign(merged, S.imp.userRules); if (Object.keys(S.imp.userRules).length) await saveMerchantRules(Object.values(merged)); }
      const r = await postEntries(p.fresh); const msg = '저장 ' + r.posted + '건 · 이미 있어 건너뜀 ' + r.duplicates + '건' + (r.rejected.length ? ' · 거부 ' + r.rejected.length + '건(' + r.rejected[0].errors[0] + ')' : '');
      try { await recordImport({ kind: S.imp.kind, fileName: (S.imp.raw && S.imp.raw.fileName) || '', rows: p.fresh.length + (p.dupCount || 0), posted: r.posted, duplicates: r.duplicates }); } catch (e) { /* 이력 기록 실패는 무시 */ }
      toast(msg); await reload(); S.imp.preview = null; S.imp.raw = null; S.imp.error = ''; S.imp.done = msg; paint(); body.insertAdjacentHTML('afterbegin', '<div class="jh-alert" data-tone="info" role="status">✅ ' + esc(msg) + '</div>');
    } catch (e) { setImp({ error: e.message }); }
  }

  /* ───── 전표: 상세·역분개·수기 입력 ───── */
  function openEntry(id) {
    const e = S.data.entries.find((x) => x.id === id); if (!e) return; const locked = S.data.settings.lockedThrough || '';
    const p = openPanel('전표 ' + (e.no || ''), entryDialogHtml(e, !e.reversedBy && !e.reverses, locked), []);
    p.el.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-act="reviewed"]')) { try { await markReviewed([id], true); toast('확인 완료로 표시했습니다.'); p.close(); await reload(); paint(); } catch (er) { p.msg(msgHtml('danger', er.message)); } return; }
      if (!ev.target.closest('[data-act="reverse"]')) return; const date = p.el.querySelector('[data-rev-date]').value; const memo = p.el.querySelector('[data-rev-memo]').value;
      if (!date) { p.msg(msgHtml('danger', '역분개 일자를 입력해 주세요.')); return; }
      const ok = await confirmDialog({ title: '역분개', body: e.no + ' 전표를 ' + date + ' 자로 역분개합니다. 원 전표는 그대로 남고 차변·대변을 뒤집은 새 전표가 생깁니다.', confirmLabel: '역분개', variant: 'danger' }); if (!ok.ok) return;
      try { await reverseEntry(id, date, memo); toast('역분개했습니다.'); p.close(); await reload(); paint(); } catch (er) { p.msg(msgHtml('danger', er.message)); }
    });
  }
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

  /* ───── 이벤트(위임) ───── */
  root.onclick = async (ev) => {
    const t = ev.target;
    const row = t.closest('[data-entry]'); if (row) { openEntry(row.getAttribute('data-entry')); return; }
    const ik = t.closest('[data-imp-kind]'); if (ik) { S.imp = { kind: ik.getAttribute('data-imp-kind'), busy: false, error: '', preview: null, userRules: {}, acctBySupplier: {}, raw: null }; paint(); return; }
    const rk = t.closest('[data-rep-kind]'); if (rk) { S.rep.kind = rk.getAttribute('data-rep-kind'); paint(); return; }
    const a = t.closest('[data-act]'); if (!a) return; const act = a.getAttribute('data-act');
    if (act === 'manual') openManual();
    else if (act === 'more') { S.limit += 200; paint(); }
    else if (act === 'review-all') {
      const ids = filterEntries(S.data.entries, S.filter).filter((e) => e.needsReview).map((e) => e.id); if (!ids.length) return;
      const ok = await confirmDialog({ title: '확인 완료로 표시', body: '지금 목록의 ' + ids.length + '건을 모두 확인 완료로 표시합니다. 전표의 금액·계정은 바뀌지 않습니다.', confirmLabel: '표시' }); if (!ok.ok) return;
      try { const n = await markReviewed(ids, true); toast(n + '건을 확인 완료로 표시했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); }
    }
    else if (act === 'commit') await commit();
    else if (act === 'csv') { const st = stmNow(); const kind = S.rep.kind; download(({ is: '손익계산서', bs: '재무상태표', tb: '합계잔액시산표' })[kind] + '_' + S.rep.from + '_' + S.rep.to + '.csv', statementCsv(st, kind)); }
    else if (act === 'print') window.print();
    else if (act === 'open-save') {
      const vals = {}; body.querySelectorAll('[data-open]').forEach((i) => { vals[i.getAttribute('data-open')] = i.value; }); const r = openingFromForm(body.querySelector('[data-open-date]').value, vals);
      if (r.errors) { body.querySelector('[data-open-result]').setAttribute('data-tone', 'danger'); body.querySelector('[data-open-result]').textContent = r.errors[0]; return; }
      const ok = await confirmDialog({ title: '개시 전표 저장', body: '개시 일자 ' + r.entry.date + ' · 자본(차액) ' + r.equity.toLocaleString('ko-KR') + '원으로 저장합니다. 저장한 전표는 고치거나 지울 수 없고 역분개로만 바로잡습니다.', confirmLabel: '저장' }); if (!ok.ok) return;
      try { const res = await postEntries([r.entry]); if (res.rejected.length) throw new Error(res.rejected[0].errors[0]); toast(res.duplicates ? '같은 날짜의 개시 전표가 이미 있어 건너뛰었습니다.' : '개시 전표를 저장했습니다.'); await reload(); location.hash = '#/finance/home'; } catch (e) { body.querySelector('[data-open-result]').setAttribute('data-tone', 'danger'); body.querySelector('[data-open-result]').textContent = e.message; }
    }
    else if (act === 'set-save') { try { await saveSettings(body.querySelector('[data-set="ownBiz"]').value, body.querySelector('[data-set="ownName"]').value); toast('설정을 저장했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); } }
    else if (act === 'lock') {
      const d = body.querySelector('[data-lock-date]').value; if (!d) { toast('마감일을 입력해 주세요.'); return; }
      const ok = await confirmDialog({ title: '결산 마감', body: d + ' 까지의 전표를 잠급니다. 이 날짜 이전으로는 새 전표를 만들 수 없고, 마감일은 앞당길 수 없습니다.', confirmLabel: '마감', variant: 'danger' }); if (!ok.ok) return;
      try { await lockThrough(d); toast('마감했습니다.'); await reload(); paint(); } catch (e) { toast(e.message); }
    }
  };
  root.onchange = async (ev) => {
    const t = ev.target;
    if (t.matches('[data-file]')) { await onFile(t); return; }
    if (t.matches('[data-file2]')) { await onFile2(t); return; }
    if (t.matches('[data-sup]')) { S.imp.acctBySupplier[t.getAttribute('data-sup')] = t.value; await buildPreview(); paint(); return; }
    if (t.matches('[data-merch]')) { const [issuer, key] = t.getAttribute('data-merch').split('|'); S.imp.userRules[issuer + '|' + key] = { issuer, key, account: t.value, label: '화면에서 선택', memo: '' }; await buildPreview(); paint(); return; }
    if (t.matches('[data-f]')) { const k = t.getAttribute('data-f'); S.filter[k] = t.type === 'checkbox' ? t.checked : t.value; S.limit = 100; paint(); if (k === 'q') { const q = body.querySelector('[data-f="q"]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } return; }
    if (t.matches('[data-rep]')) { S.rep[t.getAttribute('data-rep')] = t.value; paint(); return; }
  };
  root.oninput = (ev) => {
    const t = ev.target;
    if (t.matches('[data-open],[data-open-date]')) { const vals = {}; body.querySelectorAll('[data-open]').forEach((i) => { vals[i.getAttribute('data-open')] = i.value; }); const r = openingFromForm(body.querySelector('[data-open-date]').value, vals); const out = body.querySelector('[data-open-result]'); out.setAttribute('data-tone', r.errors ? 'warn' : 'info'); out.textContent = r.errors ? r.errors[0] : '자본(차액) ' + r.equity.toLocaleString('ko-KR') + '원' + (r.equity < 0 ? ' — 마이너스(자본잠식)입니다' : ''); }
  };
}
