/* 급여명세서 통합 문서(월별, 사람별 시트) → 월 급여 집계. 시트 형식: 지급 항목(C열 이름·F열 금액), 공제 항목(K열 이름·P열 금액), 지급합계·공제합계·실지급액.
 * 개인정보(생년월일·계좌번호)는 읽지 않는다. 요약 시트의 합계와 개인 시트 합계를 대조한다. */
const squash = (s) => String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
const n = (v) => (typeof v === 'number' ? Math.round(v) : (Number(squash(v).replace(/,/g, '')) || 0));
const serialDate = (v) => (typeof v === 'number' && v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10) : '');
export function parsePayslipWorkbook(wb) {
  const sheets = (wb && wb.sheets) || []; const sum = sheets.find((s) => s.name === '요약'); const people = []; const skip = new Set(['요약', '양식', 'Sheet1']);
  for (const sh of sheets) {
    if (skip.has(sh.name)) continue; const rows = sh.rows; let hi = -1; for (let i = 0; i < Math.min(rows.length, 30); i++) if (squash((rows[i] || [])[1]).includes('급여내역')) { hi = i; break; } if (hi < 0) continue;
    const pay = [], ded = []; let gross = 0, dedTotal = 0, net = 0;
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || []; const b = squash(r[1]), j = squash(r[9]);
      if (b.includes('지급합계')) { gross = n(r[5]); dedTotal = n(r[15]); continue; } if (b.includes('실지급액')) { net = n(r[9] || r[10] || r[5]) || net; continue; } if (b.includes('과세합계') || b.includes('계산방법')) { if (b.includes('계산방법')) break; continue; }
      const pl = String(r[2] == null ? '' : r[2]).trim(), pv = n(r[5]); if (pl && pv) pay.push({ item: pl.replace(/\s+/g, ''), amount: pv });
      const dl = String(r[10] == null ? '' : r[10]).trim(), dv = n(r[15]); if (dl && dv) ded.push({ item: dl.replace(/\s+/g, ''), amount: dv });
    }
    if (!net) net = gross - dedTotal; people.push({ sheet: sh.name, pay, ded, gross, dedTotal, net, check: gross - dedTotal === net });
  }
  const payDate = sum ? serialDate((sum.rows[0] || [])[3]) : ''; const totals = { gross: 0, ded: 0, net: 0 }; const payItems = {}, dedItems = {};
  people.forEach((p) => { totals.gross += p.gross; totals.ded += p.dedTotal; totals.net += p.net; p.pay.forEach((x) => { payItems[x.item] = (payItems[x.item] || 0) + x.amount; }); p.ded.forEach((x) => { dedItems[x.item] = (dedItems[x.item] || 0) + x.amount; }); });
  let summaryNet = null; if (sum) { summaryNet = 0; sum.rows.forEach((r) => { if (typeof r[0] === 'number' || (r[1] !== '' && typeof r[1] === 'number')) summaryNet += n(r[10]); }); }
  return { payDate, count: people.length, totals, payItems, dedItems, people: people.map((p) => ({ sheet: p.sheet, gross: p.gross, dedTotal: p.dedTotal, net: p.net, check: p.check })), summaryNet, summaryOk: summaryNet == null ? null : Math.round(summaryNet) === Math.round(totals.net) };
}

/* ───────── 포털 급여명세서(payslips/{근로자}/months/{월}) → 전표 초안 ───────── */
import { validateEntry } from './ledger-engine.js?v=20261008e';
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const R = (v) => Math.round(Number(v) || 0);
/** 포털 급여명세서 문서 1건 → 귀속월 말일자 전표. 현장 직원(부서 현장관리팀·PJT 또는 유형 field)은 현장노무비, 그 밖은 급여(판관비).
 *  차 급여/노무비 총지급 / 대 예수금(4대보험·소득세·지방소득세) · 기숙사비 회수 · 미지급금(급여, 실지급). 실지급은 통장 이체 때 미지급금과 상계 */
export function entryFromPortalPayslip(p, workerId) {
  const gross = R(p.grossPay), ded = ['pension', 'health', 'ltcare', 'employ', 'incomeTax', 'localTax'].reduce((s, k) => s + R(p[k]), 0), dorm = R(p.dormitory), net = R(p.netPay);
  const site = /현장|PJT/.test(p.dept || '') || p.empType === 'field';
  const lines = [{ account: site ? '5110' : '6010', side: 'D', amount: gross, partner: p.name }]; if (ded) lines.push({ account: '2030', side: 'C', amount: ded, partner: '4대보험·원천세(' + p.name + ')' }); if (dorm) lines.push({ account: '2020', side: 'C', amount: dorm, partner: '이엔지 공제 기숙사비(' + p.name + ')' });   /* 기숙사비는 이엔지가 대금에서 공제 — 직원 급여에서 뺀 만큼 이엔지에 줄 돈(미지급금)으로 두고, 이엔지 공제 때 외상매출금과 상계 */ lines.push({ account: '2020', side: 'C', amount: net, partner: p.name });
  const e = { date: lastDay(p.month), memo: p.month + ' 급여 ' + p.name + (site ? ' (현장)' : ''), source: { kind: 'payslip', id: (workerId || p.empNo || p.name) + '_' + p.month }, needsReview: dorm > 0, lines: lines.filter((l) => l.amount > 0) };
  const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors };
}
