import { esc, toast } from '../../core/ui.js?v=20261008j';
import { confirmDialog } from '../../core/dialog.js?v=20261008j';
import { readSpreadsheet } from '../../shared/xls-read.js?v=20261008j';
import { parseTaxInvoiceWorkbook } from '../../shared/hometax-import.js?v=20261008j';
import { parseBankSheets } from '../../shared/bank-import.js?v=20261008j';
import { ownerSettlementKeys } from '../../shared/bank-classify.js?v=20261008j';
import { parseCardWorkbook } from '../../shared/card-import.js?v=20261008j';
import { summarize, filterEntries, statements, statementCsv, openingFromForm, previewTaxInvoices, previewBank, previewCards, parseEntriesJson, manualEntry, expenseEntryFromForm, accountName, entryDocId, monthEnd, kstToday, receiptFileProblem, receiptToForm, previewPayroll } from './logic.js?v=20261008j';
import { loadLedger, loadProjects, postEntries, markReviewed, reverseEntry, lockThrough, saveSettings, saveMerchantRules, recordImport, readReceipt, getReceiptFile, readPayroll } from './data.js?v=20261008j';
import { tabsHtml, homeHtml, entriesHtml, entryDialogHtml, manualDialogHtml, importHtml, reportsHtml, openingHtml, settingsHtml, expenseHtml } from './view.js?v=20261008j';

