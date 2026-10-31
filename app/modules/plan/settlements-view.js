import { esc } from '../../core/ui.js?v=20261031d';
import { won, card, chip, fld, selectHtml, pagerHtml } from './ui.js?v=20261031d';
import { SETTLE_PAGE_SIZE, SETTLE_LABEL, METHOD_LABEL, filterSettlements, sortSettlements, settleFilterOptions, settleSummary, projectLabel, isMulti, acctMonthOf, canLinkEst, linkedEstimates, linkableEstimates, settleLinesOf, setActive, projectBalance } from './settlements.js?v=20261031d';
import { paginate } from './projects.js?v=20261031d';
import { settleName } from './settlement-doc.js?v=20261031d';
const sumCell = (label, v, tone) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + v + '</strong></div>';
const filterSel = (key, val, label, opts) => selectHtml('data-sl-filter="' + key + '"', val, [['', label]].concat(opts));
/** 청구·수금(kind=invoice) / 지급·정산(kind=payment) 목록: 합계 카드 + 필터 + 10건씩 쪽 나눔 */
export function settlementsListHtml(st) {
  const inv = st.kind === 'invoice'; const f = st.filter; const all = st.settlements.filter((s) => s.docType === st.kind); const opt = settleFilterOptions(all);
  const list = sortSettlements(filterSettlements(all, f)); const pg = paginate(list, st.page, SETTLE_PAGE_SIZE); const sm = settleSummary(filterSettlements(all, f));
  const cards = inv ? sumCell('대금청구 누계', won(sm.inv)) + sumCell('수금(완결) 합계', won(sm.invDone)) + sumCell('미수금 (청구−수금)', won(sm.receivable), sm.receivable > 0 ? 'neg' : 'pos')
    : sumCell('지급예정 누계', won(sm.pay)) + sumCell('지급완료 합계', won(sm.payDone)) + sumCell('미지급 (예정−완료)', won(sm.payable), sm.payable > 0 ? 'neg' : 'pos');
  const filters = '<div class="jh-plan__filters2">' + filterSel('pjtId', f.pjtId, '현장명 전체', st.projects.map((p) => [p.id, p.code]).concat([['__none', '해당 없음']])) + filterSel('client', f.client, '거래처 전체', opt.clients.map((c) => [c, c])) + filterSel('month', f.month, '발행월 전체', opt.months.map((m) => [m, m])) + filterSel('status', f.status, '상태 전체', [['done', inv ? '✓ 완결(수금)' : '✓ 지급완료'], ['pending', '미결']]) + '<button type="button" class="jh-btn" data-variant="ghost" data-sl-act="reset">초기화</button></div>';
  const isFiltered = f.pjtId || f.client || f.month || f.status;
  const rows = pg.items.length ? pg.items.map((s) => { const v = !setActive(s); return '<button type="button" class="jh-plan__row" data-sl-open="' + esc(s.id) + '" data-void="' + v + '"><span class="jh-plan__main"><span class="jh-plan__line"><strong>' + esc(SETTLE_LABEL[s.docType] || '정산서') + '</strong><span class="jh-field__hint">' + esc(s.no || '') + '</span>' + (v ? chip('폐기', 'gray') : '') + (s.status === 'done' ? chip('✓ 완결', 'green') : '') + '</span><span class="jh-plan__line">' + chip(projectLabel(s, st.projects), 'blue') + '<span class="jh-field__hint">' + esc('기준월 ' + (s.baseMonth || '-') + ' · 발행 ' + (s.issueDate || '-') + (s.recipient && s.recipient.company ? ' · ' + s.recipient.company : '')) + '</span></span></span><strong>' + won(s.total) + '</strong></button>'; }).join('')
    : '<div class="jh-empty">' + (isFiltered ? '조건에 맞는 정산서가 없습니다.' : (inv ? '발행된 청구서가 없습니다.' : '발행된 지급예정서가 없습니다.')) + '</div>';
  const right = '<span class="jh-plan__line">' + (inv ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-sl-act="team">팀별 노무비 ›</button>') + '<button type="button" class="jh-btn" data-variant="primary" data-sl-act="new">+ ' + (inv ? '청구서 발행' : '지급예정서 발행') + '</button></span>';
  return '<div class="jh-plan">' + card(inv ? '청구·수금' : '지급·정산', '<div class="jh-plan__pad"><div class="jh-plan__sum jh-plan__sum--3">' + cards + '</div>' + filters + rows + pagerHtml(pg, 'data-sl-page', 'list') + '</div>', right) + '</div>';
}
const party = (label, o) => '<div class="jh-plan__party"><span class="jh-field__hint">' + esc(label) + '</span><strong>' + esc((o && o.company) || '-') + '</strong><span class="jh-field__hint">' + esc([o && o.ceo ? '대표 ' + o.ceo : '', o && o.bizno].filter(Boolean).join(' · ')) + '</span>' + (o && o.contact ? '<span class="jh-field__hint">담당: ' + esc(o.contact) + '</span>' : '') + '</div>';
/** 견적 연결 패널(청구서 중 직접입력·수량정산): 내역(줄)마다 연결할 견적을 고른다 */
function linkPanelHtml(st, s) {
  const ests = linkableEstimates(s, st.estimates); const lines = settleLinesOf(s); const cur = s.perEstLines || {};
  if (!ests.length) return card('항목별 견적 연결', '<div class="jh-plan__pad"><div class="jh-empty">연결할 견적이 없습니다.</div><div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-sl-act="link-close">닫기</button></div></div>');
  const rows = lines.map((ln, i) => '<div class="jh-plan__bar"><span class="jh-plan__main"><strong>' + esc(ln.name) + '</strong><span class="jh-field__hint">' + won(ln.amount) + ' 원</span></span>' + selectHtml('data-sl-link="' + i + '"', st.linkSel[i] != null ? st.linkSel[i] : (cur[i] || ''), [['', '— 연결 안 함 —']].concat(ests.map((e) => [e.id, e.title]))) + '</div>').join('');
  return card('항목별 견적 연결', '<div class="jh-plan__pad"><div class="jh-field__hint">각 내역을 연결하면 해당 견적의 기청구에 그 금액이 반영됩니다</div>' + rows + '<div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-sl-act="link-close">닫기</button><button type="button" class="jh-btn" data-variant="primary" data-sl-act="link-save">저장</button></div></div>');
}
/** 정산서 상세: 안내, 발신·수신, 내역, 합계, 견적 연결, (지급예정서) 회계 계상월, 완결·취소·폐기·삭제·인쇄 */
export function settlementDetailHtml(st) {
  const s = st.settlements.find((x) => x.id === st.sel); if (!s) return '<div class="jh-empty">정산서를 찾을 수 없습니다.</div>';
  const inv = s.docType === 'invoice'; const active = setActive(s); const done = s.status === 'done'; const linked = linkedEstimates(s);
  const bal = projectBalance(st.settlements, s.pjtId);
  const btn = (act, label, v) => '<button type="button" class="jh-btn" data-variant="' + (v || 'secondary') + '" data-sl-act="' + act + '">' + label + '</button>';
  const acct = !inv ? ' · 회계 계상월 <strong>' + esc(acctMonthOf(s)) + '</strong> ' + (st.editAcct ? '<input class="jh-input jh-plan__acct" data-sl-acct value="' + esc(acctMonthOf(s)) + '" placeholder="YYYY-MM">' + btn('acct-save', '저장', 'primary') + btn('acct-cancel', '취소', 'ghost') : btn('acct-edit', '수정', 'ghost')) : '';
  const head = '<div class="jh-plan__pad">' + (!active ? '<div class="jh-alert" data-tone="warn" role="status">🚫 폐기된 정산서입니다. 집계에서 제외됩니다.</div>' : '')
    + '<div class="jh-plan__bar"><div class="jh-plan__main"><strong class="jh-plan__big" data-sl-name>' + esc(settleName(s)) + '</strong><span class="jh-plan__line">' + chip(SETTLE_LABEL[s.docType] || '정산서', 'gray') + ' ' + chip(isMulti(s) ? projectLabel(s, st.projects).replace(/\+/g, ' + ') : projectLabel(s, st.projects), 'blue') + '<span class="jh-field__hint">' + esc(s.no + ' · 발행 ' + (s.issueDate || '-') + (s.author ? ' · ' + s.author : '')) + '</span></span></div>'
    + '<span class="jh-plan__line">' + (canLinkEst(s) ? btn('link-open', '🔗 견적 연결' + (linked.length ? ' 수정' : '')) : '') + btn('print', '🖨 인쇄/PDF') + (active && !done ? btn(inv ? 'done' : 'done', inv ? '✓ 완결' + (bal <= 0 ? ' (권장)' : '') : '✓ 지급완료') : '') + (done ? btn('undone', '완결 취소', 'ghost') : '') + (active ? btn('void', '폐기', 'ghost') : btn('del', '🗑 삭제', 'ghost')) + '</span></div>'
    + '<div class="jh-plan__two">' + party('발신 (공급자)', s.sender) + party(inv ? '수신 (원청)' : '수신 (하청)', s.recipient) + '</div>'
    + '<div class="jh-field__hint">' + esc('기준월 ' + (s.baseMonth || '-') + ' · ' + (inv ? '지급요청일' : '지급예정일') + ' ' + (s.payDate || '-') + ' · 정산방식 ' + (METHOD_LABEL[s.method] || '-')) + '</div>' + (acct ? '<div class="jh-plan__line">' + acct + '</div>' : '')
    + (linked.length ? '<div class="jh-alert" data-tone="warn" role="status">🔗 견적 연결됨: ' + esc(linked.map((id) => { const e = st.estimates.find((x) => x.id === id); return (e ? e.title : id) + ' ' + won(s.perEst[id]) + '원'; }).join(', ')) + ' — 이후 이 견적의 공정 정산서에서 기청구로 반영됩니다.</div>' : '')
    + '<div class="jh-plan__scroll"><table class="jh-plan__table"><thead><tr><th>#</th><th>내역</th><th>비고</th><th class="jh-plan__num">금액</th></tr></thead><tbody>' + (s.lines || []).map((it, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(it.name) + '</td><td>' + esc(it.spec || '-') + '</td><td class="jh-plan__num"><strong>' + won(it.amount) + '</strong></td></tr>').join('') + '</tbody></table></div>'
    + '<div class="jh-plan__totals"><span>공급가액 <strong>' + won(s.supply) + ' 원</strong></span><span>부가세 (10%) <strong>' + won(s.vat) + ' 원</strong></span><span class="jh-plan__big">' + (inv ? '청구금액' : '지급금액') + ' 합계 <strong>' + won(s.total) + ' 원</strong></span></div>' + (s.notes ? '<div class="jh-field"><label class="jh-field__label">특이사항</label><div class="jh-plan__notes">' + esc(s.notes) + '</div></div>' : '') + '</div>';
  const back = st.origin ? '← 프로젝트로 돌아가기' : (inv ? '← 청구·수금 목록' : '← 지급·정산 목록');
  return '<div class="jh-plan"><div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-sl-act="back">' + back + '</button></div>' + card(SETTLE_LABEL[s.docType] || '정산서', head) + (st.linkOpen ? linkPanelHtml(st, s) : '') + '</div>';
}
