/* 사업용 통장 거래내역(기업은행 등 은행 엑셀) → 표준 거래 목록. 파일은 최신 거래가 위, 거래후 잔액 사슬로 빠짐·중복을 검증한다. */
const squash = (s) => String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
const norm = (s) => String(s == null ? '' : s).replace(/（/g, '(').replace(/）/g, ')').trim();
const num = (v) => (typeof v === 'number' ? Math.round(v) : (Number(squash(v).replace(/,/g, '')) || 0));
/** 한 시트(또는 여러 시트로 쪽이 나뉜 엑셀)의 거래를 표준 목록으로. seqStart: 앞 시트까지 읽은 거래 수(파일 순서 번호를 이어 가기 위해) */
export function parseBankRows(rows, seqStart) {
  let hi = -1, map = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const m = {}; (rows[i] || []).forEach((h, c) => { const k = squash(h); if (k) m[k] = c; }); if (m['출금액'] !== undefined && m['출금'] === undefined) m['출금'] = m['출금액']; if (m['입금액'] !== undefined && m['입금'] === undefined) m['입금'] = m['입금액']; if (m['잔액'] !== undefined && m['거래후잔액'] === undefined) m['거래후잔액'] = m['잔액']; if (m['내용'] !== undefined && m['거래내용'] === undefined) m['거래내용'] = m['내용']; if (m['적요'] !== undefined && m['거래구분'] === undefined) m['거래구분'] = m['적요']; if (m['출금금액'] !== undefined && m['출금'] === undefined) m['출금'] = m['출금금액']; if (m['입금금액'] !== undefined && m['입금'] === undefined) m['입금'] = m['입금금액']; if (m['거래기록사항'] !== undefined && m['상대계좌예금주명'] === undefined) m['상대계좌예금주명'] = m['거래기록사항']; if (m['거래메모'] !== undefined && m['메모'] === undefined) m['메모'] = m['거래메모']; if (m['거래일시'] === undefined && m['거래일자'] !== undefined && m['거래시간'] !== undefined) m['거래일시'] = m['거래일자']; if (m['거래일시'] !== undefined && m['출금'] !== undefined && m['입금'] !== undefined) { hi = i; map = m; break; } }
  if (hi < 0) return { txns: [], error: '은행 거래내역 엑셀로 보이지 않습니다. (거래일시·출금·입금 머리글을 찾지 못했습니다)' };
  let account = '', holder = ''; for (let i = 0; i < hi; i++) { const t = (rows[i] || []).map(squash).join(''); const m = /계좌번호[:：]?([0-9\-]{8,})/.exec(t); if (m) account = m[1]; const h = /예금주명?[:：]?([가-힣A-Za-z0-9（）()]+?)(?:통장|예금종류|$)/.exec(t); if (h && !holder) holder = h[1]; }
  const g = (r, k) => (map[k] === undefined ? '' : r[map[k]]); const txns = []; let totals = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; if (r.every((x) => x === '' || x == null)) continue; const dt = (String(g(r, '거래일시')).trim() + (map['거래시간'] !== undefined && /^\d{4}[-./]\d{2}[-./]\d{2}$/.test(String(g(r, '거래일시')).trim()) ? ' ' + String(r[map['거래시간']] || '').trim() : '')).trim();
    if (/합계/.test(dt) || /합계/.test(squash(r[0]))) { const o = g(r, '출금') || r[2], n_ = g(r, '입금') || r[3]; if (typeof o === 'number' || typeof n_ === 'number') totals = { out: num(o), in: num(n_) }; continue; }
    const m = /^(\d{4})[-./](\d{2})[-./](\d{2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/.exec(dt); if (!m) continue;
    const out = num(g(r, '출금')), inn = num(g(r, '입금')), bal = num(g(r, '거래후잔액'));
    txns.push({ seq: (Number(r[0]) || txns.length + 1) + (seqStart || 0), date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] || '', out, in: inn, balance: bal, desc: norm(g(r, '거래내용')), counterBank: norm(g(r, '상대은행')), memo: norm(g(r, '메모')), kind: norm(g(r, '거래구분')), counterName: norm(g(r, '상대계좌예금주명')), counterAcct: String(g(r, '상대계좌번호') || '').replace(/\D/g, '') });
  }
  // 파일 순서(최신이 위) → 오래된 것부터. 같은 시각이면 파일 번호가 큰 쪽이 먼저(오래됨)
  const chron = txns.slice().sort((a, b) => b.seq - a.seq);
  let breaks = 0; for (let i = 1; i < chron.length; i++) if (chron[i - 1].balance + chron[i].in - chron[i].out !== chron[i].balance) breaks++;
  const first = chron[0]; const opening = first ? first.balance + first.out - first.in : 0; const sum = (k) => txns.reduce((s, t) => s + t[k], 0);
  return { txns: chron, account, holder, opening, closing: chron.length ? chron[chron.length - 1].balance : 0, balanceBreaks: breaks, sums: { out: sum('out'), in: sum('in') }, fileTotals: totals, totalsOk: totals ? totals.out === sum('out') && totals.in === sum('in') : null, from: first && first.date, to: chron.length && chron[chron.length - 1].date };
}
/** 같은 거래를 다시 올려도 한 번만 — 일시·출입금·잔액으로 만든 키 */
export const bankKey = (t) => ['bank', t.date, t.time, t.out, t.in, t.balance].join('_');
/** 시트가 여러 장인 거래내역(예: 신한 SOHO 사업자통장 — 쪽마다 시트) 전체를 이어서 읽는다. 최신이 위인 순서를 시트 순서대로 이어 붙이고 잔액 사슬을 한 번에 검증 */
export function parseBankSheets(sheets) {
  let all = [], info = null, errors = [];
  (sheets || []).forEach((s, i) => { const r = parseBankRows(s.rows || [], all.length); if (r.error) { errors.push('시트 ' + (i + 1) + ': ' + r.error); return; } if (!info) info = r; all = all.concat(r.txns); });
  if (!all.length) return { txns: [], error: errors[0] || '은행 거래내역 엑셀로 보이지 않습니다.' };
  const chron = all.slice().sort((a, b) => b.seq - a.seq); let breaks = 0; for (let i = 1; i < chron.length; i++) if (chron[i - 1].balance + chron[i].in - chron[i].out !== chron[i].balance) breaks++;
  const first = chron[0]; const sum = (k) => all.reduce((x, t) => x + t[k], 0);
  return { txns: chron, account: info.account, holder: info.holder, opening: first.balance + first.out - first.in, closing: chron[chron.length - 1].balance, balanceBreaks: breaks, sums: { out: sum('out'), in: sum('in') }, fileTotals: sheets.length === 1 ? info.fileTotals : null, totalsOk: sheets.length === 1 ? info.totalsOk : null, from: first.date, to: chron[chron.length - 1].date, sheets: sheets.length, skippedSheets: errors.length };
}
