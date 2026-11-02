/* 포털 문의·건의 창 — 순수 화면 부분(파이어베이스 없이 시험 가능). 저장·이벤트 연결은 feedback.js */
import { esc } from '../core/ui.js?v=20261102b';
import { pageInfo, pagerSync, pagerHtml } from './pager.js?v=20261102b';
import { FB_CATEGORIES, FB_STATUS, FB_MAX, categoryLabel, statusLabel, countByStatus, dayText, sortNewestFirst, nextStatus } from './feedback-logic.js?v=20261102b';
export const newState = (me) => ({ open: false, tab: 'send', category: 'inconvenience', text: '', busy: false, msg: '', msgTone: '', isAdmin: !!(me && me.admin), rows: [], loaded: false, err: '', pg: {}, last: 0 });
export const buttonHtml = (open) => '<button type="button" class="jh-fb__btn" data-fb-toggle aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="jh-fb-panel" title="사용 중 불편한 점을 남겨 주세요"><span aria-hidden="true">💬</span><span class="jh-fb__lbl">문의·건의</span></button>';
export function sendHtml(st) {
  const opts = FB_CATEGORIES.map((c) => '<label class="jh-fb__cat"><input type="radio" name="jh-fb-cat" data-fb-cat value="' + c[0] + '"' + (st.category === c[0] ? ' checked' : '') + '><span>' + esc(c[1]) + '</span></label>').join('');
  return '<div class="jh-fb__cats" role="radiogroup" aria-label="분류">' + opts + '</div>'
    + '<textarea class="jh-input jh-fb__text" data-fb-text maxlength="' + FB_MAX + '" rows="6" placeholder="어떤 점이 불편하셨나요? 어느 화면에서 무엇을 하다가였는지 적어 주시면 빨리 고칠 수 있습니다.">' + esc(st.text) + '</textarea>'
    + '<div class="jh-field__hint">지금 보던 화면과 브라우저 정보가 함께 전달됩니다. <b>비밀번호·주민등록번호·계좌번호는 적지 마세요.</b></div>'
    + (st.msg ? '<div class="jh-fb__msg" data-tone="' + esc(st.msgTone || '') + '" role="status">' + esc(st.msg) + '</div>' : '')
    + '<div class="jh-fb__bar"><span class="jh-field__hint">' + st.text.length + ' / ' + FB_MAX + '자</span><button type="button" class="jh-btn" data-variant="primary" data-fb-send' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '보내는 중…' : '보내기') + '</button></div>';
}
export function rowHtml(r) {
  const d = r.d || {}; const st = d.status || 'new';
  const act = st === 'done' ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-fb-next="' + esc(r.id) + '">' + (st === 'new' ? '확인함' : '완료') + '</button>';
  return '<li class="jh-fb__row" data-st="' + esc(st) + '"><div class="jh-fb__rowhead"><span class="jh-chip" data-tone="' + (st === 'new' ? 'warn' : st === 'seen' ? 'accent' : 'muted') + '">' + esc(statusLabel(st)) + '</span><span class="jh-chip">' + esc(categoryLabel(d.category)) + '</span><span class="jh-field__hint">' + esc(d.name || '이름 없음') + ' · ' + esc(dayText(d.createdSec)) + '</span></div>'
    + '<div class="jh-fb__body">' + esc(d.text || '') + '</div><div class="jh-field__hint">' + esc((d.page || '') + (d.ua ? ' · ' + d.ua : '') + (d.viewport ? ' · ' + d.viewport : '') + (d.build ? ' · ' + d.build : '')) + '</div>' + (act ? '<div class="jh-fb__rowact">' + act + '</div>' : '') + '</li>';
}
export function inboxHtml(st) {
  if (st.err) return '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>';
  if (!st.loaded) return '<div class="jh-skeleton" style="height:var(--u-120)"></div>';
  const rows = sortNewestFirst(st.rows); const c = countByStatus(rows);
  const head = '<div class="jh-fb__sum"><span class="jh-chip" data-tone="warn">신규 ' + c.new + '</span><span class="jh-chip" data-tone="accent">확인 ' + c.seen + '</span><span class="jh-chip" data-tone="muted">완료 ' + c.done + '</span><button type="button" class="jh-btn" data-variant="ghost" data-fb-reload>새로고침</button></div>';
  if (!rows.length) return head + '<div class="jh-empty">받은 건의가 없습니다.</div>';
  const info = pageInfo(rows.length, pagerSync(st.pg, 'feedback', 'all')); const slice = rows.slice(info.from, info.to);
  return head + '<ul class="jh-fb__list">' + slice.map(rowHtml).join('') + '</ul>' + pagerHtml(info, 'feedback');
}
export function panelHtml(st) {
  const tabs = st.isAdmin ? '<div class="jh-segmented" role="tablist"><button type="button" class="jh-segmented__item" role="tab" data-fb-tab="send" aria-pressed="' + (st.tab === 'send') + '">건의하기</button><button type="button" class="jh-segmented__item" role="tab" data-fb-tab="inbox" aria-pressed="' + (st.tab === 'inbox') + '">받은 건의</button></div>' : '';
  return '<div class="jh-fb__head"><strong>문의·건의</strong><button type="button" class="jh-btn" data-variant="ghost" data-fb-close aria-label="닫기">✕</button></div>' + tabs + '<div class="jh-fb__main">' + (st.tab === 'inbox' && st.isAdmin ? inboxHtml(st) : sendHtml(st)) + '</div>';
}
export { nextStatus, FB_STATUS };
