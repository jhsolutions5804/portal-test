/* 견적 산식 표의 셀 수식 계산기 — 순수 계산. eval·Function 을 쓰지 않고 한 글자씩 읽는 해석기라서 입력한 글자가 코드로 실행될 길이 없다. 시험: tests/formula.test.mjs
 * 셀 규칙: 빈 칸 → { ok:true, empty:true } · 숫자(천 단위 쉼표 허용) → 그 값 · "=" 로 시작 → 수식 · 그 밖의 글자 → 오류.
 * 수식: 숫자 · + - * / × ÷ ^ % · 괄호 · 칸 참조(E1 — 열 글자 + 행 번호, 표 안에서만) · 범위(E1:E3 — 함수 안에서만) · 함수 SUM AVERAGE MIN MAX ROUND ROUNDUP ROUNDDOWN ABS. 이름은 칸 참조 모양이거나 허용 함수가 아니면 전부 오류.
 * 엑셀과 같은 점: 빈 칸은 0, 범위 안의 글자 칸은 건너뜀, ^ 는 왼쪽부터(2^3^2 = 64), 앞의 마이너스가 먼저(-2^2 = 4), 함수 이름·열 글자는 대소문자 무관. 함수 안에서는 쉼표가 인수 구분이고 함수 밖에서만 천 단위 쉼표(1,000)를 읽는다.
 * 안전장치: 길이 120자, 허용 문자만, 괄호·함수 20단계, 결과 1e13(견적 저장 규칙과 같은 한도), 소수 6자리 반올림(0.1+0.2 = 0.3).
 * 칸 값은 호출하는 쪽(표)이 ctx 로 준다: { cols:'ABCDEF', rowCount:n, get(col,row) → {ok:true,value} | {ok:true,text:true} | {ok:false,error} } — 순환 참조 검사도 그쪽에서 한다. */
