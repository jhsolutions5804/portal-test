// 운행일지의 주유·정비·수리·기타 비용 기록(2026-11-04 핫픽스) 시험.
// 같은 운행일지 문서(edoc_drive)에 rec 필드(fuel·repair)로 구분해 담는다. 서버·보안 규칙은 바뀌지 않는다.
// 지켜야 할 것: ①연비는 가득 주유 기록끼리(부분 주유 포함) 계산 ②금액 입력 실수(단가 이상)를 막음 ③주유·정비가 운행기록부(주행거리·업무사용비율)에 섞이지 않음 ④기존 운행 입력 화면은 그대로.
import * as K from '../app/shared/car-cost.js';
import { fieldsFor, fieldRows, defaultValues, validate, buildDocData, buildTitle, valuesFromDoc, setRec, emptyItem } from '../app/modules/edoc/compose.js';
import { composeHtml } from '../app/modules/edoc/compose-view.js';
import { summaryOf } from '../app/modules/edoc/logic.js';
import { FORMS } from '../app/modules/edoc/forms.js';
import { driveRows, driveTotals } from '../app/modules/general/logic.js';
import { carCostHtml, carSelect, driveHtml } from '../app/modules/general/view.js';

let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const me = { uid: 'u1', name: '한가나', rank: '사원', dept: '시공팀', email: 'han@jhsol.kr' };
const vehicles = [{ id: 'v1', name: '현대 스타리아', plate: '716호1313' }, { id: 'v2', name: 'GMC 시에라', plate: '12가 3456' }];
const NOW = new Date('2026-11-04T09:00:00');

/* ───────── 1) 기록 종류·항목 목록 ───────── */
ok(K.recKey('fuel') === 'fuel' && K.recKey('repair') === 'repair' && K.recKey('trip') === 'trip' && K.recKey(undefined) === 'trip' && K.recKey('이상한값') === 'trip', '기록 종류: fuel·repair 가 아니면 모두 운행(trip) — 옛 운행일지(rec 없음)는 그대로 운행');
ok(K.isTrip({}) && K.isTrip({ rec: 'trip' }) && !K.isTrip({ rec: 'fuel' }) && K.isCar({ rec: 'repair' }) && !K.isCar({ date: '2026-10-01' }), '운행 여부: rec 없는 옛 문서도 운행, 주유·정비는 운행이 아님');
ok(K.SERVICE_ITEMS.length === 28 && K.OTHER_ITEMS.length === 18 && K.CAR_ITEM_OPTIONS.length === 46, '항목 목록: 정비·수리 28개 + 기타 비용 18개');
ok(K.SERVICE_ITEMS.some((x) => x[0] === '엔진오일 및 오일필터' && x[1] === '12개월 · 15,000km 마다') && K.OTHER_ITEMS.some((x) => x[0] === '자동차 보험' && x[1] === '12개월 마다') && K.OTHER_ITEMS.some((x) => x[0] === '하이패스'), '항목 목록: 교체 주기 안내가 함께 있다(엔진오일 12개월·15,000km, 자동차 보험 12개월)');
ok(K.itemGroup('타이어') === '정비' && K.itemGroup('주차요금') === '기타' && K.itemGroup('내가 적은 항목') === '직접 입력' && K.itemGroup('') === '', '항목 구분: 정비·기타·직접 입력');
ok(new Set(K.CAR_ITEM_OPTIONS.map((x) => x.name)).size === K.CAR_ITEM_OPTIONS.length, '항목 이름이 겹치지 않는다(자동 완성 목록)');

