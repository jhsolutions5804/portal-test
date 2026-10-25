import { RET_DEFAULT, RET_MIN, RET_MAX, PURGE_SOON, PURGE_STATES, retentionOf, purgeInfo, purgeDayText, purgeReport, destroyDoc, settingsPatch } from '../app/modules/hr/recruit-purge.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const P = (o) => Object.assign({ id: 'j1', title: '사무직', status: 'open', decidedDate: '2026-10-01', retentionDays: 90 }, o || {});
const A = (o) => Object.assign({ id: 'a1', jobKey: 'j1', status: 'new', name: '가나다', phone: '010-1111-2222' }, o || {});
ok(RET_DEFAULT === 90 && RET_MIN === 14 && RET_MAX === 180 && PURGE_SOON === 14, '기준: 기본 90일, 법 범위 14~180일, 임박 14일');
ok(retentionOf(P()) === 90 && retentionOf(P({ retentionDays: 14 })) === 14 && retentionOf(P({ retentionDays: 180 })) === 180 && retentionOf(P({ retentionDays: 13 })) === 90 && retentionOf(P({ retentionDays: 181 })) === 90 && retentionOf(P({ retentionDays: '60' })) === 60 && retentionOf(P({ retentionDays: 45.5 })) === 90 && retentionOf({}) === 90 && retentionOf(null) === 90 && retentionOf(P({ retentionDays: 'x' })) === 90, '보관기간: 14~180 정수만 인정, 아니면 기본 90일(문자 숫자는 인정)');
// 확정일 2026-10-01 + 90일 = 2026-12-30
const at = (t, a, p) => purgeInfo(a || A(), p === undefined ? P() : p, t);
ok(at('2026-10-25').state === 'ok' && at('2026-10-25').dueDate === '2026-12-30' && at('2026-10-25').days === 66 && at('2026-10-25').retention === 90, '확정일 10-01 + 90일 = 파기 예정일 12-30 (오늘 10-25 → D-66, 예정)');
ok(at('2026-12-16').state === 'soon' && at('2026-12-15').state === 'ok' && at('2026-12-30').state === 'soon' && at('2026-12-30').days === 0, '임박: 예정일 14일 전(12-16)부터, 예정일 당일(12-30)까지도 아직 "임박"(반환 청구 가능)');
ok(at('2026-12-31').state === 'due' && at('2026-12-31').days === -1 && at('2027-03-01').state === 'due', '기한 지남: 예정일 다음 날(12-31)부터');
ok(purgeDayText(at('2026-10-25')) === 'D-66' && purgeDayText(at('2026-12-30')) === 'D-day' && purgeDayText(at('2026-12-31')) === 'D+1' && purgeDayText({ days: null }) === '' && purgeDayText(null) === '', 'D-day 글자');
ok(at('2026-12-31', A({ status: 'pass' })).state === 'kept' && at('2026-12-31', A({ status: 'fail' })).state === 'due' && at('2026-12-31', A({ status: 'review' })).state === 'due' && at('2026-12-31', A({ status: '이상한값' })).state === 'due', '합격자는 기한이 지나도 파기 제외, 불합격·검토중·신규는 대상');
ok(at('2026-12-31', A({ status: 'destroyed' })).state === 'done' && at('2026-12-31', A({ status: 'destroyed' })).dueDate === '' , '이미 파기된 지원서는 "파기 완료"');
ok(at('2026-12-31', A(), null).state === 'nolink' && at('2026-12-31', A(), P({ decidedDate: '' })).state === 'nodate' && at('2026-12-31', A(), P({ decidedDate: undefined })).state === 'nodate' && at('2026-12-31', A(), P({ decidedDate: '2026-1-5' })).state === 'nodate' && at('2026-12-31', A(), P({ decidedDate: '2026-10-01' })).state === 'due', '공고가 없으면 공고 없음, 채용 확정일이 없거나 형식이 이상하면 "확정일 미입력"(파기 대상 아님)');
ok(at('2026-10-25', A(), P({ retentionDays: 30 })).dueDate === '2026-10-31' && at('2026-10-25', A(), P({ decidedDate: '2026-09-01', retentionDays: 14 })).state === 'due' && at('2026-10-25', A(), P({ retentionDays: 999 })).dueDate === '2026-12-30' && at('2026-10-25', A(), P({ decidedDate: '2026-12-31' })).dueDate === '2027-03-31', '공고별 보관기간·월 경계·범위 밖 값은 기본값으로');
ok(at('', A(), P()).state === 'nodate' && at(undefined, A(), P()).state === 'nodate', '오늘 날짜가 이상하면 기한 지남으로 단정하지 않는다(파기 대상 아님)');
ok(Object.keys(PURGE_STATES).join() === 'due,soon,nodate,nolink,ok,kept,done' && PURGE_STATES.due.mark === '🔴' && PURGE_STATES.soon.mark === '🟠' && PURGE_STATES.due.rank > PURGE_STATES.soon.rank, '상태 표시(기호·글자·순서)');
// ── 전체 현황
const posts = [P(), P({ id: 'j2', title: '현장직', decidedDate: '' }), P({ id: 'j3', title: '지원자 없음', decidedDate: '2026-10-20' })];
const apps = [A({ id: 'a1' }), A({ id: 'a2', status: 'pass' }), A({ id: 'a3', jobKey: 'j2' }), A({ id: 'a4', jobKey: 'ghost' }), A({ id: 'a5', status: 'destroyed' }), A({ id: 'a6', jobKey: '' }), null];
const r = purgeReport(apps, posts, '2026-12-31');
ok(r.counts.due === 1 && r.counts.kept === 1 && r.counts.nodate === 1 && r.counts.nolink === 2 && r.counts.done === 1 && r.counts.ok === 0 && r.counts.soon === 0 && r.rows.length === 6 && r.pending === 4, '현황: 기한 지남 1·합격자 1·확정일 미입력 1·공고 없음 2·파기 완료 1, 처리 필요 4건(null 항목은 무시)');
ok(r.byPosting.length === 4 && r.byPosting[0].postingId === 'j1' && r.byPosting[0].total === 3 && r.byPosting[0].due === 1 && r.byPosting[0].kept === 1 && r.byPosting[0].done === 1 && r.byPosting[1].nodate === 1 && r.byPosting[2].total === 0 && r.byPosting[3].postingId === '(없음)' && r.byPosting[3].total === 2 && r.byPosting[3].posting === null, '공고별: 공고마다 한 줄(지원자 없는 공고도), 공고 없는 지원서는 "(없음)" 줄');
ok(purgeReport(null, null, '2026-12-31').rows.length === 0 && purgeReport([], [], '2026-12-31').pending === 0 && purgeReport([A()], [], '2026-12-31').counts.nolink === 1, '자료가 비어도 깨지지 않는다');
// ── 파기 뒤 최소 기록
const full = { id: 'a1', jobKey: 'j1', jobTitle: '사무직', status: 'review', createdAt: { seconds: 1760000000 }, name: '가나다', phone: '010-1111-2222', email: 'a@b.c', address: '서울시', birth: '1990-01-01', gender: '여', eduLevel: '대졸', educations: [{ school: 'X' }], careers: [{ co: 'Y' }], certs: ['Z'], military: { branch: '육군' }, notes: '특이사항', interviewAt: '2026-10-20T10:00' };
const d = destroyDoc(full, ' Admin@JHSOL.kr ', '2026-12-31T00:00:00Z');
ok(Object.keys(d).sort().join() === 'createdAt,destroyedAt,destroyedBy,jobKey,jobTitle,prevStatus,reason,status' && d.status === 'destroyed' && d.destroyedBy === 'admin@jhsol.kr' && d.destroyedAt === '2026-12-31T00:00:00Z' && d.prevStatus === 'review' && d.jobKey === 'j1' && d.jobTitle === '사무직' && d.createdAt.seconds === 1760000000 && d.reason === 'retention', '파기 기록: 남는 것은 8개 항목뿐(공고·접수 시각·파기일·파기한 사람·이전 상태)');
const dump = JSON.stringify(d); ok(!['가나다', '010-1111', 'a@b.c', '서울시', '1990', '대졸', '육군', '특이사항', 'educations', 'careers', 'phone', 'email', 'address', 'birth', 'name', 'notes', 'interviewAt'].some((x) => dump.includes(x)), '파기 기록에 이름·연락처·메일·주소·생년월일·학력·경력·병역·메모·면접 일정이 하나도 남지 않는다');
ok(destroyDoc(null, '', 'x').status === 'destroyed' && destroyDoc({}, undefined, 'x').destroyedBy === '' && destroyDoc({ status: 'weird' }, 'a', 'x').prevStatus === 'new', '빈 입력·이상한 이전 상태도 깨지지 않는다');
// ── 공고 설정 검사
const sp = settingsPatch;
ok(sp('2026-10-01', '90').ok && sp('2026-10-01', '90').data.retentionDays === 90 && sp('2026-10-01', 14).data.retentionDays === 14 && sp('2026-10-01', '180').ok && sp('2026-10-01', '').data.retentionDays === 90 && sp('', '').data.decidedDate === '' && sp(null, null).data.retentionDays === 90, '설정 저장값: 14·180 허용, 보관기간을 비우면 기본 90일, 확정일을 비우면 지움');
ok(!sp('2026-10-01', '13').ok && !sp('2026-10-01', '181').ok && !sp('2026-10-01', '90.5').ok && !sp('2026-10-01', '-5').ok && !sp('2026-10-01', '열흘').ok && !sp('2026-10-01', '0').ok && sp('2026-10-01', '13').errors[0].includes('14~180일'), '법 범위 밖(13·181)·소수·음수·글자는 거부하고 이유를 알려 준다');
ok(!sp('2026/10/01', '90').ok && !sp('2026-13-40x', '90').ok && sp('2026/10/01', '90').errors[0].includes('채용 확정일') && sp('x', 'y').errors.length === 2, '확정일 형식 오류와 두 칸 모두 틀린 경우');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
