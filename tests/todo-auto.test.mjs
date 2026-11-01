// 2026-11-01 대표님 결정: 일정에서 시간을 입력하지 않으면 자동으로 「할 일」로 등록하고, 할 일은 00~24시로 잡는다
// (PJT 일정 · 회사/개인 일정 · 영업기획·재무회계 일정). Outlook 변환은 portal-functions/outlook-sync 의 시험이 맡는다.
import { buildDoc } from '../app/modules/pjt/schedule.js';
import { toCompanyDoc, validateDraft, fmtRange } from '../app/modules/calendar/logic.js';
import { SCHEDULE_CONFIG, buildScheduleDoc, scheduleEnabledFor } from '../app/shared/schedule-logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── PJT 일정: 새 입력 창은 시작·종료가 00시 00분으로 열린다
const F = (o) => Object.assign({ text: '자재 반입', sdate: '2026-11-05', edate: '2026-11-05', tag: 'in', sh: '00', sm: '00', eh: '00', em: '00', isTodo: false }, o || {});
let r = buildDoc(F(), { today: '2026-11-05' });
ok(r.data && r.data.isTodo === true && r.data.stime === '00:00' && r.data.etime === '24:00', 'PJT: 시간을 안 정하면(00:00~00:00) 자동으로 할 일, 00:00~24:00 으로 저장');
r = buildDoc(F({ sh: '09', sm: '00', eh: '10', em: '30' }), { today: '2026-11-05' });
ok(r.data.isTodo === false && r.data.stime === '09:00' && r.data.etime === '10:30', 'PJT: 시간을 정하면 할 일이 아님(그대로 저장)');
r = buildDoc(F({ sh: '09', sm: '00', eh: '00', em: '00' }), { today: '2026-11-05' });
ok(r.data.isTodo === false && r.data.stime === '09:00', 'PJT: 시작 시간만 정해도 시간 일정(자동 할 일 아님)');
r = buildDoc(F({ isTodo: true, sh: '09', eh: '10' }), { today: '2026-11-05' });
ok(r.data.isTodo === true && r.data.stime === '00:00' && r.data.etime === '24:00', 'PJT: 「할 일」을 직접 켜면 입력된 시간과 관계없이 00:00~24:00');
r = buildDoc(F({ edate: '2026-11-08', eh: '24', em: '00' }), { today: '2026-11-05' });
ok(r.data.isTodo === true && r.data.sdate === '2026-11-05' && r.data.edate === '2026-11-08', 'PJT: 여러 날 + 시간 없음 → 여러 날 할 일(00시~24시)');
// ── 회사·개인 일정(calendar)
const D = (o) => Object.assign({ title: '월 점검', tag: 'meeting', start: '2026-11-05', end: '', isTodo: false, startTime: '', endTime: '', place: '', memo: '' }, o || {});
const me = { name: '홍길동', email: 'hong@jhsol.kr' };
ok(toCompanyDoc(D(), me).isTodo === true && toCompanyDoc(D(), me).stime === null && toCompanyDoc(D(), me).etime === null, '회사 일정: 시각을 둘 다 비우면 자동으로 할 일');
ok(toCompanyDoc(D({ startTime: '09:00', endTime: '10:00' }), me).isTodo === false && toCompanyDoc(D({ startTime: '09:00', endTime: '10:00' }), me).stime === '09:00', '회사 일정: 시각을 쓰면 할 일이 아님');
ok(toCompanyDoc(D({ isTodo: true, startTime: '09:00', endTime: '10:00' }), me).isTodo === true && toCompanyDoc(D({ isTodo: true, startTime: '09:00', endTime: '10:00' }), me).stime === null, '회사 일정: 「할 일」을 켜면 시각은 버림');
ok(!validateDraft(D()).time && !!validateDraft(D({ startTime: '09:00' })).time && !!validateDraft(D({ endTime: '10:00' })).time, '회사 일정: 시각을 둘 다 비우는 것은 오류가 아니고(할 일), 한쪽만 쓰면 오류');
ok(fmtRange({ start: '2026-11-05', end: '2026-11-05', isTodo: true, startTime: null }) === '00~24시' && fmtRange({ start: '2026-11-05', end: '2026-11-07', isTodo: true }) === '11/05~11/07', '일정 표시: 할 일은 "00~24시", 여러 날이면 날짜만');
ok(fmtRange({ start: '2026-11-05', end: '2026-11-05', startTime: '09:00', endTime: '10:00' }) === '09:00~10:00' && fmtRange({ start: '2026-11-05', end: '2026-11-05' }) === '종일', '시간 일정·시간 없는 옛 종일 일정의 표시는 그대로');
// ── 휴무·연차는 지금처럼(자동 할 일 제외, 2026-11-01 대표님 결정)
r = buildDoc(F({ tag: 'off' }), { today: '2026-11-05' });
ok(r.data.isTodo === false && r.data.tag === 'off', 'PJT: 휴무 구분은 시간이 없어도 할 일로 바꾸지 않음');
r = buildDoc(F({ tag: 'off', isTodo: true }), { today: '2026-11-05' });
ok(r.data.isTodo === true, 'PJT: 휴무라도 「할 일」을 직접 켜면 할 일(직접 선택은 존중)');
ok(toCompanyDoc(D({ tag: 'off' }), me).isTodo === false && toCompanyDoc(D({ tag: 'leave' }), me).isTodo === false, '회사 일정: 휴무·연차 구분은 시각이 없어도 할 일로 바꾸지 않음');
// ── 영업기획·재무회계 일정
const P = SCHEDULE_CONFIG.plan; const B = (o) => Object.assign({ text: '견적서 작성', sdate: '2026-11-05', edate: '', stime: '', etime: '', tag: 'est', place: '', memo: '', isTodo: false }, o || {});
ok(buildScheduleDoc(B(), P, { uid: 'u' }).doc.isTodo === true, '영업기획: 시간을 안 쓰면 자동으로 할 일');
ok(buildScheduleDoc(B({ stime: '09:00', etime: '10:00' }), P, { uid: 'u' }).doc.isTodo === false && buildScheduleDoc(B({ stime: '09:00' }), P, { uid: 'u' }).doc.isTodo === false, '영업기획: 시작 시간만 써도 시간 일정');
ok(!!buildScheduleDoc(B({ etime: '10:00' }), P, { uid: 'u' }).error && buildScheduleDoc(B({ etime: '10:00' }), P, { uid: 'u' }).error.includes('시작 시간'), '영업기획: 종료 시간만 쓰면 여전히 오류(할 일로 바꾸지 않음)');
ok(buildScheduleDoc(B({ isTodo: true, stime: '09:00' }), P, { uid: 'u' }).doc.stime === '', '영업기획: 할 일은 시간을 버림');
ok(scheduleEnabledFor('/portal-test/app/') && scheduleEnabledFor('/portal-test') && !scheduleEnabledFor('/app/') && !scheduleEnabledFor('/') && !scheduleEnabledFor(undefined), '영업기획·재무회계 일정 화면은 테섭 주소에서만 열림(본섭은 준비 중)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