/* ───────── 2) 입력 검증(금액 점검) ───────── */
const fuelGood = () => ({ rec: 'fuel', date: '2026-11-03', vehicleId: 'v1', station: '동일석유 고덕주유소', fuelType: '고급 휘발유', odo: '27203', full: '가득 주유', amount: '150,000', liters: '64.66', washFee: '' });
const chk = (v, draft) => K.carChecks(v, {}, '2026-11-04', draft);
ok(Object.keys(chk(fuelGood())).length === 0, '주유 검증: 올바른 입력(150,000원·64.66L → 리터당 2,320원)은 통과');
ok(/리터당 단가가 232원/.test(chk(Object.assign(fuelGood(), { amount: '15000' })).amount || ''), '★ 금액 점검: 0 하나 빠진 입력(15,000원·64.66L → 232원/L)은 단가 문구와 함께 거부');
ok(/리터당 단가가 23,198원/.test(chk(Object.assign(fuelGood(), { amount: '1500000' })).amount || ''), '★ 금액 점검: 0 하나 더 붙은 입력(1,500,000원)도 거부');
ok(!chk(Object.assign(fuelGood(), { amount: '65000', liters: '65' })).amount && !chk(Object.assign(fuelGood(), { amount: '500', liters: '1' })).amount && !!chk(Object.assign(fuelGood(), { amount: '400', liters: '1' })).amount && !!chk(Object.assign(fuelGood(), { amount: '5100', liters: '1' })).amount && !chk(Object.assign(fuelGood(), { amount: '5000', liters: '1' })).amount, '금액 점검: 1,000원/L 는 통과, 경계(500·5,000원/L)는 허용, 그 밖(400·5,100원/L)은 거부');
ok(/300L/.test(chk(Object.assign(fuelGood(), { liters: '350', amount: '700000' })).liters || ''), '주유량이 300L 를 넘으면 거부');
ok(Object.keys(chk(Object.assign(fuelGood(), { fuelType: '전기(충전)', amount: '9000', liters: '40' }))).length === 0, '전기(충전)는 L 단위가 아니라 단가·주유량 점검에서 제외');
ok(/뒤/.test(chk(Object.assign(fuelGood(), { date: '2026-11-05' })).date || ''), '오늘보다 뒤 날짜는 거부');
const eNeg = chk(Object.assign(fuelGood(), { washFee: '-100' })); ok(!!eNeg.washFee, '세차비가 음수면 거부');
const repGood = () => ({ rec: 'repair', date: '2026-11-04', vehicleId: 'v1', shopKind: '정비소', place: '애니카랜드 이충점', odo: '27206', items: [{ name: '엔진오일 및 오일필터', amount: '85,000', memo: '합성유' }, { name: '하이패스', amount: '12000', memo: '' }] });
ok(Object.keys(chk(repGood())).length === 0, '정비 검증: 올바른 입력은 통과(정비 당시 누적주행거리는 선택)');
ok(/한 줄 이상/.test(chk(Object.assign(repGood(), { items: [] })).items || '') && /한 줄 이상/.test(chk(Object.assign(repGood(), { items: [{ name: '', amount: '', memo: '' }] })).items || ''), '정비 검증: 항목이 하나도 없으면 거부(빈 줄만 있어도)');
const eItem = chk(Object.assign(repGood(), { items: [{ name: '', amount: '5000', memo: '' }, { name: '타이어', amount: '', memo: '' }] })); ok(!!eItem['items.0.name'] && !!eItem['items.1.amount'], '정비 검증: 항목 이름·금액이 비면 그 줄에 오류');
ok(Object.keys(chk(Object.assign(repGood(), { items: [] }), true)).length === 0, '임시저장(draft)은 비어 있는 필수 칸을 봐준다');
ok(Object.keys(K.carChecks({ rec: 'trip' }, {}, '2026-11-04')).length === 0, '운행(trip)은 이 검사가 건드리지 않는다');

/* ───────── 3) 자동 계산 문구 ───────── */
ok(K.carCalcText('fuelSum', fuelGood()) === '리터당 2,320원 · 지출 합계 150,000원', '자동 계산: 리터당 단가 = 금액 ÷ 주유량, 지출 합계');
ok(K.carCalcText('fuelSum', Object.assign(fuelGood(), { washFee: '10000' })).endsWith('지출 합계 160,000원'), '자동 계산: 세차비가 지출 합계에 더해진다');
ok(/넣으면/.test(K.carCalcText('fuelSum', {})) && /항목을 추가/.test(K.carCalcText('repairSum', {})), '자동 계산: 비어 있으면 안내 문구');
ok(K.carCalcText('repairSum', repGood()) === '합계 97,000원 (2개 항목)', '자동 계산: 정비 항목 금액 합계');

