/* 영업기획 월간 보고서 경영 층 화면(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 순수 HTML(저장·호출 없음). 시험: tests/plan-monthly-mgmt-view.test.mjs · 계산: monthly-mgmt.js · 틀: closing-view.js(같은 CSS 클래스).
 * st = { ym, rows(monthRows), totals(monthTotals), srv: { state: 'loading'|'ok'|'error'|'denied', notes } }. 영업기획 모듈 전체가 관리자 전용이라(manifest perm) 별도 권한 코드는 없다.
 * 원칙: 모르는 값은 숫자로 꾸미지 않고 이유를 보인다(마진율·수율이 null 이면 "—"와 이유). 매출 기준 = 완결 청구(1-2-3-a). 공통비는 반영하지 않는다(프로젝트 화면의 공통비 반영 이익에서 본다). */
import { esc } from '../../core/ui.js?v=20261022h';
import { won, card, chip } from './ui.js?v=20261022h';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const money = (v) => (fin(v) ? won(v) : '—');
const pct = (v) => (fin(v) ? v.toFixed(1) + '%' : '—');
const ratio = (v) => (fin(v) ? v.toFixed(1) + '배' : '—');
const cell = (label, v, hint, tone) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + v + '</strong>' + (hint ? '<span class="jh-field__hint">' + esc(hint) + '</span>' : '') + '</div>';
const why = (r, kind, loading) => { // 마진율·수율을 낼 수 없는 이유 — 숫자를 꾸미지 않고 사실을 적는다. 서버를 기다리는 중이면 "확인 못함"이 아니라 "불러오는 중"(곧 올 값을 못 찾았다고 오해하게 하지 않는다). 연결이 없으면 기다려도 안 오니 그대로
  if (r.status === 'nolink') return 'PJT 연결 없음'; if (r.status === 'nocost') return loading ? '원가 불러오는 중' : '원가 확인 못함';
  if (kind === 'margin') return fin(r.collected) && r.collected > 0 ? '' : '완결 청구 없음'; if (kind === 'yield') return !(fin(r.collected) && r.collected > 0) ? '완결 청구 없음' : (fin(r.ownLabor) && r.ownLabor > 0 ? '' : '노무 없음'); return '';
};
const metric = (r, kind, loading) => { const v = kind === 'margin' ? r.margin : r.laborYield; if (fin(v)) return kind === 'margin' ? pct(v) : ratio(v); const w = why(r, kind, loading); return '<span class="jh-field__hint">— ' + esc(w) + '</span>'; };
const chips = (r, loading) => (r.status === 'nolink' ? chip('PJT 연결 없음', 'amber') : r.status === 'nocost' && !loading ? chip('원가 확인 못함', 'amber') : '') + (r.restated === true ? chip('전달 값 정정됨', 'amber') : '');
/* 2단계 추이 카드(최근 6개월 프로젝트 × 월) — 서버 byMonth(월별 값)로 만든 행렬을 그린다. 지표 전환(마진율 ↔ 노무 수율)은 서버를 부르지 않는다. 모르는 값은 "—"와 이유(title), 음수 마진은 붉게(data-tone="neg"), 합계는 원가를 모르는 프로젝트가 있으면 비운다 */
const monthNum = (ym) => String(ym).length === 7 ? Number(String(ym).slice(5)) + '월' : '';
const cellWhy = (c, metric) => { if (c.status === 'nolink') return 'PJT 연결 없음'; if (c.status === 'nocost') return '원가 확인 못함'; if (!(fin(c.collected) && c.collected > 0)) return '완결 청구 없음'; return metric === 'yield' && !(fin(c.ownLabor) && c.ownLabor > 0) ? '노무 없음' : ''; };
const trendCell = (c, metric) => { const v = metric === 'yield' ? c.laborYield : c.margin; if (fin(v)) return '<td class="jh-plan__num"' + (metric === 'margin' && v < 0 ? ' data-tone="neg"' : '') + '>' + (metric === 'yield' ? ratio(v) : pct(v)) + '</td>'; const w = cellWhy(c, metric); return '<td class="jh-plan__num"' + (w ? ' title="' + esc(w) + '"' : '') + '>—</td>'; };
const trendTotal = (t, metric) => { const v = metric === 'yield' ? t.laborYield : t.margin; const u = fin(t.unknown) ? t.unknown : 0; if (u > 0) return '<td class="jh-plan__num" title="' + esc('원가를 모르는 프로젝트 ' + u + '개') + '">—</td>'; if (fin(v)) return '<td class="jh-plan__num"' + (metric === 'margin' && v < 0 ? ' data-tone="neg"' : '') + '>' + (metric === 'yield' ? ratio(v) : pct(v)) + '</td>'; return '<td class="jh-plan__num" title="완결 청구 없음">—</td>'; };
function trendCard(s) {
  const metric = s.metric === 'yield' ? 'yield' : 'margin'; const state = ['ok', 'loading', 'nodata', 'unavailable'].indexOf(s.trendState) >= 0 ? s.trendState : 'loading';
  const tgl = '<div class="jh-plan__line"><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="metric:margin" aria-pressed="' + (metric === 'margin') + '">마진율</button><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="metric:yield" aria-pressed="' + (metric === 'yield') + '">노무 수율</button></div>';
  const msg = (t) => '<div class="jh-plan__pad"><div class="jh-field__hint">' + esc(t) + '</div></div>';
  if (state === 'loading') return card('최근 6개월 추이', msg('월별 값을 불러오는 중입니다…'));
  if (state === 'nodata') return card('최근 6개월 추이', msg('서버가 아직 월별 값을 주지 않습니다(서버 업데이트 전). 위 표의 그 달 값은 정상입니다.'));
  if (state === 'unavailable') return card('최근 6개월 추이', msg('월별 값을 불러오지 못했습니다(원가를 확인할 수 없어 추이를 볼 수 없습니다).'));
  const t = isO(s.trend) ? s.trend : null; const months = t && Array.isArray(t.months) ? t.months.filter((m) => typeof m === 'string') : []; const rows = t && Array.isArray(t.rows) ? t.rows.filter((r) => isO(r) && Array.isArray(r.cells)) : []; const totals = t && Array.isArray(t.totals) ? t.totals : [];
  if (!t || !months.length) return card('최근 6개월 추이', msg('월별 값을 불러오는 중입니다…'));
  if (!rows.length) return card('최근 6개월 추이', msg('최근 ' + months.length + '개월에 청구도 원가도 없습니다(해당하는 프로젝트가 없습니다).'));
  const cur = typeof s.ym === 'string' ? s.ym : ''; const head = '<tr><th>프로젝트</th>' + months.map((m) => '<th class="jh-plan__num"' + (m === cur ? ' aria-current="date"' : '') + '>' + esc(monthNum(m)) + '</th>').join('') + '</tr>';
  const body = rows.map((r) => '<tr><td><a href="#/plan/projects/' + esc(r.id) + '">' + esc((r.code || '-') + (r.name ? ' ' + r.name : '')) + '</a> ' + (r.cells.some((c) => isO(c) && c.status === 'nolink') ? chip('PJT 연결 없음', 'amber') : '') + '</td>' + months.map((m, i) => trendCell(isO(r.cells[i]) ? r.cells[i] : {}, metric)).join('') + '</tr>').join('');
  const foot = '<tr><td><strong>합계</strong></td>' + months.map((m, i) => trendTotal(isO(totals[i]) ? totals[i] : {}, metric)).join('') + '</tr>';
  return card('최근 6개월 추이', '<div class="jh-plan__pad">' + tgl + '<div class="jh-plan__scroll"><table class="jh-plan__table"><thead>' + head + '</thead><tbody>' + body + foot + '</tbody></table></div><div class="jh-field__hint">그 달 완결 청구 기준, 월별 값은 서버가 준 그 달 값 그대로입니다(누계 차이가 아님). 칸에 마우스를 올리면 "—"의 이유가 보입니다.</div></div>');
}
export function monthlyMgmtHtml(st) {
  const s = isO(st) ? st : {}; const ym = typeof s.ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.ym) ? s.ym : ''; const [y, m] = ym ? ym.split('-') : ['', ''];
  const rows = (Array.isArray(s.rows) ? s.rows : []).filter(isO); const t = isO(s.totals) ? s.totals : {}; const srv = isO(s.srv) ? s.srv : { state: 'loading', notes: [] }; const notes = Array.isArray(srv.notes) ? srv.notes.filter((x) => typeof x === 'string' && x) : [];
  const nav = '<div class="jh-plan__bar"><span class="jh-plan__line"><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="prev" aria-label="이전 달">‹</button><strong class="jh-plan__big">' + (ym ? y + '년 ' + Number(m) + '월' : '월 선택') + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="next" aria-label="다음 달">›</button></span></div>';
  const loading = srv.state === 'loading'; const unknown = fin(t.unknown) ? t.unknown : 0, restated = fin(t.restated) ? t.restated : 0;
  if (typeof s.error === 'string' && s.error) return '<div class="jh-plan">' + card('월간 보고서(경영)', '<div class="jh-plan__pad">' + nav + '<div class="jh-alert" data-tone="danger" role="alert">' + esc(s.error) + '</div></div>') + '</div>'; // 기본 데이터를 못 읽었으면 알림과 월 이동만 — 없는 데이터로 숫자를 그리지 않는다
  const srvLine = srv.state === 'loading' ? '<div class="jh-field__hint">원가를 불러오는 중입니다… 청구·수금 금액은 먼저 보입니다.</div>'
    : srv.state === 'error' ? '<div class="jh-alert" data-tone="danger" role="alert">원가(서버 마진 집계)를 불러오지 못했습니다. <button type="button" class="jh-btn" data-variant="ghost" data-mm-act="reload">다시 불러오기</button></div>'
    : srv.state === 'denied' ? '<div class="jh-field__hint" data-tone="warn">원가는 재무회계 권한이 있는 계정만 볼 수 있습니다. 청구·수금 금액만 보입니다.</div>' : '';
  const head = '<div class="jh-plan__pad">' + nav + srvLine
    + '<div class="jh-plan__sum">' + cell('청구 발행', money(t.invoiced) + '원', '발행일이 이 달') + cell('완결(수금)', money(t.collected) + '원', '매출로 보는 금액') + cell('지급예정서 발행', money(t.payIssued) + '원', '외주·노무') + cell('원가', unknown ? '—' : money(t.cost) + '원', unknown ? '원가를 모르는 프로젝트가 있어 합계를 내지 않습니다' : '지급 발행 + 현장경비 + 자체 직접노무비') + '</div>'
    + '<div class="jh-plan__sum jh-plan__sum--3">' + cell('마진율', unknown ? '—' : pct(t.margin), unknown ? '' : (fin(t.margin) ? '(완결 − 원가) ÷ 완결' : '완결 청구 없음')) + cell('노무 수율', unknown ? '—' : ratio(t.laborYield), unknown ? '' : (fin(t.laborYield) ? '완결 ÷ 자체 직접노무비' : '완결 청구 또는 직접노무비 없음')) + cell('프로젝트', rows.length + '개') + '</div>'
    + (unknown ? '<div class="jh-field__hint" data-tone="warn">원가를 모르는 프로젝트 ' + unknown + '개(PJT 연결 없음 또는 서버 응답 없음)는 합계 마진율·수율에서 제외하지 않고 합계를 비웠습니다. 청구만 보이고 원가는 없는 프로젝트를 합치면 마진이 부풀려지기 때문입니다.</div>' : '')
    + (restated ? '<div class="jh-field__hint" data-tone="warn">전달 값이 정정된 프로젝트 ' + restated + '개: 과거 전표를 고쳐 누계가 줄어 그 달 원가가 음수로 나왔습니다(그대로 보입니다).</div>' : '') + '</div>';
  const body = rows.length ? rows.map((r) => '<tr><td><a href="#/plan/projects/' + esc(r.id) + '">' + esc((r.code || '-') + (r.name ? ' ' + r.name : '')) + '</a> ' + chips(r, loading) + '</td><td class="jh-plan__num">' + money(r.invoiced) + '</td><td class="jh-plan__num">' + money(r.collected) + '</td><td class="jh-plan__num">' + money(r.payIssued) + '</td><td class="jh-plan__num">' + money(r.direct) + '</td><td class="jh-plan__num">' + money(r.ownLabor) + '</td><td class="jh-plan__num">' + money(r.cost) + '</td><td class="jh-plan__num">' + metric(r, 'margin', loading) + '</td><td class="jh-plan__num">' + metric(r, 'yield', loading) + '</td></tr>').join('') : '';
  const table = '<div class="jh-plan__pad">' + (body ? '<div class="jh-plan__scroll"><table class="jh-plan__table"><thead><tr><th>프로젝트</th><th class="jh-plan__num">청구 발행</th><th class="jh-plan__num">완결</th><th class="jh-plan__num">지급 발행</th><th class="jh-plan__num">현장경비</th><th class="jh-plan__num">자체 노무</th><th class="jh-plan__num">원가</th><th class="jh-plan__num">마진율</th><th class="jh-plan__num">노무 수율</th></tr></thead><tbody>' + body + '</tbody></table></div>' : '<div class="jh-field__hint">이 달에 청구도 원가도 없는 달입니다(해당하는 프로젝트가 없습니다).</div>') + '</div>';
  const basis = ['매출은 완결 처리한 청구서만 셉니다(발행했지만 수금 전인 청구는 마진 분모에 들어가지 않습니다).', '그 달 원가는 서버 마진 집계(누계)의 "그 달까지"와 "전달까지" 차이입니다(증분).', '공통비는 반영하지 않았습니다. 공통비 반영 이익은 프로젝트 화면의 [공통비 반영해서 보기]에서 봅니다.'].concat(notes);
  const note = '<div class="jh-plan__pad">' + basis.map((n) => '<div class="jh-field__hint">· ' + esc(n) + '</div>').join('') + '</div>';
  return '<div class="jh-plan">' + card('월간 보고서(경영)', head) + card('프로젝트별 그 달 실적', table) + trendCard(s) + card('계산 기준과 주의', note) + '</div>';
}
