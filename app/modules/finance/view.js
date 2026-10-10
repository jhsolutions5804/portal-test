import { esc } from '../../core/ui.js?v=20261008j';
import { ACCOUNTS, SOURCE_LABEL, sourceLabel, won, accountName, entryDebit, OPENING_FIELDS, EXPENSE_CATS, PAY_METHODS, EVIDENCE, NO_VAT_CATS, kstToday } from './logic.js?v=20261008j';

/* 재무회계 화면 조각 — 모든 값은 esc() 로 감싸 HTML 로 만든다. 스타일은 theme/finance.css 와 공용 클래스를 쓴다 */
const TABS = [['home', '개요'], ['entries', '전표'], ['expense', '비용 입력'], ['import', '가져오기'], ['reports', '재무제표'], ['opening', '개시 재산'], ['settings', '설정']];
export const tabsHtml = (cur) => '<div class="jh-segmented jh-finance__tabs" role="group" aria-label="재무회계">' + TABS.map(([k, l]) => '<a class="jh-segmented__item" href="#/finance/' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</a>').join('') + '</div>';

/** 카드 한 장: 제목 줄 + 안쪽 여백이 일정한 내용. flush=true 면 표처럼 가장자리까지 채우는 내용 */
const card = (title, bodyHtml, right, flush) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + (flush ? bodyHtml : bodyHtml) + '</section>';
const IMP_KIND = { taxsales: '홈택스 매출', taxpurchase: '홈택스 매입', bank: '통장', card: '카드', json: '전표 묶음', sales: '홈택스 매출', purchase: '홈택스 매입' };
/** 최근 가져오기 — 세로 목록(오른쪽 칸용) */
function importListHtml(list) {
  if (!list || !list.length) return '<div class="jh-empty">가져오기 이력이 없습니다.</div>';
  return '<ul class="jh-finance__list">' + list.map((x) => '<li class="jh-finance__li"><div><strong>' + esc(IMP_KIND[x.kind] || x.kind) + '</strong><span class="jh-field__hint">' + esc(x.fileName.length > 30 ? x.fileName.slice(0, 30) + '…' : x.fileName) + '</span><span class="jh-field__hint">읽음 ' + x.rows + ' · 저장 ' + x.posted + ' · 중복 ' + x.duplicates + '</span></div><span class="jh-field__hint">' + esc(kstText(x.ms)) + '</span></li>').join('') + '</ul>';
}
const alertHtml = (tone, html) => '<div class="jh-alert" data-tone="' + tone + '" role="status">' + html + '</div>';
const tbl = (head, rows, cls) => '<div class="jh-finance__scroll"><table class="jh-fin-table' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map((h) => '<th' + (h[1] ? ' class="' + h[1] + '"' : '') + '>' + esc(h[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
const num = (v) => '<td class="num">' + esc(won(v)) + '</td>';
const accOptions = (sel, only) => ACCOUNTS.filter((a) => !only || only.includes(a.code)).map((a) => '<option value="' + a.code + '"' + (a.code === sel ? ' selected' : '') + '>' + esc(a.code + ' ' + a.name) + '</option>').join('');
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
  const i = stm.is, b = stm.bs; const mini = (head, rows) => tbl([[head], ['금액', 'num']], rows.map(([l, v]) => '<tr><td>' + esc(l) + '</td>' + num(v) + '</tr>'), 'jh-fin-table--narrow');
  const sum = mini('기간 ' + stm.from + ' ~ ' + stm.to, [['매출액', i.sales], ['매출원가(공사원가)', i.costOfSales], ['매출총이익', i.grossProfit], ['판매비와관리비', i.sgaTotal], ['영업이익', i.operatingIncome], ['당기순이익(세무조정 전)', i.netIncome]]);
  const bs = mini('재무상태표 ' + stm.to, [['자산 총계', b.assetsTotal], ['부채 총계', b.liabsTotal], ['자본 총계', b.equityTotal], ['검산(자산−부채−자본)', b.diff]]);
  const quick = '<div class="jh-finance__pad"><div class="jh-finance__quick"><a class="jh-btn" data-variant="primary" href="#/finance/expense">+ 비용 입력</a><a class="jh-btn" href="#/finance/import">가져오기</a><a class="jh-btn" href="#/finance/entries">전표 보기</a><a class="jh-btn" href="#/finance/reports">재무제표</a></div></div>';
  return alerts.join('') + k + '<div class="jh-finance__split"><div class="jh-finance__col">' + card('손익 요약', sum, '<a class="jh-link" href="#/finance/reports">재무제표 ›</a>', true) + card('재무상태', bs, '', true) + '</div><div class="jh-finance__col">' + card('바로가기', quick) + card('최근 가져오기', importListHtml(st.imports), '', true) + '</div></div>';
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
  const d = entryDebit(e); const fact = (l, v) => '<div class="jh-finance__fact"><span>' + esc(l) + '</span><strong>' + v + '</strong></div>';
  const lines = tbl([['계정'], ['거래처'], ['차변', 'num'], ['대변', 'num']], e.lines.map((l) => '<tr><td>' + esc(l.account + ' ' + accountName(l.account)) + (l.pjt ? ' <span class="jh-chip">' + esc(l.pjt) + '</span>' : '') + '</td><td>' + esc(l.partner || '') + '</td>' + (l.side === 'D' ? num(l.amount) + '<td></td>' : '<td></td>' + num(l.amount)) + '</tr>').concat(['<tr class="is-strong"><td colspan="2">합계</td>' + num(d) + num(d) + '</tr>']));
  const chk = e.needsReview ? alertHtml('warn', '이 전표는 사람이 확인해야 하는 표시가 있습니다(분류가 확실하지 않은 건). 확인하셨으면 완료로 표시해 두세요. <button type="button" class="jh-btn" data-variant="ghost" data-act="reviewed">확인 완료로 표시</button>') : '';
  const rcv = e.source && /^rc_/.test(e.source.id || '') ? '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="ghost" data-act="rc-view">📷 원본 영수증 보기</button></div>' : '';
  const rev = e.reversedBy ? alertHtml('warn', '이 전표는 ' + esc(e.reversedByNo) + ' 로 역분개되었습니다.') : (e.reverses ? alertHtml('info', esc(e.reversesNo) + ' 전표의 역분개 전표입니다.') : (canReverse ? '<div class="jh-finance__rev"><h4>바로잡기 — 역분개</h4><div class="jh-finance__bar"><input class="jh-input" type="date" data-rev-date aria-label="역분개 일자"><input class="jh-input jh-finance__q" data-rev-memo placeholder="사유(선택)"><button type="button" class="jh-btn" data-variant="danger" data-act="reverse">역분개</button></div><div class="jh-field__hint">이 전표의 차변·대변을 뒤집은 새 전표를 만듭니다(원 전표는 그대로 남음). 일자는 마감일' + (locked ? '(' + esc(locked) + ')' : '') + ' 다음 날부터 가능합니다.</div></div>' : ''));
  return '<div class="jh-finance__facts">' + fact('번호', esc(e.no)) + fact('일자', esc(e.date)) + fact('원천', esc(sourceLabel(e.source && e.source.kind)) + (e.source && e.source.id ? ' · ' + esc(String(e.source.id).slice(0, 28)) : '')) + fact('작성', esc(e.createdByName) + ' ' + esc(kstText(e.createdMs))) + '</div><p class="jh-finance__memo">' + esc(e.memo) + '</p>' + chk + lines + rcv + rev;
}
export function manualDialogHtml(n) {
  const rows = []; for (let i = 0; i < n; i++) rows.push('<tr><td><select class="jh-select" data-ml="account"><option value="">계정 선택</option>' + accOptions('') + '</select></td><td><select class="jh-select" data-ml="side"><option value="D">차변</option><option value="C">대변</option></select></td><td><input class="jh-input" data-ml="amount" inputmode="numeric" placeholder="금액"></td><td><input class="jh-input" data-ml="partner" placeholder="거래처(선택)"></td></tr>');
  return '<div class="jh-finance__bar"><input class="jh-input" type="date" data-m="date" aria-label="일자"><input class="jh-input jh-finance__q" data-m="memo" placeholder="메모(예: 대출 이자 정리)"></div>' + tbl([['계정'], ['차/대'], ['금액'], ['거래처']], rows, 'jh-fin-table--form') + '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="ghost" data-act="addline">+ 줄 추가</button><span class="jh-field__hint" data-m-sum></span></div>';
}
/* ───────── 가져오기 ───────── */
const KINDS = [['payroll', '💼', '급여명세서', '포털 급여명세서(관리자)'], ['taxsales', '🧾', '홈택스 매출', '매출 세금계산서 엑셀'], ['taxpurchase', '🧾', '홈택스 매입', '매입 세금계산서 엑셀'], ['bank', '🏦', '통장 거래내역', '기업은행 엑셀(+농협)'], ['card', '💳', '카드 이용내역', '농협·삼성·현대·IBK'], ['json', '📦', '전표 묶음', '내보낸 JSON 파일']];
const GUIDE = {
  payroll: ['인사에서 해당 월 급여명세서를 먼저 저장해 두세요', '귀속월을 고르고 불러오면 직원별 전표 초안이 나옵니다(총지급·공제·기숙사비·실지급)', '현장 직원은 현장노무비, 그 밖은 급여(판관비)로, 4대보험·세금은 예수금으로 잡힙니다', '이미 엑셀·묶음으로 올린 달은 이중으로 잡히지 않게 막습니다. 관리자만 쓸 수 있습니다'],
  taxsales: ['홈택스 로그인 → 조회/발급 → 전자(세금)계산서 목록조회', '"매출"을 고르고 기간을 정해 조회', '엑셀로 내려받은 파일(.xls·.xlsx)을 위에 올리기', '내 사업자번호와 다른 건은 자동으로 제외됩니다'],
  taxpurchase: ['홈택스 로그인 → 조회/발급 → 전자(세금)계산서 목록조회', '"매입"을 고르고 기간을 정해 조회', '엑셀로 내려받은 파일(.xls·.xlsx)을 위에 올리기', '거래처별 계정은 미리보기에서 바꿀 수 있습니다'],
  bank: ['기업은행 인터넷뱅킹 → 거래내역 조회 → 엑셀로 저장', '대표님 개인 농협 계좌 엑셀은 선택입니다(개인카드 대금 정산 짝짓기용, 장부에는 안 들어감)', '올리면 자동·확인·미정 분류 현황이 먼저 나옵니다', '저장을 누르기 전까지 장부에는 들어가지 않습니다'],
  card: ['농협·삼성·현대 카드 이용내역 또는 IBK 카드 매출내역 엑셀', '여러 파일을 한 번에 고를 수 있습니다', '가맹점별 계정을 바꾸면 그 가맹점 전체가 바뀌고 규칙으로 기억됩니다', '취소 건은 자동으로 빠집니다'],
  json: ['이 화면에서 내보냈거나 작업 묶음에 들어 있는 전표 묶음 파일(.json)', '계정·차대 검사를 통과한 전표만 올라갑니다', '이미 올린 건은 중복으로 건너뜁니다']
};
const dropHtml = (kind, accept, multi, hint, attrs) => '<label class="jh-finance__drop" data-drop="' + kind + '"><input type="file" ' + attrs + (multi ? ' multiple' : '') + ' accept="' + accept + '"><span class="jh-finance__drop-ic" aria-hidden="true">' + (kind === 'rc' ? '📷' : '📂') + '</span><strong>' + (kind === 'rc' ? '영수증 사진·PDF 올리기' : '파일을 끌어다 놓거나 눌러서 선택') + '</strong><span class="jh-field__hint">' + esc(hint) + '</span></label>';
export function importHtml(st) {
  const k = st.imp.kind; const info = KINDS.find((x) => x[0] === k);
  const kinds = '<div class="jh-finance__kinds" role="group" aria-label="가져오기 종류">' + KINDS.filter((x) => x[0] !== 'payroll' || st.admin).map(([c, ic, l, d]) => '<button type="button" class="jh-finance__kind" data-imp-kind="' + c + '" aria-pressed="' + (c === k) + '"><span aria-hidden="true">' + ic + '</span><strong>' + esc(l) + '</strong><span>' + esc(d) + '</span></button>').join('') + '</div>';
  const accept = k === 'json' ? '.json,application/json' : '.xls,.xlsx'; const multi = k === 'card';
  const hint = k === 'card' ? '.xls·.xlsx · 여러 파일 가능' : (k === 'json' ? '.json 파일' : '.xls·.xlsx 파일');
  let extra = '';
  if (k === 'bank') extra = '<div class="jh-field"><label class="jh-field__label">농협 통장 거래내역(선택)</label><input class="jh-input" type="file" data-file2 accept=".xls,.xlsx"><span class="jh-field__hint">개인카드 대금 정산 이체를 짝짓는 데만 씁니다. 먼저 위에 기업은행 파일을 올리세요.</span></div>';
  const prevM = (() => { const t = new Date(Date.now() + 9 * 3600000); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() - 1); return t.toISOString().slice(0, 7); })();
  const payForm = '<div class="jh-finance__pad"><div class="jh-field"><label class="jh-field__label" for="pay-month">귀속월</label><input class="jh-input" id="pay-month" type="month" data-pay-month value="' + prevM + '"><span class="jh-field__hint">급여를 받는 달이 아니라 일한 달(예: 9월 근무분)입니다. 월말 일자 전표로 만들어집니다.</span></div><div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="pay-load">불러오기</button></div>' + (st.imp.busy ? '<div class="jh-skeleton" style="height:var(--u-44)"></div>' : '') + (st.imp.error ? alertHtml('danger', esc(st.imp.error)) : '') + '</div>';
  const up = k === 'payroll' ? payForm : '<div class="jh-finance__pad">' + dropHtml('imp', accept, multi, hint, 'data-file') + extra + (st.imp.busy ? '<div class="jh-skeleton" style="height:var(--u-44)"></div>' : '') + (st.imp.error ? alertHtml('danger', esc(st.imp.error)) : '') + '</div>';
  const guide = '<div class="jh-finance__pad"><ol class="jh-finance__steps">' + GUIDE[k].map((g) => '<li>' + esc(g) + '</li>').join('') + '</ol></div>';
  return kinds + '<div class="jh-finance__split"><div class="jh-finance__col">' + card(info[2] + (k === 'payroll' ? ' 불러오기' : ' 올리기'), up) + '</div><div class="jh-finance__col">' + card('이렇게 받으세요', guide) + card('최근 가져오기', importListHtml(st.imports), '', true) + '</div></div>' + (st.imp.preview ? previewHtml(st) : '');
}
function previewHtml(st) {
  const p = st.imp.preview; const k = st.imp.kind; const warn = (p.warnings || []).map((w) => alertHtml('warn', '⚠ ' + esc(w))).join('');
  const go = (n, label) => '<div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="commit"' + (n ? '' : ' disabled') + '>' + esc(label) + ' (' + n + '건)</button><span class="jh-field__hint">' + (p.dupCount ? '이미 올린 ' + p.dupCount + '건은 건너뜁니다. ' : '') + '저장한 전표는 고치거나 지울 수 없고 역분개로만 바로잡습니다.</span></div>';
  if (k === 'taxsales' || k === 'taxpurchase') {
    const rows = p.rows.slice(0, 200).map((r) => '<tr><td>' + esc(r.inv.date) + '</td><td>' + esc(k === 'taxsales' ? r.inv.buyer.name : r.inv.supplier.name) + '</td><td>' + esc(r.inv.item) + '</td>' + num(r.inv.supply) + num(r.inv.vat) + num(r.inv.total) + '<td>' + (k === 'taxpurchase' ? '<select class="jh-select" data-sup="' + esc(r.supKey) + '">' + accOptions(r.account, ['5010', '5210', '5340', '5350', '5360', '5370', '5380', '5390', '6020', '6040', '6050', '6060', '6090', '6100', '6110', '6120', '6130', '6190']) + '</select>' : esc('4010 공사수입')) + '</td><td>' + (!r.ownerOk ? '<span class="jh-chip" data-tone="warn">다른 회사</span>' : (r.dup ? '<span class="jh-chip">이미 올림</span>' : '<span class="jh-chip" data-tone="accent">신규</span>')) + '</td></tr>');
    return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — ' + p.rows.length + '건 · 공급가 ' + esc(won(p.supply)) + ' · 합계 ' + esc(won(p.sum)) + '</h3></div>' + warn + tbl([['작성일'], ['거래처'], ['품목'], ['공급가', 'num'], ['부가세', 'num'], ['합계', 'num'], ['계정'], ['상태']], rows) + go(p.fresh.length, '전표로 저장') + '</section>';
  }
  if (k === 'payroll') {
    const t = p.totals; const rows = p.rows.map((r) => '<tr><td>' + esc(r.p.name) + (r.p.rank ? ' <span class="jh-field__hint">' + esc(r.p.rank) + '</span>' : '') + '</td><td>' + (r.ok ? (r.site ? '현장(노무비)' : '사무(급여)') : '<span class="jh-chip" data-tone="warn">제외</span>') + '</td>' + num(r.p.grossPay) + num(r.ded) + num(r.p.dormitory) + num(r.p.netPay) + '<td>' + (!r.ok ? '<span class="jh-chip" data-tone="warn">금액 불일치</span>' : (p.dup.some((e) => e.source.id === r.entry.source.id) ? '<span class="jh-chip">이미 올림</span>' : (p.conflict ? '<span class="jh-chip" data-tone="warn">막힘</span>' : '<span class="jh-chip" data-tone="accent">신규</span>'))) + '</td></tr>');
    return '<section class="jh-card"><div class="jh-panel__head"><h3>미리보기 — ' + esc(p.month) + ' 급여 ' + p.rows.length + '명 · 총지급 ' + esc(won(t.gross)) + ' · 실지급 ' + esc(won(t.net)) + '</h3></div>' + warn + (p.rows.length ? tbl([['직원'], ['구분'], ['총지급', 'num'], ['4대보험·세금', 'num'], ['기숙사비', 'num'], ['실지급', 'num'], ['상태']], rows) : '') + go(p.fresh.length, '전표로 저장') + '</section>';
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
const STM = [['is', '손익계산서'], ['bs', '재무상태표'], ['cf', '현금흐름표'], ['tb', '합계잔액시산표']];
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
  } else if (kind === 'cf') {
    const c = s.cf; const row = (l, v, bo) => '<tr' + (bo ? ' class="is-strong"' : '') + '><td>' + esc(l) + '</td>' + num(v) + '</tr>'; const r = [row('기초 현금(보통예금+현금)', c.beginCash, true)];
    r.push('<tr><td colspan="2" class="jh-field__hint">Ⅰ. 영업활동 — 당기순이익에서 시작해 현금이 안 움직인 것(감가상각)과 외상·미지급 같은 시차를 되돌립니다</td></tr>'); c.operating.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('영업활동 현금흐름', c.operatingTotal, true));
    r.push('<tr><td colspan="2" class="jh-field__hint">Ⅱ. 투자활동 — 차량·비품 같은 오래 쓰는 자산을 사고판 돈</td></tr>'); if (c.investing.length) c.investing.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('투자활동 현금흐름', c.investingTotal, true));
    r.push('<tr><td colspan="2" class="jh-field__hint">Ⅲ. 재무활동 — 빌린 돈·갚은 돈, 대표님 인출·정산</td></tr>'); if (c.financing.length) c.financing.forEach((x) => r.push(row('   ' + x.name, x.amount))); r.push(row('재무활동 현금흐름', c.financingTotal, true));
    r.push(row('현금 증감 (Ⅰ+Ⅱ+Ⅲ)', c.change, true), row('기말 현금', c.endCash, true), row('검산: 재무상태표 현금과의 차이', c.diff, true));
    body = tbl([['현금흐름표(간접법) ' + s.from + ' ~ ' + s.to], ['금액', 'num']], r) + alertHtml(c.balanced ? 'info' : 'danger', c.balanced ? '재무상태표의 현금과 일치합니다.' : '재무상태표의 현금과 ' + won(c.diff) + ' 차이가 있습니다 — 계정 분류를 확인해야 합니다.');
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

/* ───────── 비용 입력 ───────── */
export function expenseHtml(st) {
  const cats = EXPENSE_CATS.map(([l, a]) => '<option value="' + a + '">' + esc(l) + '</option>').join(''); const pays = PAY_METHODS.map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join(''); const ev = EVIDENCE.map((e) => '<option>' + esc(e) + '</option>').join('');
  const f = (label, html, hint) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + '</label>' + html + (hint ? '<span class="jh-field__hint">' + esc(hint) + '</span>' : '') + '</div>';
  const proj = '<datalist id="fin-proj">' + (st.projects || []).map((p) => '<option value="' + esc(p.code) + '">' + esc(p.name) + '</option>').join('') + '</datalist>';
  const all = st.entries.filter((e) => e.source && e.source.kind === 'expense'); const recent = all.slice().sort((a, b) => b.createdMs - a.createdMs).slice(0, 12);
  const ym = kstToday().slice(0, 7); const mon = all.filter((e) => String(e.date).slice(0, 7) === ym); const monSum = mon.reduce((s, e) => s + entryDebit(e), 0); const monRev = mon.filter((e) => e.needsReview).length;
  const form = '<div class="jh-finance__pad"><div class="jh-alert" data-tone="info" role="note">카드·통장·홈택스 내역은 <a class="jh-link" href="#/finance/import">가져오기</a>로 올리는 것이 정확합니다. 같은 지출을 두 번 넣지 마세요.</div><div data-rc-banner></div>' + proj + '<div class="jh-finance__two"><div>' + f('일자', '<input class="jh-input" type="date" data-x="date" value="' + esc(kstToday()) + '">') + f('가맹점·내용', '<input class="jh-input" data-x="what" maxlength="60" placeholder="예: 현장 안전모 구입(거상)">') + f('구분', '<select class="jh-select" data-x="account">' + cats + '</select>') + f('결제수단', '<select class="jh-select" data-x="pay">' + pays + '</select>', '카드는 이용 시점에 미지급금으로 쌓이고, 카드 대금 이체 때 정리됩니다.') + '</div><div>' +
    f('금액(합계, 부가세 포함)', '<input class="jh-input" data-x="total" inputmode="numeric" placeholder="0">') + '<div class="jh-field"><label class="jh-finance__check"><input type="checkbox" data-x="deduct"> 부가세 공제 대상(세금계산서·사업용 카드 영수증)</label><div class="jh-finance__bar"><input class="jh-input" data-x="vat" inputmode="numeric" placeholder="부가세 금액"><button type="button" class="jh-btn" data-variant="ghost" data-act="vat10">10% 계산</button></div><span class="jh-field__hint">접대비·기부금·개인 지출은 공제가 안 되어 자동으로 비용에 포함됩니다. 모르면 비워 두세요.</span></div>' +
    f('프로젝트(선택)', '<input class="jh-input" data-x="pjt" list="fin-proj" placeholder="프로젝트 코드">') + f('증빙 종류', '<select class="jh-select" data-x="evidence">' + ev + '</select>', '간이영수증·증빙 없음은 "확인 필요"로 표시됩니다.') + f('메모(선택)', '<input class="jh-input" data-x="memo" maxlength="80">') + '</div></div><div class="jh-alert" data-tone="info" data-x-result>입력하면 전표 모양이 여기에 나옵니다.</div><div class="jh-finance__bar"><button type="button" class="jh-btn" data-variant="primary" data-act="exp-save">전표로 저장</button></div></div>';
  const rc = '<div class="jh-finance__pad">' + dropHtml('rc', 'image/*,application/pdf', true, 'JPG·PNG·PDF · 여러 장 가능 · 한 장 7MB 이하', 'data-rc-file') + '<div class="jh-field__hint" data-rc-status>AI가 읽은 값은 틀릴 수 있어 원본과 비교한 뒤 저장해야 합니다. 원본은 증빙으로 보관됩니다.</div><div data-rc-list></div></div>';
  const rows = recent.length ? '<ul class="jh-finance__list">' + recent.map((e) => '<li class="jh-finance__li" data-entry="' + esc(e.id) + '" tabindex="0"><div><strong>' + esc(e.memo.length > 34 ? e.memo.slice(0, 34) + '…' : e.memo) + '</strong><span class="jh-field__hint">' + esc(e.date) + ' · ' + esc(accountName((e.lines[0] || {}).account)) + (e.needsReview ? ' · 확인 필요' : '') + '</span></div><span class="jh-finance__amt">' + esc(won(entryDebit(e))) + '</span></li>').join('') + '</ul>' : '<div class="jh-empty">아직 입력한 비용이 없습니다.</div>';
  const stat = '<div class="jh-finance__pad"><div class="jh-finance__stat"><div class="jh-finance__fact"><span>이번 달 입력</span><strong>' + mon.length + '건</strong></div><div class="jh-finance__fact"><span>합계</span><strong>' + esc(won(monSum)) + '</strong></div><div class="jh-finance__fact"><span>확인 필요</span><strong>' + monRev + '건</strong></div></div></div>';
  const tips = '<div class="jh-finance__pad"><ul class="jh-finance__steps"><li>개인적으로 쓴 돈은 구분을 <strong>개인 지출</strong>로 — 인출금으로 처리됩니다.</li><li>세금계산서나 사업용 카드 영수증이면 <strong>부가세 공제</strong>를 켜고 10% 계산을 누르세요.</li><li>간이영수증·증빙 없음은 <strong>확인 필요</strong>로 남습니다.</li><li>잘못 저장했으면 전표 상세에서 <strong>역분개</strong>로 바로잡습니다.</li></ul></div>';
  return '<div class="jh-finance__split"><div class="jh-finance__col">' + card('직접 입력', form) + card('📷 영수증 가져오기', rc) + '</div><div class="jh-finance__col">' + card('최근 입력 ' + recent.length + '건', rows, '', true) + card('이번 달', stat) + card('입력 팁', tips) + '</div></div>';
}
