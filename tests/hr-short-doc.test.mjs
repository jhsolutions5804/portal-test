import { SHORT_TPL_VER, SHORT_SIGN_ERROR, DAYS, toMin, shortNewSched, shortInit, dayMinutes, selectedDays, weeklyHours, monthlyHours, shortInsurance, shortCheck, shortRecord, shortHtml, configureShortDoc, MIN_HOURLY, COMPANY } from '../app/modules/hr/short-doc.js';
import { laborDocHtml, configureLaborDocs } from '../app/modules/hr/labor-doc.js';
import { __LABOR_TPL } from '../app/modules/hr/frozen-docs.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const mk = (o) => { const f = shortInit(Object.assign({ workerId: 'w1', name: '김가나', jumin: '9501011234567', phone: '010-1111-2222', address: '경기 평택시 가나로 1', startDate: '2026-10-13', endDate: '2026-10-30', contractDate: '2026-10-27', job: '사무 보조 및 직무 교육', hourly: '10320', payDay: '익월 말일', maxWeekly: '14' }, o && o.base)); (o && o.days || ['화', '수', '목', '금']).forEach((d) => { const r = f.sched.find((x) => x.day === d); r.on = true; r.start = (o && o.start) || '13:00'; r.end = (o && o.end) || '16:00'; r.breakMin = (o && o.brk) || 0; }); return f; };
const errs = (f) => shortCheck(f).errors.join(' | ');
// ── 기본 함수
ok(SHORT_TPL_VER === 's1' && DAYS.join('') === '월화수목금토일' && MIN_HOURLY[2026] === 10320, '양식 버전 s1·요일 7개·2026 최저시급 10,320');
ok(toMin('13:00') === 780 && toMin('9:05') === 545 && toMin('00:00') === 0 && Number.isNaN(toMin('24:00')) && Number.isNaN(toMin('13:60')) && Number.isNaN(toMin('')) && Number.isNaN(toMin('1300')) && Number.isNaN(toMin(null)) && Number.isNaN(toMin('abc')), '시각 읽기: HH:MM 만(24:00·13:60·빈칸·글자는 틀림)');
ok(shortNewSched().length === 7 && shortNewSched().every((r) => !r.on && r.breakMin === 0), '새 시간표: 7요일 모두 꺼짐');
const f = mk(); ok(selectedDays(f).map((r) => r.day).join('') === '화수목금' && weeklyHours(f) === 12 && monthlyHours(f) === 52.1 && dayMinutes(f.sched[1]) === 180, '화~금 13:00~16:00 → 주 12시간·월 52.1시간·하루 180분');
ok(dayMinutes({ start: '09:00', end: '18:00', breakMin: 60 }) === 480 && Number.isNaN(dayMinutes({ start: '18:00', end: '09:00' })) && Number.isNaN(dayMinutes({ start: '09:00', end: '12:00', breakMin: -5 })) && Number.isNaN(dayMinutes({ start: '', end: '' })), '하루 근로분: 종료−시작−휴게, 거꾸로·음수 휴게·빈칸은 계산 불가');
ok(shortInsurance(f).exempt === true && shortInsurance(f).accident === true && shortInsurance(mk({ days: ['월', '화', '수', '목', '금'], start: '09:00', end: '14:00', brk: 30 })).exempt === false, '4대보험: 월 60시간 미만이면 연금·건강·고용 제외(산재는 항상), 이상이면 가입 대상');
const b13 = mk({ start: '13:00', end: '16:27' }), b14 = mk({ start: '13:00', end: '16:28' });
ok(weeklyHours(b13) === 13.8 && monthlyHours(b13) === 60 && shortInsurance(b13).exempt === true && weeklyHours(b14) > 13.8 && shortInsurance(b14).exempt === false, '★ 경계: 주 13.8시간(실제 월 59.96시간)은 표시가 60.0 이어도 제외 대상, 13.87시간(월 60.25)은 가입 대상');
// ── 저장 전 검사
ok(shortCheck(f).ok && shortCheck(f).errors.length === 0 && shortCheck(f).warnings.some((w) => w.includes('15시간 미만')) && shortCheck(f).warnings.some((w) => w.includes('60시간 미만')), '정상 입력: 통과 + 15시간 미만·60시간 미만 안내');
ok(/근로일\(요일\)/.test(errs(mk({ days: [] }))) && /기간제법 제17조/.test(errs(mk({ days: [] }))), '★ 근로일을 하나도 안 고르면 저장 불가(기간제법 제17조 안내)');
for (const [label, base, key] of [['근로자 없음', { workerId: '', name: '' }, '근로자를 선택'], ['시작일 없음', { startDate: '' }, '시작일'], ['종료일이 시작일보다 앞', { endDate: '2026-10-01' }, '종료일이 시작일보다 앞'], ['작성일 없음', { contractDate: '' }, '작성일'], ['업무 없음', { job: ' ' }, '담당 업무'], ['근무장소 없음', { workPlace: '' }, '근무 장소'], ['시급 없음', { hourly: '' }, '시급을 입력'], ['지급일 없음', { payDay: '' }, '지급일'], ['시급 최저 미만', { hourly: '10319' }, '최저시급 10,320']]) ok(errs(mk({ base })).includes(key), '필수·검사: ' + label + ' → 막힘("' + key + '")');
ok(shortCheck(mk({ base: { hourly: '10320' } })).ok && shortCheck(mk({ base: { hourly: '12000' } })).ok && !shortCheck(mk({ base: { hourly: '0' } })).ok && !shortCheck(mk({ base: { hourly: '-5' } })).ok, '시급: 정확히 최저시급은 통과, 0·음수는 막힘');
ok(shortCheck(mk({ base: { startDate: '2027-01-02', endDate: '2027-02-01', hourly: '9000' } })).ok && shortCheck(mk({ base: { startDate: '2027-01-02', endDate: '2027-02-01', hourly: '9000' } })).warnings.some((w) => w.includes('2027년 최저시급')), '화면에 없는 연도는 막지 않고 "직접 확인" 안내만');
ok(shortCheck(mk({ base: { endDate: '' } })).ok, '종료일을 비워도 통과(기간을 정하지 않은 계약)');
const blank = mk(); blank.sched.forEach((r) => { r.start = ''; r.end = ''; });
ok(/시작·종료 시각/.test(errs(blank)) && /종료 시각이 시작 시각보다 늦어야/.test(errs(mk({ start: '16:00', end: '13:00' }))) && /종료 시각이 시작 시각보다 늦어야/.test(errs(mk({ start: '13:00', end: '13:00' }))), '시각: 빈칸·거꾸로·같음은 막힘');
ok(/4시간 이상이면 휴게 30분/.test(errs(mk({ start: '09:00', end: '13:00', brk: 0 }))) && !/휴게/.test(errs(mk({ start: '09:00', end: '13:00', brk: 30 }))) && /8시간 이상이면 휴게 1시간/.test(errs(mk({ days: ['월'], start: '09:00', end: '17:30', brk: 30 }))) && !/휴게/.test(errs(mk({ days: ['월'], start: '09:00', end: '18:00', brk: 60 }))) && !/휴게/.test(errs(mk({ start: '13:00', end: '16:59', brk: 0 }))), '★ 휴게 규칙(근로기준법 제54조): 근로 4시간 이상 30분·8시간 이상 1시간, 3시간 59분은 휴게 없이 통과');
ok(/휴게시간\(분\)이 올바르지/.test(errs(mk({ start: '13:00', end: '14:00', brk: 90 }))) && /휴게시간\(분\)이 올바르지/.test(errs(mk({ start: '13:00', end: '14:00', brk: 1.5 }))), '휴게시간: 근로시간보다 길거나 소수면 막힘');
ok(/단시간 근로자가 아닙니다/.test(errs(mk({ days: ['월', '화', '수', '목', '금'], start: '09:00', end: '18:00', brk: 60 }))) && !/단시간 근로자가 아닙니다/.test(errs(mk({ days: ['월', '화', '수', '목', '금'], start: '09:00', end: '17:00', brk: 60 }))), '★ 주 40시간 이상이면 단시간이 아님 → 막힘(주 35시간은 통과)');
ok(/한도\(주 11시간\)가 주 소정근로시간\(12시간\)보다 작습니다/.test(errs(mk({ base: { maxWeekly: '11' } }))) && shortCheck(mk({ base: { maxWeekly: '12' } })).ok && shortCheck(mk({ base: { maxWeekly: '' } })).ok && !shortCheck(mk({ base: { maxWeekly: '0' } })).ok && shortCheck(mk({ base: { maxWeekly: '25' } })).warnings.some((w) => w.includes('12시간')), '초과근로 한도: 소정보다 작으면 막힘·같으면 통과·비워도 통과·0은 막힘·소정+12 초과는 안내');
ok(shortCheck(mk({ days: ['월', '화', '수', '목', '금'], start: '09:00', end: '14:00', brk: 30 })).warnings.some((w) => w.includes('4대보험 가입 대상')), '월 60시간 이상이면 "4대보험 가입 대상" 안내');
ok(!shortCheck(null).ok && !shortCheck({}).ok && Array.isArray(shortCheck(undefined).errors), '빈 입력도 오류 없이 막힘(예외 없음)');
// ── 저장 기록
const rec = shortRecord(f, '2026-10-26T00:00:00Z');
ok(rec.tplVer === 's1' && rec.workType === 'short' && rec.salary === 0 && rec.payBasis === 'hourly' && rec.savedAt === '2026-10-26T00:00:00Z' && rec.savedBy === 'admin' && !('sched' in rec), '기록: 양식 s1·단시간·연봉 0·시급 기준·저장 시각·입력용 sched 칸은 빠짐');
ok(rec.schedule.length === 4 && rec.schedule.every((r) => r.hours === 3 && r.start === '13:00' && r.end === '16:00' && r.breakMin === 0) && rec.weeklyHours === 12 && rec.monthlyHours === 52.1 && rec.maxWeekly === 14 && rec.insurance.pension === false && rec.insurance.accident === true, '기록: 선택한 4요일만·일별 3시간·주 12·월 52.1·초과 한도 14·산재만 가입');
ok(shortRecord(mk({ base: { maxWeekly: '' } })).maxWeekly === null && shortRecord(mk({ days: ['월'], start: '09:00', end: '12:30' })).schedule[0].hours === 3.5, '기록: 한도를 비우면 null, 3시간 30분은 3.5시간');
// ── 출력 HTML
const H = shortHtml(rec);
ok(H.includes('단시간 근로자 근로계약서') && H.includes('제3조 (근로일 및 근로일별 근로시간)') && ['화요일', '수요일', '목요일', '금요일'].every((d) => H.includes(d)) && !['월요일', '토요일', '일요일'].some((d) => H.includes(d)), '★ 출력: 근로일 및 근로일별 근로시간 표에 선택한 4요일만(월·토·일 없음)');
ok(H.includes('13:00') && H.includes('16:00') && H.includes('주 12시간') && H.includes('2026년 10월 13일') && H.includes('2026년 10월 30일') && H.includes('2026년 10월 27일') && H.includes('10,320') && H.includes('익월 말일') && H.includes('사무 보조 및 직무 교육'), '출력: 시각·주 12시간·계약기간·작성일·시급(쉼표)·지급일·업무');
ok(['제1조 (근로계약기간)', '제2조 (근무장소 및 업무)', '제5조 (휴게시간)', '제6조 (휴일)', '제7조 (임금)', '제8조 (사회보험)', '제9조 (연차유급휴가)'].every((s) => H.includes(s)), '★ 출력: 기간제법 제17조 항목(기간·장소·업무·휴게·휴일·임금·휴가)이 모두 있다');
ok(H.includes('15시간 미만') && H.includes('산업재해보상보험은 근로시간과 관계없이') && H.includes('14일 이내에 지급한다(근로기준법 제36조)') && H.includes('1주 총 근로시간은 14시간을 넘지 않는다') && H.includes('통상임금의 50%'), '출력: 주 15시간 미만 휴일·연차 제외, 산재만 가입, 퇴직 14일 지급, 초과근로 한도 14시간·50% 가산');
ok(H.includes('생년월일 950101') && !H.includes('1234567') && !H.includes('9501011'), '출력: 주민번호는 앞 6자리(생년월일)만 — 뒷자리는 인쇄하지 않는다');
const rec15 = shortRecord(mk({ days: ['월', '화', '수', '목', '금'], start: '09:00', end: '14:00', brk: 30 })); const H15 = shortHtml(rec15);
ok(H15.includes('유급휴일(주휴일)') && !H15.includes('주휴일과 연차유급휴가는 부여하지 않는다') && H15.includes('국민연금·건강보험·고용보험·산업재해보상보험에 관계 법령에 따라 가입한다') && H15.includes('비례하여 연차유급휴가'), '주 22.5시간 계약: 주휴일 부여·4대보험 가입·연차 비례 문구로 바뀐다');
ok(shortHtml(shortRecord(mk({ base: { endDate: '', maxWeekly: '' } }))).includes('종료일을 정하지 않음') && shortHtml(shortRecord(mk({ base: { maxWeekly: '' } }))).includes('초과근로에는 통상임금의 50%를 가산하여 지급한다') && !shortHtml(shortRecord(mk({ base: { maxWeekly: '' } }))).includes('시간을 넘지 않는다. 초과'), '종료일·초과 한도를 비우면 해당 문구가 알맞게 바뀐다');
const X = shortHtml(shortRecord(mk({ base: { name: '<script>alert(1)</script>', job: '"><img src=x onerror=1>', extra: '<b>특약</b>', address: "a'b<i>" } }))); ok(!X.includes('<script>alert') && !X.includes('<img src=x') && !X.includes('<b>특약') && X.includes('&lt;script&gt;') && X.includes('&lt;img'), '★ 이름·업무·특약·주소에 넣은 HTML 은 글자로만 출력된다');
const SIG = 'data:image/png;base64,iVBORw0KGgo='; ok(shortHtml(Object.assign({}, rec, { signData: SIG })).includes(SIG) && !shortHtml(Object.assign({}, rec, { signData: 'javascript:alert(1)' })).includes('javascript:') && !shortHtml(Object.assign({}, rec, { signData: 'data:text/html;base64,AAA=' })).includes('data:text/html') && shortHtml(Object.assign({}, rec, { signData: '"><script>1</script>' })).includes('border:1px dashed'), '서명 이미지: 진짜 이미지 주소만 넣고 javascript:·html·깨진 값은 빈 서명칸');
configureShortDoc({ signatures: { kjh: SIG } }); ok(shortHtml(rec).includes('대표 ' + COMPANY.rep) && shortHtml(rec).includes(SIG), '직인: 설정하면 대표 이름 옆에 들어간다'); configureShortDoc({ signatures: { kjh: 'javascript:x' } }); ok(!shortHtml(rec).includes('javascript:'), '직인 값이 이상하면 넣지 않는다'); configureShortDoc({ signatures: {} });
ok(shortHtml(null).includes('단시간 근로자 근로계약서') && shortHtml({}).includes('____년') && shortHtml({ schedule: 'x' }).includes('제3조'), '비어 있거나 이상한 문서도 예외 없이 그린다');
// ── 양식 연결(저장 당시 양식으로만)
ok(laborDocHtml(rec) === shortHtml(rec) && laborDocHtml(rec).includes('단시간 근로자 근로계약서'), '연결: tplVer s1 → 새 단시간 양식');
const old = { name: '이옛날', jumin: '9001011234567', phone: '', address: '', dept: '', rank: '', job: '현장', empType: 'field', startDate: '2026-09-01', endDate: '2026-12-31', contractDate: '2026-09-01', hourly: 10320, salary: 30000000, payBasis: 'hourly', signData: null, tplVer: 'v6' };
ok(laborDocHtml(old) === __LABOR_TPL.v6(old) && !laborDocHtml(old).includes('단시간 근로자 근로계약서'), '★ 연결: 기존 v6 문서는 동결 양식 그대로(한 글자도 다르지 않음)');
for (const v of ['v0', 'v2', 'v4', 'v5']) { const d = Object.assign({}, old, { tplVer: v }); ok(laborDocHtml(d) === __LABOR_TPL[v](d), '연결: ' + v + ' 문서도 동결 양식 그대로'); }
ok(laborDocHtml(Object.assign({}, old, { tplVer: undefined })).length > 1000, '연결: 양식 버전이 없는 옛 문서도 그려진다(예외 없음)');
configureLaborDocs({ signatures: { kjh: SIG }, logo: 'x.png' }); ok(laborDocHtml(rec).includes(SIG) && laborDocHtml(old).includes(SIG), '연결: 직인 설정은 새 양식과 동결 양식 모두에 들어간다'); configureLaborDocs({ signatures: {}, logo: '' });
// ── 화면 연결 코드(소스 글자 확인) — 연결을 잘못 걸면 연봉계약서까지 멈추므로 고정한다
const fs = await import('node:fs'); const src = (f) => fs.readFileSync(new URL('../app/modules/hr/' + f, import.meta.url), 'utf8'); const idx = src('index.js'), sio = src('sign-io.js'), vw = src('view.js');
const def = /const outHtml = \(d\) => \(K\.docHtml \? K\.docHtml\(d\) : docHtmlByVer\(K\.tpl, d\)\);/.exec(idx);
ok(!!def && !/const outHtml = [^;]*: outHtml\(/.test(idx), '★ 연결: outHtml 은 근로계약서면 laborDocHtml, 아니면 동결 양식(docHtmlByVer)을 부르고 자기 자신을 부르지 않는다(무한 반복 방지)');
ok((idx.match(/outHtml\(/g) || []).length === 2 && /const outHtml = /.test(idx) && !/openWin\(docHtmlByVer\(/.test(idx), '연결: 저장본 열기·미리보기가 모두 outHtml 을 거친다(동결 양식 직접 호출 없음)');
ok(/docHtml: laborDocHtml/.test(idx) && /f\.workType === 'short' \? shortRecord\(f\) : laborRecord\(f\)/.test(idx) && (idx.match(/docHtml: /g) || []).length === 1, '연결: 근로계약서만 새 양식·새 기록 함수를 쓰고 연봉계약서 설정은 그대로');
ok(/configureLaborDocs\(\{ signatures: seal/.test(sio) && /docType === 'annual' \? docHtmlByVer\(__ANNUAL_TPL, snapDoc\) : laborDocHtml\(snapDoc\)/.test(sio) && !/__LABOR_TPL/.test(sio), '연결: 원격 서명 링크도 근로계약서는 laborDocHtml, 연봉계약서는 동결 양식 그대로');
ok(!/configureFrozenDocs\(/.test(idx) && (idx.match(/configureLaborDocs\(/g) || []).length === 2, '연결: 직인·로고 설정 2곳 모두 새 연결 함수(동결 양식 설정도 함께 한다)');
ok(/checkForm\(st\.aForm\)/.test(idx) && /checkForm\(st\.aForm, true\)/.test(idx) && !/annualValidate\(st\.aForm/.test(idx) && /data-an-ftype/.test(idx) && /data-an-sday/.test(idx) && /data-an-sf/.test(idx), '연결: 링크·메일·저장·미리보기가 모두 checkForm(단시간이면 shortCheck)을 거치고 새 입력 3종을 처리한다');
ok(/shortTypeCardHtml\(f\) \+ period \+ job \+ \(f\.workType === 'short' \? shortFormCardsHtml\(f, st\.aErrs\) : pay\)/.test(vw), '연결: 화면에서 단시간이면 일반 급여 카드 대신 단시간 카드');
// ── 원격 서명 안전장치: 서명 페이지(sign.html)는 근로계약서를 항상 v6 로 그린다 → s1 은 서명 링크를 막고 열람 전용만 허용
const signHtml = fs.readFileSync(new URL('../sign.html', import.meta.url), 'utf8'); const gIdx = sio.search(/docType === 'labor' && src && src\.tplVer === SHORT_TPL_VER\) throw new Error\(SHORT_SIGN_ERROR\)/); const viewIdx = sio.indexOf('if (viewOnly) {'); const bsIdx = sio.indexOf('buildSignLink({', gIdx);
ok(/const buildHtml = link\.docType === 'annual' \? __annualHtml_v5 : __laborHtml_v6/.test(signHtml) && !/tplVer/.test(signHtml), '사실 확인: 공개 서명 페이지는 근로계약서를 항상 v6 로 그리고 양식 버전을 읽지 않는다(이 전제가 바뀌면 아래 안전장치를 다시 판단)');
ok(viewIdx > 0 && gIdx > viewIdx && bsIdx > gIdx && (sio.match(/SHORT_SIGN_ERROR/g) || []).length === 2, '★ 안전장치: 서명 링크(열람 전용 아님)를 만들기 전에 s1 이면 예외 — 링크 만드는 모든 경로(저장 목록·작성 화면·이메일)가 이 함수를 거친다');
ok(/if \(st\.aForm\.workType === 'short'\) \{ toast\(SHORT_SIGN_ERROR\); return; \}/.test(idx) && idx.indexOf('toast(SHORT_SIGN_ERROR)') < idx.indexOf('const v0 = checkForm'), '작성 화면: 단시간이면 저장하기 전에 안내하고 멈춘다');
ok(/열람 전용 링크/.test(SHORT_SIGN_ERROR) && /인쇄\(PDF\)/.test(SHORT_SIGN_ERROR) && SHORT_SIGN_ERROR.length < 220, '안내 문구: 대신 인쇄(PDF) 서명과 열람 전용 링크를 알려 준다');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
