import { esc } from '../../core/ui.js?v=20261031h';
import { pageList, pagerSizeSelect, pageInfo, pagerSync, pagerHtml as sharedPagerHtml } from '../../shared/pager.js?v=20261031h';
import { TYPE_LABEL, SETTLE_TYPE_LABEL, filterProjects, paginate, pjtSummary, pjtMargin, pjtEstimates, pjtSettlements, estTotal, estTag, settleState, settleAmountForPjt, linkOptions, sortProjects } from './projects.js?v=20261031h';
import { marginExtra, marginNotes, linkedPjtId, evalSaveError, allocFor } from './margin-link.js?v=20261031h';
import { budgetCardHtml } from './budget-view.js?v=20261031h';
import { importFromEstimates } from './budget.js?v=20261031h';
const won = (n) => (Math.round(Number(n) || 0)).toLocaleString('ko-KR');
const signed = (n) => (n >= 0 ? '+' : '') + won(n);
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const chip = (t, tone) => '<span class="jh-plan__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
const statusChip = (p) => (p.status === 'done' ? chip('종료', 'gray') : chip('진행중', 'blue'));
const sumCell = (label, v, tone) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + v + '</strong></div>';
/** 프로젝트 목록. st: projects·estimates·settlements, filter{status,q} */
export function projectsListHtml(st) {
  const all = sortProjects(st.projects); const list = filterProjects(all, st.filter); const cnt = { run: all.filter((p) => p.status !== 'done').length, done: all.filter((p) => p.status === 'done').length, all: all.length };
  const chips = [['run', '진행중'], ['done', '종료'], ['all', '전체']].map(([k, l]) => '<button type="button" class="jh-plan__filter" data-pj-filter="' + k + '" aria-pressed="' + (st.filter.status === k) + '">' + l + ' ' + cnt[k] + '</button>').join('');
  const bar = '<div class="jh-plan__bar"><div class="jh-plan__filters">' + chips + '</div><div class="jh-plan__bar"><input class="jh-input jh-plan__q" type="search" data-pj-q placeholder="코드·내용·현장·발주처 검색" value="' + esc(st.filter.q || '') + '"><button type="button" class="jh-btn" data-variant="primary" data-pj-act="new">+ 프로젝트 등록</button></div></div>';
  const lInfo = pageInfo(list.length, pagerSync(st.pg || (st.pg = {}), 'plan-projects', JSON.stringify(st.filter || {}))); const rows = list.length ? list.slice(lInfo.from, lInfo.to).map((p) => { const s = pjtSummary(p.id, st.estimates, st.settlements);
    return '<button type="button" class="jh-plan__pjt" data-pj-open="' + esc(p.id) + '"><span class="jh-plan__line"><strong>' + esc(p.code || '-') + '</strong>' + chip(TYPE_LABEL[p.type] || '일반(품목)', '') + statusChip(p) + '</span><span class="jh-field__hint">' + esc([p.name, p.site].filter(Boolean).join(' · ')) + '</span><span class="jh-plan__sum">' + sumCell('견적', won(s.est)) + sumCell('청구', won(s.billed)) + sumCell('지급', won(s.paid)) + sumCell('손익', signed(s.profit), s.profit >= 0 ? 'pos' : 'neg') + '</span></button>'; }).join('') : '<div class="jh-empty">' + (all.length ? '조건에 맞는 프로젝트가 없습니다.' : '등록된 프로젝트가 없습니다. “프로젝트 등록”으로 추가하세요.') + '</div>';
  return '<div class="jh-plan">' + card('프로젝트', '<div class="jh-plan__pad">' + bar + rows + sharedPagerHtml(lInfo, 'plan-projects') + '<div class="jh-field__hint">금액 단위: 원 · 청구·지급·손익은 정산서에서 자동 집계됩니다(손익 = 청구 − 지급).</div></div>') + '</div>';
}
const pager = (p, key) => { if (p.pages <= 1) return p.total ? '<div class="jh-plan__pager">' + pagerSizeSelect('plan', p.total) + '</div><div class="jh-field__hint jh-plan__center">전체 ' + p.total + '건</div>' : '';
  const b = (n, label, on, dis) => '<button type="button" class="jh-btn" data-variant="' + (on ? 'primary' : 'ghost') + '" data-pj-page="' + key + ':' + n + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  return '<div class="jh-plan__pager">' + pagerSizeSelect('plan', p.total) + b(Math.max(1, p.page - 1), '‹', false, p.page === 1) + pageList(p.page, p.pages).map((n) => n === '…' ? '<span class="jh-field__hint">…</span>' : b(n, n, n === p.page, false)).join('') + b(Math.min(p.pages, p.page + 1), '›', false, p.page === p.pages) + '</div><div class="jh-field__hint jh-plan__center">전체 ' + p.total + '건 중 ' + p.from + '-' + p.to + '건</div>'; };
