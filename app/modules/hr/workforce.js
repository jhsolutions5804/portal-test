/* 인력 현황(대기열 1-3-16 ⑦ 1차) — 근로자 명부만으로 재직 인원의 직급·직원 구분·근속 분포, 평균 근속, 해마다의 입사·퇴사 인원을 모은다. 인건비 추이는 본섭에 재무 장부가 이식된 뒤(2차).
 * 재직 인원 숫자 카드는 인사 홈에 이미 있어 다시 만들지 않는다. 시험·대표 계정이 아닌 "test"·"[테스트]…" 이름은 통계에서 뺀다. 순수 함수 — 시험: tests/hr-workforce.test.mjs */
import { EMP_TYPES } from './logic.js?v=20261031f';
import { RANK_ORDER } from '../../shared/org.js?v=20261031f';

export const TENURE_BUCKETS = [['1년 미만', 0, 1], ['1~3년', 1, 3], ['3~5년', 3, 5], ['5년 이상', 5, 1000]];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const isTestAccount = (name) => { const s = String(name || '').trim(); return s === 'test' || /^\[테스트\]/.test(s); };
/** 입사일부터 오늘까지 햇수(소수) — 입사일이 없거나 오늘보다 미래면 null */
export function tenureYears(hireDate, today) {
  if (!isDate(hireDate) || !isDate(today) || hireDate > today) return null; // 달력 기준 — 윤년이 끼어도 정확히 만 N년이면 N.0 (365.25 로 나누면 만 5년이 4.999 로 나온다)
  const [hy, hm, hd] = hireDate.split('-').map(Number); const [ty, tm, td] = today.split('-').map(Number); let y = ty - hy; if (tm < hm || (tm === hm && td < hd)) y--;
  const from = Date.UTC(hy + y, hm - 1, hd), to = Date.UTC(hy + y + 1, hm - 1, hd); return y + (utc(today) - from) / (to - from);
}
const r1 = (v) => Math.round(v * 10) / 10;
export function workforceStats(workers, today) {
  const W = (workers || []).filter((w) => w && w.id && !isTestAccount(w.name)); const active = W.filter((w) => w.status !== 'resigned');
  const count = (list, keyOf) => { const m = new Map(); list.forEach((w) => { const k = keyOf(w); m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const rk = count(active, (w) => String(w.rank || '').trim() || '(미지정)'); const ranks = []; RANK_ORDER.forEach((r) => { if (rk.has(r)) { ranks.push([r, rk.get(r)]); rk.delete(r); } }); [...rk.entries()].sort((a, b) => (a[0] === '(미지정)') - (b[0] === '(미지정)') || b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).forEach((e) => ranks.push(e)); // 모르는 직급은 많은 순, (미지정)은 맨 끝
  const label = (k) => { const t = (EMP_TYPES || []).find((x) => (Array.isArray(x) ? x[0] : x) === k); return t ? (Array.isArray(t) ? t[1] : t) : (k || '(미지정)'); };
  const tp = count(active, (w) => label(w.empType)); const types = [...tp.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const ys = []; let noDate = 0; active.forEach((w) => { const y = tenureYears(w.hireDate, today); if (y === null) noDate++; else ys.push(y); });
  const tenure = TENURE_BUCKETS.map(([l, lo, hi]) => [l, ys.filter((y) => y >= lo && y < hi).length]);
  const yearCount = (list, field) => { const m = new Map(); list.forEach((w) => { if (isDate(w[field])) { const y = w[field].slice(0, 4); m.set(y, (m.get(y) || 0) + 1); } }); return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)); };
  return { today, headcount: active.length, avgTenure: ys.length ? r1(ys.reduce((a, b) => a + b, 0) / ys.length) : null, noHireDate: noDate, ranks, types, tenure, hires: yearCount(W, 'hireDate'), exits: yearCount(W.filter((w) => w.status === 'resigned'), 'resignDate'), resignedTotal: W.length - active.length };
}
