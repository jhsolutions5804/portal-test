/* 영업기획 월간 보고서 경영 층 화면(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 순수 HTML(저장·호출 없음). 시험: tests/plan-monthly-mgmt-view.test.mjs · 계산: monthly-mgmt.js · 틀: closing-view.js(같은 CSS 클래스).
 * st = { ym, rows(monthRows), totals(monthTotals), srv: { state: 'loading'|'ok'|'error'|'denied', notes } }. 영업기획 모듈 전체가 관리자 전용이라(manifest perm) 별도 권한 코드는 없다.
 * 원칙: 모르는 값은 숫자로 꾸미지 않고 이유를 보인다(마진율·수율이 null 이면 "—"와 이유). 매출 기준 = 완결 청구(1-2-3-a). 공통비는 반영하지 않는다(프로젝트 화면의 공통비 반영 이익에서 본다). */
import { esc } from '../../core/ui.js?v=20261022f';
import { won, card, chip } from './ui.js?v=20261022f';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const money = (v) => (fin(v) ? won(v) : '—');
const pct = (v) => (fin(v) ? v.toFixed(1) + '%' : '—');
const ratio = (v) => (fin(v) ? v.toFixed(1) + '배' : '—');
const cell = (label, v, hint, tone) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + v + '</strong>' + (hint ? '<span class="jh-field__hint">' + esc(hint) + '</span>' : '') + '</div>';
const why = (r, kind) => { // 마진율·수율을 낼 수 없는 이유 — 숫자를 꾸미지 않고 사실을 적는다
  if (r.status === 'nolink') return 'PJT 연결 없음'; if (r.status === 'nocost') return '원가 확인 못함';
  if (kind === 'margin') return fin(r.collected) && r.collected > 0 ? '' : '완결 청구 없음'; if (kind === 'yield') return !(fin(r.collected) && r.collected > 0) ? '완결 청구 없음' : (fin(r.ownLabor) && r.ownLabor > 0 ? '' : '노무 없음'); return '';
};
const metric = (r, kind) => { const v = kind === 'margin' ? r.margin : r.laborYield; if (fin(v)) return kind === 'margin' ? pct(v) : ratio(v); const w = why(r, kind); return '<span class="jh-field__hint">— ' + esc(w) + '</span>'; };
const chips = (r) => (r.status === 'nolink' ? chip('PJT 연결 없음', 'amber') : r.status === 'nocost' ? chip('원가 확인 못함', 'amber') : '') + (r.restated === true ? chip('전달 값 정정됨', 'amber') : '');
export function monthlyMgmtHtml(st) {
  const s = isO(st) ? st : {}; const ym = typeof s.ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.ym) ? s.ym : ''; const [y, m] = ym ? ym.split('-') : ['', ''];
  const rows = (Array.isArray(s.rows) ? s.rows : []).filter(isO); const t = isO(s.totals) ? s.totals : {}; const srv = isO(s.srv) ? s.srv : { state: 'loading', notes: [] }; const notes = Array.isArray(srv.notes) ? srv.notes.filter((x) => typeof x === 'string' && x) : [];
  const nav = '<div class="jh-plan__bar"><span class="jh-plan__line"><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="prev" aria-label="이전 달">‹</button><strong class="jh-plan__big">' + (ym ? y + '년 ' + Number(m) + '월' : '월 선택') + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-mm-act="next" aria-label="다음 달">›</button></span></div>';
  const unknown = fin(t.unknown) ? t.unknown : 0, restated = fin(t.restated) ? t.restated : 0;
  const srvLine = srv.state === 'loading' ? '<div class="jh-field__hint">원가를 불러오는 중입니다… 청구·수금 금액은 먼저 보입니다.</div>'
    : srv.state === 'error' ? '<div class="jh-alert" data-tone="danger" role="alert">원가(서버 마진 집계)를 불러오지 못했습니다. <button type="button" class="jh-btn" data-variant="ghost" data-mm-act="reload">다시 불러오기</button></div>'
    : srv.state === 'denied' ? '<div class="jh-field__hint" data-tone="warn">원가는 재무회계 권한이 있는 계정만 볼 수 있습니다. 청구·수금 금액만 보입니다.</div>' : '';
  const head = '<div class="jh-plan__pad">' + nav + srvLine
    + '<div class="jh-plan__sum">' + cell('청구 발행', money(t.invoiced) + '원', '발행일이 이 달') + cell('완결(수금)', money(t.collected) + '원', '매출로 보는 금액') + cell('지급예정서 발행', money(t.payIssued) + '원', '외주·노무') + cell('원가', unknown ? '—' : money(t.cost) + '원', unknown ? '원가를 모르는 프로젝트가 있어 합계를 내지 않습니다' : '지급 발행 + 현장경비 + 자체 직접노무비') + '</div>'
    + '<div class="jh-plan__sum jh-plan__sum--3">' + cell('마진율', unknown ? '—' : pct(t.margin), unknown ? '' : (fin(t.margin) ? '(완결 − 원가) ÷ 완결' : '완결 청구 없음')) + cell('노무 수율', unknown ? '—' : ratio(t.laborYield), unknown ? '' : (fin(t.laborYield) ? '완결 ÷ 자체 직접노무비' : '완결 청구 또는 직접노무비 없음')) + cell('프로젝트', rows.length + '개') + '</div>'
    + (unknown ? '<div class="jh-field__hint" data-tone="warn">원가를 모르는 프로젝트 ' + unknown + '개(PJT 연결 없음 또는 서버 응답 없음)는 합계 마진율·수율에서 제외하지 않고 합계를 비웠습니다. 청구만 보이고 원가는 없는 프로젝트를 합치면 마진이 부풀려지기 때문입니다.</div>' : '')
    + (restated ? '<div class="jh-field__hint" data-tone="warn">전달 값이 정정된 프로젝트 ' + restated + '개: 과거 전표를 고쳐 누계가 줄어 그 달 원가가 음수로 나왔습니다(그대로 보입니다).</div>' : '') + '</div>';
  const body = rows.length ? rows.map((r) => '<tr><td><a href="#/plan/projects/' + esc(r.id) + '">' + esc((r.code || '-') + (r.name ? ' ' + r.name : '')) + '</a> ' + chips(r) + '</td><td class="jh-plan__num">' + money(r.invoiced) + '</td><td class="jh-plan__num">' + money(r.collected) + '</td><td class="jh-plan__num">' + money(r.payIssued) + '</td><td class="jh-plan__num">' + money(r.direct) + '</td><td class="jh-plan__num">' + money(r.ownLabor) + '</td><td class="jh-plan__num">' + money(r.cost) + '</td><td class="jh-plan__num">' + metric(r, 'margin') + '</td><td class="jh-plan__num">' + metric(r, 'yield') + '</td></tr>').join('') : '';
  const table = '<div class="jh-plan__pad">' + (body ? '<div class="jh-plan__scroll"><table class="jh-plan__table"><thead><tr><th>프로젝트</th><th class="jh-plan__num">청구 발행</th><th class="jh-plan__num">완결</th><th class="jh-plan__num">지급 발행</th><th class="jh-plan__num">현장경비</th><th class="jh-plan__num">자체 노무</th><th class="jh-plan__num">원가</th><th class="jh-plan__num">마진율</th><th class="jh-plan__num">노무 수율</th></tr></thead><tbody>' + body + '</tbody></table></div>' : '<div class="jh-field__hint">이 달에 청구도 원가도 없는 달입니다(해당하는 프로젝트가 없습니다).</div>') + '</div>';
  const basis = ['매출은 완결 처리한 청구서만 셉니다(발행했지만 수금 전인 청구는 마진 분모에 들어가지 않습니다).', '그 달 원가는 서버 마진 집계(누계)의 "그 달까지"와 "전달까지" 차이입니다(증분).', '공통비는 반영하지 않았습니다. 공통비 반영 이익은 프로젝트 화면의 [공통비 반영해서 보기]에서 봅니다.'].concat(notes);
  const note = '<div class="jh-plan__pad">' + basis.map((n) => '<div class="jh-field__hint">· ' + esc(n) + '</div>').join('') + '</div>';
  return '<div class="jh-plan">' + card('월간 보고서(경영)', head) + card('프로젝트별 그 달 실적', table) + card('계산 기준과 주의', note) + '</div>';
}