const estRow = (e) => { const tg = estTag(e); return '<button type="button" class="jh-plan__row" data-pj-est="' + esc(e.id) + '" data-void="' + (e.status === 'void' || e.status === 'closed') + '"><span class="jh-plan__main"><span class="jh-plan__line"><strong>' + esc(e.title || '-') + '</strong>' + (tg ? chip(tg.text, tg.tone) : '') + '</span><span class="jh-field__hint">' + esc([e.no, e.date, e.client && e.client.company].filter(Boolean).join(' · ')) + '</span></span><strong>' + won(estTotal(e)) + '</strong></button>'; };
const setRow = (s, pid) => { const st = settleState(s); const multi = !!(s.pjtIds && s.pjtIds.length > 1); return '<button type="button" class="jh-plan__row" data-pj-set="' + esc(s.id) + '" data-void="' + (s.status === 'void') + '"><span class="jh-plan__main"><span class="jh-plan__line"><strong>' + esc(SETTLE_TYPE_LABEL[s.docType] || '정산서') + '</strong><span class="jh-field__hint">' + esc(s.no || '') + '</span>' + chip(st.text, st.tone) + (multi ? '<span class="jh-field__hint">(공동 발행분)</span>' : '') + '</span><span class="jh-field__hint">' + esc('기준월 ' + (s.baseMonth || '-') + ' · 발행 ' + (s.issueDate || '-') + (s.docType === 'payment' ? ' · 지급' : '')) + '</span></span><strong>' + won(settleAmountForPjt(s, pid)) + '</strong></button>'; };
/** 서버 마진 집계(st.margin)에서 프로젝트 하나의 marginHtml 입력(extra)을 만든다. 서버 집계는 장부·급여명세서를 읽어서 무거우므로 자동으로 부르지 않고 [반영해서 보기]를 눌렀을 때만 부른다.
 * ui: idle(아직 안 누름)·loading·denied(권한 없음)·error·ok. 값(direct·ownLabor·notes)은 ok 일 때만 있고 나머지는 비워 지급 기준 "잠정"이 유지된다 — 틀린 값을 확정처럼 보이지 않게 */
