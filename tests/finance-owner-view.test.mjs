// 재무회계 홈 "대표님 개인 지출" 카드 화면 시험 — 가짜 데이터만 쓴다. 계산은 finance-owner.test.mjs 가 고정한다.
import { homeHtml } from '../app/modules/finance/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const idx = (h, s) => h.indexOf(s); const ln = (account, side, amount) => ({ account, side, amount });
const E = (id, date, memo, lines, extra) => Object.assign({ id, no: id.toUpperCase(), date, memo, lines, status: 'posted', source: { kind: 'manual' } }, extra || {});
const ENT = () => [E('a1', '2026-03-03', '개인 식사', [ln('3020', 'D', 100000), ln('2020', 'C', 100000)]), E('a2', '2026-03-20', '개인 용품', [ln('3020', 'D', 50000), ln('1020', 'C', 50000)]), E('a3', '2026-04-05', '입금(되돌림)', [ln('1020', 'D', 30000), ln('3020', 'C', 30000)]), E('a4', '2026-05-01', '개인 지출', [ln('3020', 'D', 200000), ln('2020', 'C', 200000)]), E('a5', '2025-12-15', '작년 인출', [ln('3020', 'D', 70000), ln('1020', 'C', 70000)]), E('a8', '2026-03-10', '회사 일(개인카드)', [ln('5340', 'D', 500000), ln('2021', 'C', 500000)])];
const base = (entries, today) => ({ entries: entries || ENT(), today: today || '2026-05-20', imports: [], settings: { ownBiz: '123', lockedThrough: '' }, sum: { count: 6, from: '2025-12-15', to: '2026-05-01', review: 0, balanced: true, debit: 1 }, stm: { from: '2026-01-01', to: '2026-05-31', is: { sales: 1, costOfSales: 1, grossProfit: 1, sgaTotal: 1, operatingIncome: 1, netIncome: 1 }, bs: { assetsTotal: 1, liabsTotal: 1, equityTotal: 1, diff: 0 } } });
const main = (st) => { const h = homeHtml(st); return h.slice(idx(h, 'jh-fin__homemain'), idx(h, 'jh-fin__homedetail')); };
const m = main(base());
ok(m.includes('대표님 개인 지출') && idx(m, '재무상태') < idx(m, '대표님 개인 지출') && idx(m, '손익 요약') < idx(m, '재무상태'), '★ 본문에 "대표님 개인 지출" 카드가 있고 순서는 손익 요약 → 재무상태 → 대표님 개인 지출이다');
ok(m.includes('320,000') && m.includes('390,000') && m.includes('500,000'), '★ 올해 개인 지출 320,000 · 전체 누계 390,000 · 회사가 대표님께 줄 돈(개인카드) 500,000 이 보인다');
ok(m.includes('2026-03') && m.includes('150,000') && m.includes('2026-04') && m.includes('−30,000') && m.includes('2026-05') && m.includes('200,000'), '★ 월별 표: 2026-03 150,000 · 2026-04 −30,000(되돌림) · 2026-05 200,000');
ok(m.includes('개인 식사') && m.includes('개인 용품') && m.includes('개인 지출') && !m.includes('입금(되돌림)'), '★ 최근 항목은 개인 지출 줄만 보이고 되돌림 입금은 보이지 않는다');
ok(m.includes('비용이 아니라 인출금') && m.includes('손익') && m.includes('프로젝트 마진'), '★ 안내: 개인 지출은 비용이 아니라 인출금이라 손익·프로젝트 마진에 들어가지 않는다');
ok(m.includes('회사가 대표님께 줄 돈') && m.includes('개인카드'), '개인카드 미지급 잔액은 "회사가 대표님께 줄 돈"으로 인출금과 구분해 보여 준다');
{ const none = main(base([E('x', '2026-05-01', '회사 지출', [ln('5340', 'D', 1000), ln('2020', 'C', 1000)])])); ok(none.includes('대표님 개인 지출') && none.includes('아직 개인 지출이 없습니다') && !none.includes('개인 식사'), '★ 개인 지출이 없으면 "아직 개인 지출이 없습니다"가 보인다'); }
{ const ev = main(base([E('e', '2026-05-01', '<img src=x onerror=1>메모', [ln('3020', 'D', 5000), ln('2020', 'C', 5000)])])); ok(!ev.includes('<img src=x') && ev.includes('&lt;img'), '★ 메모의 태그는 이스케이프된다'); }
{ const h = homeHtml(Object.assign(base(), { entries: undefined })); ok(h.includes('jh-fin__home') && !h.includes('undefined') && !h.includes('NaN'), '전표 목록이 없어도(undefined) 던지지 않고 그려진다'); }
ok(m.includes('손익 요약') && m.includes('재무상태') && !m.includes('바로가기') && !m.includes('NaN') && !m.includes('undefined'), '기존 카드(손익 요약·재무상태)는 그대로이고 NaN·undefined 가 없다');
{ const big = main(base(ENT().concat([E('b', '2026-05-02', '큰 금액', [ln('3020', 'D', 1234567890), ln('2020', 'C', 1234567890)])]))); ok(big.includes('1,234,567,890') || big.includes('1,234,887,890'), '큰 금액도 천 단위 쉼표로 보인다'); }
{ const l1 = m.indexOf('2026년 개인 지출'); ok(l1 !== -1 && m.indexOf('전체 누계') > l1 && m.indexOf('회사가 대표님께 줄 돈') > m.indexOf('전체 누계'), '★ 연도 표기(2026년 개인 지출)가 전체 누계보다 먼저, 개인카드 미지급이 마지막이다(해가 바뀌어도 "올해"가 헷갈리지 않게 연도를 같이 보인다)'); }
{ const y = main(base(ENT(), '2027-01-10')); ok(y.includes('2027년 개인 지출') && y.includes('390,000'), '★ 해가 바뀌면 연도 표기가 2027년으로 바뀌고 전체 누계 390,000 은 그대로다'); }
{ const rows = m.match(/<tr>.*?<\/tr>/g) || []; const row = rows.find((r) => r.includes('회사가 대표님께 줄 돈(개인카드 미지급)')); ok(row && row.includes('500,000'), '★ 개인카드 행은 표의 한 줄로 "회사가 대표님께 줄 돈(개인카드 미지급)"과 금액 500,000 이 같은 줄에 있다(안내 문구의 같은 글자와 구별)'); }
{ const rec = m.slice(m.indexOf('최근 항목')); const body = (rec.match(/<tbody>.*?<\/tbody>/) || [''])[0]; const rows = body.match(/<tr>.*?<\/tr>/g) || []; const r1 = rows.find((r) => r.includes('2026-05-01')); const r2 = rows.find((r) => r.includes('2026-03-20')); ok(r1 && r1.includes('200,000') && r2 && r2.includes('50,000') && rows.length === 4, '★ 최근 항목 표에서 날짜별로 금액이 같은 줄에 있다(5월 1일 200,000 · 3월 20일 50,000 · 4줄, 월별 표의 숫자와 겹치지 않게 최근 항목 영역만 확인)'); }
{ const mr = m.slice(m.indexOf('최근 6개월'), m.indexOf('최근 항목')); const body = (mr.match(/<tbody>.*?<\/tbody>/) || [''])[0]; const rows = body.match(/<tr>.*?<\/tr>/g) || []; ok(rows.length === 6 && rows.some((r) => r.includes('2026-04') && r.includes('−30,000')), '★ 월별 표는 6줄이고 2026-04 줄에 −30,000 이 있다(최근 6개월 영역만 확인)'); }
ok(pass + fail >= 16, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
