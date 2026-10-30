/* 신고 입력표 — 근로자·계약서 불러오기, 주민번호 열람, 복사(파이어스토어·열람·복사 함수는 밖에서 주입). 시험: tests/hr-insurance-edi.test.mjs */
import { sheetOfState } from './insurance-edi.js?v=20261031a';
import { ediInit } from './insurance-edi-view.js?v=20261031a';
const J_SHOW_MS = 60000; // 열람한 주민번호는 1분 뒤 다시 가린다
export function makeEdiIo({ db, collection, getDocs, query, orderBy, limit }) {
  const one = async (path, wid) => { const s = await getDocs(query(collection(db, path + '/' + wid + '/contracts'), orderBy('contractDate', 'desc'), limit(1))); return s.empty ? null : Object.assign({ id: s.docs[0].id }, s.docs[0].data()); };
  return {
    async loadWorkers() { const s = await getDocs(collection(db, 'workers')); const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l.sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); },
    async loadContracts(wid) { const [annual, labor] = await Promise.all([one('annual_contracts', wid).catch(() => null), one('labor_contracts', wid).catch(() => null)]); return { annual, labor }; },
    async loadSlips(wid) { const q = await getDocs(collection(db, 'payslips/' + wid + '/months')); const l = []; q.forEach((d) => { const x = d.data() || {}; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(d.id)) l.push({ ym: d.id, grossPay: Number(x.grossPay) || 0 }); }); return l.sort((a, c) => (a.ym < c.ym ? -1 : 1)); }
  };
}
/** 클립보드 복사 — 실패하면 선택 복사로 한 번 더 시도 */
export async function copyToClipboard(text) {
  try { if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(String(text)); return true; } } catch (e) { /* 아래에서 다시 */ }
  try { const t = document.createElement('textarea'); t.value = String(text); t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); document.body.removeChild(t); return !!ok; } catch (e) { return false; }
}
export function ediActions({ st, io, paint, toast, revealJumin, copyText, today, after }) {
  const ensure = () => { if (!st.edi) st.edi = ediInit(); return st.edi; }; const later = after || ((fn, ms) => setTimeout(fn, ms)); let timer = null;
  const hide = () => { const e = ensure(); e.jumin = ''; if (timer) { clearTimeout(timer); timer = null; } };
  return {
    hide,
    async open() { const e = ensure(); if (e.loaded) { paint(); return; } e.loading = true; e.err = ''; paint(); try { e.workers = await io.loadWorkers(); e.loaded = true; } catch (x) { e.err = (x && (x.message || x.code)) || String(x); } e.loading = false; paint(); },
    async pick(id) {
      const e = ensure(); hide(); e.sel = id || ''; e.annual = null; e.labor = null; e.slips = []; e.payOv = ''; e.hoursOv = ''; e.lossPayOv = ''; e.lossPrevOv = ''; e.reasonOther = false; if (!e.sel) { paint(); return; } e.busy = true; paint();
      try { if (e.kind === 'loss') { const sl = await io.loadSlips(e.sel); if (e.sel === id) e.slips = sl; } else { const c = await io.loadContracts(e.sel); if (e.sel === id) { e.annual = c.annual; e.labor = c.labor; } } } catch (x) { toast((e.kind === 'loss' ? '급여명세서를 불러오지 못했습니다: ' : '계약서를 불러오지 못했습니다: ') + ((x && x.message) || '')); }
      e.busy = false; paint();
    },
    async change(t) { const e = ensure(); if (t.matches('[data-edi-worker]')) { await this.pick(t.value); return; } if (t.matches('[data-edi-pay]')) { e.payOv = t.value; paint(); return; } if (t.matches('[data-edi-hours]')) { e.hoursOv = t.value; paint(); return; } if (t.matches('[data-edi-lpay]')) { e.lossPayOv = t.value; paint(); return; } if (t.matches('[data-edi-lprev]')) { e.lossPrevOv = t.value; paint(); return; } if (t.matches('[data-edi-reason]')) { e.reasonOther = t.value === 'other'; paint(); } },
    async setKind(k) { const e = ensure(); hide(); e.kind = k === 'loss' ? 'loss' : 'acquire'; e.sel = ''; e.annual = null; e.labor = null; e.slips = []; e.payOv = ''; e.hoursOv = ''; e.lossPayOv = ''; e.lossPrevOv = ''; e.reasonOther = false; paint(); },
    async click(act) {
      const e = ensure(); if (act === 'hide') { hide(); paint(); return; }
      if (act === 'reveal') { if (!e.sel) return; const r = await revealJumin(e.sel); if (!r) return; if (!r.found) { toast('저장된 주민번호가 없습니다 — 근로자 명부에서 먼저 입력해 주세요.'); return; } e.jumin = r.jumin; paint(); if (timer) clearTimeout(timer); timer = later(() => { e.jumin = ''; timer = null; paint(); }, J_SHOW_MS); }
    },
    async copy(rowId) { const e = ensure(); const row = sheetOfState(e, today()).sections.flatMap((s) => s.rows).find((r) => r.id === rowId); if (!row || !row.copy) return; const ok = await copyText(row.copy); toast(ok ? '복사했습니다 — ' + row.label : '복사하지 못했습니다. 값을 직접 선택해 복사해 주세요.'); }
  };
}
