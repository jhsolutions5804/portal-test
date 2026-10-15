// 열람 페이지(sign.html)의 열람 전용 화면 — 평가 결과(safeFrame)는 직원이 쓴 글이 실행되지 않고, 기존 문서 종류의 화면은 예전과 똑같다.
//  sign.html 의 실제 showViewOnly 함수를 그대로 잘라서 jsdom 에서 돌린다.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { JSDOM } = require('/home/claude/portal-test/scripts/dev/node_modules/jsdom');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const src = fs.readFileSync(new URL('../sign.html', import.meta.url), 'utf8');
const a = src.indexOf('function showViewOnly'), b = src.indexOf('function normalizePhoneE164'); const escSrc = src.match(/function esc\(s\)\{[^\n]*\}/)[0];
const mk = () => { const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', { runScripts: 'outside-only' }); const w = dom.window; w.eval(escSrc + '\nvar el = document.getElementById("app");\n' + src.slice(a, b) + '\nwindow.showViewOnly = showViewOnly;'); return w; };
const EVIL = '<img src=x onerror="window.__pwned=1"> & <b>굵게</b> "따옴표"';
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const doc = '<html><body><div id="t">' + escHtml(EVIL) + '</div><b id="ok">80</b></body></html>';   // 평가 결과 HTML 이 이스케이프해 둔 직원 글
// ── 새 방식(safeFrame)
{ const w = mk(); w.showViewOnly({ f: { name: '김영서' }, title: '인사평가 결과 통보서', buildHtml: () => doc, safeFrame: true });
  const fr = w.document.getElementById('docFrame');
  ok(fr && fr.hasAttribute('sandbox') && fr.getAttribute('sandbox') === '' && !fr.hasAttribute('srcdoc') || (fr && fr.getAttribute('sandbox') === ''), '★ 평가 결과 화면의 iframe 에는 sandbox(스크립트·같은 출처 접근 차단)가 걸려 있음');
  ok(fr.srcdoc === doc, '★ 문서 내용이 속성이 아니라 프로퍼티로 그대로 들어감(내용이 한 글자도 변하지 않음)');
  const inner = new JSDOM(fr.srcdoc).window.document; const t = inner.getElementById('t');
  ok(t.textContent === EVIL && !inner.querySelector('img') && !inner.querySelector('script') && inner.getElementById('ok').textContent === '80', '★ iframe 안에서 직원이 쓴 <img onerror=…>·<b> 는 "글자"로 보이고 태그로 되살아나지 않음 — 디자인용 태그(<b id=ok>)는 정상');
  ok(w.document.getElementById('viewOpenBtn') && /평가 결과 통보서/.test(w.document.getElementById('app').textContent) && /김영서님, 안녕하세요/.test(w.document.getElementById('app').textContent), '안내 문구(이름·문서 제목)와 "새 창에서 보기 / 인쇄" 버튼이 있음');
}
// ── 대조: 기존 방식(속성)은 이스케이프한 글자가 한 번 더 해석되어 되살아난다 — 그래서 평가 결과는 새 방식을 쓴다
{ const w = mk(); w.showViewOnly({ f: { name: '김' }, title: '근로계약서', buildHtml: () => doc });
  const fr = w.document.getElementById('docFrame'); const inner = new JSDOM(fr.getAttribute('srcdoc') === null ? '' : fr.srcdoc).window.document;
  ok(!fr.hasAttribute('sandbox') && fr.hasAttribute('srcdoc'), '기존 문서 종류(safeFrame 없음)는 예전처럼 srcdoc 속성 방식 그대로(sandbox 없음) — 계약서 화면은 바뀌지 않음');
  ok(!!inner.querySelector('img'), '(대조) 기존 속성 방식에서는 이스케이프된 <img> 가 태그로 되살아남 — 이것이 평가 결과에 새 방식을 쓰는 이유');
}
// ── 소스: 평가 결과만 새 분기, 나머지 줄은 그대로
ok(src.includes("safeFrame: link.docType === 'evalresult'") && src.includes("link.docType === 'evalresult' ? (pay.title || '평가 결과 통보서') : link.docType === 'payslip' ? '급여명세서'") && src.includes("link.docType === 'leavepromo' ? ((pay.title || '연차사용촉진 서면 통지') + ' (저장본)')"), '소스: 평가 결과 분기는 맨 앞에만 추가되고 급여명세서·연차사용촉진·계약서 제목 분기는 그대로');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
