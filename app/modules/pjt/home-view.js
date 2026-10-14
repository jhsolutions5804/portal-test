import { esc } from '../../core/ui.js?v=20261014zl';
import { holidayName } from '../../shared/holidays.js?v=20261014zl';
import { itemsForKey, rangeText, TAG_COLOR, TAG_LABEL, dowOf } from './schedule.js?v=20261014zl';
import { dday, infoRows, statusLabel } from './home.js?v=20261014zl';
import { dateText } from './report.js?v=20261014zl';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const link = (st, sub, label, cls) => '<a class="' + (cls || 'jh-btn') + '" ' + (cls ? '' : 'data-variant="secondary" ') + 'href="#/pjt/' + encodeURIComponent(st.proj) + '/' + sub + '">' + label + '</a>';
/** 프로젝트 홈: 프로젝트를 고르면 처음 보이는 화면 — 왼쪽 요약 카드 | 오늘 일정·공사일보 | 기본정보(바로가기 없음 — 사이드 메뉴와 겹침). 모든 프로젝트 같은 형식 */
export function homeHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고르세요(참여자로 지정된 프로젝트만 열립니다).</div></div>';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-pjt__chip" data-tone="' + (st.doc && st.doc.status === 'ended' ? 'gray' : 'blue') + '">' + statusLabel(st.doc) + '</span><span class="jh-field__hint">프로젝트 홈</span></div>';
  if (!st.ready) return '<div class="jh-pjt">' + head + '<div class="jh-empty">불러오는 중...</div></div>';
  const unit = st.unit || '대'; const dd = dday((st.doc || {}).startDate, st.today); const p = st.progress;
  const href = (sub) => '#/pjt/' + encodeURIComponent(st.proj) + '/' + sub;
  const kp = (sub, label, value, hint, extra) => (sub ? '<a class="jh-kpi" href="' + href(sub) + '">' : '<div class="jh-kpi">') + '<span class="jh-kpi__label">' + esc(label) + '</span><span class="jh-kpi__value">' + esc(value) + '</span>' + (extra || '') + '<span class="jh-kpi__hint">' + esc(hint) + (sub ? ' ›' : '') + '</span>' + (sub ? '</a>' : '</div>');
  const meter = p ? '<span class="jh-pjt__bar2"><span style="width:' + Math.max(0, Math.min(100, p.pct)).toFixed(0) + '%"></span></span>' : '';
  const ym = String(st.today).slice(0, 4) + '년 ' + Number(String(st.today).slice(5, 7)) + '월';
  // 요약 카드(왼쪽, 세로): 공정율·시작일 D+·이달 누적 공수·오늘 출역 — 누르면 해당 화면(화면 이동은 사이드 메뉴가 맡는다)
  const kpis = '<div class="jh-kpi-grid">' + kp('progress', '전체 공정율', p ? f1(p.pct) + '%' : (st.progressNote || '계산 중...'), p ? '총 물량 ' + p.items + unit : '공정 탭에서 보기', meter) + kp('', '프로젝트 D+', dd == null ? '시작일 미설정' : (dd >= 0 ? 'D+' + dd : 'D' + dd), (st.doc || {}).startDate ? '시작일 ' + st.doc.startDate : '설정에서 시작일을 입력') + kp('attend', '이달 누적 공수', f1(st.monthMd), ym) + kp('attend', '오늘 출역', st.att.headcount + '명', f1(st.att.mandayTotal) + '공수') + '</div>';
  const items = itemsForKey(st.schedules, st.today); const hol = holidayName(st.today);
  const sched = card('오늘 일정 · ' + dateText(st.today) + (hol ? ' · ' + hol : ''), '<div class="jh-pjt__pad">' + (items.length ? items.map((u) => '<div class="jh-pjt__srow"><span class="jh-pjt__tag" style="background:' + (TAG_COLOR[u.tag] || TAG_COLOR.admin) + '22;color:' + (TAG_COLOR[u.tag] || TAG_COLOR.admin) + '">' + esc(TAG_LABEL[u.tag] || '기타') + '</span><div class="jh-pjt__sbody"><div class="jh-pjt__stitle">' + (u.time ? '<span class="jh-pjt__stime">' + esc(u.time) + '</span> ' : '') + esc(u.text || '(내용 없음)') + '</div><div class="jh-field__hint">' + esc(rangeText(u)) + (u.place ? ' · 📍 ' + esc(u.place) : '') + '</div></div></div>').join('') : '<div class="jh-empty">오늘 등록된 일정이 없습니다.</div>') + '</div>', link(st, 'schedule', '일정 보기', 'jh-btn'));
  const todayDone = st.reports.some((r) => r.date === st.today);
  const rep = card('공사일보', '<div class="jh-pjt__pad"><div class="jh-pjt__bar"><span>오늘 일보: ' + (todayDone ? '<span class="jh-pjt__chip" data-tone="blue">작성됨</span>' : '<span class="jh-pjt__chip" data-tone="amber">작성 전</span>') + '</span>' + link(st, 'report/' + st.today, todayDone ? '오늘 일보 보기' : '오늘 일보 작성', 'jh-btn') + '</div>'
    + (st.reports.length ? st.reports.map((r) => '<div class="jh-pjt__rec"><span><strong>' + esc(r.date.slice(5).replace('-', '/')) + '</strong> ' + esc(r.author) + ' <span class="jh-field__hint">' + esc((r.content || '').split('\n')[0].slice(0, 60)) + '</span></span><a href="#/pjt/' + encodeURIComponent(st.proj) + '/report/' + r.date + '">보기</a></div>').join('') : '<div class="jh-empty">작성된 공사일보가 없습니다.</div>') + '</div>');
  const info = card('📋 기본정보', '<div class="jh-pjt__pad">' + infoRows(st.doc, unit).map(([k, v]) => '<div class="jh-pjt__rec"><span class="jh-field__hint">' + esc(k) + '</span><strong>' + esc(v) + '</strong></div>').join('') + '</div>');
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + '<div class="jh-phome"><aside class="jh-phome__side" aria-label="프로젝트 요약">' + kpis + '</aside><div class="jh-phome__main">' + sched + rep + '</div><div class="jh-phome__detail">' + info + '</div></div></div></div>';
}
