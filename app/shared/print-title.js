/* 인쇄 제목(대기열 1-2-7 ①, 대표님 2026-10-22) — 시험: tests/print-title.test.mjs.
 * 브라우저의 "인쇄 → PDF 저장" 은 문서 제목(document.title)을 저장 창의 기본 파일 이름으로 쓴다. 현재 포털 화면을 그대로 인쇄하는 곳(재무회계·전자결재·PJT)은
 * 인쇄하는 동안만 document.title 을 문서 이름(app/shared/doc-filename.js 의 docFileName 결과)으로 바꾸고, 인쇄가 끝나면(afterprint) 원래 제목으로 되돌린다.
 * - 되돌림은 afterprint 이벤트가 오면 하고, 이 이벤트를 쏘지 않는 브라우저를 위해 안전망 타이머(60초)도 둔다. 정확히 한 번만 되돌린다.
 * - 인쇄 대화상자가 열려 있는 동안 화면을 옮겨 제목이 바뀌었다면(우리가 넣은 제목이 아님) 옛 제목으로 덮어쓰지 않는다.
 * - 진행 중인 인쇄 상태는 창(window) 객체에 붙여 둔다(창마다 하나 — 시험마다 새 가짜 창이면 서로 영향이 없다).
 * - 인쇄가 끝나기 전에 또 호출돼도 원래 제목을 잃지 않는다(이미 바뀐 제목을 원래 제목으로 저장하면 문서 이름이 영구히 남는다).
 * - onDone 은 되돌릴 때 한 번 불린다(PJT 가 인쇄용 영역을 지우는 데 쓴다 — 인쇄 중에 지우면 빈 문서가 인쇄된다). 제목이 비어 있으면 제목은 건드리지 않고 인쇄만 한다. */
const SAFETY_MS = 60000, MAX_TITLE = 200;
const KEY = Symbol.for('jh.printTitle');
const cleanTitle = (t) => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE).trim() : '');
function finish(env, win) {
  const a = win[KEY]; if (!a) return; win[KEY] = null;
  try { a.win.removeEventListener('afterprint', a.listener); } catch (e) { /* 무시 */ }
  try { env.clearTimeout(a.timer); } catch (e) { /* 무시 */ }
  try { if (a.set && a.win.document.title === a.current) a.win.document.title = a.original; } catch (e) { /* 무시 */ }
  a.done.forEach((f) => { try { f(); } catch (e) { /* 콜백 오류는 밖으로 새지 않는다 */ } });
}
/** title: 문서 이름(docFileName 결과). opts = { onDone, env } — env 는 시험용({ window, setTimeout, clearTimeout }). 반환 { ok, error } */
export function printWithTitle(title, opts) {
  const o = opts && typeof opts === 'object' ? opts : {}; const e = o.env && typeof o.env === 'object' ? o.env : {};
  const win = 'window' in e ? e.window : (typeof window !== 'undefined' ? window : null);
  const env = { setTimeout: e.setTimeout || ((f, ms) => setTimeout(f, ms)), clearTimeout: e.clearTimeout || ((t) => clearTimeout(t)) };
  if (!win || typeof win.print !== 'function' || !win.document) return { ok: false, error: '인쇄를 시작할 수 없습니다.' };
  const t = cleanTitle(title); const onDone = typeof o.onDone === 'function' ? o.onDone : null;
  const cur = win[KEY];
  if (cur) { if (onDone) cur.done.push(onDone); if (t) { win.document.title = t; cur.current = t; cur.set = true; } } // 이미 인쇄 중이면 원래 제목은 그대로 두고 현재 제목만 바꾼다
  else {
    const a = { win, original: win.document.title, current: t, set: !!t, done: onDone ? [onDone] : [], listener: null, timer: null };
    a.listener = () => finish(env, win); win[KEY] = a; win.addEventListener('afterprint', a.listener); a.timer = env.setTimeout(() => finish(env, win), SAFETY_MS);
    if (t) win.document.title = t;
  }
  try { win.print(); return { ok: true, error: '' }; }
  catch (err) { finish(env, win); return { ok: false, error: String((err && err.message) || err) }; }
}
