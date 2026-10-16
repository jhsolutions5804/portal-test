/* 급여명세서 엑셀(테크명세서양식) 한 달치 → 임금대장 소급 행. 순수 함수 — readXlsx 결과(sheets:[{name,rows}])를 받는다.
 * 칸 주소가 아니라 "라벨"을 찾아 오른쪽 값을 읽는다(양식이 월마다 조금씩 달라서: 항목 수·계산란 유무). 계좌번호는 읽지 않는다(임금대장에 불필요).
 * 모든 행에 검산(지급합계=항목 합, 공제합계=항목 합, 실지급=지급−공제±10원)을 붙여 어긋나면 저장하지 못하게 한다. */
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const blank = (v) => String(v == null ? '' : v).trim() === '';
const pad = (n) => String(n).padStart(2, '0');

/** "2,100,000 "·"₩1,000"·1234 → 숫자, 숫자가 아니면 null(#VALUE! 등) */
export function toNum(v) {
  if (isNum(v)) return v;
  const s = String(v == null ? '' : v).replace(/[₩,\s원]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
/** 날짜 값 → YYYY-MM-DD. "2024년 12월 31일"·"2026-07-31"·엑셀 일련번호·"85/08/30"(2자리 연도는 30 초과면 19xx) */
export function toIsoDate(v) {
  if (isNum(v) && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v == null ? '' : v).trim(); let m;
  if ((m = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(s))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = /^(\d{2})\/(\d{1,2})\/(\d{1,2})$/.exec(s))) return `${+m[1] > 30 ? 1900 + +m[1] : 2000 + +m[1]}-${pad(m[2])}-${pad(m[3])}`;
  return '';
}
/** 파일 이름 "(24.11)"·"24년 11월" → "2024-11" */
export function ymFromFileName(name) {
  const s = String(name || ''); let m = /\((\d{2})\.(\d{2})\)/.exec(s) || /(\d{2})년\s*(\d{1,2})월/.exec(s);
  return m ? `20${m[1]}-${pad(m[2])}` : '';
}
/** 지급일이 익월 말일이므로 귀속월 = 지급일의 전월 */
export function ymFromPayDate(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || ''); if (!m) return '';
  let y = +m[1], mo = +m[2] - 1; if (mo < 1) { mo = 12; y -= 1; } return `${y}-${pad(mo)}`;
}

const INFO = { name: '사원명', payDate: '지급일', hireDate: '입사일자', empNo: '사번', rank: '직위', birth: '생년월일', account: '계좌번호' };
const INFO_LABELS = new Set(Object.values(INFO).map(norm));
const cellsOf = (row) => row.map((v, i) => ({ v, i })).filter((c) => !blank(c.v));
const firstNumAfter = (cs, from) => { for (const c of cs) { if (c.i > from) { const n = toNum(c.v); if (n != null) return n; } } return null; };

