import { isDay, isYm, monthRange, stateAt, tally, monthlyProgress, monthlyManday, monthlyReports, productivity, fieldReport, FINISHING_RATE } from '../app/modules/pjt/monthly.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : '  ← 실제 ' + JSON.stringify(a) + ' / 기대 ' + JSON.stringify(b)));

// ── 구조: 실제 P4 Ph2 와 같은 단계(설치 하위 열 5개, 시공검측은 설치 밖의 마지막 단계), 섹터 2개에 품목 12개로 줄임
const STAGES = ['반입', '입고검사', '내진스토퍼', '다이크', '실링', '동판', '결선', '시공검측'], INSTALL = ['내진스토퍼', '다이크', '실링', '동판', '결선'];
const items = (pre, n) => Array.from({ length: n }, (_, i) => ({ id: pre + (i + 1), name: pre + (i + 1) }));
const ST = { stages: STAGES, installCols: INSTALL, unit: '대', groups: [{ id: 'fiz', name: '3F FIZ', items: items('8', 8) }, { id: 'xob', name: 'X-OB', items: items('9', 4) }] };   // 품목 12개
const day = (id, g) => ({ id, groups: g });
const chk = (gid, ids, cols) => ({ [gid]: Object.fromEntries(ids.flatMap((i) => cols.map((c) => [i + '_' + c, true]))) });
const A = (n, from = 1) => Array.from({ length: n }, (_, i) => '8' + (from + i));   // fiz 품목 id n개(81..)

// ── monthRange·형식
eq(monthRange('2026-08'), { ym: '2026-08', first: '2026-08-01', last: '2026-08-31', prevLast: '2026-07-31', days: 31 }, '월 범위: 첫날·말일·전월 말일·일수');
ok(monthRange('2026-01').prevLast === '2025-12-31' && monthRange('2026-03').prevLast === '2026-02-28' && monthRange('2028-03').prevLast === '2028-02-29' && monthRange('2028-02').days === 29, '연초(전월=작년 12월)·2월 말일·윤년');
ok(monthRange('2026-13') === null && monthRange('2026-00') === null && monthRange('26-08') === null && monthRange('') === null && monthRange(null) === null && monthRange(202608) === null, '틀린 월 형식은 null');
ok(isDay('2026-02-28') && !isDay('2026-02-29') && isDay('2028-02-29') && !isDay('2026-13-01') && !isDay('2026-8-1') && !isDay(null) && isYm('2026-12') && !isYm('2026-1'), '날짜·월 형식 검사(존재하지 않는 날짜 거절)');

// ── ★ 실제 본섭 흐름 재현: 설치 완료 누적이 0 → 4 → 8 → 12 (월 증분 +4 +4 +4), 시공검측은 8월부터
//   6월: 반입·입고검사만 / 7월: 설치 열을 채워 4품목 완료 / 8월: 4품목 더 완료 + 앞 8품목 검측 / 9월: 마지막 4품목(xob) 완료 + 검측
const DAYS = [
  day('2026-06-24', chk('fiz', A(8), ['반입', '입고검사'])),
  day('2026-07-05', chk('fiz', A(4), ['내진스토퍼', '다이크', '실링'])), day('2026-07-20', chk('fiz', A(4), ['동판', '결선'])),   // 7월: 81~84 설치 완료(5열이 서로 다른 날짜에 채워져도 합집합으로 완료)
  day('2026-08-10', chk('fiz', A(4, 5), INSTALL)), day('2026-08-25', chk('fiz', A(8), ['시공검측'])),                          // 8월: 85~88 설치 완료 + 81~88 검측
  day('2026-09-03', chk('xob', ['91', '92', '93', '94'], INSTALL.concat(['반입', '입고검사']))), day('2026-09-12', chk('xob', ['91', '92', '93', '94'], ['시공검측']))
];
const P6 = monthlyProgress(DAYS, '2026-06', ST), P7 = monthlyProgress(DAYS, '2026-07', ST), P8 = monthlyProgress(DAYS, '2026-08', ST), P9 = monthlyProgress(DAYS, '2026-09', ST);
eq([P6.end.installed, P7.end.installed, P8.end.installed, P9.end.installed], [0, 4, 8, 12], '★ 월말 누적 설치 완료 품목: 0 → 4 → 8 → 12 (5개 열이 다른 날 체크돼도 합집합)');
eq([P6.delta.installed, P7.delta.installed, P8.delta.installed, P9.delta.installed], [0, 4, 4, 4], '★ 월 증분(설치 완료): 월말 상태 − 전월말 상태');
eq([P6.end.inspected, P7.end.inspected, P8.end.inspected, P9.end.inspected], [0, 0, 8, 12], '시공검측 통과 누적: 7월까지 0, 8월 8, 9월 12');
ok(P8.delta.inspected === 8 && P9.delta.inspected === 4 && P7.delta.inspected === 0, '시공검측 통과 월 증분');
ok(P6.end.byStage['반입'] === 8 && P6.end.byStage['입고검사'] === 8 && P9.end.byStage['반입'] === 12 && P6.delta.byStage['반입'] === 8 && P7.delta.byStage['반입'] === 0, '반입·입고검사는 참고 지표로 단계별 누적·월 증분이 나옴');
ok(P9.end.total === 12 && Math.abs(P9.end.installRate - 1) < 1e-9 && Math.abs(P8.end.installRate - 8 / 12) < 1e-9 && Math.abs(P8.end.inspectRate - 1) < 1e-9 && P7.end.inspectRate === 0, '설치 완료율·시공검측 통과율(= 통과 ÷ 설치 완료)');
ok(P7.touched === true && P7.checkDays === 2 && P6.checkDays === 1, '그 달에 체크가 있었는지(touched)와 체크한 날 수');

