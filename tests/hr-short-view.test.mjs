import { shortTypeCardHtml, shortFormCardsHtml, FORM_TYPES } from '../app/modules/hr/short-view.js';
import { laborFormHtml } from '../app/modules/hr/view.js';
import { shortInit } from '../app/modules/hr/short-doc.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const base = { workerId: 'w1', name: '김가나', jumin: '9501011234567', phone: '', address: '', dept: '', rank: '', job: '사무 보조', empType: 'office', startDate: '2026-10-13', endDate: '2026-10-30', contractDate: '2026-10-27', hourly: '10320', salary: '', signData: null, payBasis: 'hourly', payInput: '' };
const on = (f, days, s, e, b) => { days.forEach((d) => { const r = f.sched.find((x) => x.day === d); r.on = true; r.start = s; r.end = e; r.breakMin = b || 0; }); return f; };
const st = (f, o) => Object.assign({ aView: 'form', aForm: f, aSal: { basic: 0, weekly: 0, total: 0, annual: 0 }, aWorkers: [{ id: 'w1', name: '김가나', empNo: 'A-1', status: 'active' }], aSigning: false, aErrs: [] }, o || {});
// ── 근로 형태 선택
const t0 = shortTypeCardHtml({ workType: 'regular' }), t1 = shortTypeCardHtml({ workType: 'short' }), tU = shortTypeCardHtml({});
ok(FORM_TYPES.length === 2 && (t0.match(/data-an-ftype=/g) || []).length === 2 && t0.includes('data-an-ftype="regular" aria-pressed="true"') && t0.includes('data-an-ftype="short" aria-pressed="false"'), '근로 형태: 두 단추, 일반이 눌려 있음');
ok(t1.includes('data-an-ftype="short" aria-pressed="true"') && t1.includes('data-an-ftype="regular" aria-pressed="false"') && tU.includes('data-an-ftype="regular" aria-pressed="true"') && shortTypeCardHtml(null).includes('data-an-ftype'), '근로 형태: 단시간을 고르면 단시간이 눌림, 값이 없거나 null 이어도 일반으로');
ok(t0.includes('기간제법 제17조') && t0.includes('근로일(요일)과 근로일별 근로시간') && !t0.includes('data-an-sday'), '근로 형태: 법 근거 안내, 요일 칸은 아직 없음');
// ── 단시간 카드
const f = on(shortInit(Object.assign({}, base, { maxWeekly: '14', payDay: '익월 말일', extra: '교육 기간' })), ['화', '수', '목', '금'], '13:00', '16:00');
const H = shortFormCardsHtml(f, []);
ok(['월', '화', '수', '목', '금', '토', '일'].every((d) => H.includes('data-an-sday="' + d + '"')) && (H.match(/data-an-sday=/g) || []).length === 7 && (H.match(/data-an-dayrow=/g) || []).length === 7, '근로일 표: 월~일 7줄, 줄마다 요일 단추');
ok(['화', '수', '목', '금'].every((d) => H.includes('data-an-sday="' + d + '" aria-pressed="true"')) && ['월', '토', '일'].every((d) => H.includes('data-an-sday="' + d + '" aria-pressed="false"')), '켜진 요일은 눌림(화~금), 꺼진 요일은 안 눌림');
ok(H.includes('data-an-sf="화:start" value="13:00"') && H.includes('data-an-sf="금:end" value="16:00"') && H.includes('data-an-sf="목:breakMin" value="0"') && H.includes('type="time"') && H.includes('aria-label="수요일 시작 시각"') && H.includes('aria-label="목요일 휴게시간(분)"'), '켜진 요일: 시작·종료·휴게 칸에 값, 시각 입력(time), 칸마다 읽기용 이름');
ok(/data-an-sf="월:start" value="" aria-label="월요일 시작 시각" disabled/.test(H) && /data-an-sf="일:breakMin" value="" aria-label="일요일 휴게시간\(분\)" placeholder="휴게\(분\)" disabled/.test(H) && !/data-an-sf="화:start"[^>]*disabled/.test(H), '꺼진 요일의 칸은 비활성, 켜진 요일은 활성');
ok(H.includes('주 소정근로시간 12시간') && H.includes('월 환산 약 52.1시간') && H.includes('15시간 미만') && H.includes('60시간 미만'), '합계: 주 12시간·월 52.1시간과 15시간 미만·60시간 미만 안내');
ok(H.includes('data-an-f="workPlace"') && H.includes('data-an-f="maxWeekly" value="14"') && H.includes('data-an-f="payDay" value="익월 말일"') && H.includes('>교육 기간</textarea>') && H.includes('data-an-pay value="10,320"') && H.includes('2026년 최저시급 10,320원 이상'), '다른 칸: 근무장소·초과 한도 14·지급일·특약·시급 10,320·2026 최저시급 안내');
ok(!H.includes('role="alert"') && !H.includes('저장하기 전에'), '오류가 없으면 빨간 안내는 없다');
const E = shortFormCardsHtml(f, ['월요일: 시각을 입력해 주세요.', '<img src=x onerror=1>']); ok(E.includes('role="alert"') && E.includes('저장하기 전에 고쳐 주세요') && E.includes('<li>월요일: 시각을 입력해 주세요.</li>') && !E.includes('<img src=x') && E.includes('&lt;img'), '저장이 막히면 이유를 목록으로 보이고 위험한 글자는 막는다');
const blank = shortFormCardsHtml(shortInit(Object.assign({}, base)), []); ok(blank.includes('근로일을 눌러 켜고') && !blank.includes('주 소정근로시간') && (blank.match(/disabled/g) || []).length === 21, '아무 요일도 안 켰을 때: 안내 문구, 21칸(7요일×3칸) 모두 비활성');
const X = shortFormCardsHtml(Object.assign({}, f, { workPlace: '"><script>1</script>', payDay: '"><b>x', extra: '</textarea><script>2</script>', hourly: '10320' }), []); ok(!X.includes('<script>') && !X.includes('"><b>') && X.includes('&lt;/textarea&gt;'), '★ 근무장소·지급일·특약에 넣은 HTML 은 칸 안에서 글자로만 남는다(칸을 깨지 못함)');
ok(shortFormCardsHtml({}, null).includes('data-an-sday="월"') && shortFormCardsHtml(null, undefined).includes('data-an-sday="일"') && shortFormCardsHtml({ sched: 'x' }, []).includes('data-an-sday="수"'), '비어 있거나 이상한 입력도 예외 없이 7요일을 그린다');
ok(shortFormCardsHtml({ startDate: '2027-02-01' }, []).includes('해당 연도의 최저시급 이상') && shortFormCardsHtml({ startDate: '2026-02-01' }, []).includes('2026년 최저시급'), '최저시급 안내: 모르는 연도는 일반 문구');
// ── 근로계약서 전체 화면
const short = laborFormHtml(st(f)), reg = laborFormHtml(st(Object.assign({}, base, { workType: 'regular' }))), none = laborFormHtml(st(Object.assign({}, base)));
ok(short.includes('data-an-ftype="short" aria-pressed="true"') && short.includes('근로일 및 근로일별 근로시간') && short.includes('💰 시급') && !short.includes('💰 급여 입력') && !short.includes('data-an-basis'), '★ 단시간: 근로 형태·근로일 표·시급 카드, 일반 급여 입력(시급/월급/연봉 전환)은 없다');
ok(reg.includes('data-an-ftype="regular" aria-pressed="true"') && reg.includes('💰 급여 입력') && reg.includes('data-an-basis="monthly"') && !reg.includes('data-an-sday') && !reg.includes('근로일 및 근로일별 근로시간') && none.includes('💰 급여 입력') && !none.includes('data-an-sday'), '★ 일반 근로자(또는 형태 미지정): 예전과 같은 급여 입력 카드, 단시간 칸은 없다');
ok(['data-an-act="preview"', 'data-an-act="save"', 'data-an-act="sign-link"', 'data-an-act="mail"'].every((a) => short.includes(a) && reg.includes(a)), '미리보기·확정 저장·원격 서명 링크·이메일 단추는 두 형태 모두 그대로');
const idx = (h, k) => h.indexOf(k); ok(idx(short, '👤 근로자 선택') < idx(short, '🧾 근로 형태') && idx(short, '🧾 근로 형태') < idx(short, '📅 계약 기간') && idx(short, '📅 계약 기간') < idx(short, '💼 담당 업무') && idx(short, '💼 담당 업무') < idx(short, '🕒 근로일') && idx(short, '💰 시급') < idx(short, '✍️ 근로자 서명'), '카드 순서: 근로자 → 형태 → 계약 기간 → 담당 업무 → 근로일 → 시급 → 서명');
const noWorker = laborFormHtml(st(Object.assign({}, base, { name: '' }))); ok(noWorker.includes('data-an-worker') && !noWorker.includes('data-an-ftype'), '근로자를 아직 안 골랐으면 근로자 선택만 보인다(형태 선택은 그 뒤)');
const withErr = laborFormHtml(st(f, { aErrs: ['시급을 입력해 주세요.'] })); ok(withErr.includes('시급을 입력해 주세요.') && withErr.includes('role="alert"'), '화면 전체에서도 저장이 막힌 이유가 보인다');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
