import { esc } from '../../core/ui.js?v=20261008a';
import { ACCOUNTS, SOURCE_LABEL, sourceLabel, won, accountName, entryDebit, OPENING_FIELDS } from './logic.js?v=20261008a';

/* 재무회계 화면 조각 — 모든 값은 esc() 로 감싸 HTML 로 만든다. 스타일은 theme/finance.css 와 공용 클래스를 쓴다 */
const TABS = [['home', '개요'], ['entries', '전표'], ['import', '가져오기'], ['reports', '재무제표'], ['opening', '개시 재산'], ['settings', '설정']];
export const tabsHtml = (cur) => '<div class="jh-segmented jh-finance__tabs" role="group" aria-label="재무회계">' + TABS.map(([k, l]) => '<a class="jh-segmented__item" href="#/finance/' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</a>').join('') + '</div>';
const alertHtml = (tone, html) => '<div class="jh-alert" data-tone="' + tone + '" role="status">' + html + '</div>';
const tbl = (head, rows, cls) => '<div class="jh-finance__scroll"><table class="jh-fin-table' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map((h) => '<th' + (h[1] ? ' class="' + h[1] + '"' : '') + '>' + esc(h[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
const num = (v) => '<td class="num">' + esc(won(v)) + '</td>';
const accOptions = (sel, only) => ACCOUNTS.filter((a) => !only || only.includes(a.code)).map((a) => '<option value="' + a.code + '"' + (a.code === sel ? ' selected' : '') + '>' + esc(a.code + ' ' + a.name) + '</option>').join('');
const IMP_LABEL = { taxsales: '홈택스 매출', taxpurchase: '홈택스 매입', bank: '통장', card: '카드', json: '전표 묶음', sales: '홈택스 매출', purchase: '홈택스 매입' };
const ISS_LABEL = { nonghyup: '농협(개인)', ibk_sales: 'IBK', ibk_approval: 'IBK 승인', samsung: '삼성', hyundai: '현대' };
const kstText = (ms) => (ms ? new Date(ms + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '');

/* ───────── 개요 ───────── */
export function homeHtml(st) {
  const s = st.sum, stm = st.stm, set = st.settings; const hasOpening = st.entries.some((e) => e.source && e.source.kind === 'opening');
  const alerts = [];
  if (!hasOpening) alerts.push(alertHtml('warn', '⚠ 개시(기초) 재산 목록이 아직 없습니다. <a class="jh-link" href="#/finance/opening">개시 재산</a>에서 먼저 입력해 주세요.'));
  if (!set.ownBiz) alerts.push(alertHtml('warn', '⚠ 내 사업자등록번호가 설정되어 있지 않습니다. 다른 회사 세금계산서가 섞이는 것을 막으려면 <a class="jh-link" href="#/finance/settings">설정</a>에서 입력해 주세요.'));
  if (!s.count) alerts.push(alertHtml('info', '아직 전표가 없습니다. <a class="jh-link" href="#/finance/import">가져오기</a>에서 홈택스·통장·카드 파일이나 전표 묶음 파일을 올려 주세요.'));
  const kpi = [['전표', s.count + '건', s.from ? s.from + ' ~ ' + s.to : ''], ['확인 필요', s.review + '건', s.review ? '전표 탭에서 "확인 필요만" 보기' : '없음'], ['대차 일치', s.balanced ? '일치' : '불일치', '차변 ' + won(s.debit)], ['결산 마감', set.lockedThrough || '없음', set.lockedThrough ? '이 날짜 이전 전표는 못 만듭니다' : '관리자가 설정에서 마감']];
  const k = '<div class="jh-kpi-grid">' + kpi.map(([l, v, h], i) => '<div class="jh-kpi"' + (i === 1 && s.review ? ' data-tone="accent"' : '') + '><span class="jh-kpi__label">' + esc(l) + '</span><span class="jh-kpi__value">' + esc(v) + '</span><span class="jh-kpi__hint">' + esc(h) + '</span></div>').join('') + '</div>';
  const i = stm.is, b = stm.bs; const sum = tbl([['기간 ' + stm.from + ' ~ ' + stm.to], ['금액', 'num']], [['매출액', i.sales], ['매출원가(공사원가)', i.costOfSales], ['매출총이익', i.grossProfit], ['판매비와관리비', i.sgaTotal], ['영업이익', i.operatingIncome], ['당기순이익(세무조정 전)', i.netIncome]].map(([l, v]) => '<tr><td>' + esc(l) + '</td>' + num(v) + '</tr>'));
  const bs = tbl([['재무상태표 ' + stm.to], ['금액', 'num']], [['자산 총계', b.assetsTotal], ['부채 총계', b.liabsTotal], ['자본 총계', b.equityTotal], ['검산(자산−부채−자본)', b.diff]].map(([l, v]) => '<tr><td>' + esc(l) + '</td>' + num(v) + '</tr>'));
  const imp = st.imports.length ? tbl([['일시'], ['종류'], ['파일'], ['읽음', 'num'], ['저장', 'num'], ['중복', 'num']], st.imports.map((x) => '<tr><td>' + esc(kstText(x.ms)) + '</td><td>' + esc(IMP_LABEL[x.kind] || x.kind) + '</td><td>' + esc(x.fileName) + '</td>' + num(x.rows) + num(x.posted) + num(x.duplicates) + '</tr>')) : '<div class="jh-empty">가져오기 이력이 없습니다.</div>';
  return alerts.join('') + k + '<div class="jh-finance__two"><section class="jh-card"><div class="jh-panel__head"><h3>손익 요약</h3><a class="jh-link" href="#/finance/reports">재무제표 ›</a></div>' + sum + '</section><section class="jh-card"><div class="jh-panel__head"><h3>재무상태</h3></div>' + bs + '</section></div><section class="jh-card"><div class="jh-panel__head"><h3>최근 가져오기</h3></div>' + imp + '</section>';
}

/* ───────── 전표 ───────── */
export function entriesHtml(st) {
  const f = st.filter; const list = st.list; const show = list.slice(0, st.limit);
  const srcOpts = '<option value="">원천 전체</option>' + Object.keys(SOURCE_LABEL).map((k) => '<option value="' + k + '"' + (f.source === k ? ' selected' : '') + '>' + esc(SOURCE_LABEL[k]) + '</option>').join('');
  const bar = '<div class="jh-finance__bar"><input class="jh-input" type="date" data-f="from" value="' + esc(f.from) + '" aria-label="시작일"><input class="jh-input" type="date" data-f="to" value="' + esc(f.to) + '" aria-label="종료일"><select class="jh-select" data-f="source" aria-label="원천">' + srcOpts + '</select><label class="jh-finance__check"><input type="checkbox" data-f="review"' + (f.review ? ' checked' : '') + '> 확인 필요만</label><input class="jh-input jh-finance__q" data-f="q" value="' + esc(f.q) + '" placeholder="메모·거래처·계정 검색"><button type="button" class="jh-btn" data-variant="primary" data-act="manual">+ 수기 전표</button>' + (f.review && list.length ? '<button type="button" class="jh-btn" data-variant="ghost" data-act="review-all">이 목록 ' + list.length + '건 확인 완료로 표시</button>' : '') + '</div>';
  const rows = show.map((e) => '<tr data-entry="' + esc(e.id) + '" tabindex="0"><td>' + esc(e.date) + '</td><td>' + esc(e.no) + '</td><td>' + esc(e.memo) + (e.reversedBy ? ' <span class="jh-chip" data-tone="warn">역분개됨</span>' : '') + (e.reverses ? ' <span class="jh-chip">역분개 전표</span>' : '') + (e.needsReview ? ' <span class="jh-chip" data-tone="accent">확인</span>' : '') + '</td><td><span class="jh-chip">' + esc(sourceLabel(e.source && e.source.kind)) + '</span></td>' + num(entryDebit(e)) + '</tr>');
  const more = list.length > show.length ? '<button type="button" class="jh-btn" data-variant="ghost" data-act="more">더 보기 (' + (list.length - show.length) + '건 남음)</button>' : '';
  return bar + '<div class="jh-field__hint">' + list.length + '건' + (st.entries.length !== list.length ? ' (전체 ' + st.entries.length + '건)' : '') + ' · 전표는 만든 뒤 고치거나 지울 수 없고, 잘못은 역분개로 바로잡습니다. 행을 누르면 자세히 봅니다.</div>' + (show.length ? tbl([['일자'], ['번호'], ['메모'], ['원천'], ['금액', 'num']], rows, 'jh-fin-table--click') : '<div class="jh-empty">조건에 맞는 전표가 없습니다.</div>') + more;
}
export function entryDialogHtml(e, canReverse, locked) {
  const lines = tbl([['계정'], ['거래처'], ['차변', 'num'], ['대변', 'num']], e.lines.map((l) => '<tr><td>' + esc(l.account + ' ' + accountName(l.account)) + '</td><td>' + esc(l.partner || '') + '</td>' + (l.side === 'D' ? num(l.amount) + '<td></td>' : '<td></td>' + num(l.amount)) + '</tr>'));
  const chk = e.needsReview ? alertHtml('warn', '이 전표는 사람이 확인해야 하는 표시가 있습니다(분류가 확실하지 않은 건). 확인하셨으면 완료로 표시해 두세요. <button type="button" class="jh-btn" data-variant="ghost" data-act="reviewed">확인 완료로 표시</button>') : '';
  const rev = e.reversedBy ? alertHtml('warn', '이 전표는 ' + esc(e.reversedByNo) + ' 로 역분개되었습니다.') : (e.reverses ? alertHtml('info', esc(e.reversesNo) + ' 전표의 역분개 전표입니다.') : (canReverse ? '<div class="jh-finance__bar"><input class="jh-input" type="date" data-rev-date value="' + esc(locked && locked >= e.date ? '' : '') + '" aria-label="역분개 일자"><input class="jh-input jh-finance__q" data-rev-memo placeholder="사유(선택)"><button type="button" class="jh-btn" data-variant="danger" data-act="reverse">역분개</button></div><div class="jh-field__hint">역분개는 이 전표의 차변·대변을 뒤집은 새 전표를 만듭니다(원 전표는 그대로 남음). 일자는 마감일' + (locked ? '(' + esc(locked) + ')' : '') + ' 다음 날부터 가능합니다.</div>' : ''));
  return '<div class="jh-kv"><div class="jh-kv__row"><span>번호</span><strong>' + esc(e.no) + '</strong></div><div class="jh-kv__row"><span>일자</span><strong>' + esc(e.date) + '</strong></div><div class="jh-kv__row"><span>원천</span><strong>' + esc(sourceLabel(e.source && e.source.kind)) + (e.source && e.source.id ? ' · ' + esc(String(e.source.id).slice(0, 40)) : '') + '</strong></div><div class="jh-kv__row"><span>작성</span><strong>' + esc(e.createdByName) + ' ' + esc(kstText(e.createdMs)) + '</strong></div></div><p>' + esc(e.memo) + '</p>' + chk + lines + rev;
}
export function manualDialogHtml(n) {
  const rows = []; for (let i = 0; i < n; i++) rows.push('<tr><td><select class="jh-select" data-ml="account"><option value="">계정 선택</option>' + accOptions('') + '</select></td><td><select class="jh-select" data-ml="side"><option value="D">차변</option><option value="C">대변</option></select></td><td><input class="jh-input" data-ml="amount" inputmode="numeric" placeholder="금액"></td><td><input class="jh-input" data-ml="partner" placeholder="거래처(선택)"></td></tr>');
  return '<div class="jh-finance__bar"><input class="jh-input" type="date" data-m="date" aria-label="일자"><input class="jh-input jh-finance__q" data-m="memo" placeholder="메모(예: 대출 이자 정리)"></div>' + tbl([['계정'], ['차/대'], ['금액'], ['거래처']], rows) + '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="ghost" data-act="addline">+ 줄 추가</button><span class="jh-field__hint" data-m-sum></span></div>';
}

/* ───────── 가져오기 ───────── */
const KINDS = [['taxsales', '홈택스 매출'], ['taxpurchase', '홈택스 매입'], ['bank', '통장 거래내역'], ['card', '카드 이용내역'], ['json', '전표 묶음(JSON)']];
const fileBox = (accept, hint, extra) => '<div class="jh-field"><label class="jh-field__label">파일 선택</label><input class="jh-input" type="file" data-file accept="' + accept + '"><span class="jh-field__hint">' + esc(hint) + '</span></div>' + (extra || '');
export function importHtml(st) {
  const k = st.imp.kind;
  const seg = '<div class="jh-segmented" role="group" aria-label="가져오기 종류">' + KINDS.map(([c, l]) => '<button type="button" class="jh-segmented__item" data-imp-kind="' + c + '" aria-pressed="' + (c === k) + '">' + l + '</button>').join('') + '</div>';
  const hints = { taxsales: '홈택스 > 전자(세금)계산서 목록조회 > 매출에서 내려받은 엑셀(.xls·.xlsx)', taxpurchase: '홈택스 > 전자(세금)계산서 목록조회 > 매입에서 내려받은 엑셀(.xls·.xlsx)', bank: '기업은행 거래내역 엑셀(.xlsx). 아래에 농협(대표님 개인 계좌) 거래내역을 함께 올리면 개인카드 대금 정산을 자동으로 짝지어 줍니다', card: '농협·삼성·현대 카드 이용내역 또는 IBK 카드 매출내역 엑셀(.xls·.xlsx) — 여러 파일을 한 번에 고를 수 있습니다', json: '이 화면에서 내보냈거나 작업 묶음에 들어 있는 전표 묶음 파일(.json)' };
  let extra = '';
  if (k === 'bank') extra = '<div class="jh-field"><label class="jh-field__label">농협 통장 거래내역(선택)</label><input class="jh-input" type="file" data-file2 accept=".xls,.xlsx"><span class="jh-field__hint">대표님 개인 계좌에서 나간 농협카드 대금과 기업은행에서 보낸 정산 이체를 맞춰 보는 데만 씁니다(장부에는 넣지 않음).</span></div>';
  const accept = k === 'json' ? '.json,application/json' : '.xls,.xlsx'; const multi = k === 'card' ? ' multiple' : '';
  const box = fileBox(accept, hints[k], extra).replace('data-file ', 'data-file' + multi + ' ');
  return '<div class="jh-finance__bar">' + seg + '</div><section class="jh-card jh-finance__import">' + box + (st.imp.busy ? '<div class="jh-skeleton" style="height:var(--u-44)"></div>' : '') + (st.imp.error ? alertHtml('danger', esc(st.imp.error)) : '') + '</section>' + (st.imp.preview ? previewHtml(st) : '');
}
function previewHtml(st) {
  const p = st.imp.preview; const k = st.imp.kind; const warn = (p.warnings || []).map((w) => alertHtml('warn', '⚠ ' + esc(w))).join('');
  const go = (n, label) => '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="commit"' + (n ? '' : ' disabled') + '>' + esc(label) + ' (' + n + '건)</button><span class="jh-field__hint">' + (p.dupCount ? '이미 올린 ' + p.dupCount + '건은 건너뜁니다. ' : '') + '저장한 전표는 고치거나 지울 수 없고 역분개로만 바로잡습니다.</span></div>';
  if (k === 'taxsales' || k === 'taxpurchase') {
    const rows = p.rows.slice(0, 200).map((r) => '<tr><td>' + esc(r.inv.date) + '</td><td>' + esc(k === 'taxsales' ? r.inv.buyer.name : r.inv.supplier.name) + '</td><td>' + esc(r.inv.item) + '</td>' + num(r.inv.supply) + num(r.inv.vat) + num(r.inv.total) + '<td>' + (k === 'taxpurchase' ? '<select class="jh-select" data-sup="' + esc(r.supKey) + '">' + accOptions(r.account, ['5010', '5210', '5340', '5350', '5360', '5370', '5380', '5390', '6020', '6040', '6050', '6060', '6090', '6100', '6110', '6120', '6130', '6190']) + '</select>' : esc('4010 공사수입')) + '</td><td>' + (!r.ownerOk ? '<span class="jh-chip" data-tone="warn">다른 회사</span>' : (r.dup ? '<span class="jh-chip">이미 올림</span>' : '<span class="jh-chip" data-tone="accent">신규</span>')) + '</td></tr>');
    return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — ' + p.rows.length + '건 · 공급가 ' + esc(won(p.supply)) + ' · 합계 ' + esc(won(p.sum)) + '</h3></div>' + warn + tbl([['작성일'], ['거래처'], ['품목'], ['공급가', 'num'], ['부가세', 'num'], ['합계', 'num'], ['계정'], ['상태']], rows) + go(p.fresh.length, '전표로 저장') + '</section>';
  }
  if (k === 'bank') {
    const r = p.report; const cat = Object.entries(r.by).sort((a, b) => (b[1].out + b[1].in) - (a[1].out + a[1].in)).map(([n, x]) => '<tr><td>' + esc(n) + '</td>' + num(x.n) + num(x.in) + num(x.out) + '<td>' + (x.account ? (x.status === 'auto' ? '자동' : '확인') : '미정') + '</td></tr>');
    const un = p.unclassified.length ? '<div class="jh-alert" data-tone="warn">계정을 정하지 못한 ' + p.unclassified.length + '건은 저장하지 않고 건너뜁니다: ' + esc(p.unclassified.slice(0, 5).map((t) => t.date + ' ' + (t.counterName || t.desc) + ' ' + won(Math.max(t.in, t.out))).join(' · ')) + (p.unclassified.length > 5 ? ' …' : '') + '</div>' : '';
    return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — ' + p.count + '건 · 자동 ' + r.auto + ' · 확인 ' + r.review + ' · 미정 ' + r.none + '</h3></div>' + (p.bank ? '<div class="jh-field__hint">기간 ' + esc(p.bank.from) + ' ~ ' + esc(p.bank.to) + ' · 시작 잔액 ' + esc(won(p.bank.opening)) + ' · 마지막 잔액 ' + esc(won(p.bank.closing)) + ' · 잔액 이어짐 ' + (p.bank.balanceBreaks ? '⚠ 끊김 ' + p.bank.balanceBreaks + '곳' : '이상 없음') + '</div>' : '') + warn + un + tbl([['분류'], ['건', 'num'], ['입금', 'num'], ['출금', 'num'], ['상태']], cat) + go(p.fresh.length, '전표로 저장') + '</section>';
  }
  if (k === 'card') {
    const rows = p.groups.slice(0, 250).map((g) => '<tr><td>' + esc(g.name) + '</td><td>' + esc(ISS_LABEL[g.issuer] || g.issuer) + '</td>' + num(g.n) + num(g.sum) + '<td><select class="jh-select" data-merch="' + esc(g.issuer + '|' + g.key) + '">' + accOptions(g.account, ['3020', '5350', '5380', '5390', '6020', '6040', '6050', '6090', '6110', '6120', '6190', '8030', '2030', '2040']) + '</select></td><td>' + (g.review ? '<span class="jh-chip" data-tone="accent">확인</span>' : '') + '</td></tr>');
    return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — ' + p.groups.reduce((s, g) => s + g.n, 0) + '건 · 결제 ' + esc(won(p.total)) + ' · 가맹점 ' + p.groups.length + '곳</h3></div>' + warn + '<div class="jh-field__hint">가맹점별 계정을 바꾸면 그 가맹점의 모든 결제가 바뀌고, 저장할 때 규칙으로 기억됩니다(다음 가져오기부터 먼저 적용). 개인 지출은 인출금(3020)입니다. 취소 ' + p.skipped.length + '건은 제외했습니다.</div>' + tbl([['가맹점'], ['카드'], ['건', 'num'], ['금액', 'num'], ['계정'], ['']], rows) + go(p.fresh.length, '전표로 저장') + '</section>';
  }
  const ok = p.entries.length;
  return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — 전표 ' + ok + '건</h3></div>' + (p.errors.length ? alertHtml('warn', '⚠ 형식 오류 ' + p.errors.length + '건은 제외: ' + esc(p.errors.slice(0, 3).join(' · '))) : '') + go(p.fresh ? p.fresh.length : ok, '전표로 저장') + '</section>';
}

/* ───────── 재무제표 ───────── */
const STM = [['is', '손익계산서'], ['bs', '재무상태표'], ['tb', '합계잔액시산표']];
export function reportsHtml(st) {
  const s = st.stm; const kind = st.rep.kind;
  const bar = '<div class="jh-finance__bar"><div class="jh-segmented" role="group" aria-label="재무제표">' + STM.map(([c, l]) => '<button type="button" class="jh-segmented__item" data-rep-kind="' + c + '" aria-pressed="' + (c === kind) + '">' + l + '</button>').join('') + '</div><input class="jh-input" type="date" data-rep="from" value="' + esc(st.rep.from) + '" aria-label="시작일"><input class="jh-input" type="date" data-rep="to" value="' + esc(st.rep.to) + '" aria-label="종료일"><button type="button" class="jh-btn" data-variant="ghost" data-act="csv">엑셀(CSV)로 받기</button><button type="button" class="jh-btn" data-variant="ghost" data-act="print">인쇄</button></div>';
  const note = alertHtml('warn', '⚠ 초안입니다 — 세무조정(업무용승용차 한도·접대비 한도·가계성 지출 제외 등)이 반영되지 않았고, 확정 전 전표(확인 필요 ' + st.sum.review + '건)가 섞여 있습니다. 소득세 신고 전 세무사 검토가 필요합니다.');
  let body = '';
  if (kind === 'is') {
    const i = s.is, cc = s.cc; const row = (l, v, b) => '<tr' + (b ? ' class="is-strong"' : '') + '><td>' + esc(l) + '</td>' + num(v) + '</tr>';
    const r = [];
    i.revenue.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('Ⅰ. 매출액', i.sales, true));
    cc.groups.forEach((g) => { g.items.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('  ' + g.label + ' 소계', g.subtotal, true)); });
    r.push(row('Ⅱ. 매출원가(당기총공사비)', i.costOfSales, true), row('Ⅲ. 매출총이익', i.grossProfit, true)); i.sga.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('Ⅳ. 판매비와관리비', i.sgaTotal, true), row('Ⅴ. 영업이익', i.operatingIncome, true));
    i.nonopRevenue.forEach((x) => r.push(row('   ' + x.name, x.amount))); i.nonopExpense.forEach((x) => r.push(row('   ' + x.name, -x.amount))); r.push(row('Ⅵ. 당기순이익(세무조정 전)', i.netIncome, true));
    body = tbl([['손익계산서(공사원가명세서 포함) ' + s.from + ' ~ ' + s.to], ['금액', 'num']], r);
  } else if (kind === 'bs') {
    const b = s.bs; const row = (l, v, bo) => '<tr' + (bo ? ' class="is-strong"' : '') + '><td>' + esc(l) + '</td>' + num(v) + '</tr>'; const r = [];
    b.assets.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('자산 총계', b.assetsTotal, true)); b.liabs.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('부채 총계', b.liabsTotal, true)); b.equity.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('자본 총계', b.equityTotal, true), row('검산: 자산 − (부채 + 자본)', b.diff, true));
    body = tbl([['재무상태표 ' + s.to], ['금액', 'num']], r);
  } else {
    const t = s.tb; body = tbl([['코드'], ['계정과목'], ['차변 합계', 'num'], ['대변 합계', 'num'], ['잔액(차변)', 'num'], ['잔액(대변)', 'num']], t.rows.map((x) => '<tr><td>' + esc(x.code) + '</td><td>' + esc(x.name) + '</td>' + num(x.debit) + num(x.credit) + num(x.balDebit) + num(x.balCredit) + '</tr>').concat(['<tr class="is-strong"><td></td><td>합계</td>' + num(t.totals.debit) + num(t.totals.credit) + num(t.totals.balDebit) + num(t.totals.balCredit) + '</tr>'])) + alertHtml(t.balanced ? 'info' : 'danger', t.balanced ? '대차 일치' : '대차 불일치');
  }
  return bar + note + '<section class="jh-card jh-finance__paper">' + body + '</section>';
}