function parseSheet(sheet) {
  const rows = sheet.rows || [], info = {};
  // ① 인적사항: 라벨 다음 칸(다른 라벨이면 빈 값). 계좌번호 라벨은 읽지 않는다.
  for (const row of rows) {
    const cs = cellsOf(row);
    cs.forEach((c, k) => {
      const key = Object.keys(INFO).find((x) => norm(INFO[x]) === norm(c.v));
      if (!key || key === 'account' || key in info) return;
      const nx = cs[k + 1]; info[key] = nx && !INFO_LABELS.has(norm(nx.v)) ? nx.v : '';
    });
  }
  const name = String(info.name == null ? '' : info.name).trim();
  if (!name) return { skip: '사원명 없음(양식·요약 시트)' };
  // ② 지급·공제 항목: "급여내역"·"공제내역" 머리줄의 위치로 좌우를 나눈다
  let h = -1, split = -1, payAmt = -1, dedAmt = -1;
  rows.forEach((row, r) => { if (h >= 0) return; const a = row.findIndex((v) => norm(v).includes('급여내역')), b = row.findIndex((v) => norm(v).includes('공제내역')); if (a >= 0 && b >= 0) { h = r; split = b; const am = row.map((v, i) => (norm(v) === '금액' ? i : -1)).filter((i) => i >= 0); payAmt = am.find((i) => i < b) ?? -1; dedAmt = am.find((i) => i > b) ?? -1; } });
  if (h < 0) return { skip: '급여내역·공제내역 머리줄을 찾지 못함' };
  const pay = {}, ded = {}; let r = h + 1;
  for (; r < rows.length; r++) {
    const cs = cellsOf(rows[r]); if (cs.some((c) => ['과세합계', '지급합계'].includes(norm(c.v)))) break;
    // 금액은 머리줄 "금액" 칸 위치에서만 읽는다(같은 줄 오른쪽의 계산란 숫자가 빈 공제 칸 대신 잡히는 것을 막는다). 머리줄에 금액 칸이 없으면 라벨 다음 숫자.
    for (const side of [cs.filter((c) => c.i < split), cs.filter((c) => c.i > split && (dedAmt < 0 || c.i <= dedAmt + 1))]) {
      const lab = side.find((c) => toNum(c.v) == null && !['항목', '금액'].includes(norm(c.v))); if (!lab) continue;
      const col = lab.i < split ? payAmt : dedAmt; const near = col >= 0 ? side.find((c) => c.i >= col - 1 && c.i <= col + 1 && toNum(c.v) != null) : null;
      const amt = col >= 0 ? (near ? toNum(near.v) : null) : firstNumAfter(side, lab.i); if (amt == null) continue;
      const key = String(lab.v).trim(), tgt = lab.i < split ? pay : ded; tgt[key] = (tgt[key] || 0) + amt;
    }
  }
  // ③ 합계줄
  const T = { taxable: null, nonTaxable: null, payTotal: null, dedTotal: null, net: null };
  for (; r < rows.length; r++) {
    const cs = cellsOf(rows[r]); if (cs.some((c) => norm(c.v).includes('계산방법'))) break;
    const L = cs.filter((c) => c.i < split), R = cs.filter((c) => c.i >= split);
    for (const c of L) { const n = norm(c.v); if (n === '과세합계') T.taxable = firstNumAfter(L, c.i); if (n === '지급합계') T.payTotal = firstNumAfter(L, c.i); }
    for (const c of R) { const n = norm(c.v); if (n === '비과세합계') T.nonTaxable = firstNumAfter(R, c.i); if (n === '공제합계') T.dedTotal = firstNumAfter(R, c.i); }
    for (const c of cs) { if (norm(c.v) === '실지급액') T.net = firstNumAfter(cs, c.i) ?? T.net; }
  }
  if (T.net == null) { for (const row of rows) { const cs = cellsOf(row); if (cs.some((c) => norm(c.v) === '실지급액')) { const n = firstNumAfter(cs, -1); if (n != null) T.net = n; } } }
  // ④ 계산란(있을 때만): 라벨이 정확히 같을 때만 읽는다(산출식 설명 글과 섞이지 않게)
  const calc = {}; const CALC = { contractAnnual: (n) => n === '계약연봉', monthlyBase: (n) => n === '세전월급', hourlyWage: (n) => n === '통상시급', workDays: (n) => n.endsWith('근무일'), overtimeHours: (n) => n === '초과근로시간', specialHours: (n) => n === '특근시간', recognizedHours: (n) => n === '성과인정시간' };
  for (const row of rows) { const cs = cellsOf(row); for (const c of cs) { const n = norm(c.v); for (const [k, f] of Object.entries(CALC)) { if (!(k in calc) && typeof c.v === 'string' && f(n)) { const v = firstNumAfter(cs, c.i); if (v != null) calc[k] = v; } } } }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const checks = { pay: T.payTotal == null ? null : sum(pay) === T.payTotal, ded: T.dedTotal == null ? (sum(ded) === 0 ? true : null) : sum(ded) === T.dedTotal, net: T.net == null || T.payTotal == null ? null : Math.abs(T.net - (T.payTotal - (T.dedTotal || 0))) <= 10 };
  return { row: { name, birth: toIsoDate(info.birth) || String(info.birth || ''), hireDate: toIsoDate(info.hireDate), rank: String(info.rank == null ? '' : info.rank).trim(), excelEmpNo: String(info.empNo == null ? '' : info.empNo).trim(), payDate: toIsoDate(info.payDate), pay, ded, ...T, calc, checks, ok: checks.pay === true && checks.ded === true && checks.net === true, sheet: sheet.name } };
}

/** 한 파일(readXlsx 결과) → { ym, ymSource, rows, skipped, warnings } */
export function parseWageWorkbook(book, fileName = '') {
  const rows = [], skipped = [], warnings = [];
  for (const sh of (book && book.sheets) || []) { const res = parseSheet(sh); if (res.skip) skipped.push({ sheet: sh.name, reason: res.skip }); else rows.push(res.row); }
  const fromName = ymFromFileName(fileName), fromPay = [...new Set(rows.map((x) => ymFromPayDate(x.payDate)).filter(Boolean))];
  let ym = fromName || fromPay[0] || '', ymSource = fromName ? '파일 이름' : fromPay[0] ? '지급일' : '';
  if (fromName && fromPay.length && fromPay.some((x) => x !== fromName)) warnings.push(`파일 이름의 귀속월(${fromName})과 지급일로 계산한 귀속월(${fromPay.join(', ')})이 다릅니다 — 파일을 확인하세요.`);
  if (fromPay.length > 1) warnings.push(`시트마다 지급일이 달라 귀속월이 여러 개입니다(${fromPay.join(', ')}).`);
  if (!ym) warnings.push('귀속월을 알 수 없습니다(파일 이름에 (YY.MM) 또는 지급일이 필요).');
  if (!rows.length) warnings.push('읽을 수 있는 직원 시트가 없습니다.');
  rows.forEach((x) => { x.ym = ym; });
  return { ym, ymSource, rows, skipped, warnings };
}
