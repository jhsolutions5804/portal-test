// 출퇴근 기록 화면 배치 시험(2026-11-04 대표님 요청): PC 에서는 왼쪽에 제목·요약 카드·직접 입력(세로로 쌓은 폼), 오른쪽에 월 기록 목록, 모바일은 위아래.
// 기능(월 선택·근로자 선택·입력 칸·저장·기록 행)은 그대로여야 한다.
import fs from 'node:fs';
import { inputPageHtml } from '../app/modules/attendance/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rows = [{ date: '2026-11-04', checkIn: '08:50', checkOut: '', workHours: 0, breakMinutes: 120, source: 'admin' }, { date: '2026-11-03', checkIn: '10:20', checkOut: '16:50', workHours: 4.5, breakMinutes: 120, source: 'admin' }, { date: '2026-11-02', checkIn: '10:20', checkOut: '16:30', workHours: 4.2, breakMinutes: 120, source: 'clock' }];
const mk = (admin) => ({ me: { admin, name: '김종화' }, today: '2026-11-04', ym: '2026-11', months: ['2026-11', '2026-10'], workers: [{ id: 'w1', name: '김종화', rank: '부사장' }, { id: 'w2', name: '이한영', rank: '사원' }], worker: { id: 'w1', name: '김종화', rank: '부사장' }, rows, standard: 168, form: { date: '2026-11-04', checkIn: '08:50', checkOut: '', hours: 0 }, perm: { ok: true } });
const html = inputPageHtml(mk(true)); const html2 = inputPageHtml(mk(false));
const count = (s, re) => (s.match(re) || []).length;
const balanced = (s) => count(s, /<div[\s>]/g) === count(s, /<\/div>/g) && count(s, /<section[\s>]/g) === count(s, /<\/section>/g);
ok(balanced(html) && balanced(html2), '태그가 정확히 닫힌다(div·section 짝이 맞음 — 관리자·일반 직원 화면 모두)');
// 구조: 바깥 jh-att 안에 왼쪽 묶음(main)과 오른쪽 목록(list)
const iAtt = html.indexOf('class="jh-att"'), iMain = html.indexOf('class="jh-att__main"'), iList = html.indexOf('jh-att__list');
ok(html.startsWith('<div class="jh-dashboard"><div class="jh-att"><div class="jh-att__main">') && iAtt > 0 && iMain > iAtt && iList > iMain && html.indexOf('jh-att__side') > iMain && html.indexOf('jh-att__side') < iList, '★ 구조: dashboard > att > (main 왼쪽 묶음, side 오른쪽 열[달력 카드 + 기록 목록 카드]) 순서');
const mainHtml = html.slice(iMain, html.indexOf('</div><div class="jh-att__side">')); const listHtml = html.slice(html.indexOf('<section class="jh-panel jh-card jh-att__list">'));
ok(/jh-pagehead/.test(mainHtml) && /출퇴근 기록/.test(mainHtml) && /data-month/.test(mainHtml), '★ 왼쪽 묶음: 제목(출퇴근 기록)과 월 선택');
ok(/jh-kpi-grid/.test(mainHtml) && /기록 일수/.test(mainHtml) && /근무시간 합계/.test(mainHtml) && /소정근로시간/.test(mainHtml) && />168\.0h</.test(mainHtml), '★ 왼쪽 묶음: 요약 카드 3개(기록 일수·근무시간 합계·소정근로시간)');
ok(/직접 입력 · 수정/.test(mainHtml) && /data-att-form/.test(mainHtml) && /data-att="date"/.test(mainHtml) && /data-att="checkIn"/.test(mainHtml) && /data-att="checkOut"/.test(mainHtml) && /data-att-hours/.test(mainHtml) && /data-att-save/.test(mainHtml) && /data-att-msg/.test(mainHtml), '★ 왼쪽 묶음: 직접 입력·수정 폼(날짜·출근·퇴근·근무시간·저장)');
ok(/data-worker/.test(mainHtml) && /근로자 \(관리자\)/.test(mainHtml) && /김종화 부사장/.test(mainHtml), '왼쪽 묶음: 관리자는 근로자 선택이 있다');
ok(!/data-worker/.test(html2) && /오늘 기록은 직접 입력·수정할 수 있고/.test(html2), '일반 직원 화면: 근로자 선택은 없고 안내 문구가 다르다');
ok(!/jh-att__main[\s\S]*월 기록/.test(mainHtml) && !/data-edit=/.test(mainHtml), '왼쪽 묶음에는 월 기록 목록이 들어 있지 않다');
ok(/2026년 11월 기록 · 김종화/.test(listHtml) && count(listHtml, /data-edit="/g) === 3 && /11\/04\(수\) · 08:50 ~ --:--/.test(listHtml) && /퇴근 기록 없음/.test(listHtml) && /원터치/.test(listHtml) && /관리자 입력/.test(listHtml), '★ 오른쪽 카드: 「2026년 11월 기록 · 김종화」와 기록 3건(출근만 있는 날은 「퇴근 기록 없음」, 입력 방식 표시)');
ok(/class="jh-docrow is-selected" data-edit="2026-11-04"/.test(listHtml), '오른쪽 카드: 입력 폼의 날짜(11/04)에 해당하는 행이 선택 표시된다');
const empty = inputPageHtml(Object.assign(mk(true), { rows: [] })); ok(/해당 월 기록이 없습니다/.test(empty) && /jh-att__list/.test(empty) && balanced(empty), '기록이 없는 달: 오른쪽 카드에 안내 문구, 구조 유지');
// 월간 달력 카드(오른쪽 열, 목록 위)
globalThis.window = { JH_HOLIDAYS: { '2026-11-03': '시험 공휴일' } };
const calHtml = inputPageHtml(mk(true)); delete globalThis.window;
const iSide = calHtml.indexOf('jh-att__side'), iCal = calHtml.indexOf('jh-att__cal'), iLst = calHtml.indexOf('jh-att__list'); const calSec = calHtml.slice(iCal, iLst);
ok(iSide > 0 && iCal > iSide && iLst > iCal && !/jh-att__cal/.test(mainHtml), '★ 달력 카드는 오른쪽 열의 맨 위(목록 카드보다 앞)에 있고 왼쪽 묶음에는 없다');
ok(/📅 2026년 11월 달력/.test(calSec) && count(calSec, /jh-attcal__dow"/g) === 7 && />일<\/div>/.test(calSec) && />토<\/div>/.test(calSec) && /role="grid"/.test(calSec), '★ 달력: 「2026년 11월 달력」 제목과 요일 머리글 7개(일~토)');
ok(count(calSec, /class="jh-attcal__cell"/g) === 30 && count(calSec, /class="jh-attcal__pad"/g) === 5, '달력: 날짜 칸 30개 + 뒤쪽 빈칸 5개(2026-11)');
ok(count(calSec, /<button type="button" class="jh-attcal__cell" data-edit="/g) === 4 && count(calSec, /data-future="true"/g) === 26 && !/<button[^>]*data-future/.test(calSec), '★ 오늘(11/04)까지 4칸만 누를 수 있는 단추이고, 이후 26칸은 단추가 아니다');
ok(/data-edit="2026-11-04" data-state="work" data-dow="3" data-today="true" aria-pressed="true"/.test(calSec) && /data-edit="2026-11-02" data-state="work" data-dow="1" aria-pressed="false"/.test(calSec), '★ 오늘(11/04)은 오늘 표시, 입력 폼의 날짜와 같아 선택 표시(aria-pressed)');
ok(/data-edit="2026-11-03" data-state="holidayWork" data-dow="2" data-off="true" data-holiday="true"/.test(calSec) && /jh-attcal__hol">시험 공휴일</.test(calSec) && /data-edit="2026-11-01" data-state="off" data-dow="0" data-off="true"/.test(calSec), '★ 공휴일(이름 표시)의 근무 기록은 쉬는 날 근무(holidayWork), 기록 없는 일요일은 쉬는 날(off)');
ok(/jh-attcal__time">10:20~16:30<\/span><span class="jh-attcal__h">4\.2h</.test(calSec) && /jh-attcal__time">08:50~<\/span><span class="jh-attcal__h"><\/span><span class="jh-attcal__warn">퇴근 없음</.test(calSec), '★ 칸 안: 출퇴근 시각과 근무시간(4.2h), 출근만 있는 날은 「퇴근 없음」 경고');
ok(/aria-label="11월 4일 수요일, 출근 08:50, 퇴근 기록 없음"/.test(calSec) && /aria-label="11월 5일 목요일, 아직 오지 않은 날"/.test(calSec), '칸마다 읽어 주는 문구(aria-label)');
ok(!/결근/.test(calSec), '★ 달력에 「결근」 표시가 없다(연차·출장을 여기서 보지 않으므로)');
ok(/연차·휴가·출장은 이 달력에 나오지 않습니다/.test(calSec), '달력 안내 문구: 연차·휴가·출장은 나오지 않음을 알린다');
ok(balanced(calHtml) && count(calHtml, /data-edit="/g) === 4 + 3, '달력 포함 화면도 태그 짝이 맞고, 클릭 대상은 달력 4 + 기록 목록 3');
const aug = inputPageHtml(Object.assign(mk(true), { ym: '2026-08', today: '2026-11-04', rows: [], form: { date: '2026-08-10', checkIn: '', checkOut: '', hours: 0 } })); ok(count(aug, /class="jh-attcal__pad"/g) === 6 + 5 && count(aug, /<button type="button" class="jh-attcal__cell"/g) === 31, '지난 달(2026-08): 모든 날짜를 누를 수 있다(31칸), 6주 달력의 앞·뒤 빈칸');
const noPerm = inputPageHtml(Object.assign(mk(false), { perm: { ok: false, code: 'needs-approval', reason: '지난 날짜는 결재 요청이 필요합니다.' } })); ok(/지난 날짜는 결재 요청이 필요합니다/.test(noPerm.slice(noPerm.indexOf('jh-att__main'), noPerm.indexOf('jh-att__list'))) && /data-att-save disabled/.test(noPerm) && /data-att-request/.test(noPerm), '권한 안내와 결재 요청 단추는 왼쪽 묶음(입력 폼)에 있고 저장은 비활성');
// 스타일
const css = fs.readFileSync(new URL('../app/theme/edoc.css', import.meta.url), 'utf8'); const shell = fs.readFileSync(new URL('../app/theme/shell.css', import.meta.url), 'utf8');
ok(/\.jh-att \{ display: grid; gap: var\(--sp-4\); grid-template-columns: minmax\(0, 1fr\); \}/.test(css), '★ 스타일(기본·모바일): 한 칸(위아래)');
ok(/\.jh-att__main \{ display: grid; gap: var\(--sp-4\); min-width: 0; align-content: start; \}/.test(css), '스타일: 왼쪽 묶음은 세로로 쌓고 칸이 넘치지 않는다(min-width: 0)');
const cq = css.match(/@container dash \(min-width: 58rem\) \{[\s\S]*?\n\}/); ok(!!cq && /\.jh-att \{ grid-template-columns: minmax\(0, 30rem\) minmax\(0, 1fr\); align-items: start;/.test(cq[0]), '★ 스타일(넓은 화면): 컨테이너 폭 58rem 이상이면 왼쪽 30rem 고정 + 오른쪽 나머지의 2단, 위쪽 맞춤');
ok(!!cq && /\.jh-att__main \.jh-form__row\[data-cols="3"\] \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(cq[0]), '★ 스타일(넓은 화면): 왼쪽 폼의 날짜·출근·퇴근은 세로로 한 칸씩(모바일 화면과 같은 모양)');
ok(/\.jh-dashboard \{[^}]*container-type: inline-size; container-name: dash;/.test(shell), '컨테이너 이름 dash 가 jh-dashboard 에 지정돼 있다(사이드바를 뺀 실제 화면 폭 기준)');
ok(/\.jh-att__side \{ display: grid; gap: var\(--sp-4\); min-width: 0; align-content: start; \}/.test(css), '스타일: 오른쪽 열은 달력 카드와 목록 카드를 세로로 쌓는다');
ok(/\.jh-attcal \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/.test(css) && /\.jh-attcal__dow\[data-dow="0"\] \{ color: var\(--c-danger\); \}/.test(css) && /\.jh-attcal__dow\[data-dow="6"\] \{ color: var\(--c-primary\); \}/.test(css), '★ 스타일: 7칸 달력 격자, 일요일 빨강·토요일 파랑');
ok(/\.jh-attcal__time \{ display: none;/.test(css) && /@container dash \(min-width: 58rem\) \{ \.jh-attcal__time \{ display: block; \}/.test(css), '★ 스타일: 좁은 화면에서는 시각을 숨기고 근무시간만, 넓은 화면(2단)에서는 시각도 보인다');
ok(/\.jh-attcal__cell\[data-today="true"\] \.jh-attcal__d \{ background: var\(--c-primary\);/.test(css) && /\.jh-attcal__cell\[aria-pressed="true"\] \{ outline: 2px solid var\(--c-primary\);/.test(css) && /\.jh-attcal__cell\[data-future="true"\] \{ cursor: default; opacity: 0\.55; \}/.test(css), '스타일: 오늘·선택 강조, 오늘 이후는 흐리게(누를 수 없음)');
ok(/@container dash \(max-width: 40rem\) \{ \.jh-att__cal \{ display: none; \} \}/.test(css), '★ 스타일: 휴대폰 폭(40rem=640px 이하)에서는 달력 카드를 숨긴다(입력 폼·기록 목록만)');
ok(!/@container dash \(max-width: (4[1-9]|[5-9]\d)rem\) \{ \.jh-att__cal/.test(css) && !/\.jh-att__cal \{[^}]*display: none/.test(css.replace(/@container dash \(max-width: 40rem\) \{ \.jh-att__cal \{ display: none; \} \}/, '')), '스타일: 숨김은 휴대폰 폭 한 곳뿐이다(태블릿·좁은 창·PC에서는 숨기지 않는다)');
const idx = fs.readFileSync(new URL('../app/modules/attendance/index.js', import.meta.url), 'utf8');
ok(/const ds = e\.getAttribute\('data-edit'\); const r = S\.rows\.find\(\(x\) => x\.date === ds\); S\.form = r \? \{ date: r\.date, checkIn: r\.checkIn, checkOut: r\.checkOut, hours: r\.workHours \} : \{ date: ds, checkIn: '', checkOut: '', hours: 0 \}; recompute\(\); paint\(\);/.test(idx), '★ 컨트롤러: 날짜를 누르면 그 날 기록을 폼에 불러오고, 기록이 없는 날은 날짜만 바꿔 빈 폼으로 불러온다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
