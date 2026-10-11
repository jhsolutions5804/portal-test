import { GTYPES, GKEYS, dday, won, formToDoc, docToForm, newDefaults, leaseMonthly, leaseLast, leasePayState, dueList, homeSummary, SEED } from '../app/modules/general/logic.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const T0 = '2026-10-12';

ok(dday('2026-10-12', T0) === 0 && dday('2026-11-11', T0) === 30 && dday('2026-10-01', T0) === -11 && dday('2026-02-30', T0) === null && dday('', T0) === null && dday('abc', T0) === null && dday('2027-01-01', '2026-12-31') === 1, '총무: 남은 날수(D-day) 계산 — 지난 날은 음수, 없는 날짜·빈 값은 null');
ok(GKEYS.join() === 'lease,vehicle,asset,renewal' && GKEYS.every((k) => GTYPES[k].coll.startsWith('general_') && GTYPES[k].fields.some((f) => f.k === 'name' && f.req) && GTYPES[k].cols.length >= 5 && typeof GTYPES[k].dues === 'function'), '총무: 네 종류 모두 항목 정의(컬렉션 이름 general_, 이름 필수, 목록 열, 만기 규칙)를 갖춤');

const lease = formToDoc('lease', { name: ' 원희캐슬 B111 ', kind: '창고', rent: '200,000', vat: '20000', payDay: '25', start: '2024-08-19', end: '2027-08-18', status: '사용중', note: '메모' }, [{ ym: '2026-09', date: '2026-09-30', amount: '220,000', memo: '' }]);
ok(lease.errors.length === 0 && lease.doc.name === '원희캐슬 B111' && lease.doc.rent === 200000 && lease.doc.vat === 20000 && lease.doc.payDay === 25 && lease.doc.deposit === 0 && lease.doc.payments.length === 1 && lease.doc.payments[0].amount === 220000 && leaseMonthly(lease.doc) === 220000, '★ 총무 입력 검증: 이름 앞뒤 공백 정리, 금액의 쉼표·원 제거, 비운 금액은 0, 이력 줄 변환');
const bad = formToDoc('lease', { name: '', rent: '-5', start: '2026-05-01', end: '2026-04-01', payDay: '40', kind: '모름' }, [{ ym: '2026-13', date: '2026-02-30', amount: 'abc' }]);
ok(bad.doc === null && bad.errors.length >= 7 && bad.errors.some((e) => /이름/.test(e)) && bad.errors.some((e) => /임대료/.test(e)) && bad.errors.some((e) => /만료일이 시작일보다/.test(e)) && bad.errors.some((e) => /납부일/.test(e)) && bad.errors.some((e) => /종류/.test(e)) && bad.errors.some((e) => /귀속 월/.test(e)), '★ 총무 입력 검증: 이름 없음·음수 금액·만료일이 시작일보다 빠름·납부일 범위·종류 값·이력의 잘못된 월·날짜·금액을 모두 걸러냄');
ok(formToDoc('lease', { name: 'a', payDay: '1.5' }, []).errors.some((e) => /납부일/.test(e)) && formToDoc('vehicle', { name: 'x', odo: '12.5' }, []).errors.some((e) => /주행거리/.test(e)) && formToDoc('vehicle', { name: 'x' }, [{ date: '', item: '' }]).errors.length === 2, '총무 입력 검증: 정수 칸의 소수·필수 이력 칸(일자·내용)');
const form = docToForm('lease', lease.doc); ok(form.name === '원희캐슬 B111' && form.rent === '200000' && form.status === '사용중' && newDefaults('lease').kind === '창고' && newDefaults('lease').status === '사용중' && newDefaults('renewal').lead === '30', '총무: 저장된 문서 ↔ 입력 양식 값(새 항목은 기본값)');
ok(formToDoc('renewal', { name: '구독', nextDate: '2026-12-01' }, []).doc.lead === 30 && formToDoc('renewal', { name: '구독', lead: '0' }, []).doc.lead === 0 && formToDoc('asset', { name: '노트북', cost: '1,500,000', status: '폐기' }, []).doc.cost === 1500000, '총무: 기본값(미리 알림 30일)·0 은 0 으로 저장·자산 구입가');

