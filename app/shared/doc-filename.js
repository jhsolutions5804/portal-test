/* 모든 문서(PDF) 파일 이름 규칙 — 공용 함수 한 곳(대표님 확정 2026-10-16, 대기열 1-2).
 * 브라우저의 "인쇄 → PDF 저장" 은 문서 <title> 을 기본 파일 이름으로 쓴다. 각 문서의 <title> 에 이 함수의 결과를 넣는다.
 *
 * 문서군별 순서(구분자 ' - '):
 *   project : 프로젝트 → 종류 → 번호 → 상대방 → 날짜(YYYY-MM-DD)          예) P4 Ph2 - 견적서 - EST-2026-001 - 다람이엔지 - 2026-05-10
 *   month   : 연월(YYYY-MM) → 종류 → (프로젝트)                            예) 2026-09 월말 마감
 *   person  : 종류 → 이름 → 기준일. 연월(ym)을 주면 '연월 종류 - 이름'(급여명세서)  예) 근로계약서 - 홍길동 - 2026-10-26 / 2026-06 급여명세서 - 홍길동
 *   edoc    : 종류 → 문서번호 → 작성자 → 날짜                              예) 구매품의 - 2610001 - 김작성 - 2026-10-01
 *
 * 안전 규칙(강제): 주민번호·계좌번호·전화번호·금액처럼 보이는 글자는 이름의 자유 입력 칸(프로젝트·상대방·이름·작성자)에서 지운다.
 * 번호는 영문·숫자·한글·._- 만, 날짜는 YYYY-MM-DD / YYYY-MM 형식만 받는다. 파일 이름에 못 쓰는 문자(/ \ : * ? " < > |)와 제어문자는 없앤다.
 * 전체 길이는 120자 이내(넘으면 자유 입력 칸부터 줄여 날짜·번호는 살린다). 이 파일은 화면 코드와 무관한 순수 함수라 서버·시험에서도 같이 쓴다. */
const MAX_PART = 40, MAX_ALL = 120;
const BAD = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const SENSITIVE = [
  /\d{6}[-\s]?[1-8]\d{6}/g, // 주민등록번호
  /(?:\+82[-\s]?)?0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, // 전화·휴대폰
  /\d{2,6}(?:-\d{2,8}){2,3}/g, // 하이픈이 있는 계좌·카드번호
  /\d{9,}/g, // 긴 숫자열(계좌·카드·사업자 등)
  /[₩￦]\s*\d[\d,.]*/g, // ₩ 금액
  /\d[\d,.]*\s*(?:원|만원|억원|억|천원)/g, // '원' 금액
  /\d{1,3}(?:,\d{3})+/g // 천 단위 쉼표 숫자
];
/** 자유 입력 글자(프로젝트·상대방·이름 등)를 파일 이름 조각으로: 민감 패턴·금지 문자 제거, 공백 정리, 길이 제한 */
export function safeText(s, max) {
  let t = String(s == null ? '' : s).normalize('NFC');
  SENSITIVE.forEach((re) => { t = t.replace(re, ' '); });
  t = t.replace(BAD, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s-]+|[.\s-]+$/g, '');
  const m = max || MAX_PART;
  return t.length > m ? t.slice(0, m).trim() : t;
}
const noOf = (s) => String(s == null ? '' : s).replace(/[^0-9A-Za-z가-힣._-]/g, '').slice(0, 30);
const dateOf = (s) => { const m = String(s == null ? '' : s).match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
const ymOf = (s) => { const m = String(s == null ? '' : s).match(/^\d{4}-\d{2}/); return m ? m[0] : ''; };
function build(x, maxFree) {
  const free = (v) => safeText(v, maxFree), kind = safeText(x.kind, 30) || '문서';
  let parts;
  if (x.group === 'month') parts = [[ymOf(x.ym), kind].filter(Boolean).join(' '), free(x.project)];
  else if (x.group === 'person') { const ym = ymOf(x.ym); parts = ym ? [ym + ' ' + kind, free(x.name)] : [kind, free(x.name), dateOf(x.date)]; }
  else if (x.group === 'edoc') parts = [kind, noOf(x.docNo != null ? x.docNo : x.no), free(x.author), dateOf(x.date)];
  else parts = [free(x.project), kind, noOf(x.no), free(x.party), dateOf(x.date)];
  return parts.filter(Boolean).join(' - ');
}
/** 문서 파일 이름(확장자 없음). o = { group, kind, project, no, party, date, ym, name, docNo, author } — 없는 칸은 건너뛴다 */
export function docFileName(o) {
  const x = o || {};
  let s = build(x, MAX_PART);
  if (s.length > MAX_ALL) s = build(x, 18);
  if (s.length > MAX_ALL) s = s.slice(0, MAX_ALL).replace(/[\s-]+$/, '');
  return s;
}