// ── ★ 체크 취소·정정은 날짜 합이 아니라 상태 차이로: 옛 날짜 문서에서 키를 지우면 그 달 증분이 줄어든다
{ const edited = DAYS.map((d) => (d.id === '2026-07-05' ? day(d.id, chk('fiz', A(2), ['내진스토퍼', '다이크', '실링'])) : d));   // 7월 5일 문서에서 83·84 의 체크를 지움
  eq([monthlyProgress(edited, '2026-07', ST).end.installed, monthlyProgress(edited, '2026-07', ST).delta.installed], [2, 2], '★ 옛 날짜 문서를 고쳐 체크를 취소하면 월말 상태·월 증분에 반영(2품목만 완료)');
  const back = monthlyProgress([day('2026-06-10', chk('fiz', A(3), INSTALL)), day('2026-07-02', {})], '2026-07', ST);   // 6월 체크 3개 → 7월 중 6월 문서를 지워 0개(여기서는 7월 시점 입력이 없는 경우와 구분)
  ok(back.start.installed === 3 && back.end.installed === 3 && back.delta.installed === 0, '아무것도 안 바뀐 달은 증분 0'); }
{ const regress = monthlyProgress([day('2026-06-10', chk('fiz', A(5), INSTALL))].concat([]), '2026-07', ST); ok(regress.delta.installed === 0, '이전 달 상태가 그대로면 증분 0');
  const neg = (() => { const d6 = day('2026-06-10', chk('fiz', A(5), INSTALL)); const p = monthlyProgress([d6], '2026-06', ST); const q = monthlyProgress([day('2026-06-10', chk('fiz', A(5), INSTALL.slice(0, 3)))], '2026-07', ST); return [p.end.installed, q.start.installed]; })(); eq(neg, [5, 0], '체크를 일부 지우면 설치 완료가 줄어든다(음수 증분도 있을 수 있음 — 정정)'); }

// ── 키 해석: 품목 id 에 밑줄이 있어도(Ph4 의 EHU_4F10701) 열을 구조에서 찾아 자른다, 모르는 열·형식 이상은 무시
{ const ST4 = { stages: ['반입', '입고검사', '내진스토퍼', '시공검측'], installCols: ['내진스토퍼'], groups: [{ id: 'core20', name: '#20Core', items: [{ id: 'EHU_4F10701' }, { id: 'EHU_4F10702' }, { id: 'EHU_4F10703' }] }] };
  const d = [day('2026-03-27', { core20: { 'EHU_4F10701_내진스토퍼': true, 'EHU_4F10702_내진스토퍼': true, 'EHU_4F10701_반입': true, 'EHU_4F10703_없는열': true, 'EHU_4F10703': true, '_내진스토퍼': true, 'EHU_4F10702_시공검측': false } })];
  const t = tally(stateAt(d, '2026-03-31', ST4), ST4); eq([t.installed, t.byStage['내진스토퍼'], t.byStage['반입'], t.byStage['시공검측'], t.cells, t.total], [2, 2, 1, 0, 3, 3], 'Ph4 구조(품목 id 에 밑줄): 설치 완료 2·칸 3, 모르는 열·형식 이상·false 값은 무시'); }
{ const t = tally(stateAt([day('2026-07-01', { fiz: { '899_실링': true }, ghost: { '801_실링': true } })], '2026-07-31', ST), ST); ok(t.cells === 0 || t.cells === 1, '구조에 없는 품목은 집계에서 제외하거나 한정(전체 품목 수는 구조 기준)'); ok(t.total === 12, '전체 품목 수는 구조(섹터 품목 합)에서'); }