/* ───────── 4) 연비 — 가득 주유 기준 ───────── */
const F = (id, date, odo, amount, liters, full, extra) => Object.assign({ id, rec: 'fuel', date, vehicleId: 'v1', vehicleName: '현대 스타리아', status: 'approved', odo, amount, liters, full, washFee: 0, authorName: '김', createdMs: 0, fuelType: '휘발유' }, extra || {});
const docsA = [F('a1', '2026-10-01', 10000, 100000, 45, true), F('a2', '2026-10-10', 10400, 90000, 40, true), F('a3', '2026-10-20', 10700, 50000, 22, false), F('a4', '2026-10-28', 11000, 120000, 50, true)];
const rowsA = K.withEconomy(K.fuelRows(docsA)); const byId = (rs, id) => rs.find((r) => r.id === id);
ok(byId(rowsA, 'a1').economy === null && byId(rowsA, 'a1').segKm === null, '★ 연비: 처음 가득 주유는 기준이라 연비가 없다');
ok(byId(rowsA, 'a2').segKm === 400 && byId(rowsA, 'a2').segLiters === 40 && byId(rowsA, 'a2').economy === 10, '★ 연비: 가득→가득 400km ÷ 40L = 10 km/L');
ok(byId(rowsA, 'a3').economy === null, '연비: 부분 주유 줄에는 연비를 매기지 않는다');
ok(byId(rowsA, 'a4').segKm === 600 && byId(rowsA, 'a4').segLiters === 72 && byId(rowsA, 'a4').economy === 8.33, '★ 연비: 사이의 부분 주유(22L)를 합쳐 600km ÷ (22+50)L = 8.33 km/L');
const av = K.avgEconomy(rowsA); ok(av && av.km === 1000 && av.liters === 112 && av.kmPerL === 8.93 && av.n === 2, '평균 연비: 구간 거리 합 ÷ 구간 연료 합 = 1000 ÷ 112 = 8.93');
ok(K.avgEconomy(K.withEconomy(K.fuelRows([F('x', '2026-10-01', 100, 1000, 1, true)]))) === null, '평균 연비: 가득 주유 1건뿐이면 없음');
const mix = K.withEconomy(K.fuelRows(docsA.concat([F('b1', '2026-10-05', 50000, 80000, 35, true, { vehicleId: 'v2', vehicleName: 'GMC 시에라' }), F('b2', '2026-10-15', 50300, 70000, 30, true, { vehicleId: 'v2', vehicleName: 'GMC 시에라' })])));
ok(byId(mix, 'b2').economy === 10 && byId(mix, 'a4').economy === 8.33, '연비: 차량마다 따로 계산(다른 차량의 주유가 끼지 않는다)');
const unsorted = K.withEconomy(K.fuelRows([docsA[3], docsA[0], docsA[2], docsA[1]])); ok(byId(unsorted, 'a4').economy === 8.33, '연비: 입력 순서와 상관없이 날짜순으로 계산');
const back = K.withEconomy(K.fuelRows([F('c1', '2026-10-01', 20000, 100000, 45, true), F('c2', '2026-10-10', 19000, 90000, 40, true)]));
ok(byId(back, 'c2').flags.includes('odoBack') && byId(back, 'c2').economy === null, '★ 점검: 계기판이 이전 주유보다 작으면 표시하고 연비는 계산하지 않는다');
const odd = K.withEconomy(K.fuelRows([F('d1', '2026-10-01', 1000, 70000, 30, true), F('d2', '2026-10-02', 1100, 230000, 100, true)])); ok(byId(odd, 'd2').flags.includes('econOut') && byId(odd, 'd2').economy === 1, '점검: 연비가 3 km/L 밑이면 표시(1 km/L)');
const cheap = K.withEconomy(K.fuelRows([F('e1', '2026-10-01', 1000, 22500, 45, true)])); ok(cheap[0].flags.includes('priceOut') && cheap[0].unitPrice === 500, '점검: 리터당 단가가 1,000~3,000원 밖이면 표시');
const ev = K.withEconomy(K.fuelRows([F('g1', '2026-10-01', 1000, 9000, 40, true, { fuelType: '전기(충전)' }), F('g2', '2026-10-05', 1300, 9000, 40, true, { fuelType: '전기(충전)' })])); ok(!ev[1].flags.length && K.avgEconomy(ev) === null, '전기(충전)는 단가·연비 점검과 평균 연비에서 제외');
const dr = K.fuelRows([F('h1', '2026-10-01', 1000, 100, 1, true, { status: 'draft' }), F('h2', '2026-10-02', 1000, 100, 1, true, { date: 'x' }), F('h3', '2026-10-03', 1000, 100, 1, true, { status: 'rejected' }), F('h4', '2026-10-04', 1000, 100, 1, true, { status: 'posted' })]); ok(dr.length === 1 && dr[0].id === 'h4', '주유 줄: 임시저장·반려·날짜 오류 문서는 집계에서 뺀다');

