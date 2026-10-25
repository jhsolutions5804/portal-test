/* 월별 4대보험 대조표 — 순수 계산 함수 시험(저장 없음). 급여명세서 근로자 공제 합(회사 월 합계)과 공단 고지금액(근로자+사업주 합)을 월별로 맞춰 사업주 실부담·미납·급증·이상 비율을 찾는다.
 * 개인별 값은 받지도 돌려주지도 않는다(회사 월 합계만). 기대값은 손으로 계산했고, 입력 숫자는 대표님이 올린 고지서 12장과 본섭 급여명세서 2026-05~09 회사 합계다(app-docs/margin-insurance-rates.md). */
import assert from 'node:assert'; import { reconcile } from '../app/modules/hr/insurance-recon.js'; const R = { reconcile };
let pass = 0, failN = 0; const t = (name, fn) => { try { fn(); pass++; console.log('OK   ' + name); } catch (e) { failN++; console.log('FAIL ' + name + ' → ' + e.message); } };
const P = () => ({
  '2026-05': { count: 3, gross: 9411270, pension: 345800, health: 303760, ltcare: 39900, employ: 84690 },
  '2026-06': { count: 5, gross: 13238476, pension: 345800, health: 303760, ltcare: 39900, employ: 115940 },
  '2026-07': { count: 5, gross: 15091091, pension: 646610, health: 490700, ltcare: 64460, employ: 135790 },
  '2026-08': { count: 5, gross: 14792118, pension: 646610, health: 490700, ltcare: 64460, employ: 133110 },
  '2026-09': { count: 6, gross: 13536687, pension: 646615, health: 402354, ltcare: 52851, employ: 121811 },
});
const B = () => ({
  '2026-05': { pension: 729400, health: 571700, ltcare: 75100, unpaid: 0 },
  '2026-06': { pension: 729400, health: 838760, ltcare: 110180, unpaid: 0 },
  '2026-07': { pension: 838060, health: 838760, ltcare: 110180, unpaid: 0 },
  '2026-08': { pension: 1826060, health: 1586520, ltcare: 208420, unpaid: 3621000 },
  '2026-09': { pension: 1332060, health: 1222400, ltcare: 160580, unpaid: 2715040 },
});
const run = (o) => R.reconcile(Object.assign({ payslips: P(), bills: B() }, o || {}));
const row = (r, m) => r.rows.find((x) => x.month === m);
const has = (r, m, f) => row(r, m).flags.includes(f);

console.log('── 한 달 대조(2026-07)');
t('★ 연금: 고지 838,060 · 근로자 공제 646,610 → 사업주 실부담(고지−공제) 191,450 · 동률 기준 419,030 · 차이 +227,580 · 공제/고지 0.7716', () => { const p = row(run(), '2026-07').pension; assert.deepStrictEqual([p.bill, p.employee, p.employerByBill, p.employerParity, p.gap, p.ratio], [838060, 646610, 191450, 419030, 227580, 0.7716]); });
t('★ 건강: 고지 838,760 · 공제 490,700 → 실부담 348,060 · 동률 419,380 · 차이 +71,320 · 비율 0.585', () => { const h = row(run(), '2026-07').health; assert.deepStrictEqual([h.bill, h.employee, h.employerByBill, h.employerParity, h.gap, h.ratio], [838760, 490700, 348060, 419380, 71320, 0.585]); });
t('★ 장기요양: 고지 110,180 · 공제 64,460 → 동률 55,090 · 차이 +9,370', () => { const l = row(run(), '2026-07').ltcare; assert.deepStrictEqual([l.bill, l.employee, l.employerParity, l.gap], [110180, 64460, 55090, 9370]); });
t('★ 고용(근로자 0.9%): 총지급 15,091,091 × 0.9% = 135,820 기대 · 실제 공제 135,790 → 차이 −30', () => { const e = row(run(), '2026-07').employ; assert.deepStrictEqual([e.employee, e.expected, e.diff], [135790, 135820, -30]); });
t('★ 연금 공제/고지 비율이 0.5 에서 0.1 넘게 벗어나면 pensionRatioOff(7월 0.7716 → 표시), 건강 0.585 는 허용 범위라 표시 없음', () => { const r = run(); assert(has(r, '2026-07', 'pensionRatioOff')); assert(!has(r, '2026-07', 'healthRatioOff')); });
t('★ 5월은 연금 공제 345,800 ÷ 고지 729,400 = 0.4741 로 정상(표시 없음) · 동률 기준 364,700 · 차이 −18,900', () => { const r = run(); const p = row(r, '2026-05').pension; assert.deepStrictEqual([p.ratio, p.employerParity, p.gap], [0.4741, 364700, -18900]); assert(!has(r, '2026-05', 'pensionRatioOff')); });