// ── 입력 불변·이상한 입력
{ const copy = JSON.stringify(DAYS); monthlyProgress(DAYS, '2026-08', ST); ok(JSON.stringify(DAYS) === copy, '입력 문서를 바꾸지 않음(순수 함수)');
  ok(monthlyProgress(DAYS, 'x', ST) === null && monthlyProgress([], '2026-08', ST).delta.installed === 0 && monthlyProgress(null, '2026-08', ST).end.total === 12 && monthlyProgress(undefined, '2026-08', {}).end.installed === 0, '잘못된 월은 null, 문서가 없거나 구조가 비어도 오류 없이 0');
  ok(monthlyProgress([null, undefined, { id: 'bad', groups: {} }, { id: '2026-08-01' }, { id: '2026-08-02', groups: null }], '2026-08', ST).delta.cells === 0, '깨진 문서(null·id 형식 이상·groups 없음)가 섞여도 무시'); }

// ── 공수·출역: 공수 합(0·음수·숫자 아님 제외)·공수 일수, 출역 일수·일평균 인원(배열), 범위 밖 날짜 제외
{ const MD = [{ id: '2026-08-03', md: { w1: 0.5, w2: 1, w3: 0 } }, { id: '2026-08-04', md: { w1: 1.5, w2: '1', w9: -1, w8: 'x', w7: null } }, { id: '2026-08-05', md: {} }, { id: '2026-07-31', md: { w1: 9 } }, { id: '2026-09-01', md: { w1: 9 } }, { id: 'zzz', md: { w1: 9 } }, null];
  const AT = [{ id: '2026-08-03', checks: ['w1', 'w2', 'w3'] }, { id: '2026-08-04', checks: ['w1', 'w2', 'w2', '', null] }, { id: '2026-08-05', checks: [] }, { id: '2026-07-31', checks: ['w1'] }, { id: '2026-08-06', checks: 'w1' }];
  const m = monthlyManday(MD, AT, '2026-08'); eq([m.manday, m.mandayDays, m.workers], [4, 2, 2], '공수 합 4(0.5+1 + 1.5+1; 0·음수·숫자 아님 제외)·공수 입력 2일·인원 2명'); eq([m.attendDays, m.avgHeads], [2, 2.5], '출역 2일(빈 날·배열 아님·범위 밖 제외), 일평균 출역 인원 2.5(같은 사람 중복·빈 값은 한 번만)');
  const e = monthlyManday([], [], '2026-08'); eq([e.manday, e.attendDays, e.avgHeads], [0, 0, 0], '자료가 없으면 0'); ok(monthlyManday(MD, AT, 'x') === null && monthlyManday(null, null, '2026-08').manday === 0, '잘못된 월은 null, 목록이 null 이어도 오류 없음');
  ok(monthlyManday([{ id: '2026-08-03', md: { a: 0.1, b: 0.2 } }], [], '2026-08').manday === 0.3, '소수 공수의 부동소수 오차를 반올림(0.1+0.2=0.3)'); }

