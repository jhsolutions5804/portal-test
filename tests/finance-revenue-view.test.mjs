import { revenueTripleHtml } from '../app/modules/finance/view.js';
import { arByMonth, taxSalesSupplyByMonth, revenueTriple } from '../app/modules/finance/logic.js';
/* 월별 매출 세 숫자 카드(대표님 2026-10-21 "제이에이치 전체 매출 정보가 있어야 하고, 솔루션→이엔지 계산서도 취합해야 세무 계획을 짤 수 있다") — 화면 규칙 시험.
 * 공개 저장소이므로 가짜 금액만 쓴다. 청구서(이엔지→발주처)·세금계산서(솔루션→이엔지)·통장 입금(이엔지→솔루션)은 서로 다른 서류라 같지 않은 것이 정상이며 짝짓지 않는다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const gE = (id, d, k, lines) => ({ id, date: d, memo: id, source: { kind: k }, lines: lines.map(([a, s, m]) => ({ account: a, side: s, amount: m })) });
const E3 = () => [gE('s1', '2026-07-10', 'taxinv_sales', [['1100', 'D', 1100], ['4010', 'C', 1000], ['2040', 'C', 100]]), gE('s2', '2026-07-25', 'taxinv_sales', [['1100', 'D', 550], ['4010', 'C', 500], ['2040', 'C', 50]]), gE('s3', '2026-08-05', 'taxinv_sales', [['1100', 'D', 220], ['4010', 'C', 200]]), gE('b1', '2026-07-30', 'bank', [['1020', 'D', 900], ['1100', 'C', 900]])];
const IM = () => ({ ok: true, months: [{ month: '2026-07', supply: 1700, done: 1300, open: 400, count: 3 }, { month: '2026-08', supply: 50, done: 0, open: 50, count: 1 }], total: { supply: 1750, done: 1300, open: 450, count: 4 } });
const TR = (im) => revenueTriple(arByMonth(E3()), taxSalesSupplyByMonth(E3()), im === undefined ? IM() : im);
const H = (state, im, error) => revenueTripleHtml({ state, error: error || '' }, TR(im));
const BAN = /직접비|간접비|자체 인력 인건비|실투입비|직접원가/;
console.log('── 성공: 월별 표와 연 합계');
{ const h = H('ok'); ok(h.includes('2026-07') && h.includes('2026-08') && h.indexOf('2026-08') < h.indexOf('2026-07'), '★ 월별 표가 보이고 최근 달(8월)이 7월보다 위다');
  ok(h.includes('1,700') && h.includes('완결 1,300') && h.includes('미완결 400'), '★ 7월 청구서 공급가 1,700 과 "완결 1,300 · 미완결 400" 이 보인다');
  ok(h.includes('1,500') && h.includes('1,650') && h.includes('900'), '★ 7월 세금계산서 공급가 1,500·합계(부가세 포함) 1,650·통장 입금 900 이 보인다');
  ok(h.includes('2026') && h.includes('1,750') && h.includes('1,700') && h.includes('1,870'), '★ 연 합계(2026): 청구서 1,750·세금계산서 공급가 1,700·합계 1,870 이 보인다');
  { const yi = h.indexOf('2026 합계'); ok(yi > 0 && h.slice(yi).includes('완결 1,300 · 미완결 450'), '★ 연 합계 줄에도 "완결 1,300 · 미완결 450"이 보인다(월 칸의 "완결 1,300 · 미완결 400"과 따로)'); }
  ok(/청구서/.test(h) && /세금계산서/.test(h) && /통장 입금/.test(h) && /공급가/.test(h) && /부가세 포함/.test(h), '칸 이름에 청구서·세금계산서·통장 입금과 공급가·부가세 포함 구분이 있다');
  ok(h.includes('세 숫자는 서로 다른 서류입니다') && h.includes('짝짓지 않습니다') && h.includes('이엔지') && h.includes('발주처') && h.includes('솔루션'), '★ "세 숫자는 서로 다른 서류입니다 … 짝짓지 않습니다" 안내가 이엔지→발주처·솔루션→이엔지·이엔지→솔루션을 구분해 항상 보인다'); }
console.log('── 미완결 강조(이 표의 핵심 쓸모: 완결을 안 눌러 프로젝트 매출에서 빠진 금액)');
{ const h = H('ok'); ok(h.includes('미완결 450') && h.includes('아직 프로젝트 매출에 포함되지 않았습니다') && /data-tone="warn"/.test(h), '★ 미완결 합계 450 과 "아직 프로젝트 매출에 포함되지 않았습니다"가 경고 톤으로 보인다');
  const all = H('ok', { ok: true, months: [{ month: '2026-07', supply: 1700, done: 1700, open: 0, count: 3 }], total: { supply: 1700, done: 1700, open: 0, count: 3 } }); ok(!all.includes('아직 프로젝트 매출에 포함되지 않았습니다') && !/data-tone="warn"/.test(all) && all.includes('완결 1,700 · 미완결 0'), '★ 미완결이 하나도 없으면 경고 문구도 경고 톤(data-tone=warn)도 없고 월 칸에는 "완결 1,700 · 미완결 0"이 그대로 보인다'); }
console.log('── 불러오는 중·실패·권한 없음: 청구서 칸만 영향, 세금계산서·입금은 그대로');
{ const h = H('loading', null); ok(h.includes('청구서 매출을 불러오는 중') && h.includes('1,500') && h.includes('1,650') && h.includes('900') && !/data-inv-reload/.test(h), '★ 불러오는 중이면 청구서 칸에 안내가 보이고 세금계산서 1,500·1,650·통장 입금 900 은 바로 보이며 다시 불러오기 버튼은 없다');
  const e = H('error', null, '서버가 응답하지 않습니다'); ok(e.includes('서버가 응답하지 않습니다') && /data-inv-reload/.test(e) && e.includes('다시 불러오기') && e.includes('1,500') && e.includes('900'), '★ 실패하면 오류 문구와 [다시 불러오기]가 보이고 세금계산서·통장 입금은 그대로 보인다');
  const d = H('denied', null); ok(d.includes('청구서 매출은 재무회계 권한이 있는 계정만 볼 수 있습니다') && !/data-inv-reload/.test(d) && d.includes('1,500'), '★ 권한이 없으면 권한 안내가 보이고(다시 불러오기는 없음) 세금계산서·통장 입금은 보인다');
  const i = H('idle', null); ok(i.includes('1,500') && i.includes('900') && !i.includes('NaN') && !i.includes('undefined') && !i.includes('null'), '아직 안 불렀으면(idle) 청구서 칸은 비어 있고 NaN·undefined·null 이 보이지 않는다');
  const bad = H('ok', { ok: false }); ok(bad.includes('청구서 매출을 불러오지 못했습니다') && /data-inv-reload/.test(bad) && bad.includes('1,500'), '★ 성공이라는데 응답이 이상하면(ok 거짓) 성공으로 보지 않고 오류와 다시 불러오기를 보인다 — 비어 있는 숫자를 0원으로 보이지 않게'); }
console.log('── 값이 없을 때·안전');
{ ok(!H('ok').includes('NaN') && !H('ok').includes('undefined') && !H('ok').includes('>null<'), '성공 화면에 NaN·undefined·null 이 없다');
  const empty = revenueTripleHtml({ state: 'ok', error: '' }, revenueTriple([], {}, { ok: true, months: [], total: { supply: 0, done: 0, open: 0, count: 0 } })); ok(empty.includes('아직 표시할 매출이 없습니다') && !empty.includes('NaN'), '매출이 하나도 없으면 "아직 표시할 매출이 없습니다"가 보인다');
  for (const bad2 of [null, undefined, {}, 'x', 3]) { let h = '', threw = false; try { h = revenueTripleHtml({ state: 'ok' }, bad2); } catch (e) { threw = true; } ok(!threw && typeof h === 'string' && !h.includes('NaN') && !h.includes('undefined'), '이상한 입력(' + JSON.stringify(bad2) + ')에도 던지지 않는다'); }
  ok(!BAN.test(H('ok') + H('loading', null) + H('error', null, '오류') + H('denied', null)), '화면에 옛 용어(직접비·간접비·실투입비 등)가 없다');
  ok(!H('ok').includes('<script') && revenueTripleHtml({ state: 'error', error: '<img src=x onerror=1>' }, TR(null)).indexOf('<img') === -1, '오류 문구의 태그는 그대로 실리지 않는다(이스케이프)'); }
ok(pass + fail >= 23, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
