import { printWithTitle } from '../app/shared/print-title.js';
/* 인쇄 제목(대기열 1-2-7 ①, 대표님 2026-10-22) — 가짜 창·문서로 시험한다(실제 브라우저 접근 없음).
 * 브라우저의 "인쇄 → PDF 저장" 은 문서 제목을 기본 파일 이름으로 쓴다. 현재 포털 화면을 그대로 인쇄하는 곳(재무회계·전자결재·PJT)은 인쇄하는 동안만 document.title 을 문서 이름으로 바꾸고 인쇄가 끝나면(afterprint) 되돌린다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
/* 가짜 환경: window.print 호출 시점의 document.title 을 기록, afterprint 리스너 관리, 가짜 타이머 */
function mkEnv(opts) {
  const o = opts || {}; const listeners = []; const timers = []; const log = { printTitles: [], prints: 0, cleared: 0 };
  const document = { title: o.title === undefined ? '포털 홈' : o.title };
  const win = { document, print() { log.prints++; log.printTitles.push(document.title); if (o.throwOnPrint) throw new Error('인쇄 실패 시험'); if (o.onPrint) o.onPrint(win, document); },
    addEventListener(n, f) { if (n === 'afterprint') listeners.push(f); }, removeEventListener(n, f) { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); } };
  const env = { window: win, setTimeout: (f, ms) => { const t = { f, ms, done: false }; timers.push(t); return t; }, clearTimeout: (t) => { if (t) { t.done = true; log.cleared++; } } };
  return { env, win, document, listeners, timers, log, fireAfterPrint: () => listeners.slice().forEach((f) => f({ type: 'afterprint' })), fireTimers: () => timers.filter((t) => !t.done).forEach((t) => { t.done = true; t.f(); }) };
}
console.log('── 인쇄하는 동안만 제목을 바꾼다');
{ const m = mkEnv(); const r = printWithTitle('손익계산서 - 2026-01~2026-09', { env: m.env }); ok(m.log.printTitles[0] === '손익계산서 - 2026-01~2026-09' && m.log.prints === 1, '★ window.print 가 불리는 순간 document.title 이 문서 이름이다(저장 창의 기본 파일 이름이 되는 값)'); ok(m.document.title === '손익계산서 - 2026-01~2026-09', '★ 인쇄가 끝나기 전(afterprint 전)에는 제목을 되돌리지 않는다 — 인쇄 대화상자가 열려 있는 동안 이름이 바뀌지 않게'); ok(r && r.ok === true, '성공하면 ok: true'); }
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); m.fireAfterPrint(); ok(m.document.title === '포털 홈', '★ afterprint 가 오면 원래 제목으로 되돌린다'); ok(m.listeners.length === 0, '★ afterprint 리스너를 제거한다(쌓이지 않게)'); }
console.log('── afterprint 가 안 오는 브라우저를 위한 안전망 타이머');
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); ok(m.timers.length === 1 && m.timers[0].ms >= 30000, '★ 안전망 타이머가 걸린다(30초 이상 — 인쇄 대화상자를 오래 열어 둘 수 있어서)'); m.fireTimers(); ok(m.document.title === '포털 홈', '★ afterprint 가 없어도 타이머로 되돌린다'); ok(m.listeners.length === 0, '타이머로 되돌릴 때도 리스너를 제거한다'); }
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); m.fireAfterPrint(); ok(m.log.cleared === 1 && m.timers[0].done === true, '★ afterprint 로 되돌리면 안전망 타이머를 취소한다'); }
console.log('── 되돌림은 정확히 한 번');
{ const m = mkEnv(); let done = 0; printWithTitle('문서 A', { env: m.env, onDone: () => { done++; } }); m.fireAfterPrint(); m.fireAfterPrint(); m.fireTimers(); ok(done === 1, '★ afterprint 가 두 번 오거나 타이머가 뒤따라 와도 onDone 은 한 번이다'); ok(m.document.title === '포털 홈', '되돌린 제목이 유지된다'); }
{ const m = mkEnv(); let done = 0; printWithTitle('문서 A', { env: m.env, onDone: () => { done++; } }); ok(done === 0, '★ onDone 은 인쇄가 끝난 뒤에 불린다(PJT 가 인쇄 영역을 지우는 데 쓴다 — 인쇄 중에 지우면 빈 문서가 인쇄된다)'); m.fireAfterPrint(); ok(done === 1, 'afterprint 후 onDone 호출'); }
console.log('── 인쇄가 실패하면');
{ const m = mkEnv({ throwOnPrint: true }); let done = 0; const r = printWithTitle('문서 A', { env: m.env, onDone: () => { done++; } }); ok(r.ok === false && /인쇄 실패 시험/.test(r.error), '★ window.print 가 던지면 ok: false 와 오류 메시지를 돌려준다(호출자가 안내한다)'); ok(m.document.title === '포털 홈', '★ 실패하면 즉시 원래 제목으로 되돌린다'); ok(done === 1 && m.listeners.length === 0 && m.timers.every((t) => t.done), '★ 실패해도 onDone 이 불리고 리스너·타이머가 남지 않는다'); }
console.log('── 인쇄 중 다른 코드가 제목을 바꿨다면(예: 다른 화면으로 이동) 덮어쓰지 않는다');
{ const m = mkEnv({ onPrint: (w, d) => { /* 인쇄 대화상자가 열려 있는 동안 화면 이동 */ } }); printWithTitle('문서 A', { env: m.env }); m.document.title = '다른 화면 - 포털'; m.fireAfterPrint(); ok(m.document.title === '다른 화면 - 포털', '★ 되돌릴 때 현재 제목이 우리가 넣은 제목이 아니면 그대로 둔다(화면 이동으로 바뀐 제목을 옛 제목으로 덮어쓰지 않는다)'); }
console.log('── 빈 제목·이상한 제목');
for (const bad of ['', '   ', null, undefined, 3, {}]) { const m = mkEnv(); const r = printWithTitle(bad, { env: m.env }); ok(m.log.printTitles[0] === '포털 홈' && m.log.prints === 1 && r.ok === true, '★ 제목이 ' + JSON.stringify(bad) + ' 이면 제목을 바꾸지 않고 인쇄만 한다(이름이 없어도 인쇄는 되어야 한다)'); }
{ const m = mkEnv(); printWithTitle('손익계산서\n - 2026-01\t~ 2026-09\r\n\u0000', { env: m.env }); ok(m.log.printTitles[0] === '손익계산서 - 2026-01 ~ 2026-09', '★ 개행·탭·제어문자는 공백 하나로 정리한다(탭 제목·파일 이름이 깨지지 않게) — 실제: ' + JSON.stringify(m.log.printTitles[0])); }
{ const m = mkEnv(); printWithTitle('가'.repeat(300), { env: m.env }); ok(m.log.printTitles[0].length <= 200, '제목이 너무 길면 200자로 자른다(실제 ' + m.log.printTitles[0].length + '자)'); }
console.log('── 연속 호출');
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); printWithTitle('문서 B', { env: m.env }); m.fireAfterPrint(); ok(m.document.title === '포털 홈', '★ 인쇄가 끝나기 전에 또 호출해도 원래 제목(포털 홈)을 잃지 않는다 — 이미 바뀐 제목을 원래 제목으로 저장하면 문서 이름이 영구히 남는다'); ok(m.listeners.length === 0, '연속 호출 뒤에도 리스너가 남지 않는다'); }
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); m.fireAfterPrint(); printWithTitle('문서 B', { env: m.env }); ok(m.log.printTitles[1] === '문서 B', '끝난 뒤의 다음 호출은 새 제목으로 인쇄된다'); m.fireAfterPrint(); ok(m.document.title === '포털 홈', '두 번째 인쇄 뒤에도 원래 제목으로 돌아온다'); }
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env }); printWithTitle('', { env: m.env }); ok(m.document.title === '문서 A' && m.log.prints === 2, '★ 인쇄 중에 빈 제목으로 또 호출해도 이미 설정한 제목(문서 A)을 비우지 않는다 — 파일 이름이 사라지지 않게'); m.fireAfterPrint(); ok(m.document.title === '포털 홈', '그 뒤 afterprint 로 원래 제목으로 돌아온다'); }
console.log('── 안전');
{ const m = mkEnv({ title: '' }); printWithTitle('문서 A', { env: m.env }); m.fireAfterPrint(); ok(m.document.title === '', '원래 제목이 비어 있었어도 그대로 돌려놓는다'); }
{ let threw = false; try { printWithTitle('문서 A', { env: { window: null } }); } catch (e) { threw = true; } ok(!threw, '환경이 없어도(창이 없음) 던지지 않고 ok: false 를 돌려준다'); const r = printWithTitle('문서 A', { env: { window: null } }); ok(r.ok === false, '창이 없으면 ok: false'); }
{ const m = mkEnv(); let threw = false; try { printWithTitle('문서 A', { env: m.env, onDone: () => { throw new Error('콜백 오류'); } }); m.fireAfterPrint(); } catch (e) { threw = true; } ok(!threw && m.document.title === '포털 홈', '★ onDone 이 던져도 제목은 이미 되돌려져 있고 오류가 밖으로 새지 않는다'); }
{ const m = mkEnv(); printWithTitle('문서 A', { env: m.env, onDone: 'x' }); m.fireAfterPrint(); ok(m.document.title === '포털 홈', 'onDone 이 함수가 아니면 무시한다'); }
ok(pass + fail >= 1, '시험이 끝까지 실행됨');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
