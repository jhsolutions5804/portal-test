/* 인사 서류(근로계약서·연봉계약서·급여명세서) 문서 이름(대기열 1-2-7 ③, 대표님 2026-10-22 — 핵심 3종만, 작성 중 미리보기는 이름만) — 시험: tests/hr-doc-titles.test.mjs.
 * 저장본: 근로계약서 = 종류 - 이름 - 계약 시작일 / 연봉계약서 = 종류 - 이름 - 연도(대표님 확정 "연봉은 연도") / 급여명세서 = 종류 - 연월 - 이름(확정 "급여명세서는 연월 우선").
 * 작성 중 미리보기: 계약서는 날짜 없이 종류 - 이름(계약 시작일은 아직 바뀔 수 있다). 급여명세서는 연월을 넣는다(월은 사용자가 고른 값이고 급여명세서의 정체성이다).
 * 제목에는 이름·종류·날짜(연월)만 — 주민번호·주소·연락처·급여·계좌·서명·부서·직급은 서류에 있어도 넣지 않는다(docFileName 의 안전 필터가 이름 칸의 전화번호·금액을 한 번 더 지운다). */
import { docFileName } from '../../shared/doc-filename.js?v=20261022c';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const realDate = (s) => { const m = String(s == null ? '' : s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31 ? m[0] : ''; };
const realMonth = (s) => { const m = String(s == null ? '' : s).match(/^(\d{4})-(\d{2})/); return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? m[0] : ''; };
/** label = '근로계약서' | '연봉계약서'(K.label), rec = 계약서 기록(또는 작성 중 폼), o.preview = 작성 중 미리보기 */
export function contractDocTitle(label, rec, o) {
  const r = isObj(rec) ? rec : {}; const preview = !!(o && o.preview); const kind = typeof label === 'string' && label ? label : '계약서'; const start = realDate(r.startDate);
  if (preview || !start) return docFileName({ group: 'person', kind, name: r.name });
  return kind === '연봉계약서' ? docFileName({ group: 'person', kind, name: r.name, year: Number(start.slice(0, 4)) }) : docFileName({ group: 'person', kind, name: r.name, date: start });
}
/** rec = 급여명세서 기록(payslipRecord) — 연월은 저장본·미리보기 모두 넣는다 */
export function payslipDocTitle(rec, o) {
  const r = isObj(rec) ? rec : {}; return docFileName({ group: 'person', kind: '급여명세서', name: r.name, ym: realMonth(r.month) });
}
