/* 견적 산식 표의 셀 수식 계산기 — 순수 계산. eval·Function 을 쓰지 않고 한 글자씩 읽는 해석기라서 입력한 글자가 코드로 실행될 길이 없다. 시험: tests/formula.test.mjs
 * 셀 규칙: 빈 칸 → { ok:true, empty:true } · 숫자(천 단위 쉼표 허용) → 그 값 · "=" 로 시작 → 수식(숫자 · + - * / × ÷ · 괄호 · %) · 그 밖의 글자 → 오류. 셀 참조·함수·거듭제곱은 지원하지 않는다.
 * 안전장치: 길이 120자, 허용 문자만, 괄호 20단계, 결과 1e13(견적 저장 규칙과 같은 한도), 소수 6자리 반올림(0.1+0.2 = 0.3). */
const MAX_LEN = 120, MAX_DEPTH = 20, LIMIT = 1e13;
const ALLOWED = /^[0-9.,+\-*/×÷()%\x20\t\r\n]*$/; // 공백은 일반 공백·탭·줄바꿈만. \s 는 NBSP·전각 공백·BOM 같은 보이지 않는 문자까지 받아 금액을 조용히 바꿀 수 있어 쓰지 않는다
const WS = /[\x20\t\r\n]+/g, TRIM = /^[\x20\t\r\n]+|[\x20\t\r\n]+$/g;
const NUM_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^\.\d+$/; // 천 단위 쉼표(1,250) 또는 쉼표 없는 숫자. "1,5"·"12,34" 같은 소수점 쉼표 실수는 거부
const err = (error) => ({ ok: false, error });
const tidy = (x) => Math.round(x * 1e6) / 1e6;
/** 한 셀의 글자(또는 숫자)를 읽는다. 돌려주는 값: { ok:true, empty:true } | { ok:true, value } | { ok:false, error } */
export function evalCell(input) {
  if (input === null || input === undefined) return { ok: true, empty: true };
  if (typeof input === 'number') { if (!Number.isFinite(input)) return err('숫자가 올바르지 않습니다.'); if (Math.abs(input) > LIMIT) return err('값이 허용 한도를 넘습니다.'); return { ok: true, value: tidy(input) }; }
  if (typeof input !== 'string') return err('숫자나 =수식으로 입력해 주세요.');
  const text = input.replace(TRIM, ''); if (text === '') return { ok: true, empty: true };
  if (text.length > MAX_LEN) return err('입력이 너무 깁니다(' + MAX_LEN + '자 이하).');
  if (text[0] !== '=') { if (!NUM_RE.test(text.replace(/^-/, ''))) return err('숫자나 =수식으로 입력해 주세요(예: 1,250 또는 =8*38.5).'); const n = parseFloat(text.replace(/,/g, '')); if (Math.abs(n) > LIMIT) return err('값이 허용 한도를 넘습니다.'); return { ok: true, value: tidy(n) }; }
  const src = text.slice(1); if (!ALLOWED.test(src)) return err('수식에는 숫자와 + - × ÷ ( ) % 만 쓸 수 있습니다.');
  const s = src.replace(WS, ''); if (s === '') return err('수식이 비어 있습니다.');
  let i = 0; const peek = () => s[i];
  const fail = (m) => { const e = new Error(m); e.formula = true; throw e; };
  function number() {
    let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j++;
    const tok = s.slice(i, j); if (!tok) fail('숫자가 필요합니다.'); if (!NUM_RE.test(tok)) fail('숫자 형식이 올바르지 않습니다: ' + tok);
    i = j; const n = parseFloat(tok.replace(/,/g, '')); if (!Number.isFinite(n) || Math.abs(n) > LIMIT) fail('값이 허용 한도를 넘습니다.'); return n;
  }
  function factor(depth) {
    const c = peek();
    if (c === '+') { i++; return factor(depth); }
    if (c === '-') { i++; return -factor(depth); }
    let v;
    if (c === '(') { if (depth >= MAX_DEPTH) fail('괄호를 너무 깊게 겹쳤습니다(' + MAX_DEPTH + '단계 이하).'); i++; v = expr(depth + 1); if (peek() !== ')') fail('괄호가 닫히지 않았습니다.'); i++; }
    else v = number();
    while (peek() === '%') { i++; v = v / 100; }
    return v;
  }
  function term(depth) {
    let v = factor(depth);
    for (;;) {
      const c = peek();
      if (c === '*' || c === '×') { i++; v = v * factor(depth); }
      else if (c === '/' || c === '÷') { i++; const d = factor(depth); if (d === 0) fail('0 으로 나눌 수 없습니다.'); v = v / d; }
      else return v;
      if (!Number.isFinite(v) || Math.abs(v) > LIMIT) fail('값이 허용 한도를 넘습니다.');
    }
  }
  function expr(depth) {
    let v = term(depth);
    for (;;) { const c = peek(); if (c === '+') { i++; v = v + term(depth); } else if (c === '-') { i++; v = v - term(depth); } else return v; if (!Number.isFinite(v) || Math.abs(v) > LIMIT) fail('값이 허용 한도를 넘습니다.'); }
  }
  try {
    const v = expr(0);
    if (i < s.length) fail(s[i] === ')' ? '괄호가 맞지 않습니다.' : '수식을 읽을 수 없습니다: ' + s.slice(i, i + 6));
    if (!Number.isFinite(v) || Math.abs(v) > LIMIT) return err('값이 허용 한도를 넘습니다.');
    return { ok: true, value: tidy(v) };
  } catch (e) { if (e && e.formula) return err(e.message); return err('수식을 계산할 수 없습니다.'); }
}
