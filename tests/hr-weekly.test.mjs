import { addDays, dow, weekStart, weekEnd, weeksOfMonth, weekLabel, weekStage, weekSummary, weekDetail, weeklyReport, isSuspectDay, SUSPECT_DAY_HOURS, WEEK_STAGES, WEEK_LEGAL, WEEK_NOTICE, WEEK_WARN, WEEK_LIMIT, WEEK_OT_LIMIT, isDate } from '../app/modules/hr/weekly.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rec = (date, h, o) => Object.assign({ date, workHours: h, checkIn: '09:00', checkOut: '18:00', breakMinutes: 60 }, o || {});
// ── 날짜 계산
ok(WEEK_LEGAL === 40 && WEEK_NOTICE === 44 && WEEK_WARN === 48 && WEEK_LIMIT === 52 && WEEK_OT_LIMIT === 12, '기준 숫자(주 40·주의 44·경고 48·한도 52·연장 12)');
ok(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].every((d) => weekStart(d) === '2026-10-19'), '월~일 일곱 날짜가 모두 같은 주(월요일 10-19)에 속한다 — 일요일(10-25)은 그 주의 마지막 날');
ok(weekStart('2026-10-26') === '2026-10-26' && weekEnd('2026-10-26') === '2026-11-01' && weekEnd('2026-10-19') === '2026-10-25', '월요일은 새 주의 시작, 주의 끝은 일요일');
ok(weekStart('2027-01-01') === '2026-12-28' && weekStart('2027-01-03') === '2026-12-28' && weekStart('2027-01-04') === '2027-01-04', '해가 바뀌는 주(2026-12-28~2027-01-03)');
ok(weekStart('2028-02-29') === '2028-02-28' && addDays('2028-02-28', 1) === '2028-02-29' && addDays('2028-02-29', 1) === '2028-03-01' && addDays('2027-02-28', 1) === '2027-03-01', '윤년(2028-02-29)·평년 2월 말');
ok(addDays('2026-10-31', 1) === '2026-11-01' && addDays('2026-11-01', -1) === '2026-10-31' && addDays('2026-10-19', -7) === '2026-10-12' && addDays('2026-12-31', 1) === '2027-01-01', '날짜 더하기·빼기(달·해 경계)');
ok(dow('2026-10-25') === 0 && dow('2026-10-19') === 1 && dow('2026-10-24') === 6 && dow('') === -1 && weekStart('') === '' && weekStart('2026-13-40x') === '' && weekStart(null) === '' && addDays('엉터리', 1) === '' && !isDate('2026-1-5'), '요일(일=0)·잘못된 입력은 빈 값');
ok(weeksOfMonth(2026, 10).join() === '2026-09-28,2026-10-05,2026-10-12,2026-10-19,2026-10-26', '2026-10 이 걸치는 주 5개(앞 주는 9월 28일 시작)');
ok(weeksOfMonth(2026, 2).join() === '2026-01-26,2026-02-02,2026-02-09,2026-02-16,2026-02-23' && weeksOfMonth(2027, 1)[0] === '2026-12-28' && weeksOfMonth(2028, 2).slice(-1)[0] === '2028-02-28' && weeksOfMonth(2026, 11).slice(-1)[0] === '2026-11-30', '2월(일요일 시작)·1월(해 경계)·윤년·월말이 월요일인 달');
ok(weekLabel('2026-10-19') === '10/19~10/25' && weekLabel('2026-09-28') === '09/28~10/04' && weekLabel('2026-12-28') === '12/28~01/03' && weekLabel('x') === '', '주 표시 글자(달 경계 포함)');
// ── 단계 경계
const st = (h) => weekStage(h);
ok(st(0) === 'ok' && st(43.99) === 'ok' && st(44) === 'notice' && st(47.99) === 'notice' && st(48) === 'warn' && st(52) === 'warn' && st(52.01) === 'over' && st(70) === 'over', '단계 경계: 44 이상 주의, 48 이상 경고, 정확히 52 는 한도 이내(경고), 52 초과는 초과');
ok(st(52.004) === 'warn' && st(52.006) === 'over' && st(43.996) === 'notice' && st('48') === 'warn' && st(null) === 'ok' && st(undefined) === 'ok' && st('엉터리') === 'ok', '소수 둘째 자리에서 반올림해 판정, 숫자가 아니면 정상(0시간)');
ok(Object.keys(WEEK_STAGES).join() === 'ok,notice,warn,over' && WEEK_STAGES.over.mark === '🔴' && WEEK_STAGES.over.label === '52시간 초과' && WEEK_STAGES.notice.rank < WEEK_STAGES.warn.rank && WEEK_STAGES.warn.rank < WEEK_STAGES.over.rank, '단계 표시(글자·기호·순서) — 색에만 의존하지 않는다');
// ── 주 요약
const W = [rec('2026-10-19', 9.5), rec('2026-10-20', 8.25), rec('2026-10-21', 10), rec('2026-10-22', 9), rec('2026-10-23', 8), rec('2026-10-24', 3.5)];
let s = weekSummary(W, '2026-10-19');
ok(s.total === 48.25 && s.days === 6 && s.ot === 8.25 && s.otRemain === 3.75 && s.stage === 'warn' && s.holidayHours === 3.5 && s.start === '2026-10-19' && s.end === '2026-10-25', '합계(소수 합산)·근로일수·연장(40 초과분)·남은 연장·단계·토요일 근로 시간');
ok(weekSummary(W.concat([rec('2026-10-18', 8), rec('2026-10-26', 8)]), '2026-10-19').total === 48.25, '앞뒤 주의 기록은 합계에 들어가지 않는다(일요일 10-18·월요일 10-26 제외)');
ok(weekSummary(W.concat([rec('2026-10-25', 4)]), '2026-10-19').total === 52.25 && weekSummary(W.concat([rec('2026-10-25', 4)]), '2026-10-19').stage === 'over' && weekSummary(W.concat([rec('2026-10-25', 4)]), '2026-10-19').holidayHours === 7.5, '일요일 근로도 같은 주에 합산(주말 합 7.5h, 52.25h 초과)');
ok(weekSummary([], '2026-10-19').total === null && weekSummary([], '2026-10-19').stage === null && weekSummary(null, '2026-10-19').ot === null && weekSummary([rec('2026-10-27', 8)], '2026-10-19').total === null, '그 주 기록이 없으면 0시간이 아니라 "자료 없음"(null)');
const d3 = [rec('2026-10-19', 13), rec('2026-10-20', 13), rec('2026-10-21', 13)]; const sd3 = weekSummary(d3, '2026-10-19'); ok(sd3.total === 39 && sd3.stage === 'ok' && sd3.ot === 0 && sd3.otRemain === 12, '법정 사례: 하루 13시간씩 3일 = 39시간은 한도 이내(연장 0) — 하루 8시간 초과가 아니라 주 40시간 초과분으로 본다');
const d7 = [19, 20, 21, 22, 23, 24, 25].map((d) => rec('2026-10-' + d, 8)); const sd7 = weekSummary(d7, '2026-10-19'); ok(sd7.total === 56 && sd7.stage === 'over' && sd7.ot === 16 && sd7.otRemain === -4 && sd7.days === 7, '법정 사례: 월~일 매일 8시간 = 56시간은 초과(연장 16, 남은 연장 −4)');
ok(weekSummary([rec('2026-10-19', 40)], '2026-10-19').ot === 0 && weekSummary([rec('2026-10-19', 40.5)], '2026-10-19').ot === 0.5 && weekSummary([rec('2026-10-19', 0)], '2026-10-19').total === 0 && weekSummary([rec('2026-10-19', 0)], '2026-10-19').stage === 'ok', '정확히 40시간은 연장 0, 0시간 기록은 자료는 있되 0시간');
const dup = weekSummary([rec('2026-10-19', 8), rec('2026-10-19', 9)], '2026-10-19'); ok(dup.total === 9 && dup.days === 1, '같은 날짜 기록이 겹쳐 들어와도 하루로 센다(달 경계 합칠 때 중복 방지)');
const bad = weekSummary([null, {}, { date: '2026-10-19' }, { date: '엉터리', workHours: 99 }, { date: '2026-10-20', workHours: 'x' }, rec('2026-10-21', 8)], '2026-10-19'); ok(bad.total === 8 && bad.days === 3, '날짜가 없거나 이상한 줄은 무시, 시간이 숫자가 아니면 0시간으로 센다');
const night = weekSummary([rec('2026-10-25', 9, { checkIn: '22:00', checkOut: '07:00' }), rec('2026-10-26', 8)], '2026-10-19'); ok(night.total === 9 && weekSummary([rec('2026-10-25', 9), rec('2026-10-26', 8)], '2026-10-26').total === 8, '자정을 넘긴 철야(일요일 22시 출근)는 출근한 날(일요일)의 주에 전부 합산된다');
ok(weekSummary([rec('2026-12-31', 9), rec('2027-01-01', 9), rec('2027-01-03', 5)], '2026-12-28').total === 23, '해를 넘기는 주도 하나로 합산');
// ── 일별 내역
const hol = (d) => d === '2026-10-22'; const dd = weekDetail(W, '2026-10-19', hol);
ok(dd.length === 7 && dd.map((x) => x.date).join() === '2026-10-19,2026-10-20,2026-10-21,2026-10-22,2026-10-23,2026-10-24,2026-10-25' && dd.map((x) => x.dow).join() === '1,2,3,4,5,6,0', '일별 내역은 월~일 7칸, 요일 번호');
ok(dd[5].off && dd[6].off && dd[3].off && !dd[0].off && !dd[4].off, '휴일 표시: 토·일과 공휴일(목 10-22)');
ok(dd[6].rec === null && dd[6].hours === 0 && dd[0].hours === 9.5 && dd[0].checkIn === '09:00' && dd[0].breakMinutes === 60 && !dd[0].trip && weekDetail([rec('2026-10-19', 8, { isBusinessTrip: true })], '2026-10-19')[0].trip === true, '기록이 없는 날은 빈 칸, 있는 날은 출퇴근·휴게·시간·출장');
// ── 인사 홈 신호
const workers = [{ id: 'a', name: '가' }, { id: 'b', name: '나' }, { id: 'c', name: '다' }, { id: 'd', name: '라', status: 'resigned' }, { id: 'e', name: '마' }];
const days = (h, n, start) => Array.from({ length: n }, (_, i) => rec(addDays(start, i), h / n));
const mk = (id, h, n, start, name) => days(h, n, start).map((r) => Object.assign({ workerId: id, name: name || id }, r));
const rows = [].concat(mk('a', 46, 5, '2026-10-19'), mk('a', 38, 5, '2026-10-12'), mk('b', 53, 6, '2026-10-12'), mk('b', 10, 2, '2026-10-19'), mk('c', 48, 6, '2026-10-19'), mk('c', 48, 6, '2026-10-12'), mk('d', 60, 6, '2026-10-19'), mk('f', 55, 6, '2026-10-19', '삭제된직원'), mk('g', 30, 4, '2026-10-05'));
const rep = weeklyReport(workers, rows, '2026-10-25');
ok(rep.thisStart === '2026-10-19' && rep.lastStart === '2026-10-12' && rep.today === '2026-10-25', '오늘이 일요일(10-25)이면 이번 주는 10-19 시작, 지난주는 10-12 시작');
ok(rep.items.map((i) => i.workerId + ':' + i.which + ':' + i.stage).join() === 'f:this:over,b:last:over,c:this:warn,c:last:warn,a:this:notice', '목록: 52 초과(55h → 53h) → 경고(48h 두 주, 이번 주 먼저) → 주의, 같은 단계는 시간 많은 순, 같은 시간은 이번 주 먼저');
ok(!rep.items.some((i) => i.workerId === 'd') && !rep.items.some((i) => i.workerId === 'g') && !rep.items.some((i) => i.workerId === 'e'), '퇴사자(60h)·두 주 밖 기록(g)·기록 없는 직원(e)은 목록에 없다');
ok(rep.items.find((i) => i.workerId === 'f').name === '삭제된직원' && rep.items.find((i) => i.workerId === 'a').name === '가', '직원 명부에 없는 사람은 기록에 적힌 이름으로, 있는 사람은 명부 이름으로');
ok(rep.withData === 4 && rep.items.find((i) => i.workerId === 'a').total === 46 && rep.items.find((i) => i.workerId === 'b').ot === 13 && rep.items.find((i) => i.workerId === 'b').otRemain === -1, '기록이 있는 직원 수(a·b·c·f = 4명, 퇴사자 제외)와 합계·연장·남은 연장');
const rep2 = weeklyReport(workers, rows, '2026-10-26'); ok(rep2.thisStart === '2026-10-26' && rep2.lastStart === '2026-10-19' && !rep2.items.some((i) => i.which === 'this') && rep2.items.some((i) => i.workerId === 'c' && i.which === 'last'), '월요일(10-26)이 되면 새 주가 시작돼 이번 주 기록은 없고 지난주가 10-19 주로 바뀐다');
const rep3 = weeklyReport([], [], '2026-10-25'); ok(rep3.items.length === 0 && rep3.withData === 0 && weeklyReport(null, null, '2026-10-25').items.length === 0, '기록이 없으면 빈 목록(0명)');
const rep4 = weeklyReport(workers, [{ date: '2026-10-20', workHours: 60 }], '2026-10-25'); ok(rep4.items.length === 0, '직원 표시(workerId)가 없는 기록은 무시');
// ── 의심스러운 하루 기록(실제 본섭에서 발견: 20:08~20:08 → 24시간)
ok(SUSPECT_DAY_HOURS === 16 && isSuspectDay(rec('2026-10-01', 24, { checkIn: '20:08', checkOut: '20:08' })) && isSuspectDay(rec('2026-10-01', 16.01)) && !isSuspectDay(rec('2026-10-01', 16)) && !isSuspectDay(rec('2026-10-01', 12)) && isSuspectDay(rec('2026-10-01', 8, { checkIn: '09:00', checkOut: '09:00' })) && !isSuspectDay(rec('2026-10-01', 8, { checkIn: '', checkOut: '' })) && !isSuspectDay(null) && !isSuspectDay({}), '의심 기록: 하루 16시간 초과(16.01h)·출근=퇴근 시각, 정확히 16시간·시각이 비어 있는 기록·빈 값은 아님');
const sus = weekSummary([rec('2026-10-19', 8), rec('2026-10-20', 24, { checkIn: '20:08', checkOut: '20:08' }), rec('2026-10-21', 17)], '2026-10-19');
ok(sus.total === 49 && sus.suspect === 2 && sus.stage === 'warn' && weekSummary(W, '2026-10-19').suspect === 0 && weekSummary([], '2026-10-19').suspect === 0, '의심 기록은 합계에서 빼지 않고(24h 그대로 합산) 건수만 센다 — 정상 주는 0건, 자료 없는 주도 0건');
ok(weekDetail([rec('2026-10-19', 24, { checkIn: '20:08', checkOut: '20:08' }), rec('2026-10-20', 8)], '2026-10-19').map((d) => d.suspect).join() === 'true,false,false,false,false,false,false', '일별 내역에 의심 표시(그 날만)');
ok(weeklyReport([{ id: 'a', name: '가' }], [].concat(mk('a', 46, 5, '2026-10-19')).concat([Object.assign({ workerId: 'a', name: 'a' }, rec('2026-10-24', 24, { checkIn: '20:08', checkOut: '20:08' }))]), '2026-10-25').items[0].suspect === 1, '홈 신호 항목에도 의심 건수가 전달된다');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