const L1 = { id: 'l1', name: 'B111', status: '사용중', end: '2026-11-20', rent: 200000, vat: 20000, fee: 10000, payments: [{ ym: '2026-08', date: '2026-08-31', amount: 220000 }, { ym: '2026-09', date: '2026-10-01', amount: 220000 }] };
ok(leaseLast(L1).ym === '2026-09' && leasePayState(L1, T0).tone === 'accent' && leasePayState({ status: '사용중', payments: [{ ym: '2026-06' }] }, T0).tone === 'danger' && /누락/.test(leasePayState({ status: '사용중', payments: [{ ym: '2026-06' }] }, T0).text) && leasePayState({ status: '사용중', payments: [] }, T0).tone === 'muted' && leasePayState({ status: '종료', payments: [] }, T0) === null && leasePayState({ status: '사용중', payments: [{ ym: '2026-08' }] }, T0).tone === 'danger' && leasePayState({ status: '사용중', payments: [{ ym: '2026-10' }] }, T0).tone === 'accent', '★ 총무 임대 입금 상태: 마지막 귀속 월이 지난달(한 달 이내)이면 정상, 두 달 이상 뒤처지면 "입금 누락 가능", 기록 없음은 안내, 종료는 표시 없음');

const data = {
  lease: [L1, { id: 'l2', name: '끝난 창고', status: '종료', end: '2026-10-20' }],
  vehicle: [{ id: 'v1', name: '시에라', status: '운행', end: '', insExpire: '2026-10-20', inspect: '2027-03-01', monthly: 1623950 }, { id: 'v2', name: '팔린 차', status: '반납·매각', insExpire: '2026-10-13' }],
  asset: [{ id: 'a1', name: '노트북', status: '사용중', warranty: '2026-10-05', cost: 1500000 }, { id: 'a2', name: '폐기 장비', status: '폐기', warranty: '2026-10-05', cost: 700000 }],
  renewal: [{ id: 'r1', name: 'MS365', status: '사용중', nextDate: '2026-12-31', lead: 30, amount: 199650, cycle: '월' }, { id: 'r2', name: '노란우산', status: '사용중', nextDate: '2026-10-30', lead: 30, amount: 50000, cycle: '월' }, { id: 'r3', name: '해지한 구독', status: '해지', nextDate: '2026-10-14', amount: 9900, cycle: '연' }, { id: 'r4', name: '날짜 없음', status: '사용중', nextDate: '' }]
};
const dl = dueList(data, T0, 90);
ok(dl.map((x) => x.label + ':' + x.what).join('|') === '노트북:보증 만료|시에라:보험 만기|노란우산:갱신·만기|B111:계약 만료|MS365:갱신·만기', '★ 총무 만기 알림: 네 종류의 만기일을 가까운 순(지난 것 먼저)으로 모으고, 종료·해지·폐기·매각 항목과 날짜 없는 항목은 뺌');
ok(dl[0].d === -7 && dl[0].tone === 'danger' && dl[1].d === 8 && dl[1].tone === 'warn' && dl[2].d === 18 && dl[2].tone === 'warn' && dl[3].d === 39 && dl[3].tone === 'warn' && dl[4].d === 80 && dl[4].tone === 'muted', '총무 만기 알림: 지난 것은 danger, 미리 알림 기간(lead) 안은 warn');
ok(dueList(data, T0, 30).length === 3 && dueList(data, T0, 90).some((x) => x.label === 'MS365' && x.d === 80 && x.tone === 'muted') && !dueList(data, T0, 30).some((x) => x.label === 'MS365'), '총무 만기 알림: 보는 기간(horizon) 밖은 제외, 알림 기간 밖이면 muted');
const hs = homeSummary(data);
ok(hs.leaseN === 1 && hs.leaseMonthly === 230000 && hs.vehicleN === 1 && hs.vehicleMonthly === 1623950 && hs.assetN === 1 && hs.assetCost === 1500000 && hs.renewalN === 3 && hs.renewalYear === 199650 * 12 + 50000 * 12, '총무 개요 숫자: 사용 중인 것만 — 임대 월 합계(관리비 포함)·차량 월 납부·자산 구입가·갱신 연 환산');
ok(homeSummary({}).leaseN === 0 && dueList({}, T0).length === 0 && won(1234567) === '1,234,567' && won('') === '0', '총무: 빈 자료에서도 오류 없이 0');

const seedOk = ['lease', 'renewal'].every((k) => SEED[k].every((d) => { const T = GTYPES[k]; const vals = {}; Object.keys(d).forEach((x) => { vals[x] = d[x]; }); const r = formToDoc(k, vals, d[T.log.k] || []); return r.errors.length === 0; }));
ok(seedOk && SEED.lease.length === 2 && SEED.lease[0].payments.length === 19 && SEED.lease[0].payments.some((p) => p.ym === '2025-07' && p.amount === 440000) && SEED.renewal.length === 2, '총무: 엑셀 기준 첫 목록(임대 2건·갱신 2건)이 입력 검증을 모두 통과, B111 입금 이력 19건(2025-07은 두 달분 440,000원)');

console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)');
if (fail) process.exit(1);
