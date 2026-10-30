import { esc } from '../../core/ui.js?v=20261031a';
import { holidayName } from '../../shared/holidays.js?v=20261031a';
import { itemsForKey, rangeText, TAG_COLOR, TAG_LABEL, dowOf, dotsFor, monthGrid } from './schedule.js?v=20261031a';
import { dday, infoRows, statusLabel } from './home.js?v=20261031a';
import { dateText } from './report.js?v=20261031a';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const link = (st, sub, label, cls) => '<a class="' + (cls || 'jh-btn') + '" ' + (cls ? '' : 'data-variant="secondary" ') + 'href="#/pjt/' + encodeURIComponent(st.proj) + '/' + sub + '">' + label + '</a>';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const offKind = (k) => (holidayName(k) || dowOf(k) === 0 ? 'red' : dowOf(k) === 6 ? 'sat' : '');
/** 프로젝트 홈: 왼쪽 월 캘린더, 오른쪽에 캘린더에서 고른 날짜의 일정(그 아래 공사일보·기본정보). 요약 카드·바로가기는 없다 — 화면 이동은 사이드 메뉴. 모든 프로젝트 같은 형식 */
export function homeHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고르세요(참여자로 지정된 프로젝트만 열립니다).</div></div>';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-pjt__chip" data-tone="' + (st.doc && st.doc.status === 'ended' ? 'gray' : 'blue') + '">' + statusLabel(st.doc) + '</span><span class="jh-field__hint">프로젝트 홈</span></div>';
  if (!st.ready) return '<div class="jh-pjt">' + head + '<div class="jh-empty">불러오는 중...</div></div>';
  const unit = st.unit || '대'; const { y, m } = st.month;
  const nav = '<div class="jh-pjt__bar"><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-hm-nav="-1" aria-label="이전 달">‹</button><strong>' + y + '년 ' + (m + 1) + '월</strong><button type="button" class="jh-btn" data-variant="ghost" data-hm-nav="1" aria-label="다음 달">›</button><button type="button" class="jh-btn" data-variant="secondary" data-hm-nav="today">오늘</button></span></div>';
  const dow = DOW.map((d, i) => '<div class="jh-pjt__calh" data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</div>').join('');
  const cells = monthGrid(y, m).flat().map((k) => { if (!k) return '<div class="jh-pjt__calc" data-empty="1"></div>'; const hn = holidayName(k); const dots = dotsFor(st.schedules, k).map((t) => '<span class="jh-pjt__dot" style="background:' + (TAG_COLOR[t] || TAG_COLOR.admin) + '"></span>').join(''); const off = offKind(k) || (itemsForKey(st.schedules, k).some((x) => x.tag === 'off') ? 'red' : '');
    return '<button type="button" class="jh-pjt__calc" data-hm-day="' + k + '" data-sel="' + (k === st.date) + '" data-today="' + (k === st.today) + '" data-off="' + off + '"><span class="jh-pjt__calnum">' + Number(k.slice(8)) + '</span>' + (hn ? '<span class="jh-pjt__calhol">' + esc(hn) + '</span>' : '') + '<span class="jh-pjt__dots">' + dots + '</span></button>'; }).join('');
  const cal = '<section class="jh-card"><div class="jh-pjt__pad">' + nav + '<div class="jh-pjt__calgrid">' + dow + cells + '</div></div></section>';
  const items = itemsForKey(st.schedules, st.date); const hol = holidayName(st.date);
  const sched = card(dateText(st.date) + (hol ? ' · ' + hol : '') + ' 일정', '<div class="jh-pjt__pad">' + (items.length ? items.map((u) => '<div class="jh-pjt__srow"><span class="jh-pjt__tag" style="background:' + (TAG_COLOR[u.tag] || TAG_COLOR.admin) + '22;color:' + (TAG_COLOR[u.tag] || TAG_COLOR.admin) + '">' + esc(TAG_LABEL[u.tag] || '기타') + '</span><div class="jh-pjt__sbody"><div class="jh-pjt__stitle">' + (u.time ? '<span class="jh-pjt__stime">' + esc(u.time) + '</span> ' : '') + esc(u.text || '(내용 없음)') + '</div><div class="jh-field__hint">' + esc(rangeText(u)) + (u.place ? ' · 📍 ' + esc(u.place) : '') + (u.att ? ' · 👥 ' + esc(u.att) : '') + '</div></div></div>').join('') : '<div class="jh-empty">이 날 등록된 일정이 없습니다.</div>') + '</div>', link(st, 'schedule/' + st.date, '일정 등록·수정', 'jh-btn'));
  const done = (st.reportDates && st.reportDates.has(st.date)) || st.reports.some((r) => r.date === st.date);
  const rep = card('공사일보', '<div class="jh-pjt__pad"><div class="jh-pjt__bar"><span>' + esc(dateText(st.date)) + ' 일보: ' + (done ? '<span class="jh-pjt__chip" data-tone="blue">작성됨</span>' : '<span class="jh-pjt__chip" data-tone="amber">작성 전</span>') + '</span>' + link(st, 'report/' + st.date, done ? '일보 보기' : '일보 작성', 'jh-btn') + '</div>'
    + (st.reports.length ? '<div class="jh-field__hint">최근 일보</div>' + st.reports.map((r) => '<div class="jh-pjt__rec"><span><strong>' + esc(r.date.slice(5).replace('-', '/')) + '</strong> ' + esc(r.author) + ' <span class="jh-field__hint">' + esc((r.content || '').split('\n')[0].slice(0, 60)) + '</span></span><a href="#/pjt/' + encodeURIComponent(st.proj) + '/report/' + r.date + '">보기</a></div>').join('') : '<div class="jh-empty">작성된 공사일보가 없습니다.</div>') + '</div>');
  const info = card('📋 기본정보', '<div class="jh-pjt__pad">' + infoRows(st.doc, unit).map(([k, v]) => '<div class="jh-pjt__rec"><span class="jh-field__hint">' + esc(k) + '</span><strong>' + esc(v) + '</strong></div>').join('') + '</div>');
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + '<div class="jh-phome2"><div class="jh-phome2__cal">' + cal + '</div><div class="jh-phome2__side">' + sched + rep + info + '</div></div></div></div>';
}