/* ───────── 5) 정비 줄·합계·거름 ───────── */
const R = (id, date, items, extra) => Object.assign({ id, rec: 'repair', date, vehicleId: 'v1', vehicleName: '현대 스타리아', status: 'approved', shopKind: '정비소', place: '애니카랜드', odo: 10500, items, note: '', authorName: '박', createdMs: 0 }, extra || {});
const docsAll = docsA.concat([R('r1', '2026-10-15', [{ name: '엔진오일 및 오일필터', amount: 85000, memo: '' }, { name: '하이패스', amount: 12000, memo: '' }]), R('r2', '2026-11-02', [{ name: '타이어', amount: 400000, memo: '' }], { vehicleId: 'v2', vehicleName: 'GMC 시에라' }), F('f9', '2026-11-03', 11500, 150000, 64.66, true, { washFee: 10000 })]);
const all = K.costRows(docsAll, {}); ok(all.length === 7 && all[0].date === '2026-11-03' && all[all.length - 1].date === '2026-10-01', '비용 줄: 주유+정비를 최근순으로 합친다');
const t = K.costTotals(all); ok(t.n === 7 && t.fuel === 100000 + 90000 + 50000 + 120000 + 150000 && t.wash === 10000 && t.repair === 97000 + 400000 && t.total === 510000 + 10000 + 497000 && t.fuelN === 5 && t.repairN === 2, '★ 합계: 주유 510,000 + 세차비 10,000 + 정비·기타 497,000 = 1,017,000원');
ok(t.liters === 221.66 && t.avgUnit === Math.round(510000 / 221.66), '합계: 주유량 합과 평균 단가');
const oct = K.costFilter(all, { mode: 'month', ym: '2026-10' }); ok(oct.length === 5 && K.costTotals(oct).total === 360000 + 97000, '월별 거름: 2026-10 만(주유 4건 + 정비 1건)');
ok(K.costFilter(all, { mode: 'year', year: '2026' }).length === 7 && K.costFilter(all, { mode: 'year', year: '2025' }).length === 0 && K.costFilter(all, { mode: 'all' }).length === 7, '연도·전체 거름');
ok(K.costFilter(all, { mode: 'all', vehicleId: 'v2' }).length === 1 && K.costFilter(all, { mode: 'all', rec: 'repair' }).length === 2, '차량·종류 거름');
const fAll = K.costRows(docsAll, {}); const november = K.costFilter(fAll, { mode: 'month', ym: '2026-11' }); ok(november.length === 2 && byId(november, 'f9').economy === 7.73, '월 거름 뒤에도 연비는 전체 기록 기준으로 이미 계산돼 있다(11월 2건 중 주유의 연비 7.73)');
ok(byId(fAll, 'f9').segKm === 500 && byId(fAll, 'f9').economy === 7.73, '★ 기간을 거르기 전에 연비를 계산한다(11월만 봐도 10월 마지막 가득 주유와 이어짐: 500km ÷ 64.66L = 7.73)');
const bm = K.costByMonth(all); ok(bm.length === 2 && bm[0].ym === '2026-11' && bm[0].total === 150000 + 10000 + 400000 && bm[1].total === 100000 + 90000 + 50000 + 120000 + 97000, '월별 합계(최근 달이 위)');
const bv = K.costByVehicle(all); ok(bv.length === 2 && bv[0].vehicle === '현대 스타리아' && bv[0].total === 617000 && bv[0].fuel === 510000 && bv[0].repair === 97000 && bv[1].vehicle === 'GMC 시에라' && bv[1].total === 400000, '차량별 합계(많은 순): 스타리아 617,000원(주유 510,000+세차 10,000+정비 97,000), 시에라 400,000원');
ok(K.costYears(all).join() === '2026', '연도 목록');

