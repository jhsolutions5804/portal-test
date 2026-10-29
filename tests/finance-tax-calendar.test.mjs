/* 재무회계 세무 달력 — 법정기한 계산 규칙 시험(화면·네트워크 없음) */
import { TAX_RULES, adjustDeadline, taxEventsOfYear, taxEventsForRange, GROUP_ORDER } from '../app/modules/finance/tax-calendar.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const dow = (k) => new Date(k + 'T00:00:00Z').getUTCDay();
const HOL = new Set(['2027-03-01', '2026-08-17']);                      // 시험용 공휴일(삼일절·대체공휴일)
const isOff = (k) => dow(k) === 0 || dow(k) === 6 || HOL.has(k);
const ev26 = taxEventsOfYear(2026, isOff), ev27 = taxEventsOfYear(2027, isOff);
const find = (list, id) => list.find((e) => e.id === id);

ok(find(ev26, 'vat-file:2026-07-25').date === '2026-07-27' && find(ev26, 'vat-file:2026-07-25').shifted === true && find(ev26, 'vat-file:2026-07-25').due === '2026-07-25', '★ 부가세 확정신고 7/25(2026은 토요일) → 다음 근무일 7/27, 원래 기한은 그대로 기록');
ok(find(ev27, 'vat-file:2027-01-25').date === '2027-01-25' && !find(ev27, 'vat-file:2027-01-25').shifted, '근무일이면 그대로(2027-01-25 월요일)');
ok(find(ev26, 'income-tax:2026-05-31').date === '2026-06-01', '★ 종합소득세 5/31(2026은 일요일) → 6/1');
ok(adjustDeadline('2027-02-28', isOff) === '2027-03-02', '★ 일요일 2/28 + 월요일 삼일절 휴일 → 3/2(연속된 쉬는 날을 건너뜀)');
ok(find(ev26, 'vat-invoice:2026-07-11').date === '2026-07-11' && !find(ev26, 'vat-invoice:2026-07-11').shifted, '내부 점검일(세금계산서 수령 점검 7/11, 토요일)은 옮기지 않는다');
ok(find(ev26, 'vat-invoice:2026-07-11').title.indexOf('합계표 자동반영 마감') > 0 && find(ev26, 'vat-invoice:2026-08-11').title.indexOf('합계표') < 0, '세금계산서 점검 제목은 1월·7월에만 "합계표 자동반영 마감"이 붙는다');
ok(ev26.filter((e) => e.ruleId === 'wht').length === 12 && ev26.filter((e) => e.ruleId === 'stmt-monthly').length === 12, '월별 규칙은 한 해에 12건(원천세 매월 10일, 간이지급명세서 매월 말일)');
ok(find(ev27, 'stmt-monthly:2027-02-28').date === '2027-03-02' && find(ev27, 'stmt-monthly:2027-04-30').date === '2027-04-30' && find(ev27, 'stmt-monthly:2027-02-28').due === '2027-02-28', '말일 규칙: 2월 28일, 4월 30일(2월은 쉬는 날이라 3/2로)');
const ids = ev26.map((e) => e.id); ok(new Set(ids).size === ids.length, '같은 해 일정 id 는 겹치지 않는다(3/10 건강보험·지급명세서가 같은 날이어도)');
const mar10 = taxEventsForRange({ from: '2027-03-10', to: '2027-03-10' }, isOff); ok(mar10.length === 3 && mar10[0].group === '원천·지급명세서' && mar10[1].group === '원천·지급명세서' && mar10[2].group === '4대보험', '같은 날(2027-03-10 수요일: 원천세·지급명세서·건강보험)은 그룹 순서(부가세→소득세→원천·지급명세서→4대보험→지방세)로 정렬');
const r = taxEventsForRange({ from: '2026-12-20', to: '2027-02-01' }, isOff); ok(r.every((e) => e.date >= '2026-12-20' && e.date <= '2027-02-01') && r.some((e) => e.id === 'vat-file:2027-01-25') && r.some((e) => e.ruleId === 'duty-check') && find(r, 'stmt-simple:2027-01-31').date === '2027-02-01', '해를 넘는 범위도 정확히 잘라서 돌려준다(기장의무 판정 1/5, 부가세 1/25, 간이지급명세서 1/31이 일요일이라 2/1로 밀려 범위 끝에 포함)');
ok(r.map((e) => e.date).join() === r.map((e) => e.date).slice().sort().join(), '날짜순 정렬');
ok(taxEventsForRange({ from: '2026-01-01', to: '2026-12-31' }, isOff).length === ev26.filter((e) => e.date.startsWith('2026')).length + taxEventsOfYear(2025, isOff).filter((e) => e.date.startsWith('2026')).length, '연말 기한이 다음 해로 밀린 일정(전년 12월 기한)이 범위에 올바르게 들어온다');
ok(TAX_RULES.every((x) => x.id && x.group && GROUP_ORDER.indexOf(x.group) >= 0 && x.at.length > 0 && x.at.every(([m, d]) => m >= 1 && m <= 12 && (d === 'last' || (d >= 1 && d <= 28 || [29, 30, 31].indexOf(d) >= 0)))) && new Set(TAX_RULES.map((x) => x.id)).size === TAX_RULES.length, '규칙 정의 점검: id 중복 없음·그룹 유효·월 1~12');
ok(ev26.filter((e) => e.verify).every((e) => e.memo.indexOf('세무사 확인 전') > 0) && ev26.filter((e) => !e.verify).every((e) => e.memo.indexOf('세무사 확인 전') < 0), '★ 확인이 덜 된 일정(조건부·제도 변경 예정)만 설명에 "세무사 확인 전"을 붙인다');
ok(find(ev26, 'biz-account:2026-06-30').statutory && find(ev26, 'income-tax:2026-06-01'.replace('06-01', '05-31')).statutory && !find(ev26, 'vat-prep:2026-07-18').statutory, '법정기한 표시(statutory)와 내부 점검 구분');
ok(taxEventsOfYear(2026, null).length === ev26.length, 'isOff 가 없어도 오류 없이 계산(옮김 없음)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