// ── 공사일보: 달력 전체 미작성(결정 11), 기간 경계(월초·프로젝트 시작일·오늘·종료일), 출역 있는 날 중 미작성, 특이사항·다음 작업
{ const R = (id, o) => Object.assign({ id, remarks: '', tomorrow: '', today: 'x', author: '작성자' }, o || {});
  const REP = [R('2026-08-03', { remarks: '자재 반입 지연', tomorrow: '4층 배관' }), R('2026-08-04'), R('2026-08-10', { remarks: '  ', tomorrow: '5층 점검', author: '김' }), R('2026-08-20', { remarks: '검측 일정 변경' }), R('2026-07-31'), R('2026-09-01')];
  const full = monthlyReports(REP, '2026-08', { today: '2026-12-31' }); eq([full.from, full.to, full.span, full.written, full.missing], ['2026-08-01', '2026-08-31', 31, 4, 27], '★ 달력 전체: 8월 31일 중 일보가 있는 4일을 뺀 27일이 미작성(주말·공휴일 포함)');
  const cur = monthlyReports(REP, '2026-08', { today: '2026-08-15' }); eq([cur.to, cur.span, cur.written, cur.missing], ['2026-08-15', 15, 3, 12], '이번 달이면 오늘까지만 센다(미래 날짜는 미작성이 아님)');
  const sd = monthlyReports(REP, '2026-08', { today: '2026-12-31', startDate: '2026-08-10' }); eq([sd.from, sd.span, sd.written, sd.missing], ['2026-08-10', 22, 2, 20], '프로젝트 시작일이 월 중간이면 시작일부터 센다');
  const en = monthlyReports(REP, '2026-08', { today: '2026-12-31', endDate: '2026-08-20' }); eq([en.to, en.span, en.missing], ['2026-08-20', 20, 16], '종료일이 월 중간이면 종료일까지만 센다');
  const nm = monthlyReports(REP, '2026-08', { today: '2026-12-31', startDate: '2026-09-15' }); eq([nm.span, nm.written, nm.missing], [0, 0, 0], '시작일이 그 달보다 뒤면 세는 날이 없다(미작성 0)');
  const fut = monthlyReports(REP, '2026-08', { today: '2026-07-01' }); ok(fut.span === 0 && fut.missing === 0, '아직 오지 않은 달은 미작성 0');
  const early = monthlyReports(REP, '2026-08', { today: '2026-12-31', startDate: '2026-01-01' }); ok(early.from === '2026-08-01', '시작일이 월 이전이면 월초부터');
  eq(full.remarks.map((x) => [x.date, x.text, x.author]), [['2026-08-03', '자재 반입 지연', '작성자'], ['2026-08-20', '검측 일정 변경', '작성자']], '특이사항: 비고가 비어 있지 않은 날만 날짜순(공백만 있는 비고 제외, 범위 밖 제외)');
  eq(full.nextPlan, { text: '5층 점검', from: '2026-08-10' }, '다음 달 계획 초안 = 그 달 마지막으로 "내일 작업"이 적힌 일보의 내용');
  const AT = [{ id: '2026-08-03', checks: ['w1'] }, { id: '2026-08-05', checks: ['w1'] }, { id: '2026-08-06', checks: ['w1'] }, { id: '2026-08-07', checks: [] }, { id: '2026-07-30', checks: ['w1'] }];
  const am = monthlyReports(REP, '2026-08', { today: '2026-12-31', attendDocs: AT }); ok(am.attendMissing === 2, '참고: 출역이 있는데 일보가 없는 날 2일(8/5·8/6 — 8/3 은 일보 있음, 8/7 은 출역 비어 있음, 7월은 범위 밖)');
  const orig = REP.map((x) => x.id).join(); monthlyReports(REP, '2026-08', {}); ok(REP.map((x) => x.id).join() === orig, '받은 일보 배열의 순서를 바꾸지 않음(복사 후 정렬)');
  ok(monthlyReports([], '2026-08', { today: '2026-08-31' }).missing === 31 && monthlyReports(null, '2026-08', { today: '2026-08-31' }).written === 0 && monthlyReports(REP, 'x') === null, '일보가 하나도 없으면 전부 미작성, null 목록·잘못된 월도 안전');
  const noTs = monthlyReports(REP, '2026-08', {}); ok(noTs.to === '2026-08-31', 'today 를 안 주면 월말까지(시험·과거 달 보고서용)'); }

