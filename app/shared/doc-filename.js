/* 모든 문서(PDF) 파일 이름 규칙 — 공용 함수 한 곳(대표님 확정 2026-10-16, 대기열 1-2).
 * 브라우저의 "인쇄 → PDF 저장" 은 문서 <title> 을 기본 파일 이름으로 쓴다. 각 문서의 <title> 에 이 함수의 결과를 넣는다.
 *
 * **종류(견적서·월말 마감·근로계약서 …)는 모든 문서군에서 이름의 맨 앞**(대표님 2026-10-17 — 파일 목록에서 종류별로 묶여 보이게). 문서군별 순서(project 는 '_', 나머지는 ' - '):
 *   project : 종류 _ 날짜(YYYYMMDD) _ 거래처(담당자) _ 현장명 _ 견적명   (구분자 '_', 대표님이 엑셀로 쓰시던 방식 + 맨 앞에 종류)
 *             예) 견적서_20260510_다람이엔지(김과장)_P4 Ph2_FCU 설치 견적   — 견적명이 없는 정산서·계약서는 그 칸만 건너뜀. 번호(EST-…)는 파일 이름에 넣지 않는다
 *   month   : 종류 → 연월(YYYY-MM) → (거래처) → (프로젝트)                            예) 월말 마감 - 2026-09 / 월간 보고서 - 2026-07 - P4 Ph2 (FAB)
 *   person  : 종류 → 이름 → 기준일. 연월(ym)을 주면 '종류 - 연월 - 이름'(급여명세서)  예) 근로계약서 - 홍길동 - 2026-10-26 / 급여명세서 - 2026-06 - 홍길동
 *   edoc    : 종류 → 문서번호 → 작성자 → 날짜                              예) 구매품의 - 2610001 - 김작성 - 2026-10-01
 *   period  : 종류 → 기간 → (이름) — 재무제표·원장·부가세 신고표처럼 시작~끝 기간이 핵심인 문서(대표님 2026-10-22). 기간은 from~to 이고 월의 첫날~월의 마지막 날이면 연월로 줄인다(2026-01~2026-09, 한 달이면 2026-09), 끝날짜만 있으면 그 날짜(기준일)
 *             예) 손익계산서 - 2026-01~2026-09 / 재무상태표 - 2026-09-30 / 계정별 원장 - 2026-01~2026-09 - 보통예금
 *   (전자결재 문서에는 문서번호 필드가 없어 edoc 의 번호를 비우면 칸만 건너뛴다 — 대표님 2026-10-22)
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
  // 이름 속 '/' 는 '-' 로("A/S" → "A-S"; 공백으로 바꾸면 "A S" 처럼 어색해진다). 나머지 금지 문자는 공백으로
  t = t.replace(/\//g, '-').replace(BAD, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s-]+|[.\s-]+$/g, '');
  const m = max || MAX_PART;
  return t.length > m ? t.slice(0, m).trim() : t;
}
const noOf = (s) => String(s == null ? '' : s).replace(/[^0-9A-Za-z가-힣._-]/g, '').slice(0, 30);
const dateOf = (s) => { const m = String(s == null ? '' : s).match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
const compactDate = (s) => dateOf(s).replace(/-/g, '');
const partyOf = (party, contact, max) => { const p = safeText(party, max), c = safeText(contact, 20); return p && c ? p + '(' + c + ')' : (p || c); };
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 기간 글자 — from·to 는 YYYY-MM-DD 만 받고(틀린 형식은 버림) 시작이 끝보다 늦으면 바꾼다. 월 첫날~월 마지막 날이면 연월로 줄인다(한쪽만 줄이지 않는다) */
const periodOf = (from, to) => { const real = (d) => { const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/); return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31 ? d : ''; }; let a = real(dateOf(from)), b = real(dateOf(to)); if (a && b && a > b) { const t = a; a = b; b = t; } if (!a && !b) return ''; if (!b) return a + '~'; if (!a) return b;
  const ma = a.match(/^(\d{4})-(\d{2})-01$/), mb = b.match(/^(\d{4})-(\d{2})-(\d{2})$/); const aligned = !!ma && !!mb && Number(mb[3]) === lastDay(Number(mb[1]), Number(mb[2])); if (aligned) return a.slice(0, 7) === b.slice(0, 7) ? a.slice(0, 7) : a.slice(0, 7) + '~' + b.slice(0, 7); return a + '~' + b; };
const ymOf = (s) => { const m = String(s == null ? '' : s).match(/^\d{4}-\d{2}/); return m ? m[0] : ''; };
function build(x, maxFree) {
  const free = (v) => safeText(v, maxFree), kind = safeText(x.kind, 30) || '문서';
  let parts;
  if (x.group === 'month') parts = [kind, ymOf(x.ym), free(x.party), free(x.project)]; // party(거래처)는 선택 — 안 주면 기존 이름과 같다(월말 마감·월간 보고서). 정산서는 종류 - 기준월 - 거래처(대기열 1-2-10, 대표님 2026-10-23)
  else if (x.group === 'person') { const ym = ymOf(x.ym); const yr = (typeof x.year === 'number' || typeof x.year === 'string') && /^\d{4}$/.test(String(x.year)) && Number(x.year) >= 1900 && Number(x.year) <= 2100 ? String(x.year) : ''; parts = ym ? [kind, ym, free(x.name)] : [kind, free(x.name), yr || dateOf(x.date)]; }
  else if (x.group === 'period') parts = [kind, periodOf(x.from, x.to), free(x.project)];
  else if (x.group === 'edoc') parts = [kind, noOf(x.docNo != null ? x.docNo : x.no), free(x.author), dateOf(x.date)];
  else {   // project: 종류_날짜_거래처(담당자)_현장명_견적명
    const proj = free(x.project); let ttl = safeText(x.title, maxFree === MAX_PART ? 60 : maxFree);   // 견적명은 실제로 52자까지 있어 60자(길어서 줄일 때는 18자)
    if (ttl && kind && ttl.endsWith(kind)) ttl = ttl.slice(0, ttl.length - kind.length).replace(/[\s_\-·]+$/, '');   // 견적명 끝의 "…견적서"는 앞의 종류와 겹치니 떼어낸다(종류는 항상 맨 앞에 남는다)
    if (ttl === proj) ttl = '';                                       // 견적명이 현장명과 같으면 한 번만
    return [kind, compactDate(x.date), partyOf(x.party, x.contact, maxFree), proj, ttl].filter(Boolean).join('_');
  }


  return parts.filter(Boolean).join(' - ');
}
/** 문서 파일 이름(확장자 없음). o = { group, kind, project, no, party, contact, title, rev, date, ym, name, docNo, author } — 없는 칸은 건너뛴다. project 문서군은 contact(거래처 담당자)·title(견적명)을 쓴다 */
export function docFileName(o) {
  const x = o || {};
  // 개정본(rev 2 이상)은 맨 끝에 _r2 · _r3 (대표님 2026-10-18) — 같은 날 같은 거래처·견적명의 원본과 개정본이 같은 이름이 되어 덮어쓰는 것을 막는다. 처음 발행한 견적(rev 1)의 이름은 그대로
  const rev = Math.floor(Number(x.rev)), suf = rev >= 2 && rev < 100 ? '_r' + rev : '', cap = MAX_ALL - suf.length;
  let s = build(x, MAX_PART);
  if (s.length > cap) s = build(x, 18);
  if (s.length > cap) s = s.slice(0, cap).replace(/[\s_-]+$/, '');
  return s + suf;
}
