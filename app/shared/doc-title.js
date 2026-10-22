/* 문서 창 제목(대기열 1-2-7 ③, 대표님 2026-10-22) — 시험: tests/hr-doc-titles.test.mjs.
 * 브라우저의 "인쇄 → PDF 저장" 은 문서 <title> 을 저장 창의 기본 파일 이름으로 쓴다. 서명·저장이 끝난 서류(frozen-docs.js — 동결, 직접 수정 금지)는 양식 함수를 고치지 않고
 * 창에 열 때만 <title> 을 문서 이름으로 바꾼다(제목은 문서 내용이 아니라 창 이름표). <title> 외에는 한 글자도 바꾸지 않고 스크립트도 더하지 않는다(인사 서식에는 이미 인쇄 버튼이 있다). */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanTitle = (t) => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200).trim() : '');
/** html 의 첫 번째 <title> 만 title 로 바꾼다(이스케이프). 제목이 비면 그대로, <title> 이 없으면 <head> 안(없으면 맨 앞)에 더한다. 문자열이 아니면 빈 문자열로 본다 */
export function withDocTitle(html, title) {
  const h = typeof html === 'string' ? html : ''; const t = cleanTitle(title); if (!t) return h; const tag = '<title>' + esc(t) + '</title>';
  if (/<title>[\s\S]*?<\/title>/i.test(h)) return h.replace(/<title>[\s\S]*?<\/title>/i, () => tag);
  if (/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + h;
}
/** 새 창을 열어 제목을 문서 이름으로 바꾼 문서를 쓴다. 팝업이 막히거나 오류가 나면 안내하고 false. opts = { html, title, openWindow(url, name), toast(msg) } */
export function openDocWindow(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}; const say = (m) => { try { if (typeof o.toast === 'function') o.toast(m); } catch (e) { /* 안내 실패는 무시 */ } };
  try {
    const open = typeof o.openWindow === 'function' ? o.openWindow : (u, n) => window.open(u, n); const w = open('', '_blank');
    if (!w) { say('팝업이 차단되어 출력 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.'); return false; }
    w.document.write(withDocTitle(o.html, o.title)); w.document.close(); return true;
  } catch (e) { say('출력 창을 열지 못했습니다. 팝업을 허용했는지 확인해 주세요.'); return false; }
}
