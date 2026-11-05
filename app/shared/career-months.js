/* 경력 개월 계산(공용) — 인사 모듈(경력관리·이력서 인쇄)과 직원 본인 화면(내 이력서)이 같은 계산을 쓰도록 shared 에 둔다. 순수 함수(시험: tests/hr-career-tab.test.mjs). */
const ym = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
const idx = (s) => (+s.slice(0, 4)) * 12 + (+s.slice(5, 7) - 1);
/** 입사 전 경력 합계 개월(겹치는 기간은 한 번만 센다). 퇴사가 비어 있으면 todayYm(YYYY-MM)까지. 시기를 알 수 없는 줄은 뺀다 */
export function careerMonths(rows, todayYm) {
  const spans = (rows || []).map((r) => { if (!ym(r.from)) return null; const e = ym(r.to) ? idx(r.to) : (ym(todayYm) ? idx(todayYm) : null); if (e == null) return null; const s = idx(r.from); return e >= s ? [s, e + 1] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  let total = 0, curS = null, curE = null;
  spans.forEach(([s, e]) => { if (curS == null) { curS = s; curE = e; } else if (s <= curE) { curE = Math.max(curE, e); } else { total += curE - curS; curS = s; curE = e; } });
  if (curS != null) total += curE - curS; return total;
}
export const fmtMonths = (m) => { const n = Math.max(0, Math.round(m || 0)); const y = Math.floor(n / 12), r = n % 12; return ((y ? y + '년 ' : '') + (r || !y ? r + '개월' : '')).trim(); };