const MAX_LEN = 120, MAX_DEPTH = 20, LIMIT = 1e13;
const ALLOWED = /^[0-9A-Za-z.,+\-*/×÷()%^:#!\x20\t\r\n]*$/; // 공백은 일반 공백·탭·줄바꿈만. \s 는 NBSP·전각 공백·BOM 같은 보이지 않는 문자까지 받아 금액을 조용히 바꿀 수 있어 쓰지 않는다
const WS = /[\x20\t\r\n]+/g, TRIM = /^[\x20\t\r\n]+|[\x20\t\r\n]+$/g;
const NUM_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^\.\d+$/; // 천 단위 쉼표(1,250) 또는 쉼표 없는 숫자. "1,5"·"12,34" 같은 소수점 쉼표 실수는 거부
const PLAIN_RE = /^\d+(?:\.\d+)?$|^\.\d+$/; // 함수 안 — 쉼표는 인수 구분이라 숫자에 못 들어간다
export const FUNCS = Object.freeze(['SUM', 'AVERAGE', 'MIN', 'MAX', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS']);
const err = (error) => ({ ok: false, error });
const tidy = (x) => Math.round(x * 1e6) / 1e6;
const shift = (v, d) => Number(v + 'e' + d); // 10 의 거듭제곱을 곱하지 않고 글자로 옮겨 1.005 같은 값의 부동소수점 오차를 피한다
function roundTo(x, d, mode) {
  const sign = x < 0 ? -1 : 1; const a = Math.abs(tidy(x)); const sc = shift(a, d);
  const r = mode === 'up' ? Math.ceil(sc) : mode === 'down' ? Math.floor(sc) : Math.round(sc);
  return sign * shift(r, -d);
}
/** 한 셀의 글자(또는 숫자)를 읽는다. ctx 는 표 안에서만 준다. 돌려주는 값: { ok:true, empty:true } | { ok:true, value } | { ok:false, error } */
export function evalCell(input, ctx) {
  if (input === null || input === undefined) return { ok: true, empty: true };
  if (typeof input === 'number') { if (!Number.isFinite(input)) return err('숫자가 올바르지 않습니다.'); if (Math.abs(input) > LIMIT) return err('값이 허용 한도를 넘습니다.'); return { ok: true, value: tidy(input) }; }
  if (typeof input !== 'string') return err('숫자나 =수식으로 입력해 주세요.');
  const text = input.replace(TRIM, ''); if (text === '') return { ok: true, empty: true };
  if (text.length > MAX_LEN) return err('입력이 너무 깁니다(' + MAX_LEN + '자 이하).');
  if (text[0] !== '=') { if (!NUM_RE.test(text.replace(/^-/, ''))) return err('숫자나 =수식으로 입력해 주세요(예: 1,250 또는 =8*38.5 또는 =E1*C2).'); const n = parseFloat(text.replace(/,/g, '')); if (Math.abs(n) > LIMIT) return err('값이 허용 한도를 넘습니다.'); return { ok: true, value: tidy(n) }; }
  const src = text.slice(1); if (!ALLOWED.test(src)) return err('수식에는 숫자·칸 이름(E1)·함수(SUM 등)와 + - × ÷ ^ ( ) % : 만 쓸 수 있습니다.');
  const s = src.replace(WS, ''); if (s === '') return err('수식이 비어 있습니다.');
  let i = 0, fdepth = 0; const peek = () => s[i]; const isL = (c) => c !== undefined && /[A-Za-z]/.test(c); const isD = (c) => c !== undefined && /[0-9]/.test(c);
  const fail = (m) => { const e = new Error(m); e.formula = true; throw e; };
  const chk = (v) => { if (!Number.isFinite(v) || Math.abs(v) > LIMIT) fail('값이 허용 한도를 넘습니다.'); return v; };
  function number() {
    const allowComma = fdepth === 0; let j = i; while (j < s.length && (/[0-9.]/.test(s[j]) || (allowComma && s[j] === ','))) j++;
    const tok = s.slice(i, j); if (!tok) fail('숫자가 필요합니다.'); if (!(allowComma ? NUM_RE : PLAIN_RE).test(tok)) fail('숫자 형식이 올바르지 않습니다: ' + tok);
    i = j; return chk(parseFloat(tok.replace(/,/g, '')));
  }
  function cellRef() { // 현재 위치가 칸 참조 모양일 때 { col, row, end } — 아니면 null
    if (!isL(s[i]) || isL(s[i + 1])) return null; let k = i + 1; while (isD(s[k])) k++; if (k === i + 1) return null; const digits = s.slice(i + 1, k);
    if (isL(s[k])) return null; return { col: s[i].toUpperCase(), row: parseInt(digits, 10), digits, end: k };
  }
  function check(ref) {
    if (!ctx) fail('칸 참조는 산식 표 안에서만 쓸 수 있습니다.');
    if (ref.digits.length > 2 || ref.row < 1) fail('행 번호가 올바르지 않습니다: ' + ref.col + ref.digits);
    if (!ctx.cols.includes(ref.col)) fail('열 ' + ref.col + ' 은(는) 없습니다(' + ctx.cols[0] + '~' + ctx.cols[ctx.cols.length - 1] + ').');
  }
  function single(ref) {
    check(ref); if (ref.row > ctx.rowCount) fail(ref.row + '번 행이 없습니다.');
    const g = ctx.get(ref.col, ref.row); if (!g.ok) fail(g.error); if (g.text) fail(ref.col + ref.row + ' 은(는) 글자 칸이라 계산에 쓸 수 없습니다.'); return g.value;
  }
  function range(a, b) { // 엑셀처럼 글자 칸은 건너뛰고, 표 끝을 넘는 행은 있는 곳까지만
    check(a); check(b); const c1 = Math.min(ctx.cols.indexOf(a.col), ctx.cols.indexOf(b.col)), c2 = Math.max(ctx.cols.indexOf(a.col), ctx.cols.indexOf(b.col)); const r1 = Math.min(a.row, b.row), r2 = Math.min(Math.max(a.row, b.row), ctx.rowCount); const vals = [];
    for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) { const g = ctx.get(ctx.cols[c], r); if (!g.ok) fail(g.error); if (!g.text) vals.push(g.value); }
    return vals;
  }
  function apply(name, args) {
    const flat = args.flatMap((a) => a.vals); const one = () => { if (args.length !== 1 || args[0].range) fail(name + ' 은(는) 값 하나가 필요합니다.'); return args[0].vals[0]; };
    if (name === 'SUM') return chk(flat.reduce((t, x) => t + x, 0));
    if (name === 'AVERAGE') { if (!flat.length) fail('평균을 낼 값이 없습니다.'); return chk(flat.reduce((t, x) => t + x, 0) / flat.length); }
    if (name === 'MIN' || name === 'MAX') { if (!flat.length) fail(name + ' 을(를) 구할 값이 없습니다.'); return name === 'MIN' ? Math.min(...flat) : Math.max(...flat); }
    if (name === 'ABS') return Math.abs(one());
    if (args.length !== 2 || args.some((a) => a.range)) fail(name + ' 은(는) 값 두 개(값, 자릿수)가 필요합니다.');
    const d = args[1].vals[0]; if (!Number.isInteger(d) || d < -8 || d > 8) fail('자릿수는 -8~8 의 정수여야 합니다.');
    return chk(roundTo(args[0].vals[0], d, name === 'ROUNDUP' ? 'up' : name === 'ROUNDDOWN' ? 'down' : 'round'));
  }
  function call(name, depth) {
    if (depth >= MAX_DEPTH) fail('괄호·함수를 너무 깊게 겹쳤습니다(' + MAX_DEPTH + '단계 이하).');
    fdepth++; const args = [];
    if (peek() === ')') fail(name + ' 에 값이 필요합니다.');
    for (;;) {
      const m = /^[A-Za-z][0-9]{1,2}:[A-Za-z][0-9]{1,2}(?=[,)])/.exec(s.slice(i));
      if (m) { const [x, y] = m[0].split(':'); const ra = { col: x[0].toUpperCase(), row: parseInt(x.slice(1), 10), digits: x.slice(1) }, rb = { col: y[0].toUpperCase(), row: parseInt(y.slice(1), 10), digits: y.slice(1) }; i += m[0].length; args.push({ vals: range(ra, rb), range: true }); }
      else args.push({ vals: [expr(depth + 1)], range: false });
      if (peek() === ',') { i++; continue; } if (peek() === ')') { i++; break; } fail('괄호가 닫히지 않았거나 쉼표 위치가 올바르지 않습니다.');
    }
    fdepth--; return apply(name, args);
  }
  function primary(depth) {
    const c = peek();
    if (c === '(') { if (depth >= MAX_DEPTH) fail('괄호·함수를 너무 깊게 겹쳤습니다(' + MAX_DEPTH + '단계 이하).'); i++; const v = expr(depth + 1); if (peek() !== ')') fail('괄호가 닫히지 않았습니다.'); i++; return v; }
    if (c === '#') { if (s.startsWith('#REF!', i)) fail('삭제된 칸을 가리키는 수식입니다. 수식을 고쳐 주세요.'); fail('수식을 읽을 수 없습니다.'); }
    if (isL(c)) {
      const ref = cellRef(); if (ref) { i = ref.end; return single(ref); }
      let j = i; while (isL(s[j])) j++; const word = s.slice(i, j);
      if (s[j] === '(') { const name = word.toUpperCase(); if (!FUNCS.includes(name)) fail('알 수 없는 함수입니다: ' + word); i = j + 1; return call(name, depth); }
      fail('알 수 없는 이름입니다: ' + word);
    }
    return number();
  }
  function postfix(depth) { let v = primary(depth); while (peek() === '%') { i++; v = v / 100; } return v; }
  function unary(depth) { const c = peek(); if (c === '+') { i++; return unary(depth); } if (c === '-') { i++; return -unary(depth); } return postfix(depth); }
  function power(depth) { let v = unary(depth); while (peek() === '^') { i++; const e = unary(depth); const r = Math.pow(v, e); if (!Number.isFinite(r)) fail('계산할 수 없는 거듭제곱입니다.'); v = chk(r); } return v; }
  function term(depth) {
    let v = power(depth);
    for (;;) {
      const c = peek();
      if (c === '*' || c === '×') { i++; v = v * power(depth); }
      else if (c === '/' || c === '÷') { i++; const d = power(depth); if (d === 0) fail('0 으로 나눌 수 없습니다.'); v = v / d; }
      else return v;
      chk(v);
    }
  }
  function expr(depth) { let v = term(depth); for (;;) { const c = peek(); if (c === '+') { i++; v = v + term(depth); } else if (c === '-') { i++; v = v - term(depth); } else return v; chk(v); } }
  try {
    const v = expr(0);
    if (i < s.length) fail(s[i] === ')' ? '괄호가 맞지 않습니다.' : '수식을 읽을 수 없습니다: ' + s.slice(i, i + 6));
    chk(v); return { ok: true, value: tidy(v) };
  } catch (e) { if (e && e.formula) return err(e.message); return err('수식을 계산할 수 없습니다.'); }
}
