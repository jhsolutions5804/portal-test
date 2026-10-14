import { homeHtml } from '../app/modules/pjt/home-view.js';
import { scheduleHtml } from '../app/modules/pjt/schedule-view.js';
import { overviewHtml } from '../app/modules/pjt/overview-view.js';
import { twoWeeks } from '../app/modules/pjt/schedule.js';
import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const idx = (h, s) => h.indexOf(s);
const css = fs.readFileSync(new URL('../app/theme/pjt.css', import.meta.url), 'utf8');
// ① 프로젝트 홈: 바로가기 삭제, 왼쪽 요약 카드 | 오늘 일정·공사일보 | 기본정보
const hst = { proj: 'p4ph2', label: 'P4 Ph2 (FAB)', ready: true, unit: '대', doc: { name: 'P4 Ph2', site: '평택', startDate: '2026-05-29', status: 'active', qty: 183 }, progress: { pct: 10.93, items: 183 }, monthMd: 25.5, att: { headcount: 3, mandayTotal: 4.5 }, today: '2026-10-14', schedules: [], reports: [{ date: '2026-08-28', author: '윤석원', content: '작업' }], features: { weeklyReportPpt: true, layoutMap: true } };
const h = homeHtml(hst); const side = h.slice(idx(h, 'jh-phome__side'), idx(h, 'jh-phome__main')), main = h.slice(idx(h, 'jh-phome__main'), idx(h, 'jh-phome__detail')), det = h.slice(idx(h, 'jh-phome__detail'));
ok(!h.includes('바로가기') && !h.includes('jh-pjt__qbtn') && !h.includes('공정표 PPT') && !h.includes('장비 배치도'), '★ 프로젝트 홈에서 바로가기 카드(일정·공정·출역·공수·공사일보·PPT·배치도 링크)가 없어짐 — 화면 이동은 사이드 메뉴');
ok(idx(h, 'jh-phome__side') < idx(h, 'jh-phome__main') && idx(h, 'jh-phome__main') < idx(h, 'jh-phome__detail') && (side.match(/class="jh-kpi"/g) || []).length === 4 && side.includes('href="#/pjt/p4ph2/progress"') && (side.match(/href="#\/pjt\/p4ph2\/attend"/g) || []).length === 2 && side.includes('10.9%') && side.includes('총 물량 183대') && side.includes('D+138') && side.includes('25.5') && side.includes('3명') && side.includes('4.5공수') && side.includes('jh-pjt__bar2') && !/<a class="jh-kpi"[^>]*>[^]*?프로젝트 D\+/.test(side.split('프로젝트 D+')[0].slice(-120)), '★ 프로젝트 홈 3단: 왼쪽 요약 카드 4개(공정율+막대·D+·이달 누적 공수·오늘 출역, 누르면 해당 화면, D+는 링크 아님)');
ok(main.includes('오늘 일정') && main.includes('공사일보') && main.includes('오늘 일보 작성') && idx(main, '오늘 일정') < idx(main, '공사일보') && det.includes('기본정보') && det.includes('평택') && !side.includes('오늘 일정'), '가운데: 오늘 일정 → 공사일보, 오른쪽(넓은 화면): 기본정보');
ok(/\.jh-phome \{ display: grid; grid-template-columns: 17rem minmax\(0, 1fr\)/.test(css) && /@media \(min-width: 1500px\) \{ \.jh-phome \{ grid-template-columns: 17rem minmax\(0, 1fr\) var\(--u-320\)/.test(css) && /@media \(max-width: 1099px\) \{ \.jh-phome \{ grid-template-columns: minmax\(0, 1fr\)/.test(css), '스타일 보호: 프로젝트 홈 17rem | 가변, 1500px 이상 3단, 1099px 이하 1단');
// ② PJT 전체 홈: 왼쪽 통합 일정 달력, 오른쪽 프로젝트 목록
const ost = { ready: true, admin: true, projects: [{ key: 'p4ph2', label: 'P4 Ph2 (FAB)', doc: { name: 'P4 Ph2 (FAB)' } }], stats: {}, items: [], view: 'monthly', y: 2026, m: 9, sel: '', offset: 0, today: '2026-10-14', form: null };
const oh = overviewHtml(ost);
ok(idx(oh, 'id="ov-sched"') !== -1 && idx(oh, 'id="ov-rail"') !== -1 && idx(oh, 'id="ov-sched"') < idx(oh, 'id="ov-rail"') && /\.jh-ov__layout \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(var\(--u-320\), 26rem\)/.test(css), '★ PJT 전체 홈: 왼쪽 통합 일정 달력(#ov-sched) → 오른쪽 프로젝트 목록(#ov-rail), 오른쪽 폭 320~26rem');
// ③ 프로젝트 일정: 주간 없음, 2주는 달력 형태
const tw = twoWeeks('2026-10-14');
ok(tw.length === 14 && tw[0] === '2026-10-11' && tw[13] === '2026-10-24' && twoWeeks('2026-10-11')[0] === '2026-10-11' && twoWeeks('2026-10-17')[0] === '2026-10-11' && twoWeeks('2026-10-18')[0] === '2026-10-18', '2주 달력은 고른 날이 속한 주(일요일 시작)와 다음 주 14일');
const sst = (o) => Object.assign({ proj: 'p4ph2', label: 'P4 Ph2 (FAB)', ready: true, view: 'two', date: '2026-10-14', today: '2026-10-14', month: { y: 2026, m: 9 }, items: [{ id: 'a', text: '주간 공정회의', sdate: '2026-10-15', edate: '2026-10-15', stime: '09:00', etime: '10:00', tag: 'meeting' }, { id: 'b', text: 'FCU 설치', sdate: '2026-10-15', edate: '2026-10-15', stime: '13:00', etime: '17:00', tag: 'fcu' }, { id: 'c', text: '안전교육', sdate: '2026-10-15', edate: '2026-10-15', stime: '', etime: '', tag: 'edu' }, { id: 'd', text: '자재 반입', sdate: '2026-10-15', edate: '2026-10-15', stime: '15:00', etime: '16:00', tag: 'in' }], form: null, manage: true, readonly: false }, o || {});
const sh = scheduleHtml(sst()); const tabs = [...sh.matchAll(/data-sc-view="(\w+)"/g)].map((m) => m[1]);
ok(tabs.join() === 'month,two' && !/>주간</.test(sh) && sh.includes('>달력<') && sh.includes('>2주<') && sh.includes('10/11 ~ 10/24'), '★ 일정 보기는 달력·2주 두 가지(주간 없음), 2주 제목은 10/11 ~ 10/24');
ok((sh.match(/jh-pjt__calc jh-pjt__calc--two/g) || []).length === 14 && (sh.match(/jh-pjt__calh/g) || []).length === 7 && sh.includes('jh-pjt__splitcal') && !sh.includes('jh-pjt__sform') && (sh.match(/<section class="jh-card"><div class="jh-panel__head"><h3 class="jh-pjt__dayh"/g) || []).length === 1, '★ 2주는 달력 형태: 7요일 머리글 + 14칸, 날짜별 카드 목록이 아니라 왼쪽 달력 + 오른쪽 그날 목록 하나');
const cell = sh.slice(idx(sh, 'data-sc-day="2026-10-15"'), idx(sh, 'data-sc-day="2026-10-16"'));
ok(cell.includes('주간 공정회의') && cell.includes('FCU 설치') && cell.includes('자재 반입') && !cell.includes('안전교육') && cell.includes('+1건') && cell.includes('<b>09:00</b>') && cell.includes('<b>13:00</b>'), '2주 달력 칸에는 그날 일정 제목 3개(시간 있는 순서 — 시간 없는 일정은 뒤로)와 나머지 건수(+1건)가 보임');
ok(!scheduleHtml(sst({ view: 'week' })).includes('calc--two') && scheduleHtml(sst({ view: 'week' })).includes('data-sc-day="2026-10-01"') && scheduleHtml(sst({ view: 'month' })).includes('data-sc-day="2026-10-01"') && !scheduleHtml(sst({ view: 'month' })).includes('calc--two') && /aria-selected="true">달력</.test(scheduleHtml(sst({ view: 'week' }))), '없어진 주간 보기값(week)이 남아 있어도 달력(월)으로 열림');
// ④ 공정·공사일보·출역·공수 스타일 보호
ok(/\.jh-pjt__splitprog \{ grid-template-columns: minmax\(0, 19rem\) minmax\(0, 1fr\)/.test(css) && /\.jh-pjt__splitprog \.jh-pjt__panebody \{ overflow: visible; max-height: none; \}/.test(css) && /\.jh-pjt__splitprog \.jh-pjt__ctable \{ table-layout: fixed;/.test(css), '★ 공정: 왼쪽 섹터 카드 19rem(이전 420px), 오른쪽 체크표는 안쪽 스크롤바 없이(overflow visible·고정 칸 너비)');
ok(/\.jh-pjt__splitrep \{ grid-template-columns: minmax\(0, 20rem\) minmax\(0, 1fr\)/.test(css) && /\.jh-pjt__rpt \{ border-top: var\(--u-4\) solid var\(--c-primary\)/.test(css) && /\.jh-pjt__calc\[data-has="true"\] \{ background: #E8F7EE/.test(css), '★ 공사일보: 달력은 작게(20rem), 일보 카드는 강조선·큰 제목, 일보가 있는 날은 초록 칸');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
