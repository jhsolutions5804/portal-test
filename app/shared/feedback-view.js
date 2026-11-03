/* 포털 문의·건의 창 — 순수 화면 부분(파이어베이스 없이 시험 가능). 저장·이벤트 연결은 feedback.js
 * 2026-11-02: 완료 탭 분리 · 댓글(조치 내용) · 건의자 알림(버튼의 점 + 「내 건의」 탭) 추가 */
import { esc } from '../core/ui.js?v=20261103e';
import { pageInfo, pagerSync, pagerHtml } from './pager.js?v=20261103e';
import { FB_CATEGORIES, FB_MAX, FB_REPLY_MAX, categoryLabel, statusLabel, myStatusLabel, countByStatus, dayText, sortNewestFirst, splitInbox, unreadCount } from './feedback-logic.js?v=20261103e';
export const newState = (me) => ({ open: false, tab: 'send', category: 'inconvenience', text: '', busy: false, msg: '', msgTone: '', isAdmin: !!(me && me.admin), rows: [], loaded: false, err: '', mine: [], mineLoaded: false, newIds: {}, expand: '', replies: {}, draft: '', pg: {}, last: 0, unread: false });
export const buttonHtml = (open, unread) => '<button type="button" class="jh-fb__btn" data-fb-toggle aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="jh-fb-panel" title="' + (unread ? '새 답변이 도착했습니다' : '사용 중 불편한 점을 남겨 주세요') + '"><span aria-hidden="true">💬</span><span class="jh-fb__lbl">' + (unread ? '새 답변' : '문의·건의') + '</span>' + (unread ? '<span class="jh-fb__dot" role="status" aria-label="새 답변이 있습니다"></span>' : '') + '</button>';
export function sendHtml(st) {
  const opts = FB_CATEGORIES.map((c) => '<label class="jh-fb__cat"><input type="radio" name="jh-fb-cat" data-fb-cat value="' + c[0] + '"' + (st.category === c[0] ? ' checked' : '') + '><span>' + esc(c[1]) + '</span></label>').join('');
  return '<div class="jh-fb__cats" role="radiogroup" aria-label="분류">' + opts + '</div>'
    + '<textarea class="jh-input jh-fb__text" data-fb-text maxlength="' + FB_MAX + '" rows="6" placeholder="어떤 점이 불편하셨나요? 어느 화면에서 무엇을 하다가였는지 적어 주시면 빨리 고칠 수 있습니다.">' + esc(st.text) + '</textarea>'
    + '<div class="jh-field__hint">지금 보던 화면과 브라우저 정보가 함께 전달됩니다. <b>비밀번호·주민등록번호·계좌번호는 적지 마세요.</b> 답변이 달리면 이 버튼에 점으로 알려 드립니다.</div>'
    + (st.msg ? '<div class="jh-fb__msg" data-tone="' + esc(st.msgTone || '') + '" role="status">' + esc(st.msg) + '</div>' : '')
    + '<div class="jh-fb__bar"><span class="jh-field__hint">' + st.text.length + ' / ' + FB_MAX + '자</span><button type="button" class="jh-btn" data-variant="primary" data-fb-send' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '보내는 중…' : '보내기') + '</button></div>';
}
/** 댓글 한 줄 — 조치 완료와 함께 남긴 것은 「조치 완료」 표시 */
export const replyHtml = (r) => { const d = r.d || {}; return '<li class="jh-fb__reply" data-kind="' + esc(d.kind || 'reply') + '"><div class="jh-fb__rowhead"><span class="jh-field__hint"><b>' + esc(d.name || '관리자') + '</b> · ' + esc(dayText(d.createdSec)) + '</span>' + (d.kind === 'done' ? '<span class="jh-chip" data-tone="success">조치 완료</span>' : '') + '</div><div class="jh-fb__body">' + esc(d.text || '') + '</div></li>'; };
function threadHtml(r, st, admin) {
  const rp = st.replies[r.id] || {}; const status = (r.d && r.d.status) || 'new';
  const list = rp.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(rp.err) + '</div>' : !rp.loaded ? '<div class="jh-skeleton" style="height:var(--u-56)"></div>' : (rp.list.length ? '<ul class="jh-fb__replies">' + rp.list.map(replyHtml).join('') + '</ul>' : '<div class="jh-field__hint">아직 댓글이 없습니다.</div>');
  const form = admin ? '<textarea class="jh-input jh-fb__text" data-fb-reply rows="3" maxlength="' + FB_REPLY_MAX + '" placeholder="처리 내용을 적어 주세요. 건의하신 분께 알림이 갑니다.">' + esc(st.draft) + '</textarea><div class="jh-fb__rowact"><button type="button" class="jh-btn" data-variant="ghost" data-fb-replysend="' + esc(r.id) + '"' + (st.busy ? ' disabled' : '') + '>댓글 남기기</button>' + (status !== 'done' ? '<button type="button" class="jh-btn" data-variant="primary" data-fb-done="' + esc(r.id) + '"' + (st.busy ? ' disabled' : '') + '>조치 완료로 처리</button>' : '') + '</div>' : '';
  return '<div class="jh-fb__thread">' + list + form + '</div>';
}
export function rowHtml(r, st) {
  const d = r.d || {}; const stt = d.status || 'new'; const open = st && st.expand === r.id; const n = d.replyCount || 0;
  const quick = stt === 'new' ? '<button type="button" class="jh-btn" data-variant="ghost" data-fb-next="' + esc(r.id) + '">확인함</button>' : '';
  const tog = '<button type="button" class="jh-btn" data-variant="ghost" data-fb-exp="' + esc(r.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '닫기' : (stt === 'done' ? '댓글 ' + n : '댓글·처리 ' + n)) + '</button>';
  return '<li class="jh-fb__row" data-st="' + esc(stt) + '"><div class="jh-fb__rowhead"><span class="jh-chip" data-tone="' + (stt === 'new' ? 'warn' : stt === 'seen' ? 'accent' : 'muted') + '">' + esc(statusLabel(stt)) + '</span><span class="jh-chip">' + esc(categoryLabel(d.category)) + '</span><span class="jh-field__hint">' + esc(d.name || '이름 없음') + ' · ' + esc(dayText(d.createdSec)) + '</span></div>'
    + '<div class="jh-fb__body">' + esc(d.text || '') + '</div><div class="jh-field__hint">' + esc((d.page || '') + (d.ua ? ' · ' + d.ua : '') + (d.viewport ? ' · ' + d.viewport : '') + (d.build ? ' · ' + d.build : '')) + '</div>'
    + '<div class="jh-fb__rowact">' + quick + tog + '</div>' + (open ? threadHtml(r, st, true) : '') + '</li>';
}
/** 받은 건의(관리자) — mode: 'open'(신규·확인) | 'done'(조치 완료, 따로 모아 봄) */
export function inboxHtml(st, mode) {
  const m = mode === 'done' ? 'done' : 'open';
  if (st.err) return '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>';
  if (!st.loaded) return '<div class="jh-skeleton" style="height:var(--u-120)"></div>';
  const all = st.rows || []; const c = countByStatus(all); const rows = splitInbox(all)[m];
  const head = '<div class="jh-fb__sum"><span class="jh-chip" data-tone="warn">신규 ' + c.new + '</span><span class="jh-chip" data-tone="accent">확인 ' + c.seen + '</span><span class="jh-chip" data-tone="muted">완료 ' + c.done + '</span><button type="button" class="jh-btn" data-variant="ghost" data-fb-reload>새로고침</button></div>';
  if (!rows.length) return head + '<div class="jh-empty">' + (m === 'done' ? '조치 완료된 건의가 없습니다.' : '처리할 건의가 없습니다.') + '</div>';
  const info = pageInfo(rows.length, pagerSync(st.pg, 'feedback-' + m, 'all')); const slice = rows.slice(info.from, info.to);
  return head + '<ul class="jh-fb__list">' + slice.map((r) => rowHtml(r, st)).join('') + '</ul>' + pagerHtml(info, 'feedback-' + m);
}
/** 내 건의(건의자) — 내가 보낸 건의의 처리 상태와 관리자 댓글을 읽는다. 새 답변은 「새 답변」 표시 */
export function mineRowHtml(r, st) {
  const d = r.d || {}; const stt = d.status || 'new'; const open = st.expand === r.id; const n = d.replyCount || 0; const fresh = !!(d.userUnread || (st.newIds && st.newIds[r.id]));
  return '<li class="jh-fb__row" data-st="' + esc(stt) + '"><div class="jh-fb__rowhead"><span class="jh-chip" data-tone="' + (stt === 'done' ? 'success' : stt === 'seen' ? 'accent' : 'warn') + '">' + esc(myStatusLabel(stt)) + '</span><span class="jh-chip">' + esc(categoryLabel(d.category)) + '</span>' + (fresh ? '<span class="jh-chip" data-tone="danger">새 답변</span>' : '') + '<span class="jh-field__hint">' + esc(dayText(d.createdSec)) + '</span></div>'
    + '<div class="jh-fb__body">' + esc(d.text || '') + '</div><div class="jh-fb__rowact"><button type="button" class="jh-btn" data-variant="ghost" data-fb-exp="' + esc(r.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '닫기' : '답변 ' + n) + '</button></div>' + (open ? threadHtml(r, st, false) : '') + '</li>';
}
export function mineHtml(st) {
  if (!st.mineLoaded) return '<div class="jh-skeleton" style="height:var(--u-120)"></div>';
  const rows = sortNewestFirst(st.mine || []);
  if (!rows.length) return '<div class="jh-empty">보낸 건의가 없습니다. 「건의하기」 탭에서 남겨 주세요.</div>';
  const info = pageInfo(rows.length, pagerSync(st.pg, 'feedback-mine', 'all')); const slice = rows.slice(info.from, info.to);
  return '<ul class="jh-fb__list">' + slice.map((r) => mineRowHtml(r, st)).join('') + '</ul>' + pagerHtml(info, 'feedback-mine');
}
const tabBtn = (st, key, label, badge) => '<button type="button" class="jh-segmented__item" role="tab" data-fb-tab="' + key + '" aria-pressed="' + (st.tab === key) + '">' + esc(label) + (badge ? ' <span class="jh-fb__count">' + badge + '</span>' : '') + '</button>';
export function panelHtml(st) {
  const sp = splitInbox(st.rows || []);
  const tabs = '<div class="jh-segmented" role="tablist">' + tabBtn(st, 'send', '건의하기')
    + (st.isAdmin ? tabBtn(st, 'inbox', '받은 건의', st.loaded ? sp.open.length : 0) + tabBtn(st, 'done', '완료', st.loaded ? sp.done.length : 0) : '')
    + tabBtn(st, 'mine', '내 건의', unreadCount(st.mine) ? '새 ' + unreadCount(st.mine) : 0) + '</div>';
  const main = st.tab === 'inbox' && st.isAdmin ? inboxHtml(st, 'open') : st.tab === 'done' && st.isAdmin ? inboxHtml(st, 'done') : st.tab === 'mine' ? mineHtml(st) : sendHtml(st);
  return '<div class="jh-fb__head"><strong>문의·건의</strong><button type="button" class="jh-btn" data-variant="ghost" data-fb-close aria-label="닫기">✕</button></div>' + tabs + (st.msg && st.tab !== 'send' ? '<div class="jh-fb__msg" data-tone="' + esc(st.msgTone || '') + '" role="status">' + esc(st.msg) + '</div>' : '') + '<div class="jh-fb__main">' + main + '</div>';
}
