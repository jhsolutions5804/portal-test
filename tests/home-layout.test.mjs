import fs from 'node:fs';
import { widgetFrameHtml, fullFrameHtml } from '../app/modules/calendar/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const read = (p) => fs.readFileSync(new URL('../app/' + p, import.meta.url), 'utf8');
// 홈 카드는 4개: 출퇴근 · 전자결재 · 일정 캘린더 · 일정 목록 (연차 현황 위젯은 홈에서 뺌)
const wd = (src) => { const m = src.match(/widgets: \[([^\]]*)\]/); return m ? [...m[1].matchAll(/id: '(\w+)', order: (\d+)/g)].map((x) => x[1] + ':' + x[2]) : []; };
const att = wd(read('modules/attendance/index.js')), edoc = wd(read('modules/edoc/index.js')), cal = wd(read('modules/calendar/index.js'));
ok(att.join() === 'clock:10' && edoc.join() === 'todo:20' && cal.join() === 'month:90', '★ 메인 홈 위젯은 3개뿐: 출퇴근(clock) · 전자결재(todo) · 일정 캘린더(month, 달력+선택한 날 목록 한 장): ' + [att, edoc, cal].flat().join(' '));
ok(!/mountLeaveWidget/.test(read('modules/edoc/index.js')) && !/reserve: '(todo|huge|medium|large)'/.test(read('modules/edoc/index.js') + read('modules/calendar/index.js')) && /reserve: 'tall'/.test(read('modules/attendance/index.js')), '전자결재·일정 카드는 불러오기 전에 큰 자리를 미리 잡지 않고(내용 높이), 출퇴근만 자리를 잡음');
// 일정: 달력 카드와 목록 카드가 따로
const S = { widget: true, view: 'month', title: '2026년 10월', off: [], y: 2026, m: 10, sel: '2026-10-15' }; const provs = [{ id: 'company', label: '회사 일정' }, { id: 'leave', label: '연차·휴무' }]; const me = { admin: true, uid: 'u' };
const wf = widgetFrameHtml(S, provs, me), ff = fullFrameHtml(Object.assign({}, S, { widget: false }), provs, me);
ok(wf.includes('📅 일정 캘린더') && wf.includes('data-cal-grid') && wf.includes('data-cal-day') && !wf.includes('jh-cal__views') && !wf.includes('data-view="agenda"') && wf.includes('data-cal-today') && wf.includes('data-new'), '★ 홈의 일정 캘린더 카드 한 장: 월 달력 + 선택한 날 목록(오른쪽)·오늘·등록 버튼, 보기 전환 없음');
ok(ff.includes('jh-cal__views') && ff.includes('data-cal-day') && ff.includes('data-view="agenda"'), '전체 일정 화면은 그대로(보기 전환·날짜 목록 포함)');
// 배치 스타일
const sh = read('theme/shell.css');
ok(/@container dash \(min-width: 1320px\) \{[^}]*grid-template-columns: minmax\(18rem, 22rem\) minmax\(0, 1fr\); grid-template-rows: auto 1fr; align-items: stretch;/.test(sh) && /data-widget="attendance\/clock"\] \{ grid-column: 1; grid-row: 1; \}/.test(sh) && /data-widget="edoc\/todo"\] \{ grid-column: 1; grid-row: 2; align-self: stretch; \}/.test(sh) && /edoc\/todo"\] > \.jh-panel > \.jh-form \{ align-content: space-between; \}/.test(sh) && /data-widget="calendar\/month"\] \{ grid-column: 2; grid-row: 1 \/ span 2; \}/.test(sh) , '★ 넓은 홈(홈 칸 폭 1320px↑ ≈ 화면 1440px 초과): 왼쪽 출퇴근·전자결재(세로) | 오른쪽 넓은 일정 캘린더 한 장(두 줄 높이)');
ok(/data-widget="attendance\/clock"\], \.jh-dashboard \.jh-widget\[data-widget="edoc\/todo"\] \{ align-self: start; \}/.test(sh), '★ 왼쪽 카드는 내용 높이(align-self: start)라 빈 여백이 안 남고, 일정 목록 카드는 칸 높이에 맞춰 늘어나되 내용이 길어도 칸을 키우지 않음(contain: size, 안에서 스크롤)');
ok(!/data-reserve="(huge|medium|large|todo)"/.test(sh) && /data-reserve="tall"\] \{ min-height:/.test(sh) && /\.jh-widget > \.jh-panel > \.jh-form \{ padding: var\(--sp-4\) calc\(var\(--sp-4\) \+ var\(--sp-1\)\); gap: var\(--sp-4\); \}/.test(sh) && /edoc\/todo"\] \.jh-todo-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: var\(--sp-2\); \}/.test(sh), '미리 크게 잡던 최소 높이(전자결재 568px·일정 1064px) 제거, 홈 카드 안 여백은 다른 화면과 같은 기준, 전자결재 할 일 4칸은 2×2');
const cc = read('theme/calendar.css');
ok(/data-reserve="tall"\] \{ min-height: calc\(var\(--u-320\) \+ var\(--u-20\)\); \}/.test(sh) && /edoc\/todo"\] \.jh-todo \{ padding: var\(--sp-3\); min-height: 0; \}/.test(sh) && /edoc\/todo"\] \.jh-todo__hint \{ display: none; \}/.test(sh) && /@media \(min-width: 900px\) \{ \.jh-cal\[data-in-widget="true"\] \.jh-cal__day \{ min-height: var\(--u-84\); \} \}/.test(cc) && /filter\.open = widget \? false : !isPhone\(\)/.test(read('modules/calendar/index.js')), '★ 카드 높이 줄이기: 출퇴근 자리 340px(실제 높이), 전자결재 할 일 칸은 낮게(안내 문구 생략), 일정 달력 칸 96→84px(폰 제외), 홈 달력은 "표시할 일정" 범례를 접어 둠');
ok(/data-widget="calendar\/month"\] \{ grid-column: 1 \/ -1; \}/.test(sh) && /data-widget="calendar\/month"\] \{ grid-column: 2; grid-row: 1 \/ span 2; \}/.test(sh), '★ 홈 달력은 한 장으로 넓게(좁은 폭 전체 줄, 넓은 홈은 오른쪽 칸 전체)');
ok(/@container dash \(min-width: 1320px\) \{[^}]*grid-template-columns: minmax\(18rem, 22rem\) minmax\(0, 1fr\);/.test(sh) && !/min-width: 1100px\) \{\s*\.jh-dashboard \.jh-dashboard__grid/.test(sh) && !/@media \(min-width: 1441px\)/.test(sh), '★ 홈 카드 3열은 홈 칸 폭 1320px 이상(화면 폭 약 1440px 초과)에서만 — 1440px 이하는 2×2(대표님 결정 2026-10-26). 미디어쿼리 기준 폭은 899px 하나뿐이라는 규약 때문에 컨테이너 쿼리로 둔다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
