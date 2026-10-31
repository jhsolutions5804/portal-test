// 인사총무 목록의 페이지 나누기 — 근로자 명부·연차 현황(공용 shared/pager.js 의 pageTableHtml 로 감싼 함수)
import { tableHtml, leaveTableHtml } from '../app/modules/hr/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = (n) => Array.from({ length: n }, (_, i) => ({ id: 'w' + i, empNo: 'E' + String(i).padStart(3, '0'), name: '직원' + String(i).padStart(2, '0'), dept: '인사총무', rank: '사원', empType: '정규직', phone: '010', birth6: '900101' }));
const rowsOf = (h) => (h.match(/data-w-open="/g) || []).length; const range = (h) => (h.match(/\d+–\d+ \/ \d+줄/) || ['없음'])[0];
const st = { today: '2026-10-31', workers: W(23), contracts: {}, view: 'active', q: '', sel: null, reg: null, pg: {} };
let h = tableHtml(st);
ok(rowsOf(h) === 10 && range(h) === '1–10 / 23줄' && h.includes('data-pg-key="hr-workers"') && h.includes('<th>사원번호</th>'), '근로자 명부: 23명이면 처음 10명, "1–10 / 23줄" 막대, 머리글 유지');
st.pg['hr-workers'].page = 3; h = tableHtml(st); ok(rowsOf(h) === 3 && h.includes('직원22') && !h.includes('직원19') && range(h) === '21–23 / 23줄', '3쪽(마지막)은 3명(21~23번째)');
st.q = '직원07'; h = tableHtml(st); ok(rowsOf(h) === 1 && !h.includes('data-pg-key') && st.pg['hr-workers'].page === 1, '검색하면 1쪽으로 돌아가고 10명 이하이면 막대 없음');
const st2 = { today: '2026-10-31', workers: W(10), contracts: {}, view: 'active', q: '', sel: null, reg: null }; h = tableHtml(st2);
ok(rowsOf(h) === 10 && !h.includes('data-pg-key') && st2.pg !== undefined, '실제 현재 인원(10명)에서는 화면이 지금과 같음(쪽 막대 없음, st.pg 가 없어도 오류 없음)');
const LR = Array.from({ length: 14 }, (_, i) => ({ id: 'l' + i, name: '직원' + i, dept: '인사총무', rank: '사원', hireDate: '2024-01-01', detail: '', granted: 15, used: 2, remain: 13 }));
const sl = { leaveRows: LR, pg: {} }; let lh = leaveTableHtml(sl); const lrows = (x) => (x.match(/data-l-open="/g) || []).length;
ok(lrows(lh) === 10 && lh.includes('1–10 / 14줄') && lh.includes('data-pg-key="hr-leave"'), '연차 현황: 14명이면 처음 10명 + 막대');
sl.pg['hr-leave'].size = 20; lh = leaveTableHtml(sl); ok(lrows(lh) === 14 && lh.includes('1–14 / 14줄'), '페이지당 20줄로 바꾸면 14명 모두');
ok(leaveTableHtml({ leaveRows: [], pg: {} }).includes('등록된 근로자가 없습니다.'), '빈 목록 안내 문구는 그대로');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
