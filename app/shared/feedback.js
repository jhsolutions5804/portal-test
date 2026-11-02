/* 포털 문의·건의 창 — 우측 하단에 떠서 따라다니는 버튼(2026-11-02 대표님 요청). 저장·이벤트 연결만 맡고, 규칙은 feedback-logic.js, 화면은 feedback-view.js.
 * 직원: 분류·내용을 적어 보내면 portal_feedback 에 쌓인다(보안 규칙: 자기 이름으로 만들기만 가능). 관리자: 「받은 건의」 탭에서 목록을 보고 상태(신규→확인→완료)를 바꾼다. */
import { db, collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, serverTimestamp } from '../core/firebase.js?v=20261102b';
import { FB_COL, buildFeedbackDoc, cooldownLeft, feedbackEnabledFor, nextStatus } from './feedback-logic.js?v=20261102b';
import { newState, buttonHtml, panelHtml } from './feedback-view.js?v=20261102b';
import { pagerAction, pagerApply } from './pager.js?v=20261102b';
const buildOf = () => { const s = document.querySelector('script[src*="boot.js"]'); const m = s && /[?&]v=(\w+)/.exec(s.getAttribute('src') || ''); return m ? m[1] : ''; };
const rowOf = (s) => { const d = s.data(); return { id: s.id, d: Object.assign({}, d, { createdSec: (d.createdAt && d.createdAt.seconds) || 0 }) }; };
/** 로그인한 사용자에게 우측 하단 문의·건의 버튼을 붙인다. 되돌림 함수를 돌려준다(로그아웃 때 호출). 테섭 주소가 아니면 아무것도 붙이지 않는다 */
export function installFeedback(me) {
  if (!feedbackEnabledFor(location.pathname) || !me || !me.uid) return () => {};
  const old = document.getElementById('jh-fb'); if (old) old.remove();
  const host = document.createElement('div'); host.id = 'jh-fb'; host.className = 'jh-fb'; document.body.appendChild(host);
  const st = newState(me);
  const paint = () => { host.setAttribute('data-open', st.open ? 'true' : 'false'); host.innerHTML = buttonHtml(st.open) + (st.open ? '<section class="jh-fb__panel" id="jh-fb-panel" role="dialog" aria-label="문의·건의">' + panelHtml(st) + '</section>' : ''); };
  const loadInbox = async () => {
    st.err = ''; st.loaded = false; paint();
    try { const snap = await getDocs(query(collection(db, FB_COL), orderBy('createdAt', 'desc'), limit(200))); st.rows = snap.docs.map(rowOf); }
    catch (e) { st.err = '받은 건의를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.'; }
    st.loaded = true; paint();
  };
  const send = async () => {
    const left = cooldownLeft(st.last, Date.now());
    if (left) { st.msg = Math.ceil(left / 1000) + '초 뒤에 다시 보낼 수 있습니다.'; st.msgTone = 'warn'; paint(); return; }
    const r = buildFeedbackDoc({ category: st.category, text: st.text }, me, { hash: location.hash, build: buildOf(), userAgent: navigator.userAgent, width: window.innerWidth, height: window.innerHeight });
    if (r.error) { st.msg = r.error; st.msgTone = 'danger'; paint(); return; }
    st.busy = true; st.msg = ''; paint();
    try { await addDoc(collection(db, FB_COL), Object.assign({}, r.doc, { createdAt: serverTimestamp() })); st.last = Date.now(); st.text = ''; st.busy = false; st.msg = '접수했습니다. 의견 감사합니다.'; st.msgTone = 'ok'; paint(); }
    catch (e) { st.busy = false; st.msg = '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; st.msgTone = 'danger'; paint(); }
  };
  host.addEventListener('input', (ev) => { const t = ev.target; if (t instanceof HTMLTextAreaElement && t.hasAttribute('data-fb-text')) { st.text = t.value; if (st.msg && st.msgTone === 'danger') { st.msg = ''; const m = host.querySelector('.jh-fb__msg'); if (m) m.remove(); } const c = host.querySelector('.jh-fb__bar .jh-field__hint'); if (c) c.textContent = st.text.length + ' / 2000자'; } });
  host.addEventListener('change', (ev) => { const t = ev.target; if (t instanceof HTMLInputElement && t.hasAttribute('data-fb-cat')) st.category = t.value; });
  host.addEventListener('click', async (ev) => {
    const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg, pa)) paint(); return; }
    const t = ev.target instanceof Element ? ev.target.closest('[data-fb-toggle],[data-fb-close],[data-fb-send],[data-fb-tab],[data-fb-next],[data-fb-reload]') : null; if (!t) return;
    if (t.hasAttribute('data-fb-toggle')) { st.open = !st.open; st.msg = ''; paint(); if (st.open) { const ta = host.querySelector('[data-fb-text]'); if (ta) ta.focus(); } return; }
    if (t.hasAttribute('data-fb-close')) { st.open = false; paint(); return; }
    if (t.hasAttribute('data-fb-send')) { await send(); return; }
    if (t.hasAttribute('data-fb-tab')) { st.tab = t.getAttribute('data-fb-tab') === 'inbox' ? 'inbox' : 'send'; st.msg = ''; paint(); if (st.tab === 'inbox' && !st.loaded) await loadInbox(); return; }
    if (t.hasAttribute('data-fb-reload')) { await loadInbox(); return; }
    if (t.hasAttribute('data-fb-next')) {
      const id = t.getAttribute('data-fb-next'); const row = st.rows.find((x) => x.id === id); if (!row) return; const to = nextStatus(row.d.status || 'new');
      try { await updateDoc(doc(db, FB_COL, id), { status: to, handledAt: serverTimestamp(), handledBy: me.uid }); row.d.status = to; paint(); } catch (e) { st.err = '상태를 바꾸지 못했습니다.'; paint(); }
    }
  });
  const onKey = (ev) => { if (ev.key === 'Escape' && st.open) { st.open = false; paint(); } };
  document.addEventListener('keydown', onKey);
  paint();
  return () => { document.removeEventListener('keydown', onKey); host.remove(); };
}
