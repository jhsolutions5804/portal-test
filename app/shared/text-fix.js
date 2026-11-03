/* 전각(넓은 폭) 문자 → 보통 문자 — 메신저·엑셀에서 복사해 붙여 넣은 「Ｐ４ｐｈ」「（ ）」「、」 가 일정 제목·장소에 그대로 저장되면 글자 사이가 벌어져 보이고(2026-11-03 PJT 일정 3건) 검색·Outlook 전송에도 불편하다.
 * 순수 함수(화면·네트워크 없음). 바꾸는 것: 전각 영문·숫자·기호(U+FF01~FF5E) → 같은 보통 문자, 전각 공백(U+3000) → 공백, 、(U+3001) → 쉼표, 。(U+3002) → 마침표.
 * 한글·한자·일본어 가나·반각 가타카나·㈜·①처럼 의미가 있는 기호는 그대로 둔다(NFKC 를 쓰지 않는 이유 — 「①」이 「1」로 바뀌는 등 뜻이 달라질 수 있다). 두 번 적용해도 결과가 같다. */
export function toHalfwidth(s) {
  if (s == null) return '';
  return String(s).replace(/[\uFF01-\uFF5E\u3000\u3001\u3002]/g, (ch) => {
    const n = ch.charCodeAt(0);
    if (n >= 0xFF01 && n <= 0xFF5E) return String.fromCharCode(n - 0xFEE0);
    if (n === 0x3000) return ' ';
    if (n === 0x3001) return ',';
    return '.';
  });
}
/** 객체·배열 안의 모든 글자 값을 같은 규칙으로 정리한 새 값을 돌려준다(숫자·참/거짓·비어 있는 값·날짜 같은 객체는 그대로, 키는 건드리지 않음). 붙여 넣기가 많은 문서(업무일지·공사일보 등)를 저장하기 직전에 한 번 쓴다. */
export function halfwidthDeep(v) {
  if (typeof v === 'string') return toHalfwidth(v);
  if (Array.isArray(v)) return v.map(halfwidthDeep);
  if (v && Object.getPrototypeOf(v) === Object.prototype) { const o = {}; Object.keys(v).forEach((k) => { o[k] = halfwidthDeep(v[k]); }); return o; }
  return v;
}