/** 재무회계 — 복식 원장·가져오기·재무제표. 영업기획·인사총무와 분리된 영역(관리자·재무회계팀·perms.finance). 설계: 기획_재무제표_설계_r1.md */
export const manifest = {
  id: 'finance', order: 25, title: '재무회계', icon: '📒', defaultHash: '#/finance/home',
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
  const tab = ['home', 'entries', 'expense', 'import', 'reports', 'opening', 'settings'].includes(route.segs[0]) ? route.segs[0] : 'home';
  root.onclick = null; root.onchange = null; root.oninput = null; root.ondragover = null; root.ondragleave = null; root.ondrop = null;
  root.innerHTML = '<div class="jh-finance">' + tabsHtml(tab) + '<div id="fin-body" class="jh-finance__body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#fin-body');
  const paint = () => {
    S.data.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0)));
    const sum = summarize(S.data.entries); const stm = stmNow(); const st = Object.assign({}, S, S.data, { projects: S.projects || [], sum, stm, list: filterEntries(S.data.entries, S.filter) });
    body.innerHTML = tab === 'home' ? homeHtml(st) : tab === 'entries' ? entriesHtml(st) : tab === 'expense' ? expenseHtml(st) : tab === 'import' ? importHtml(st) : tab === 'reports' ? reportsHtml(st) : tab === 'opening' ? openingHtml(st) : settingsHtml(st);
    body.removeAttribute('aria-busy');
  };
  const reload = async () => { S.data = await loadLedger(); };
  RC_RESET();
  try { await reload(); if (tab === 'expense' && !S.projects) S.projects = await loadProjects(); paint(); if (tab === 'expense') setTimeout(() => { rcShow(); rcRender(); }, 0); } catch (e) { console.error('재무회계 불러오기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 재무회계 권한이 있는 계정인지 확인해 주세요. (' + esc(e.code || e.message) + ')</div>'; return; }

  /* ───── 가져오기 ───── */
  const setImp = (patch) => { Object.assign(S.imp, patch); paint(); };
  async function buildPreview() {
    const k = S.imp.kind; const raw = S.imp.raw; if (!raw) return;
    const have = existingIds();
    if (k === 'taxsales' || k === 'taxpurchase') { const p = previewTaxInvoices(raw.parsed, k === 'taxsales' ? 'sales' : 'purchase', S.data.settings.ownBiz, have, S.imp.acctBySupplier); S.imp.preview = p; }
    else if (k === 'bank') { const ctx2 = { ownerSettle: raw.nh ? ownerSettlementKeys(raw.bank.txns, raw.nh.txns) : undefined }; const p = previewBank(raw.bank.txns, ctx2, have); p.bank = raw.bank; p.warnings = []; if (raw.bank.balanceBreaks) p.warnings.push('통장 잔액이 이어지지 않는 곳이 ' + raw.bank.balanceBreaks + '곳 있습니다 — 빠진 거래가 있는지 확인해 주세요.'); if (raw.bank.totalsOk === false) p.warnings.push('파일의 합계 줄과 거래 합계가 다릅니다.'); if (raw.nh) p.warnings.push('농협 개인 계좌 거래내역을 참고해 개인카드 대금 정산 이체를 짝지었습니다.'); S.imp.preview = p; }
    else if (k === 'card') { const merged = {}; S.data.rules.forEach((r) => { merged[r.issuer + '|' + r.key] = r; }); Object.assign(merged, S.imp.userRules); const p = previewCards(raw.items, Object.values(merged), have); p.warnings = raw.warnings || []; S.imp.preview = p; }
    else if (k === 'payroll') { S.imp.preview = previewPayroll(raw.payroll, have, S.data.entries); }
    else if (k === 'json') { const have2 = have; const fresh = raw.entries.filter((e) => { const id = entryDocId(e); return !(id && have2.has(id)); }); S.imp.preview = { entries: raw.entries, errors: raw.errors, fresh, dupCount: raw.entries.length - fresh.length }; }
  }
  async function onFile(input) {
    const files = [...(input.files || [])]; if (!files.length) return; setImp({ busy: true, error: '', preview: null, raw: null });
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
      if (ev.target.closest('[data-act="rc-view"]')) { await viewReceipt(e, p.el); return; }
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
    else if (act === 'csv') { const st = stmNow(); const kind = S.rep.kind; download(({ is: '손익계산서', bs: '재무상태표', cf: '현금흐름표', tb: '합계잔액시산표' })[kind] + '_' + S.rep.from + '_' + S.rep.to + '.csv', statementCsv(st, kind)); }
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
    if (t.matches('[data-rc-file]')) { await onReceipts(t); return; }
    if (t.matches('[data-file]')) { await onFile(t); return; }
    if (t.matches('[data-file2]')) { await onFile2(t); return; }
    if (t.matches('[data-sup]')) { S.imp.acctBySupplier[t.getAttribute('data-sup')] = t.value; await buildPreview(); paint(); return; }
    if (t.matches('[data-merch]')) { const [issuer, key] = t.getAttribute('data-merch').split('|'); S.imp.userRules[issuer + '|' + key] = { issuer, key, account: t.value, label: '화면에서 선택', memo: '' }; await buildPreview(); paint(); return; }
    if (t.matches('[data-x="total"],[data-x="vat"],[data-open]')) { const n = Number(String(t.value).replace(/[,\s원]/g, '')); if (t.value.trim() !== '' && Number.isFinite(n)) t.value = n.toLocaleString('ko-KR'); }   // 금액 칸은 천 단위 쉼표
    if (t.matches('[data-x]')) { expPreview(); return; }
    if (t.matches('[data-f]')) { const k = t.getAttribute('data-f'); S.filter[k] = t.type === 'checkbox' ? t.checked : t.value; S.limit = 100; paint(); if (k === 'q') { const q = body.querySelector('[data-f="q"]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } return; }
    if (t.matches('[data-rep]')) { S.rep[t.getAttribute('data-rep')] = t.value; paint(); return; }
  };
  root.ondragover = (ev) => { const z = ev.target.closest && ev.target.closest('[data-drop]'); if (z) { ev.preventDefault(); z.classList.add('is-over'); } };
  root.ondragleave = (ev) => { const z = ev.target.closest && ev.target.closest('[data-drop]'); if (z) z.classList.remove('is-over'); };
  root.ondrop = async (ev) => {   // 파일을 끌어다 놓기 — 영수증 칸이면 영수증으로, 가져오기 칸이면 그 종류의 파일로
    const z = ev.target.closest && ev.target.closest('[data-drop]'); if (!z) return; ev.preventDefault(); z.classList.remove('is-over');
    const files = [...((ev.dataTransfer && ev.dataTransfer.files) || [])]; if (!files.length) return;
    if (z.getAttribute('data-drop') === 'rc') await onReceipts({ files }); else await onFile({ files: S.imp.kind === 'card' ? files : files.slice(0, 1) });
  };
  root.oninput = (ev) => {
    const t = ev.target;
    if (t.matches('[data-x]')) { expPreview(); return; }
    if (t.matches('[data-open],[data-open-date]')) { const vals = {}; body.querySelectorAll('[data-open]').forEach((i) => { vals[i.getAttribute('data-open')] = i.value; }); const r = openingFromForm(body.querySelector('[data-open-date]').value, vals); const out = body.querySelector('[data-open-result]'); out.setAttribute('data-tone', r.errors ? 'warn' : 'info'); out.textContent = r.errors ? r.errors[0] : '자본(차액) ' + r.equity.toLocaleString('ko-KR') + '원' + (r.equity < 0 ? ' — 마이너스(자본잠식)입니다' : ''); }
  };
}
