// 인사총무 > 출퇴근·초과근로 — 모바일에서 날짜를 누르면 「근로 내역 추가/수정」이 팝업(시트)으로 열린다(대표님 2026-11-04 「모바일에서는 팝업이 안 뜨는데」)
import fs from 'node:fs';
import { attendCalHtml } from '../app/modules/hr/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = [{ id: 'w1', name: '정다애', empNo: '23002', rank: '대리' }];
const mk = (o) => Object.assign({ acMode: 'cal', acY: 2026, acM: 10, today: '2026-11-04', acWorkers: W, acW: 'w1', acRows: [{ date: '2026-10-05', checkIn: '07:00', checkOut: '18:00', breakMinutes: 120 }], acAdj: [], acLeaves: [], acOt: [], otRows: [], otOpen: '', otForm: null, acSel: '', acForm: null, acWeek: '', acDaily: null, workers: W, rrWorkers: [], caps: null }, o || {});
const css = fs.readFileSync(new URL('../app/theme/hr.css', import.meta.url), 'utf8'); const view = fs.readFileSync(new URL('../app/modules/hr/view.js', import.meta.url), 'utf8');
const closed = attendCalHtml(mk()); const open = attendCalHtml(mk({ acSel: '2026-10-05', acForm: { checkIn: '07:00', checkOut: '18:00', breakMinutes: '120', isBusinessTrip: false, tripType: 'personal_near' } }));
ok(!/data-open="true"/.test(closed) && !/jh-ac__backdrop/.test(closed) && /<div class="jh-ac__side">/.test(closed), '★ 날짜를 고르기 전에는 오른쪽 칸에 팝업 표시도 뒷배경도 없다(안내 카드만)');
ok(/<div class="jh-ac__side" data-open="true"><div class="jh-ac__backdrop" data-ac-act="close" aria-hidden="true"><\/div><section/.test(open) || /<div class="jh-ac__side" data-open="true"><div class="jh-ac__backdrop" data-ac-act="close" aria-hidden="true"><\/div>/.test(open), '★ 날짜를 고르면 오른쪽 칸이 열린 상태(data-open)가 되고 첫 자식이 뒷배경(누르면 닫기)이다');
const side = open.slice(open.indexOf('jh-ac__side')); ok(side.includes('정다애 근로 내역 수정') && side.includes('data-ac-act="save"') && side.includes('data-ac-act="close"') && side.includes('data-ac-f="checkIn"'), '열린 칸 안에 그 날의 출근·퇴근·휴게 입력과 저장·닫기 단추가 그대로 있다(기존 저장·삭제 처리와 같은 단추라 동작이 바뀌지 않는다)');
ok(/\.jh-ac__backdrop \{ display: none; \}/.test(css), '스타일: 뒷배경은 기본(PC·태블릿)에서 보이지 않는다');
const mq = css.slice(css.indexOf('@media (max-width: 899px) {\n  .jh-ac__layout > .jh-ac__side[data-open="true"]'));
ok(/\.jh-ac__layout > \.jh-ac__side\[data-open="true"\] \{ position: fixed; inset: 0; z-index: 70;/.test(mq) && /\.jh-ac__side\[data-open="true"\] > \.jh-ac__backdrop \{ display: block; position: absolute; inset: 0;/.test(mq) && /> :nth-child\(2\) \{[^}]*max-height: 88vh; overflow-y: auto;[^}]*border-radius/.test(mq), '★ 스타일(모바일 899px 이하): 열린 칸이 화면 전체를 덮는 팝업이 되고 그 안의 카드가 아래에서 올라오는 시트(최대 높이 88vh, 안에서 스크롤)다');
ok(/:not\(\.jh-ac__backdrop\):not\(:nth-child\(2\)\) \{ display: none; \}/.test(mq), '팝업이 열려 있는 동안 초과근로 입력·내역 같은 다른 카드는 숨긴다(근로 내역 카드만 보임)');
ok(!/\.jh-ac__side\[data-open="true"\][^{]*\{[^}]*position: fixed/.test(css.replace(mq, '')), '★ 팝업 규칙은 모바일 미디어 쿼리 안에만 있다 — PC·태블릿의 오른쪽 칸(따라오는 칸)은 그대로');
ok(/@media \(max-width: 899px\) \{ \.jh-ac__layout, \.jh-ac__layout\[data-mode="ot"\]/.test(css), '기존 모바일 1단 규칙(899px 이하)과 같은 기준을 쓴다');
ok(/data-ac-act="close"/.test(view) && fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8').includes("act === 'close'"), '닫기 처리(act=close)가 이미 있어 뒷배경 누르기도 같은 처리로 닫힌다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