/* ───────── 6) 내보내기(CSV) ───────── */
const csv = K.carCostCsv(all, '차량 비용 — 전체');
ok(csv.startsWith('\uFEFF') && /"일자","차량","차량번호","작성자","종류"/.test(csv) && /"합계"/.test(csv) && /"1017000"/.test(csv) && /"7\.73"/.test(csv), 'CSV: 한글 깨짐 방지(BOM)·머리글·합계 줄(총 1,017,000원)·연비 칸');
const inj = K.carCostCsv(K.costRows([F('z1', '2026-10-01', 1000, 70000, 30, true, { station: '=HYPERLINK("http://x")' })], {}), 't');
ok(!/(^|,|\n)"=HYPERLINK/.test(inj), 'CSV: 수식으로 시작하는 입력(=…)은 그대로 실행되지 않게 처리(수식 주입 방어)');

/* ───────── 7) 작성 로직(compose) ───────── */
const base = defaultValues('drive', me, NOW);
const tripKeys = fieldsFor('drive', {}).map((f) => f.key).join();
ok(tripKeys === 'date,vehicleId,pjtId,origin,destination,kind,odoStart,odoEnd,bizKm,purpose,note' && fieldsFor('drive', { rec: 'trip' }).map((f) => f.key).join() === tripKeys && base.rec === 'trip', '★ 운행 입력 칸은 이전과 똑같다(기본 종류 운행)');
ok(fieldsFor('drive', { rec: 'fuel' }).map((f) => f.key).join() === 'date,vehicleId,station,fuelType,odo,full,amount,liters,fuelSum,washFee,note', '주유 입력 칸: 일자·차량·주유소·유종·누적주행거리·방식·금액·주유량·자동계산·세차비·메모');
ok(fieldsFor('drive', { rec: 'repair' }).map((f) => f.key).join() === 'date,vehicleId,shopKind,place,odo,items,repairSum,note', '정비 입력 칸: 일자·차량·정비 구분·장소·누적주행거리·항목·자동계산·메모');
ok(fieldRows('drive', {})[0].layout === 'narrow-first-3' && fieldRows('drive', {})[0].fields.map((f) => f.key).join() === 'date,vehicleId,pjtId', '운행 첫 줄 배치(운행일자·차량·프로젝트 한 줄)는 그대로');
ok(!fieldRows('drive', { rec: 'fuel' }).some((r) => r.layout === 'narrow-first-3'), '주유·정비 줄에는 세 칸 전용 배치를 쓰지 않는다');
const fv = Object.assign({}, base, fuelGood()); ok(Object.keys(validate('drive', fv, { now: NOW })).length === 0, '작성 검증: 주유 올바른 입력 통과');
ok(!!validate('drive', Object.assign({}, fv, { odo: '', amount: '', liters: '', vehicleId: '' }), { now: NOW }).odo && !!validate('drive', Object.assign({}, fv, { vehicleId: '' }), { now: NOW }).vehicleId, '작성 검증: 필수(차량·누적주행거리·금액·주유량) 누락 거부');
ok(!!validate('drive', Object.assign({}, fv, { amount: '15000' }), { now: NOW }).amount, '작성 검증: 단가 이상 거부(작성 경로에서도)');
ok(!validate('drive', Object.assign({}, fv, { washFee: '0' }), { now: NOW }).washFee, '작성 검증: 세차비 0 은 허용(선택 칸)');
const dFuel = buildDocData('drive', fv, me, { vehicles, now: NOW });
ok(dFuel.dtype === 'drive' && dFuel.rec === 'fuel' && dFuel.vehicleName === '현대 스타리아' && dFuel.vehiclePlate === '716호1313' && dFuel.odo === 27203 && dFuel.amount === 150000 && dFuel.liters === 64.66 && dFuel.unitPrice === 2320 && dFuel.full === true && dFuel.washFee === 0 && dFuel.cost === 150000 && dFuel.fuelType === '고급 휘발유' && dFuel.station === '동일석유 고덕주유소', '★ 주유 저장 문서: rec·차량·누적주행거리·금액·주유량·리터당 단가·합계');
ok(!('odoStart' in dFuel) && !('odoEnd' in dFuel) && !('distance' in dFuel) && !('bizKm' in dFuel) && !('pjtId' in dFuel), '★ 주유 문서에는 운행기록부 필드(계기판 전·후·주행거리·업무용·프로젝트)가 없다');
const dPart = buildDocData('drive', Object.assign({}, fv, { full: '부분 주유', washFee: '10,000' }), me, { vehicles }); ok(dPart.full === false && dPart.washFee === 10000 && dPart.cost === 160000, '주유 저장: 부분 주유·세차비는 지출 합계에 더해짐');
const rv = Object.assign({}, base, repGood()); ok(Object.keys(validate('drive', rv, { now: NOW })).length === 0, '작성 검증: 정비 올바른 입력 통과');
const dRep = buildDocData('drive', rv, me, { vehicles }); ok(dRep.rec === 'repair' && dRep.shopKind === '정비소' && dRep.place === '애니카랜드 이충점' && dRep.odo === 27206 && dRep.items.length === 2 && dRep.items[0].amount === 85000 && dRep.cost === 97000 && !('odoStart' in dRep), '★ 정비 저장 문서: 항목 이름·금액·메모와 합계(85,000+12,000)');
ok(buildDocData('drive', Object.assign({}, rv, { odo: '' }), me, { vehicles }).odo === null && buildDocData('drive', Object.assign({}, rv, { items: [{ name: '', amount: '', memo: '' }, rv.items[0]] }), me, { vehicles }).items.length === 1, '정비 저장: 누적주행거리를 비우면 null, 빈 항목 줄은 저장하지 않는다');
ok(buildTitle('drive', { rec: 'fuel', date: '2026-11-03' }, me) === '20261103 한가나 차량 주유 기록' && buildTitle('drive', { rec: 'repair', date: '2026-11-04', vehicleName: '현대 스타리아' }, me) === '20261104 한가나 차량 정비·비용 기록 (현대 스타리아)' && buildTitle('drive', { date: '2026-10-10' }, me) === '20261010 한가나 차량 운행일지', '제목: 주유·정비·운행');
const bFuel = valuesFromDoc(Object.assign({ id: 'x' }, dFuel)); ok(bFuel.type === 'drive' && bFuel.values.rec === 'fuel' && bFuel.values.full === '가득 주유' && bFuel.values.odo === 27203 && bFuel.values.liters === 64.66, '저장 문서 → 작성 화면 복원(주유)');
const bPart = valuesFromDoc(Object.assign({ id: 'x' }, dPart)); ok(bPart.values.full === '부분 주유', '복원: 부분 주유');
const bRep = valuesFromDoc(Object.assign({ id: 'x' }, dRep)); ok(bRep.values.rec === 'repair' && bRep.values.items.length === 2 && bRep.values.items[1].name === '하이패스' && bRep.values.odo === 27206, '저장 문서 → 작성 화면 복원(정비 항목)');
const bTrip = valuesFromDoc({ id: 'x', dtype: 'drive', date: '2026-10-10', vehicleId: 'v1', odoStart: 12000, odoEnd: 12048 }); ok(bTrip.values.rec === 'trip' && bTrip.values.odoEnd === 12048, '복원: rec 없는 옛 운행 문서는 운행으로');
const sr = setRec(base, 'repair'); ok(sr.rec === 'repair' && sr.items.length === 1 && sr.items[0].name === '' && setRec(sr, 'fuel').rec === 'fuel' && setRec(base, 'zzz').rec === 'trip' && base.rec === 'trip', '종류 바꾸기: 정비·비용이면 빈 항목 한 줄을 깔아 주고 원본 값은 건드리지 않는다');
ok(JSON.stringify(emptyItem('drive')) === '{"name":"","amount":"","memo":""}' && JSON.stringify(emptyItem('spend')) === '{"name":"","qty":"","unitPrice":"","link":""}' && 'qty' in emptyItem(), '빈 항목: 운행일지는 이름·금액·메모, 구매·지출은 기존 그대로');
const tripGood = Object.assign({}, base, { date: '2026-10-10', vehicleId: 'v1', pjtId: 'common', origin: '본사', destination: '현장', odoStart: '12000', odoEnd: '12048', purpose: '자재' }); const dTrip = buildDocData('drive', tripGood, me, { vehicles, projects: [] });
ok(dTrip.odoStart === 12000 && dTrip.odoEnd === 12048 && dTrip.distance === 48 && !('rec' in dTrip) && !('items' in dTrip) && !('liters' in dTrip) && Object.keys(validate('drive', tripGood, { projects: [], now: NOW })).length === 0, '★ 운행 저장 문서와 검증은 이전과 똑같다(rec·주유 필드가 끼지 않는다)');

/* ───────── 8) 운행기록부 분리 ───────── */
const tripDoc = { id: 't1', dtype: 'drive', status: 'approved', date: '2026-10-10', vehicleId: 'v1', vehicleName: '현대 스타리아', odoStart: 12000, odoEnd: 12048, distance: 48, bizKm: 48, authorName: '한', kind: '일반 업무용' };
const oldTrip = Object.assign({}, tripDoc, { id: 't2' }); const explicitTrip = Object.assign({}, tripDoc, { id: 't3', rec: 'trip' });
const rowsT = driveRows([oldTrip, explicitTrip, Object.assign({}, dFuel, { id: 'c1', status: 'approved' }), Object.assign({}, dRep, { id: 'c2', status: 'approved' })]);
ok(rowsT.length === 2 && rowsT.every((r) => r.id === 't2' || r.id === 't3'), '★ 운행기록부: 주유·정비 문서가 섞이지 않는다(rec 없는 옛 문서와 rec=trip 만)');
ok(driveTotals(rowsT).distance === 96 && driveTotals(rowsT).n === 2, '★ 운행기록부 합계(주행거리·건수)는 운행만 센다');

/* ───────── 9) 문서 상세·목록 요약 ───────── */
const val = (label, d) => { const r = FORMS.drive.rows.find((x) => x.label === label); return r ? (r.get ? r.get(d) : d[r.key]) : undefined; };
ok(val('운행일자', dTrip) === '2026-10-10' && val('기록 종류', dTrip) === '' && val('주행거리', dTrip) === '48 km (업무용 48 km)' && val('주유소', dTrip) === '' && val('합계 금액(원)', dTrip) === '', '문서 상세(운행): 운행 행은 그대로, 주유·정비 행은 비어 숨겨진다');
ok(val('기록 종류', dFuel) === '주유' && val('운행일자', dFuel) === '' && val('일자', dFuel) === '2026-11-03' && val('주유소', dFuel) === '동일석유 고덕주유소' && val('유종 · 방식', dFuel) === '고급 휘발유 · 가득 주유' && val('누적주행거리', dFuel) === '27,203 km' && val('주유량', dFuel) === '64.66 L (리터당 2,320원)' && val('주유금액', dFuel) === 150000 && val('합계 금액(원)', dFuel) === 150000 && val('주행거리', dFuel) === '' && val('계기판(km)', dFuel) === '', '★ 문서 상세(주유): 일자·주유소·유종·누적주행거리·주유량·금액, 운행 행은 숨김');
ok(val('기록 종류', dRep) === '정비·수리·비용' && val('정비 구분 · 장소', dRep) === '정비소 · 애니카랜드 이충점' && val('항목', dRep).join('|') === '엔진오일 및 오일필터 (합성유) — 85,000원|하이패스 — 12,000원' && val('합계 금액(원)', dRep) === 97000, '★ 문서 상세(정비): 구분·장소·항목별 금액·합계');
ok(K.carSummary(dFuel) === '주유 · 64.66L · 150,000원 · 동일석유 고덕주유소' && K.carSummary(dRep) === '정비·비용 · 엔진오일 및 오일필터, 하이패스 · 97,000원' && K.carSummary(dTrip) === '', '목록 요약: 주유·정비는 한 줄 요약, 운행은 기존처럼 비움');
ok(summaryOf(Object.assign({}, dFuel)) === K.carSummary(dFuel) && summaryOf(dTrip) === '', '전자결재 목록 요약(summaryOf)에 연결');

/* ───────── 10) 작성 화면 출력 ───────── */
const baseState = (type, values, extra) => Object.assign({ type, values, errors: {}, ctx: { projects: [], me: { name: '한가나', rank: '사원', dept: '시공팀' }, users: [], vehicles, byUid: {}, required: [] }, files: [], uploading: [], line: { approvers: [], cc: [] }, partsUi: { custom: false, texts: {}, preview: null, previewError: '' }, busy: false, ui: {} }, extra || {});
const hTrip = composeHtml(baseState('drive', base)); const hFuel = composeHtml(baseState('drive', Object.assign({}, base, fuelGood()))); const hRep = composeHtml(baseState('drive', Object.assign({}, base, repGood())));
ok(/data-rec="trip" aria-pressed="true"/.test(hTrip) && /data-rec="fuel" aria-pressed="false"/.test(hTrip) && /data-rec="repair"/.test(hTrip) && />운행<\/button>/.test(hTrip) && />주유<\/button>/.test(hTrip) && />정비·수리·비용<\/button>/.test(hTrip), '화면: 기록 종류 단추 3개(운행·주유·정비·수리·비용), 기본은 운행');
ok(/data-input="origin"/.test(hTrip) && /data-input="odoStart"/.test(hTrip) && !/data-input="liters"/.test(hTrip) && !/jh-car-items/.test(hTrip), '화면(운행): 기존 입력 칸 그대로, 주유·정비 칸은 없다');
ok(/data-rec="fuel" aria-pressed="true"/.test(hFuel) && /data-input="station"/.test(hFuel) && /data-input="liters"[^>]*/.test(hFuel) && /step="0\.01"/.test(hFuel) && /data-car-calc="fuelSum"/.test(hFuel) && /리터당 2,320원 · 지출 합계 150,000원/.test(hFuel) && !/data-input="origin"/.test(hFuel), '★ 화면(주유): 주유소·유종·금액·주유량(소수 둘째 자리) 칸과 자동 계산 표시, 운행 칸은 없다');
ok(/data-input="fuelType"/.test(hFuel) && />고급 휘발유<\/option>/.test(hFuel) && /가득 주유/.test(hFuel) && /부분 주유/.test(hFuel), '화면(주유): 유종·가득/부분 선택');
ok(/<datalist id="jh-car-items">/.test(hRep) && /엔진오일 및 오일필터/.test(hRep) && /12개월 · 15,000km 마다/.test(hRep) && /data-item="0\.name"[^>]*/.test(hRep) && /list="jh-car-items"/.test(hRep) && /data-car-calc="repairSum"/.test(hRep) && /합계 97,000원 \(2개 항목\)/.test(hRep) && /data-add-item/.test(hRep), '★ 화면(정비): 항목 자동 완성 목록(교체 주기 포함)·항목별 금액·합계·항목 추가');
ok(/data-input="shopKind"/.test(hRep) && />자가정비<\/option>/.test(hRep) && /정비 당시 누적주행거리/.test(hRep), '화면(정비): 정비소/자가정비, 정비 당시 누적주행거리');
ok(/총무 → 운행일지의 <strong>차량 비용<\/strong>/.test(hFuel) && /총무가 모든 사람의 운행일지를/.test(hTrip), '화면: 안내 문구가 종류에 맞게 바뀐다(주유·정비는 차량 비용으로 모임)');
const hEdit = composeHtml(baseState('drive', Object.assign({}, base, fuelGood()), { edit: { id: 'x' } })); ok(/data-rec="trip"[^>]*disabled/.test(hEdit) && !/data-rec="fuel"[^>]*disabled/.test(hEdit) && /바꿀 수 없습니다/.test(hEdit), '화면: 이미 작성한 기록은 종류를 바꿀 수 없다');
const hErr = composeHtml(baseState('drive', Object.assign({}, base, repGood(), { items: [{ name: '', amount: '', memo: '' }] }), { errors: { 'items.0.name': '항목을 입력해 주세요.', items: '한 줄 이상' } })); ok(/항목을 입력해 주세요\./.test(hErr) && /data-invalid="true"/.test(hErr), '화면: 항목 줄 오류가 그 줄에 표시된다');

/* ───────── 11) 총무 화면 ───────── */
const today = '2026-11-04';
const mkSt = (car, docs, vs) => ({ data: { vehicle: vs || vehicles }, drive: { docs, hist: [], mode: 'all', anchor: today, ym: '2026-11', vehicleId: '', driver: '', pjtKey: '', approvedOnly: false, imp: null, projects: [], pa: { kw: '', pjt: '', from: '', to: '', over: false } }, car, pg: {}, today });
const carNov = { mode: 'month', ym: '2026-11', year: '2026', vehicleId: '', rec: '' };
const hNov = carCostHtml(mkSt(carNov, docsAll));
ok(/차량 비용 — 주유·정비·기타/.test(hNov) && /총 지출/.test(hNov) && /560,000원/.test(hNov) && /평균 연비/.test(hNov) && /7\.73 km\/L/.test(hNov), '★ 총무 화면(11월): 총 지출 560,000원(주유 150,000 + 정비 400,000 + 세차 10,000)·평균 연비 7.73');
ok(/data-c-mode="month" aria-pressed="true"/.test(hNov) && /data-c-ym/.test(hNov) && /data-c-nav="-1"/.test(hNov) && /data-g-act="c-csv"/.test(hNov) && /data-c-f="vehicleId"/.test(hNov) && /data-c-f="rec"/.test(hNov), '총무 화면: 보기(월별·연도별·전체)·월 이동·차량/종류 거름·엑셀 단추');
ok(/타이어 400,000원/.test(hNov) && /동일석유|\(주유소 미입력\)/.test(hNov) && /500km · 7\.73 km\/L/.test(hNov), '총무 화면: 정비 항목별 금액, 주유 내역과 구간·연비');
const hAll = carCostHtml(mkSt(Object.assign({}, carNov, { mode: 'all' }), docsAll)); ok(/월별 합계/.test(hAll) && /차량별 합계/.test(hAll) && /2026-10/.test(hAll) && /1,017,000원/.test(hAll), '총무 화면(전체): 월별 합계·차량별 합계, 총 지출 1,017,000원');
ok(!/월별 합계/.test(hNov), '총무 화면(월별 보기): 월별 합계 표는 보이지 않는다(그 달 하나뿐)');
const hEmpty = carCostHtml(mkSt(carNov, [tripDoc])); ok(/아직 주유·정비 기록이 없습니다/.test(hEmpty) && /운행기록부|전자결재 → 작성 → 차량 운행일지/.test(hEmpty) && /0원/.test(hEmpty), '총무 화면: 기록이 없으면 쓰는 방법을 안내(운행 문서는 비용에 세지 않는다)');
const hNone = carCostHtml(mkSt(Object.assign({}, carNov, { ym: '2025-01' }), docsAll)); ok(/2025-01 기간에 주유·정비 기록이 없습니다/.test(hNone), '총무 화면: 그 기간에 기록이 없을 때 안내');
const hFlag = carCostHtml(mkSt(Object.assign({}, carNov, { mode: 'all' }), [F('c1', '2026-10-01', 20000, 100000, 45, true), F('c2', '2026-10-10', 19000, 90000, 40, true)])); ok(/금액·연비를 확인할 기록이 1건/.test(hFlag) && /계기판이 이전보다 작음/.test(hFlag), '★ 총무 화면: 점검할 기록(계기판 역전)을 위에 알린다');
const hVeh = carCostHtml(mkSt(Object.assign({}, carNov, { mode: 'all', vehicleId: 'v2' }), docsAll)); ok(/GMC 시에라/.test(hVeh) && !/차량별 합계/.test(hVeh) && /400,000원/.test(hVeh), '총무 화면: 차량을 고르면 그 차량만(차량별 합계 표는 숨김)');
const sel = carSelect(mkSt(Object.assign({}, carNov, { mode: 'month', ym: '2026-10' }), docsAll)); ok(sel.rows.length === 5 && sel.period === '2026-10' && sel.vsel === null && carSelect(mkSt(Object.assign({}, carNov, { vehicleId: 'v2', mode: 'year' }), docsAll)).vsel.name === 'GMC 시에라', '선택 함수(화면·내보내기가 같이 쓴다): 줄·기간·차량');

// 총무 → 운행일지 화면 전체: 운행 카드 아래에 차량 비용 카드가 붙고, 운행 카드의 건수·주행거리에는 주유·정비가 세어지지 않는다
const stAll = mkSt(carNov, [tripDoc].concat(docsAll)); stAll.drive.mode = 'all';
const hDrive = driveHtml(stAll);
ok(/차량 운행일지 취합/.test(hDrive) && /차량 비용 — 주유·정비·기타/.test(hDrive) && hDrive.indexOf('차량 운행일지 취합') < hDrive.indexOf('차량 비용 — 주유·정비·기타'), '★ 총무 운행일지 화면: 운행 카드 아래에 차량 비용 카드가 붙는다');
ok(/운행 건수<\/span><span class="jh-kpi__value">1건/.test(hDrive) && /주행거리<\/span><span class="jh-kpi__value">48 km/.test(hDrive), '★ 총무 운행일지 화면: 운행 건수(1건)·주행거리(48km)에는 주유·정비 7건이 세어지지 않는다');
const hDriveOnlyCar = driveHtml(Object.assign(mkSt(carNov, docsAll), {})); ok(/아직 올라온 운행일지가 없습니다/.test(hDriveOnlyCar), '주유·정비 기록만 있으면 운행일지는 아직 없는 것으로 안내한다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
