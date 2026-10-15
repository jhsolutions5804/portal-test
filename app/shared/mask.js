/* 이메일 가리기 — 화면 표시용("ab***@domain.kr"). 인사 모듈(hr/sign.js maskEmail)과 같은 규칙이며 tests/eval-result-io.test.mjs 가 두 결과가 같은지 확인한다(모듈끼리 직접 가져오지 않기 위한 공용 사본). */
export const maskEmail = (e) => { const [a, b] = String(e || '').split('@'); return b ? a.slice(0, 2) + '***@' + b : ''; };
