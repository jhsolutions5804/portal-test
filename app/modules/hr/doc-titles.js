/* 인사 서류(근로계약서·연봉계약서·급여명세서) 문서 이름(대기열 1-2-7 ③, 대표님 2026-10-22 — 핵심 3종만, 작성 중 미리보기는 이름만) — 시험: tests/hr-doc-titles.test.mjs.
 * 저장본: 근로계약서 = 종류 - 이름 - 계약 시작일 / 연봉계약서 = 종류 - 이름 - 연도(대표님 확정 "연봉은 연도") / 급여명세서 = 종류 - 연월 - 이름(확정 "급여명세서는 연월 우선").
 * 작성 중 미리보기: 계약서는 날짜 없이 종류 - 이름(계약 시작일은 아직 바뀔 수 있다). 급여명세서는 연월을 넣는다(월은 사용자가 고른 값이고 급여명세서의 정체성이다).
 * 제목에는 이름·종류·날짜(연월)만 — 주민번호·주소·연락처·급여·계좌·서명·부서·직급은 서류에 있어도 넣지 않는다(docFileName 의 안전 필터가 이름 칸의 전화번호·금액을 한 번 더 지운다). */
import { docFileName } from '../../shared/doc-filename.js?v=20261031d';
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
/* ───────── 나머지 서류(대표님 2026-10-22 "이름·날짜 넣어도 돼"): 해고예고통지서·퇴직원·휴직원·연차촉진·연봉 제안서·이력서 ─────────
 * 이 서류들은 해고 사유·연봉 금액·연차 일수·생년월일·주소 같은 민감한 값이 서류에 있어도 제목에는 종류·이름·기준일만 쓴다(필드별로 시험). */
const dateOnly = (s) => realDate(s);
/** 해고예고통지서 — 종류 - 이름 - 통지일. d = dismissal_notices 기록(workerName·noticeDate) */
export function dismissalDocTitle(d) { const r = isObj(d) ? d : {}; return docFileName({ group: 'person', kind: '해고예고통지서', name: r.workerName, date: dateOnly(r.noticeDate) }); }
/** 퇴직원·휴직원 — 종류 - 이름 - 기준일(퇴직 예정일 / 휴직 시작일 — 둘 다 lastDate). kind = rrqKindOf(d) 의 '휴직' 이면 휴직원, 아니면 퇴직원(코드의 기본과 같다) */
export function resignDocTitle(d, kind) { const r = isObj(d) ? d : {}; return docFileName({ group: 'person', kind: kind === '휴직' ? '휴직원' : '퇴직원', name: r.authorName, date: dateOnly(r.lastDate) }); }
/** 연차 사용 촉진 통보서 — 서류 제목(차수 포함, leave-promo-docs.js 의 제목과 같다) - 이름 - 통보일. 지금은 서류 제목에 이름이 아예 없다 */
export function leavePromoDocTitle(rec) { const r = isObj(rec) ? rec : {}; const kind = r.stage === 'p2' ? '연차 유급휴가 사용 시기 지정 통보서 (2차)' : '연차 유급휴가 사용 촉진 통보서 (' + (r.stage === 'p1x' ? '추가 1차' : '1차') + ')'; return docFileName({ group: 'person', kind, name: r.workerName, date: dateOnly(r.noticeDate) }); }
/** 연봉 제안서 — 종류 - 이름 - 제안일. 작성 중 출력(o.preview)은 이름만(제안일·금액이 아직 바뀔 수 있다) */
export function offerDocTitle(f, o) { const r = isObj(f) ? f : {}; const preview = !!(o && o.preview); return docFileName({ group: 'person', kind: '연봉 제안서', name: r.name, date: preview ? '' : dateOnly(r.offerDate) }); }
/** 이력서 — 종류 - 이름(자연스러운 기준일이 없고 생년월일은 개인정보라 날짜는 넣지 않는다) */
export function resumeDocTitle(a) { const r = isObj(a) ? a : {}; return docFileName({ group: 'person', kind: '이력서', name: r.name }); }
