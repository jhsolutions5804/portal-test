/* 표 파일(CSV) 공용 안전 함수 — 엑셀이 열 때 수식으로 실행하는 값(CSV 수식 주입)을 막는다(대기열 1-2-8 5단계, 대표님 2026-10-22). 시험: tests/shared-csv.test.mjs.
 * 글자가 = + - @ 탭 CR LF 로 시작하면 앞에 작은따옴표를 붙여 글자로 읽히게 한다(OWASP). 숫자(음수 포함)는 숫자라 그대로 — 음수 마진율 -53.2 에 작은따옴표를 붙이면 엑셀이 글자로 읽어 합계가 깨진다(숫자는 숫자로 넘길 것).
 * 모든 값은 큰따옴표로 감싼다(기존 월 마감 CSV 출력 호환 — 엑셀은 "1000" 도 숫자로 읽는다). NaN·Infinity·null·undefined·객체·함수는 빈 칸, 불리언은 글자. */
export function csvCell(v) {
  let t;
  if (typeof v === 'number') t = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'string') t = /^[=+\-@\t\r\n]/.test(v) ? "'" + v : v;
  else if (typeof v === 'boolean') t = String(v);
  else t = '';
  return '"' + t.replace(/"/g, '""') + '"';
}
/* 필요할 때만 큰따옴표를 쓰는 셀(대기열 1-2-11, 대표님 2026-10-22) — 가맹점 분류표처럼 파일 모양을 바꾸지 않아야 하는 곳용. 값 해석과 수식 시작 글자 보호는 csvCell 과 같고(= + - @ 탭 CR LF 로 시작하는 글자는 작은따옴표 접두, 숫자는 그대로, 그 밖은 빈 칸),
 * 쉼표·큰따옴표·줄바꿈이 있을 때만 큰따옴표로 감싼다(기존 분류표 출력과 같다). */
export function csvCellMin(v) {
 let t;
 if (typeof v === 'number') t = Number.isFinite(v) ? String(v) : '';
 else if (typeof v === 'string') t = /^[=+\-@\t\r\n]/.test(v) ? "'" + v : v;
 else if (typeof v === 'boolean') t = String(v);
 else t = '';
 return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
/** 행(배열의 배열)을 CSV 글자로 — 맨 앞에 BOM(엑셀에서 한글이 깨지지 않게), 행은 CRLF, 끝에도 CRLF. 행이 배열이 아니면 건너뛴다 */
export function csvText(rows) {
  const list = Array.isArray(rows) ? rows.filter(Array.isArray) : [];
  return '\ufeff' + list.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