export function marginExtraOf(st, pid, planId) {
  if (typeof pid !== 'string' || !pid) return { ui: 'unlinked' };
  const m = st && typeof st === 'object' ? st.margin : null; const ST = m && typeof m === 'object' ? m.state : '';
  if (ST === 'loading') return { ui: 'loading' };
  if (ST === 'denied') return { ui: 'denied' };
  if (ST === 'error') return { ui: 'error', error: '마진 집계를 불러오지 못했습니다. 지급 기준 잠정 값입니다.' };
  if (ST === 'ok') {
    const e = marginExtra(m.data, pid); if (!e) return { ui: 'error', error: '마진 집계 응답 형식이 올바르지 않아 불러오지 못했습니다. 지급 기준 잠정 값입니다.' };
    const c = st.marginCheck && typeof st.marginCheck === 'object' ? st.marginCheck : null; const CS = c ? c.state : '';
    const okCheck = CS === 'ok' && !!c.data && typeof c.data === 'object' && c.data.ok === true && !!c.data.unmarked && typeof c.data.unmarked === 'object' && Array.isArray(c.data.payslipCheck);
    const checkUi = CS === 'loading' ? 'loading' : CS === 'ok' ? (okCheck ? 'ok' : 'error') : CS === 'error' || CS === 'denied' ? 'error' : 'idle';
    const es = st.evalSave && typeof st.evalSave === 'object' && typeof planId === 'string' && planId ? st.evalSave[planId] : null; const ES = es && typeof es === 'object' ? es.state : '';
    const okEval = ES === 'ok' && !!es.data && typeof es.data === 'object' && es.data.ok === true && typeof es.data.actual === 'number' && Number.isFinite(es.data.actual) && typeof es.data.asOf === 'string';
    const evalUi = ES === 'saving' ? 'saving' : ES === 'ok' ? (okEval ? 'ok' : 'error') : ES === 'error' ? 'error' : 'idle';
    const evalError = evalUi === 'error' ? (ES === 'error' && typeof es.error === 'string' && es.error ? es.error : evalSaveError(null)) : '';
    const al = st.alloc && typeof st.alloc === 'object' ? st.alloc : null; const AS = al ? al.state : ''; const alloc = AS === 'ok' ? allocFor(al.data, pid) : null;
    const allocUi = AS === 'loading' ? 'loading' : AS === 'ok' ? (alloc ? 'ok' : 'error') : AS === 'error' || AS === 'denied' ? 'error' : 'idle';
    const allocError = allocUi === 'error' ? (AS === 'denied' ? '공통비 배부는 재무회계 권한이 있는 계정만 볼 수 있습니다.' : AS === 'ok' ? '공통비 배부 응답 형식이 올바르지 않아 보여 드리지 못합니다.' : '공통비 배부를 불러오지 못했습니다.') : '';
    return Object.assign(e, { ui: 'ok', checkUi, allocUi, alloc: allocUi === 'ok' ? alloc : undefined, allocError, evalUi, evalResult: okEval ? { actual: es.data.actual, asOf: es.data.asOf, estimated: es.data.estimated === true } : null, evalError, notes: marginNotes(m.data, okCheck ? c.data : undefined) });
  }
  return { ui: 'idle' };
}
/** 마진율 줄: 목표(프로젝트마다 입력)·실현(청구 − 지급 기준)·목표 대비. 청구가 없으면 계산 안 함 */
export function marginHtml(p, s, extra) {
  // 실투입비 = 지급 누계 + 직접비(전표의 프로젝트 표시 현장 원가) + 자체 인력 인건비(공수 배분). 직접비·자체 인건비는 아직 연결되지 않았으면 빠져 있다(extra 가 없으면 "잠정")
  const ex = extra || {}; const m = pjtMargin(s, { target: p && p.targetMargin, direct: ex.direct, ownLabor: ex.ownLabor }); const pct = (v) => (v == null ? '-' : v + '%');
  const diff = m.diff == null ? '-' : (m.diff > 0 ? '+' : '') + m.diff + '%p'; const tone = m.diff == null ? '' : m.diff >= 0 ? 'pos' : 'neg';
  const c = m.cost; const hasDirect = ex.direct != null, hasOwn = ex.ownLabor != null; const complete = hasDirect && hasOwn;
  const done = s && typeof s.done === 'number' && s.done > 0 ? s.done : 0; const open = Math.max(0, (s && Number(s.billed) > 0 ? Number(s.billed) : 0) - done);
  const salesLine = done > 0 ? '<div class="jh-field__hint">확정 매출(완결) ' + won(done) + '원</div>' : '';
  const openLine = open > 0 ? '<div class="jh-field__hint" data-tone="warn">' + (done > 0 ? '' : '완결한 청구서가 없어 마진율을 계산하지 않습니다(청구서를 완결 처리하면 확정 매출로 계산). ') + '완결 전 청구 ' + won(open) + '원은 아직 매출에 포함되지 않았습니다(완결 처리하면 매출로 확정).</div>' : '';
  const part = (label, v, ok) => label + ' ' + (ok ? won(v) + '원' : '미연결');
  const costLine = '<div class="jh-field__hint">프로젝트 원가 ' + won(c.total) + '원 = ' + part('외주·자재(지급예정서)', c.paid, true) + ' + ' + part('현장경비', c.direct, hasDirect) + ' + ' + part('자체 직접노무비', c.ownLabor, hasOwn) + '</div>';
  const loadErr = ex.error ? '<div class="jh-field__hint" data-tone="warn">' + esc(ex.error) + '</div>' : '';
  const btnHtml = (label, off) => '<button type="button" class="jh-btn" data-variant="ghost" data-pj-act="margin-load"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  const ckBtn = (label, off) => '<button type="button" class="jh-btn" data-variant="ghost" data-pj-act="margin-check"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  const ckHtml = ex.checkUi === 'loading' ? '<div class="jh-field__hint">' + ckBtn('대조하는 중…', true) + '</div>' : ex.checkUi === 'ok' ? '<div class="jh-field__hint">' + ckBtn('다시 대조', false) + '</div>' : ex.checkUi === 'error' ? '<div class="jh-field__hint" data-tone="warn">장부 대조를 불러오지 못했습니다.</div><div class="jh-field__hint">' + ckBtn('다시 대조', false) + '</div>' : ex.checkUi === 'idle' ? '<div class="jh-field__hint">' + ckBtn('장부 대조 확인', false) + ' 전표 전체를 읽어 표시가 없는 현장경비와 급여명세서·장부 5110 을 대조합니다.</div>' : '';
  const unlinkedLine = ex.ui === 'unlinked' ? '<div class="jh-field__hint" data-tone="warn">이 프로젝트는 PJT 관리 항목에 연결되지 않아 현장경비·자체 직접노무비를 계산할 수 없습니다(지급 기준 잠정 값). 정보 수정에서 PJT 관리 항목을 연결하면 반영됩니다.</div>' : '';
  const alBtn = (label, off) => '<button type="button" class="jh-btn" data-variant="ghost" data-pj-act="margin-alloc"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  const allocHtml = ex.ui !== 'ok' || !(done > 0) ? '' : ex.allocUi === 'loading' ? '<div class="jh-field__hint">' + alBtn('계산하는 중…', true) + '</div>' : ex.allocUi === 'error' ? '<div class="jh-field__hint" data-tone="warn">' + esc(ex.allocError || '') + '</div><div class="jh-field__hint">' + alBtn('다시 계산', false) + '</div>' : ex.allocUi === 'ok' && ex.alloc ? (() => { const a = ex.alloc; const contrib = done - c.total; const after = contrib - a.allocated; const pct = Math.round(after / done * 1000) / 10; return '<div class="jh-field__hint" data-tone="' + (after >= 0 ? 'pos' : 'neg') + '">공통비 반영 이익 ' + won(after) + '원 (' + pct + '%) = 공헌이익 ' + won(contrib) + '원 − 공통비 배부 ' + won(a.allocated) + '원 (잠정)</div>'
    + (a.allocated > 0 ? '<div class="jh-field__hint">이 프로젝트가 받은 공통비: ' + a.months.map((x) => esc(x.month) + ' ' + won(x.amount) + '원(공수 ' + x.manday + ')').join(' · ') + '</div>' : '<div class="jh-field__hint">이 프로젝트는 공수 기록이 있는 달이 없어 배부된 공통비가 없습니다.</div>')
    + (a.pool > 0 ? '<div class="jh-field__hint" data-tone="warn">잠정 — 공통비 전체 ' + won(a.pool) + '원 중 ' + a.pctAllocated + '%(' + won(a.allocatedTotal) + '원)만 배부됐습니다. 공수 기록이 있는 달만 배부하고' + (a.unallocatedMonths > 0 ? ' 공수가 없는 ' + a.unallocatedMonths + '개월 ' : ' 나머지 ') + won(a.unallocated) + '원은 배부하지 않았습니다.</div>' : '')
    + (a.unmarked.count > 0 ? '<div class="jh-field__hint" data-tone="warn">미표시 판관비 ' + a.unmarked.count + '줄 ' + won(a.unmarked.amount) + '원이 공통비에 포함돼 있습니다. 프로젝트에 표시하면 공통비에서 빠집니다.</div>' : '')
    + '<div class="jh-field__hint">배부 기준 공수: 일용직 ' + a.daily + '일 · 자체 직원 참여일 ' + a.own + '일' + (a.own === 0 ? ' (자체 직원 참여 기록이 아직 없습니다)' : '') + '</div><div class="jh-field__hint">' + alBtn('다시 계산', false) + '</div>'; })() : '<div class="jh-field__hint">' + alBtn('공통비 반영해서 보기', false) + ' 판관비 중 프로젝트에 표시하지 않은 것과 사무직 급여를 그 달 공수 비율로 나눠 반영합니다(전표 전체를 읽어 몇 초 걸립니다).</div>';
  const evBtn = (label, off) => '<button type="button" class="jh-btn" data-variant="ghost" data-pj-act="margin-eval"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  const evalHtml = ex.ui !== 'ok' ? '' : !(done > 0) ? '<div class="jh-field__hint">완결한 청구서가 없어 평가용으로 저장할 마진이 없습니다(청구서를 완결 처리한 뒤 저장).</div>' : ex.evalUi === 'saving' ? '<div class="jh-field__hint">' + evBtn('저장하는 중…', true) + '</div>' : ex.evalUi === 'ok' && ex.evalResult ? '<div class="jh-field__hint" data-tone="pos">평가용으로 저장됨 — 실현 마진율 ' + ex.evalResult.actual + '% · 확인일 ' + esc(ex.evalResult.asOf) + (ex.evalResult.estimated ? ' · 사업주 4대보험 추정 포함' : '') + '</div>' + (m.actual != null && m.actual !== ex.evalResult.actual ? '<div class="jh-field__hint" data-tone="warn">화면의 실현 마진율(' + m.actual + '%)과 저장된 값(' + ex.evalResult.actual + '%)이 다릅니다. 데이터가 바뀌었을 수 있으니 다시 불러온 뒤 다시 저장해 주세요.</div>' : '') + '<div class="jh-field__hint">' + evBtn('다시 저장', false) + '</div>' : ex.evalUi === 'error' ? '<div class="jh-field__hint" data-tone="warn">' + esc(ex.evalError || '') + '</div><div class="jh-field__hint">' + evBtn('다시 저장', false) + '</div>' : '<div class="jh-field__hint">' + evBtn('평가용으로 저장', false) + ' 인사평가 점수에 쓰이는 값입니다. 서버가 완결 청구·지급·현장경비·자체 직접노무비로 다시 계산해 저장합니다(공통비 배부 전 공헌이익).</div>';
  const ctl = ex.ui === 'idle' ? '<div class="jh-field__hint">' + btnHtml('현장경비·자체 직접노무비 반영해서 보기', false) + ' 장부와 급여명세서를 읽어 계산합니다(재무회계 권한자).</div>' : ex.ui === 'loading' ? '<div class="jh-field__hint">' + btnHtml('불러오는 중…', true) + '</div>' : ex.ui === 'denied' ? '<div class="jh-field__hint">현장경비·자체 직접노무비 반영은 재무회계 권한이 있는 계정만 볼 수 있습니다.</div>' : ex.ui === 'error' ? '<div class="jh-field__hint">' + btnHtml('다시 불러오기', false) + '</div>' : ex.ui === 'ok' ? '<div class="jh-field__hint">' + btnHtml('다시 불러오기', false) + '</div>' + ckHtml + allocHtml + evalHtml : '';
  const notes = Array.isArray(ex.notes) && ex.notes.length ? '<ul class="jh-field__hint" data-margin-notes>' + ex.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '';
  const warn = complete ? '' : '<div class="jh-field__hint" data-tone="warn">잠정: 현장경비(전표의 프로젝트 표시)·자체 직접노무비가 아직 반영되지 않아 <strong>외주·자재(지급예정서) 기준</strong>입니다. 실제 마진율은 이보다 낮을 수 있습니다. 평가에 쓰기 전에 연결 여부를 확인하세요.</div>';
  return '<div class="jh-plan__sum jh-plan__sum--3">' + sumCell('목표 마진율', m.target == null ? '미입력' : pct(m.target)) + sumCell('실현 마진율' + (complete ? '' : ' (잠정)'), pct(m.actual)) + sumCell('목표 대비', diff, tone) + '</div>' + costLine + salesLine + openLine + warn + loadErr + unlinkedLine + notes + ctl + '<div class="jh-field__hint">실현 마진율 = (청구 − 프로젝트 원가) ÷ 청구 · 팀 공수 노무비는 지급예정서에 이미 들어 있어 따로 빼지 않습니다 · 목표는 "정보 수정"에서 프로젝트마다 입력합니다. 인사평가(수시평가)의 프로젝트 성과는 이 값을 읽어 점수를 냅니다.</div>';
}
/** 프로젝트 상세(허브): 기본정보·요약·견적·청구·지급 */
export function projectDetailHtml(st) {
  const p = st.projects.find((x) => x.id === st.sel); if (!p) return '<div class="jh-empty">프로젝트를 찾을 수 없습니다.</div>';
  const s = pjtSummary(p.id, st.estimates, st.settlements); const ests = paginate(pjtEstimates(st.estimates, p.id), st.page.est), inv = paginate(pjtSettlements(st.settlements, p.id, 'invoice'), st.page.inv), pay = paginate(pjtSettlements(st.settlements, p.id, 'payment'), st.page.pay);
  const info = [['현장명', p.site], ['발주처', p.client], ['시공사', p.contractor], ['협력사', p.partner]].filter((x) => x[1]).map((x) => '<div class="jh-field__hint">' + esc(x[0]) + ': ' + esc(x[1]) + '</div>').join('');
  const head = '<div class="jh-plan__pad"><div class="jh-plan__line"><strong class="jh-plan__big">' + esc(p.code || '-') + '</strong>' + chip(TYPE_LABEL[p.type] || '일반(품목)', '') + statusChip(p) + '</div><div>' + esc(p.name || '') + '</div>' + info + '<div class="jh-plan__bar"><span class="jh-plan__line"><button type="button" class="jh-btn" data-variant="secondary" data-pj-act="edit">정보 수정</button><button type="button" class="jh-btn" data-variant="ghost" data-pj-act="del">삭제</button></span></div></div>';
  const sum = '<div class="jh-plan__pad"><div class="jh-plan__sum jh-plan__sum--5">' + sumCell('견적 합계', won(s.est)) + sumCell('청구 누계', won(s.billed)) + sumCell('지급 누계', won(s.paid)) + sumCell('미수금', won(s.due), s.due > 0 ? 'neg' : '') + sumCell('실현 손익', signed(s.profit), s.profit >= 0 ? 'pos' : 'neg') + '</div><div class="jh-field__hint">실현 손익 = 청구 − 지급 · 미수금 = 청구 − 완결된 청구</div>' + marginHtml(p, s, marginExtraOf(st, linkedPjtId(p), p.id)) + '</div>';
  const estBody = '<div class="jh-plan__pad">' + (ests.items.length ? ests.items.map(estRow).join('') : '<div class="jh-empty">아직 견적이 없습니다.</div>') + pager(ests, 'est') + '</div>';
  const invBody = '<div class="jh-plan__pad">' + (inv.items.length ? inv.items.map((x) => setRow(x, p.id)).join('') : '<div class="jh-empty">아직 청구서가 없습니다.</div>') + pager(inv, 'inv') + '</div>';
  const payBody = '<div class="jh-plan__pad">' + (pay.items.length ? pay.items.map((x) => setRow(x, p.id)).join('') : '<div class="jh-empty">아직 지급예정서가 없습니다.</div>') + pager(pay, 'pay') + '</div>';
  const btn = (label, act) => '<button type="button" class="jh-btn" data-variant="secondary" data-pj-act="' + act + '">' + label + '</button>';
  return '<div class="jh-plan"><div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-pj-act="list">← 프로젝트 목록</button></div>' + card('프로젝트', head) + card('요약', sum) + card('실행예산 (계획 원가)', budgetCardHtml(st.budget && st.budget[p.id], st.budget && st.budget[p.id] && st.budget[p.id].showImport ? importFromEstimates(st.estimates, p.id) : null)) + '<div class="jh-plan__two">' + card('견적 내역 (' + ests.total + ')', estBody, btn('+ 견적 작성', 'new-est')) + '<div class="jh-plan__col">' + card('청구서 (' + inv.total + ')', invBody, btn('+ 청구서 발행', 'new-inv')) + card('지급예정서 (' + pay.total + ')', payBody, btn('+ 지급예정서 발행', 'new-pay')) + '</div></div></div>';
}
const fld = (label, inner, hint) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + '</label>' + inner + (hint ? '<div class="jh-field__hint">' + esc(hint) + '</div>' : '') + '</div>';
const inp = (k, v, ph) => '<input class="jh-input" data-pj-f="' + k + '" value="' + esc(v == null ? '' : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>';
const sel = (k, v, opts) => '<select class="jh-select" data-pj-f="' + k + '">' + opts.map(([val, l]) => '<option value="' + esc(val) + '"' + (val === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
/** 프로젝트 등록·수정 폼 */
export function projectFormHtml(st) {
  const f = st.form; const edit = !!st.sel;
  const opts = linkOptions(st.registry).map((o) => [o.value, o.label]);
  const body = '<div class="jh-plan__pad">' + fld('PJT 코드', inp('code', f.code, '예: P4 Ph5 (XXX)')) + fld('내용', inp('name', f.name, '예: FCU 183대 설치')) + fld('현장명', inp('site', f.site, '예: 화성 17L / 청주 M15X CUB동'))
    + '<div class="jh-plan__grid3">' + fld('발주처', inp('client', f.client, '예: 삼성전자')) + fld('시공사', inp('contractor', f.contractor, '예: 삼성중공업')) + fld('협력사', inp('partner', f.partner, '예: 귀뚜라미범양냉방')) + '</div>'
    + '<div class="jh-plan__grid">' + fld('정산 방식', sel('type', f.type, [['general', '일반 (품목 직접 입력)'], ['fcu', '자동정산 (정산서·공수 연동)']])) + fld('상태', sel('status', f.status, [['run', '진행중'], ['done', '종료']])) + '</div>'
    + fld('목표 마진율(%) — 이 프로젝트의 견적 시점 목표', inp('targetMargin', f.targetMargin, '예: 12'), '프로젝트마다 따로 정합니다. 비워 두면 "목표 미입력"이고, 입력하면 프로젝트 요약에 실현 마진율·목표 대비가 나타나며 인사평가(수시평가)의 프로젝트 성과 점수에 참고됩니다.')
    + fld('연동 PJT (공정·공수 통합, 견적·정산서 연동)', sel('link', f.link, opts), '선택한 PJT의 공정(섹터·진척)과 공수 데이터를 자동정산에 함께 연동합니다. "자동 생성"을 선택하면 저장 시 PJT관리에도 동일한 이름으로 새 항목이 만들어집니다.')
    + '<div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-pj-act="cancel">취소</button><button type="button" class="jh-btn" data-variant="primary" data-pj-act="save">저장</button></div></div>';
  return '<div class="jh-plan"><div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-pj-act="cancel">← 뒤로</button></div>' + card(edit ? '프로젝트 수정' : '프로젝트 등록', body) + '</div>';
}