// ── 수율: 상태 판정(설계 §3-1·§4·결정 9)
{ const MD = (v) => ({ manday: v, mandayDays: 1, attendDays: 1, avgHeads: 1, workers: 1 });
  const ok7 = productivity(P7, MD(8), ST); ok(ok7.status === 'ok' && ok7.installed === 4 && ok7.manday === 8 && Math.abs(ok7.value - 0.5) < 1e-9 && ok7.per100 === 50, '★ 정상: 설치 완료 +4 ÷ 공수 8 = 0.5 (공수 100당 50품목), 분자·분모 함께');
  const odd = productivity(P8, MD(3), ST); ok(odd.status === 'ok' && odd.per100 === Math.round((4 / 3) * 1000) / 10, '소수 값은 소수 첫째 자리까지(공수 100당)');
  const nc = productivity(monthlyProgress([day('2026-06-24', chk('fiz', A(8), ['반입', '입고검사']))], '2026-08', ST), MD(195), ST); ok(nc.status === 'no-check' && nc.value === null && nc.per100 === null && nc.manday === 195, '★ 공수는 있는데 그 달 공정 체크가 전혀 없으면 숫자 대신 "공정 체크 없음"(입력 누락 가능) — 분모는 그대로 보여 줌');
  const nm = productivity(P7, MD(0), ST); ok(nm.status === 'no-manday' && nm.value === null, '공수가 0 이면 "공수 입력 없음"(0 나눗셈 방지)');
  const nm2 = productivity(P7, { manday: null }, ST); ok(nm2.status === 'no-manday', '공수 합이 없는 값이어도 안전');
  const onlyRef = productivity(monthlyProgress([day('2026-08-05', chk('fiz', A(8), ['반입']))], '2026-08', ST), MD(100), ST); ok(onlyRef.status === 'ok' && onlyRef.installed === 0 && onlyRef.per100 === 0, '반입만 체크한 달은 체크는 있었으므로 수율 0(설치는 안 늘었다는 사실) — "체크 없음"이 아님');
  const fin = productivity(monthlyProgress(DAYS.concat([day('2026-09-20', chk('fiz', A(8), ['반입']))]), '2026-10', ST), MD(40), ST); ok(fin.status === 'finishing' && fin.value === null && fin.installRate >= FINISHING_RATE, '★ 전월 말 설치 완료율이 95% 이상이면 "마감 단계"(설치 수율 대신 — 마감 체크리스트는 2단계)');
  { const ST20 = { stages: STAGES, installCols: INSTALL, groups: [{ id: 'fiz', name: 'x', items: Array.from({ length: 20 }, (_, i) => ({ id: 'q' + (i + 1) })) }] };   // 품목 20개 — 설치 완료율을 5% 단위로 정확히 만들 수 있다
    const rate = (n) => productivity(monthlyProgress([day('2026-06-10', chk('fiz', Array.from({ length: n }, (_, i) => 'q' + (i + 1)), INSTALL))], '2026-07', ST20), MD(10), ST20);
    ok(rate(19).status === 'finishing' && Math.abs(rate(19).installRate - 0.95) < 1e-9, '★ 경계: 설치 완료율이 정확히 95%(19/20)이면 마감 단계'); ok(rate(20).status === 'finishing', '100% 도 마감 단계'); ok(rate(18).status !== 'finishing' && rate(18).status === 'no-check', '95% 미만(90%, 18/20)이면 마감 단계가 아님 — 7월에 새 체크가 없으니 공정 체크 없음'); }
  ok(productivity(null, MD(1), ST).status === 'no-data' && productivity(P7, null, ST).status === 'no-data' && productivity(P7, MD(1), null).status === 'no-data' && productivity(P7, MD(1), { stages: STAGES, installCols: [] }).status === 'no-data', '공정 구조가 없거나 설치 열이 없으면 "데이터 없음"(오류 아님)'); }

// ── 한 벌: fieldReport
{ const MD = [{ id: '2026-07-06', md: { w1: 1, w2: 1 } }, { id: '2026-07-07', md: { w1: 1, w2: 1 } }, { id: '2026-07-08', md: { w1: 1, w2: 1 } }, { id: '2026-07-09', md: { w1: 1, w2: 1 } }], AT = MD.map((d) => ({ id: d.id, checks: ['w1', 'w2'] })); const RP = [{ id: '2026-07-06', remarks: '', tomorrow: '배관' }];
  const f = fieldReport({ progress: DAYS, manday: MD, attendance: AT, reports: RP }, '2026-07', { structure: ST, startDate: '2026-06-01', today: '2026-12-31' });
  ok(f.ym === '2026-07' && f.progress.delta.installed === 4 && f.manday.manday === 8 && f.manday.attendDays === 4 && f.reports.missing === 30 && f.reports.attendMissing === 3 && f.yield.status === 'ok' && f.yield.per100 === 50, '한 벌: 7월 설치 +4·공수 8·출역 4일·일보 미작성 30(달력 전체)·출역 있는데 미작성 3·수율 공수 100당 50');
  ok(fieldReport({}, '2026-07', {}).yield.status === 'no-data' && fieldReport(null, '2026-07', null).manday.manday === 0 && fieldReport({}, 'x', {}) === null, '구조·문서가 없어도 오류 없이 빈 보고, 잘못된 월은 null');
  const s1 = JSON.stringify(f); const s2 = JSON.stringify(fieldReport({ progress: DAYS, manday: MD, attendance: AT, reports: RP }, '2026-07', { structure: ST, startDate: '2026-06-01', today: '2026-12-31' })); ok(s1 === s2, '같은 입력은 항상 같은 결과(순수)');
  ok(!/amount|price|pay|wage|salary|bank|account|rrn|jumin|phone/i.test(s1), '현장 층 결과에는 금액·개인정보 성격의 필드가 없음'); }

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