/* ───────── 개시 재산 / 설정 ───────── */
export function openingHtml(st) {
  const done = st.entries.find((e) => e.source && e.source.kind === 'opening');
  const rowsOf = (side) => OPENING_FIELDS.filter((f) => f.side === side).map((f) => '<div class="jh-field"><label class="jh-field__label" for="op-' + f.code + '">' + esc(f.label) + '</label><input class="jh-input" id="op-' + f.code + '" data-open="' + f.code + '" inputmode="numeric" placeholder="0"></div>').join('');
  return (done ? alertHtml('info', '개시 전표(' + esc(done.date) + ', ' + esc(done.no) + ')가 이미 있습니다. 같은 날짜에는 한 번만 저장되며, 잘못되었으면 그 전표를 역분개한 뒤 다른 일자로 다시 입력합니다.') : '') +
    '<section class="jh-card jh-form"><div class="jh-panel__head"><h3>개시(기초) 재산 목록</h3></div><p class="jh-field__hint">장부를 시작하는 날(예: 2025-12-31 현재) 가진 재산과 갚을 돈을 입력하면 자본금은 차액으로 자동 계산됩니다. 전기 재무제표가 없으면 이 목록이 출발점입니다. 모르는 항목은 비워 두세요(0).</p><div class="jh-field"><label class="jh-field__label" for="op-date">개시 일자</label><input class="jh-input" type="date" id="op-date" data-open-date value="' + esc(st.openDate) + '"><span class="jh-field__hint">전표 일자(보통 새 장부의 첫날, 예 2026-01-01)</span></div><div class="jh-finance__two"><div><h4>자산</h4>' + rowsOf('A') + '</div><div><h4>부채</h4>' + rowsOf('L') + '</div></div><div class="jh-alert" data-tone="info" data-open-result>입력하면 자본이 여기에 계산됩니다.</div><div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="open-save">개시 전표 저장</button></div></section>';
}
export function settingsHtml(st) {
  const s = st.settings; const admin = st.admin;
  return '<section class="jh-card jh-form"><div class="jh-panel__head"><h3>회사 설정</h3></div><div class="jh-field"><label class="jh-field__label" for="set-biz">내 사업자등록번호</label><input class="jh-input" id="set-biz" data-set="ownBiz" value="' + esc(s.ownBiz || '') + '" inputmode="numeric" placeholder="000-00-00000"' + (admin ? '' : ' disabled') + '><span class="jh-field__hint">홈택스 파일의 공급자(매출)·공급받는자(매입) 번호가 이 번호와 같아야 가져옵니다.</span></div><div class="jh-field"><label class="jh-field__label" for="set-name">상호</label><input class="jh-input" id="set-name" data-set="ownName" value="' + esc(s.ownName || '') + '"' + (admin ? '' : ' disabled') + '></div>' + (admin ? '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="set-save">설정 저장</button></div>' : '<div class="jh-field__hint">설정은 관리자만 바꿉니다.</div>') + '</section>' +
    '<section class="jh-card jh-form"><div class="jh-panel__head"><h3>결산 마감</h3></div><p class="jh-field__hint">마감일까지의 전표는 새로 만들 수 없게 잠급니다(수정은 마감 다음 날 이후 일자로 역분개). 마감일은 앞당길 수 없습니다. 현재 마감일: <strong>' + esc(s.lockedThrough || '없음') + '</strong></p>' + (admin ? '<div class="jh-finance__bar"><input class="jh-input" type="date" data-lock-date aria-label="마감일"><button type="button" class="jh-btn" data-variant="danger" data-act="lock">결산 마감</button></div>' : '<div class="jh-field__hint">결산 마감은 관리자만 합니다.</div>') + '</section>';
}
