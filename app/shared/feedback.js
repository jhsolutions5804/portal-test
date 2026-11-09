/* 포털 문의·건의 창 — 우측 하단에 떠서 따라다니는 버튼(2026-11-02 대표님 요청). 저장·이벤트 연결만 맡고, 규칙은 feedback-logic.js, 화면은 feedback-view.js.
 * 직원: 분류·내용을 적어 보내면 portal_feedback 에 쌓이고, 「내 건의」 탭에서 처리 상태와 관리자 댓글을 읽는다. 새 답변이 달리면 버튼에 점이 뜬다.
 * 관리자: 「받은 건의」(처리 중)·「완료」 탭에서 목록을 보고, 댓글로 조치 내용을 남기거나 「조치 완료로 처리」한다(건의자에게 알림 = userUnread). */
import { db, collection, addDoc, getDocs, query, where, orderBy, limit, doc, updateDoc, writeBatch, serverTimestamp } from '../core/firebase.js?v=20261109v';
import { FB_COL, buildFeedbackDoc, buildReplyDoc, cooldownLeft, feedbackEnabledFor, nextStatus, unreadCount, errorNotice, alertLooksLikeError, errorReportDraft, noticeAllowed } from './feedback-logic.js?v=20261109v';
import { newState, buttonHtml, panelHtml, noticeHtml } from './feedback-view.js?v=20261109v';
import { pagerAction, pagerApply } from './pager.js?v=20261109v';
const buildOf = () => { const s = document.querySelector('script[src*="boot.js"]'); const m = s && /[?&]v=(\w+)/.exec(s.getAttribute('src') || ''); return m ? m[1] : ''; };
const sec = (t) => (t && t.seconds) || 0;
const rowOf = (s) => { const d = s.data(); return { id: s.id, d: Object.assign({}, d, { createdSec: sec(d.createdAt), handledSec: sec(d.handledAt) }) }; };
const replyOf = (s) => { const d = s.data(); return { id: s.id, d: Object.assign({}, d, { createdSec: sec(d.createdAt) }) }; };
const MINE_EVERY_MS = 60000;
/** 로그인한 사용자에게 우측 하단 문의·건의 버튼을 붙인다. 되돌림 함수를 돌려준다(로그아웃 때 호출). 테섭 주소가 아니면 아무것도 붙이지 않는다 */
export function installFeedback(me) {
  if (!feedbackEnabledFor(location.pathname) || !me || !me.uid) return () => {};
  const old = document.getElementById('jh-fb'); if (old) old.remove();
  const host = document.createElement('div'); host.id = 'jh-fb'; host.className = 'jh-fb'; document.body.appendChild(host);
  const st = newState(me); let lastMine = 0, dead = false;
  const paint = () => { if (dead) return; host.setAttribute('data-open', st.open ? 'true' : 'false'); host.innerHTML = (st.notice && !st.open ? noticeHtml(st.notice) : '') + buttonHtml(st.open, st.unread) + (st.open ? '<section class="jh-fb__panel" id="jh-fb-panel" role="dialog" aria-label="문의·건의">' + panelHtml(st) + '</section>' : ''); };
  /** 오류 안내(대기열 2-1-15): 화면에서 오류가 나면 버튼 위에 「알리기」 말풍선을 한 번 띄운다. 잡히지 않은 오류·처리되지 않은 약속 실패·화면에 그려진 빨간 오류 안내를 본다(1분에 한 번만) */
  let lastNoticeAt = 0, noticeTimer = 0;
  const raise = (raw) => { const n = errorNotice(raw); if (dead || !n.show || st.open || !noticeAllowed(lastNoticeAt, Date.now())) return; lastNoticeAt = Date.now(); st.notice = n.summary; paint(); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { st.notice = ''; paint(); }, 20000); };
  const onErr = (ev) => { if (ev && ev.filename && String(ev.filename).indexOf(location.origin) !== 0) return; raise({ message: (ev && ev.message) || (ev && ev.error && ev.error.message) || '' }); };
  const onRej = (ev) => raise({ message: (ev && ev.reason && (ev.reason.message || String(ev.reason))) || '' });
  const mo = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) { if (!(n instanceof Element) || host.contains(n)) continue; const a = n.matches && n.matches('.jh-alert[data-tone="danger"]') ? n : (n.querySelector ? n.querySelector('.jh-alert[data-tone="danger"]') : null); if (a && alertLooksLikeError(a.textContent)) { raise({ message: a.textContent }); return; } } });
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onRej); mo.observe(document.body, { childList: true, subtree: true });
  /** 내가 보낸 건의를 읽어 새 답변 점을 갱신한다(조용히 — 화면을 다시 그리는 것은 점이 바뀔 때와 내 건의 탭을 볼 때만) */
  const loadMine = async (force) => {
    const now = Date.now(); if (!force && now - lastMine < MINE_EVERY_MS) return; lastMine = now;
    try { const snap = await getDocs(query(collection(db, FB_COL), where('uid', '==', me.uid), limit(50))); st.mine = snap.docs.map(rowOf); st.mineLoaded = true; const u = unreadCount(st.mine) > 0; if (u !== st.unread || (st.open && st.tab === 'mine')) { st.unread = u; paint(); } }
    catch (e) { st.mineLoaded = true; }
  };
  /** 내 건의 탭을 열면 읽지 않은 답변을 「읽음」으로 바꾼다(화면에는 이번에 한해 「새 답변」 표시를 남긴다) */
  const markSeen = async () => {
    const fresh = st.mine.filter((r) => r.d.userUnread === true); if (!fresh.length) return;
    fresh.forEach((r) => { st.newIds[r.id] = true; });
    for (const r of fresh) { try { await updateDoc(doc(db, FB_COL, r.id), { userUnread: false }); r.d.userUnread = false; } catch (e) { /* 읽음 표시가 안 돼도 화면은 그대로 */ } }
    st.unread = unreadCount(st.mine) > 0; paint();
  };
  const loadInbox = async () => {
    st.err = ''; st.loaded = false; paint();
    try { const snap = await getDocs(query(collection(db, FB_COL), orderBy('createdAt', 'desc'), limit(200))); st.rows = snap.docs.map(rowOf); }
    catch (e) { st.err = '받은 건의를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.'; }
    st.loaded = true; paint();
  };
  const loadReplies = async (id) => {
    st.replies[id] = { loaded: false, list: [], err: '' }; paint();
    try { const snap = await getDocs(query(collection(db, FB_COL, id, 'replies'), orderBy('createdAt', 'asc'), limit(100))); st.replies[id] = { loaded: true, list: snap.docs.map(replyOf), err: '' }; }
    catch (e) { st.replies[id] = { loaded: true, list: [], err: '댓글을 불러오지 못했습니다.' }; }
    paint();
  };
  const send = async () => {
    const left = cooldownLeft(st.last, Date.now());
    if (left) { st.msg = Math.ceil(left / 1000) + '초 뒤에 다시 보낼 수 있습니다.'; st.msgTone = 'warn'; paint(); return; }
    const r = buildFeedbackDoc({ category: st.category, text: st.text }, me, { hash: location.hash, build: buildOf(), userAgent: navigator.userAgent, width: window.innerWidth, height: window.innerHeight });
    if (r.error) { st.msg = r.error; st.msgTone = 'danger'; paint(); return; }
    st.busy = true; st.msg = ''; paint();
    try { await addDoc(collection(db, FB_COL), Object.assign({}, r.doc, { createdAt: serverTimestamp() })); st.last = Date.now(); st.text = ''; st.busy = false; st.msg = '접수했습니다. 의견 감사합니다. 답변이 달리면 이 버튼에 점으로 알려 드립니다.'; st.msgTone = 'ok'; paint(); lastMine = 0; loadMine(true); }
    catch (e) { st.busy = false; st.msg = '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; st.msgTone = 'danger'; paint(); }
  };
  /** 관리자: 댓글만 남기기(done=false) 또는 조치 완료로 처리(done=true, 댓글은 선택) — 한 번에 저장(batch)하고 건의자에게 알림(userUnread=true) */
  const reply = async (id, done) => {
    const row = st.rows.find((x) => x.id === id); if (!row) return; const text = st.draft.trim();
    let rdoc = null; if (text || !done) { const r = buildReplyDoc(text, me, done ? 'done' : 'reply'); if (r.error) { st.msg = r.error; st.msgTone = 'danger'; paint(); return; } rdoc = r.doc; }
    st.busy = true; st.msg = ''; paint();
    try {
      const b = writeBatch(db); const patch = { lastReplyAt: serverTimestamp(), userUnread: true };
      if (rdoc) { b.set(doc(collection(db, FB_COL, id, 'replies')), Object.assign({}, rdoc, { createdAt: serverTimestamp() })); patch.replyCount = (row.d.replyCount || 0) + 1; }
      if (done) { patch.status = 'done'; patch.handledAt = serverTimestamp(); patch.handledBy = me.uid; } else if ((row.d.status || 'new') === 'new') { patch.status = 'seen'; patch.handledAt = serverTimestamp(); patch.handledBy = me.uid; }
      b.update(doc(db, FB_COL, id), patch); await b.commit();
      if (patch.replyCount) row.d.replyCount = patch.replyCount; if (patch.status) { row.d.status = patch.status; row.d.handledSec = Math.floor(Date.now() / 1000); }
      st.draft = ''; st.busy = false; st.msg = done ? '조치 완료로 처리했습니다. 건의하신 분께 알림이 갔습니다.' : '댓글을 남겼습니다. 건의하신 분께 알림이 갔습니다.'; st.msgTone = 'ok';
      if (done) st.expand = ''; paint(); if (!done) loadReplies(id);
    } catch (e) { st.busy = false; st.msg = '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; st.msgTone = 'danger'; paint(); }
  };
  host.addEventListener('input', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLTextAreaElement)) return;
    if (t.hasAttribute('data-fb-text')) { st.text = t.value; if (st.msg && st.msgTone === 'danger') { st.msg = ''; const m = host.querySelector('.jh-fb__msg'); if (m) m.remove(); } const c = host.querySelector('.jh-fb__bar .jh-field__hint'); if (c) c.textContent = st.text.length + ' / 2000자'; }
    else if (t.hasAttribute('data-fb-reply')) st.draft = t.value;
  });
  host.addEventListener('change', (ev) => { const t = ev.target; if (t instanceof HTMLInputElement && t.hasAttribute('data-fb-cat')) st.category = t.value; });
  host.addEventListener('click', async (ev) => {
    const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg, pa)) paint(); return; }
    const t = ev.target instanceof Element ? ev.target.closest('[data-fb-toggle],[data-fb-report],[data-fb-noticeclose],[data-fb-close],[data-fb-send],[data-fb-tab],[data-fb-next],[data-fb-reload],[data-fb-exp],[data-fb-replysend],[data-fb-done]') : null; if (!t) return;
    if (t.hasAttribute('data-fb-noticeclose')) { st.notice = ''; paint(); return; }
    if (t.hasAttribute('data-fb-report')) { st.open = true; st.tab = 'send'; st.category = 'bug'; st.text = errorReportDraft(st.notice); st.notice = ''; st.msg = ''; paint(); const ta = host.querySelector('[data-fb-text]'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } loadMine(true); return; }
    if (t.hasAttribute('data-fb-toggle')) { st.open = !st.open; st.msg = ''; paint(); if (st.open) { const ta = host.querySelector('[data-fb-text]'); if (ta) ta.focus(); loadMine(true); } return; }
    if (t.hasAttribute('data-fb-close')) { st.open = false; paint(); return; }
    if (t.hasAttribute('data-fb-send')) { await send(); return; }
    if (t.hasAttribute('data-fb-tab')) {
      const k = t.getAttribute('data-fb-tab'); st.tab = ['inbox', 'done', 'mine'].includes(k) ? k : 'send'; st.msg = ''; st.expand = ''; st.draft = ''; paint();
      if ((st.tab === 'inbox' || st.tab === 'done') && !st.loaded) await loadInbox();
      if (st.tab === 'mine') { await loadMine(true); await markSeen(); }
      return;
    }
    if (t.hasAttribute('data-fb-reload')) { await loadInbox(); return; }
    if (t.hasAttribute('data-fb-exp')) { const id = t.getAttribute('data-fb-exp'); st.draft = ''; st.msg = ''; if (st.expand === id) { st.expand = ''; paint(); return; } st.expand = id; paint(); await loadReplies(id); return; }
    if (t.hasAttribute('data-fb-replysend')) { await reply(t.getAttribute('data-fb-replysend'), false); return; }
    if (t.hasAttribute('data-fb-done')) { await reply(t.getAttribute('data-fb-done'), true); return; }
    if (t.hasAttribute('data-fb-next')) {
      const id = t.getAttribute('data-fb-next'); const row = st.rows.find((x) => x.id === id); if (!row) return; const to = nextStatus(row.d.status || 'new');
      try { await updateDoc(doc(db, FB_COL, id), { status: to, handledAt: serverTimestamp(), handledBy: me.uid }); row.d.status = to; paint(); } catch (e) { st.err = '상태를 바꾸지 못했습니다.'; paint(); }
    }
  });
  const onKey = (ev) => { if (ev.key === 'Escape' && st.open) { st.open = false; paint(); } };
  const onVis = () => { if (document.visibilityState === 'visible') loadMine(false); };
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVis);
  paint(); loadMine(true);
  return () => { dead = true; clearTimeout(noticeTimer); mo.disconnect(); window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); host.remove(); };
}