console.log('── 이상 탐지');
t('★ 급증: 8월 연금 고지 1,826,060 은 7월 838,060 의 2.18배 → jump(9월 1,332,060 은 8월보다 줄어 표시 없음, 5·6월은 비교 대상 없음/동일)', () => { const r = run(); assert(has(r, '2026-08', 'jump')); assert(!has(r, '2026-09', 'jump')); assert(!has(r, '2026-06', 'jump')); assert(!has(r, '2026-07', 'jump') || false); });
t('★ 7월 고지는 6월 대비 연금 1.15배(838,060 ÷ 729,400)라 급증이 아니다', () => { assert(!has(run(), '2026-07', 'jump')); });
t('★ 미납: 고지에 미납액이 있으면 unpaid(8월·9월), 0 이면 없음', () => { const r = run(); assert(has(r, '2026-08', 'unpaid') && has(r, '2026-09', 'unpaid')); assert(!has(r, '2026-07', 'unpaid')); assert.strictEqual(row(r, '2026-08').unpaid, 3621000); });
t('★ 명세서는 있는데 고지가 없으면 noBill, 고지는 있는데 명세서가 없으면 noPayslip', () => { const p = P(); const b = B(); delete b['2026-09']; b['2026-04'] = { pension: 178400, health: 1188100, ltcare: 155140 }; const r = R.reconcile({ payslips: p, bills: b }); assert(has(r, '2026-09', 'noBill')); assert(has(r, '2026-04', 'noPayslip')); assert.strictEqual(row(r, '2026-04').payslip, null); assert.strictEqual(row(r, '2026-09').bill, null); });
t('★ 고용 공제가 총지급×0.9% 에서 5% 넘게 벗어나면 employOff, 정상 범위(7월 −30원)면 없음', () => { const p = P(); p['2026-06'].employ = 60000; const r = R.reconcile({ payslips: p, bills: B() }); assert(has(r, '2026-06', 'employOff')); assert(!has(r, '2026-07', 'employOff')); });
t('급증 기준·허용 비율은 옵션으로 바꿀 수 있다(jumpFactor 3 이면 8월도 표시 없음, ratioTol 0.3 이면 7월 연금 표시 없음)', () => { const r = run({ jumpFactor: 3, ratioTol: 0.3 }); assert(!has(r, '2026-08', 'jump')); assert(!has(r, '2026-07', 'pensionRatioOff')); });

t('★ 동률 절반은 반올림이다(내림 아님) — 고지 101 → 동률 51 · 고지 100 → 50', () => { const r = R.reconcile({ payslips: { '2026-07': { gross: 1000, pension: 51, health: 50, ltcare: 0 } }, bills: { '2026-07': { pension: 101, health: 100, ltcare: 0 } } }); const x = row(r, '2026-07'); assert.strictEqual(x.pension.employerParity, 51); assert.strictEqual(x.health.employerParity, 50); assert.strictEqual(x.pension.gap, 0); });
t('★ 건강+장기요양만 급증해도(연금은 그대로) jump 표시 — 7월 건강 838,760+110,180 → 8월 건강 2,000,000+300,000', () => { const b = B(); b['2026-08'] = { pension: 838060, health: 2000000, ltcare: 300000, unpaid: 0 }; const r = R.reconcile({ payslips: P(), bills: b }); assert(has(r, '2026-08', 'jump')); const b2 = B(); b2['2026-08'] = { pension: 838060, health: 900000, ltcare: 120000, unpaid: 0 }; assert(!has(R.reconcile({ payslips: P(), bills: b2 }), '2026-08', 'jump')); });
t('★ 건강만 보면 1.7배(급증 아님)인데 장기요양이 커져 건강+장기요양 합이 1.97배면 jump — 합산 기준임을 고정(건강 838,760→1,425,892 · 장기요양 110,180→440,720)', () => { const b = B(); b['2026-08'] = { pension: 838060, health: 1425892, ltcare: 440720, unpaid: 0 }; assert(has(R.reconcile({ payslips: P(), bills: b }), '2026-08', 'jump')); });
t('★ 급증 비교는 직전에 고지가 있던 달과 한다(중간에 고지가 빈 달이 있어도) — 5월 729,400 → 7월 1,400,000(빈 6월 건너뜀)은 1.92배라 급증', () => { const b = B(); delete b['2026-06']; b['2026-07'] = { pension: 1400000, health: 571700, ltcare: 75100, unpaid: 0 }; assert(has(R.reconcile({ payslips: P(), bills: b }), '2026-07', 'jump')); });
console.log('── 월 맞춤(고지월 = 급여월 + offset)');
t('★ offset 1 이면 급여 2026-05 는 고지 2026-06 과 맞춘다(연금 고지 729,400 → 같은 값이지만 건강 838,760)', () => { const r = run({ offset: 1 }); assert.strictEqual(row(r, '2026-05').billMonth, '2026-06'); assert.strictEqual(row(r, '2026-05').health.bill, 838760); });
t('★ offset 1 이면 고지 2026-05 는 급여 2026-04 와 짝이라 noPayslip 행이 2026-04 로 생기고, 급여 2026-09 는 고지 2026-10 이 없어 noBill', () => { const r = run({ offset: 1 }); assert(has(r, '2026-04', 'noPayslip')); assert.strictEqual(row(r, '2026-04').billMonth, '2026-05'); assert(has(r, '2026-09', 'noBill')); });
t('offset 이 정수가 아니면(글자·소수) 0 으로 본다', () => { for (const bad of ['1', 1.5, null, NaN]) assert.strictEqual(row(run({ offset: bad }), '2026-05').billMonth, '2026-05'); });
t('연도 경계: 급여 2026-12 + offset 1 → 고지 2027-01, 급여 2027-01 − offset 1 → 2026-12', () => { const r = R.reconcile({ payslips: { '2026-12': { gross: 1000, pension: 40 } }, bills: { '2027-01': { pension: 100, health: 0, ltcare: 0 } }, offset: 1 }); assert.strictEqual(row(r, '2026-12').billMonth, '2027-01'); assert.deepStrictEqual(row(r, '2026-12').pension.bill, 100); });

console.log('── 합계·추정률(5개월)');
t('★ 비교된 5개월 합: 총지급 66,069,642 · 근로자 공제(연금+건강+장기요양) 4,884,280 · 고지(근로자+사업주) 11,177,580 · 사업주 실부담(고지−공제) 6,293,300', () => { const T = run().totals; assert.deepStrictEqual([T.monthsCompared, T.gross, T.employee, T.bill, T.employerByBill], [5, 66069642, 4884280, 11177580, 6293300]); });
t('★ 총지급 대비: 공제 동률 환산 7.39% · 고지 절반 기준 8.46% (마진율 사업주 추정률의 근거 — 고용·산재는 별도)', () => { const T = run().totals; assert.strictEqual(T.employeeShareOfGross, 0.0739); assert.strictEqual(T.billHalfShareOfGross, 0.0846); });
t('미납 합계는 고지가 있는 모든 달의 미납액을 더한다(8월 3,621,000 + 9월 2,715,040)', () => { assert.strictEqual(run().totals.unpaid, 6336040); });
t('한쪽만 있는 달은 합계 비교에서 빠진다(명세서만 있는 달·고지만 있는 달)', () => { const b = B(); delete b['2026-09']; const T = R.reconcile({ payslips: P(), bills: b }).totals; assert.strictEqual(T.monthsCompared, 4); assert.strictEqual(T.gross, 66069642 - 13536687); });

console.log('── 입력 방어');
t('★ 입력이 이상해도(null·undefined·문자열·배열·빈 객체) 던지지 않고 빈 결과를 돌려준다', () => { for (const bad of [null, undefined, 'x', 3, [], {}]) { let r; try { r = R.reconcile(bad); } catch (e) { r = { threw: e.message }; } assert(!r.threw && Array.isArray(r.rows) && r.rows.length === 0 && r.totals.monthsCompared === 0, JSON.stringify(bad)); } });
t('★ 월 형식이 깨진 키(abc·2026-7·2026-13·빈 값)는 무시한다', () => { const p = P(); p['abc'] = { gross: 1 }; p['2026-7'] = { gross: 1 }; p['2026-13'] = { gross: 1 }; p[''] = { gross: 1 }; const r = R.reconcile({ payslips: p, bills: B() }); assert.deepStrictEqual(r.rows.map((x) => x.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09']); });
t('★ 이상한 금액(NaN·음수·글자·null)은 0 으로 보고 소수는 반올림한다', () => { const r = R.reconcile({ payslips: { '2026-07': { gross: 1000.4, pension: -5, health: 'x', ltcare: null, employ: NaN } }, bills: { '2026-07': { pension: 100.6, health: NaN, ltcare: -1 } } }); const x = row(r, '2026-07'); assert.strictEqual(x.payslip.gross, 1000); assert.strictEqual(x.pension.employee, 0); assert.strictEqual(x.pension.bill, 101); assert.strictEqual(x.health.bill, 0); });
t('★ 고지가 0 이면 공제/고지 비율은 null(0으로 나누지 않음)이고 비율 표시는 없다', () => { const r = R.reconcile({ payslips: { '2026-07': { gross: 1000, pension: 40 } }, bills: { '2026-07': { pension: 0, health: 0, ltcare: 0 } } }); assert.strictEqual(row(r, '2026-07').pension.ratio, null); assert(!has(r, '2026-07', 'pensionRatioOff')); });
t('입력 객체를 바꾸지 않는다(순수 함수) · 같은 입력은 같은 결과(멱등)', () => { const i = { payslips: P(), bills: B() }; const s = JSON.stringify(i); const a = R.reconcile(i); assert.strictEqual(JSON.stringify(i), s); assert.deepStrictEqual(a, R.reconcile({ payslips: P(), bills: B() })); });
t('행은 급여월 오름차순이다', () => { const p = P(); const o = {}; Object.keys(p).reverse().forEach((k) => { o[k] = p[k]; }); assert.deepStrictEqual(R.reconcile({ payslips: o, bills: B() }).rows.map((x) => x.month), Object.keys(P()).sort()); });
t('결과에 개인 정보가 없다 — 회사 월 합계만(작업자·이름·주민번호 필드 없음)', () => { const s = JSON.stringify(run()); assert(!/worker|작업자|name|이름|resident|주민/i.test(s)); });
assert(pass + failN >= 31, '시험이 끝까지 실행되지 않음(' + (pass + failN) + '건)');
console.log('\n' + (failN ? '실패 ' + failN + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); if (failN) process.exit(1);
