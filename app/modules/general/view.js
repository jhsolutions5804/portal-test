import { esc } from '../../core/ui.js?v=20261031c';
import { GTYPES, GKEYS, creditBalance, creditRowsBalance, creditTotals, dday, won, leasePayState, dueList, homeSummary, leaseMonthly, driveAllRows, driveFilter, driveTotals, driveByProject, driveByMonth, driveOdoCheck, driveRange, weekStart, DRIVE_STATUS, driveKeywordStats, matchHistory } from './logic.js?v=20261031c';

const TABS = [['home', '개요'], ['lease', '임대'], ['vehicle', '차량'], ['drive', '운행일지'], ['asset', '자산·장비'], ['credit', '외상 장부'], ['renewal', '갱신 일정']];
export const tabsHtml = (cur, base) => '<div class="jh-segmented jh-gen__tabs" role="group" aria-label="총무">' + TABS.map(([k, l]) => '<a class="jh-segmented__item" href="' + esc(base || '#/general') + '/' + k + '" aria-pressed="' + (k === cur) + '">' + esc(l) + '</a>').join('') + '</div>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const alertHtml = (tone, html) => '<div class="jh-alert" data-tone="' + tone + '" role="status">' + html + '</div>';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const ddayText = (n) => (n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + Math.abs(n));

/** 개요: 네 종류의 숫자와 가까운 만기·갱신 */
export function homeHtml(st) {
  const data = st.data; const s = homeSummary(data); const dues = dueList(data, st.today, 90); const total = GKEYS.reduce((n, k) => n + (data[k] || []).length, 0);
  const kpi = [['임대', s.leaseN + '건', '월 ' + won(s.leaseMonthly) + '원(관리비 포함)', 'lease'], ['차량', s.vehicleN + '대', '월 ' + won(s.vehicleMonthly) + '원', 'vehicle'], ['자산·장비', s.assetN + '점', '구입가 합계 ' + won(s.assetCost) + '원', 'asset'], ['외상 장부', s.creditN + '곳', '미결제 잔액 ' + won(s.creditBalance) + '원', 'credit'], ['갱신 일정', s.renewalN + '건', '연 환산 ' + won(s.renewalYear) + '원', 'renewal']];
  const k = '<div class="jh-kpi-grid">' + kpi.map(([l, v, h, key]) => '<a class="jh-kpi jh-gen__kpi" href="' + esc(st.base || '#/general') + '/' + key + '"><span class="jh-kpi__label">' + esc(l) + '</span><span class="jh-kpi__value">' + esc(v) + '</span><span class="jh-kpi__hint">' + esc(h) + '</span></a>').join('') + '</div>';
  const rows = dues.map((x) => '<tr class="jh-gen__row" data-g-go="' + esc(x.type) + '" data-g-id="' + esc(x.id) + '"><td>' + chip(ddayText(x.d), x.tone === 'muted' ? 'muted' : x.tone) + '</td><td>' + esc(x.date) + '</td><td>' + esc(GTYPES[x.type].title) + '</td><td>' + esc(x.label) + '</td><td>' + esc(x.what) + '</td></tr>').join('');
  const body = dues.length ? '<div class="jh-gen__scroll"><table class="jh-gen-table jh-gen-table--click"><thead><tr><th>남은 날</th><th>일자</th><th>구분</th><th>항목</th><th>내용</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">앞으로 90일 안에 다가오는 만기·갱신이 없습니다.</div>';
  const first = total === 0 ? alertHtml('info', '아직 입력된 항목이 없습니다. 각 탭에서 항목을 추가하거나, <strong>임대·갱신 일정</strong> 탭의 "엑셀 기준 첫 목록 넣기"로 월간 손익계산서 엑셀에 있던 항목을 한 번에 넣을 수 있습니다.') : '';
  return first + k + card('다가오는 만기·갱신 (90일 안, 지난 것 포함)', body);
}

const inputFor = (f, val, attr) => {
  const v = esc(val == null ? '' : val);
  if (f.t === 'select') return '<select class="jh-select" ' + attr + '>' + f.o.map((o) => '<option' + (String(val) === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
  if (f.t === 'area') return '<textarea class="jh-input" rows="3" ' + attr + '>' + v + '</textarea>';
  if (f.t === 'date') return '<input class="jh-input" type="date" value="' + v + '" ' + attr + '>';
  if (f.t === 'money' || f.t === 'int') return '<input class="jh-input" inputmode="numeric" value="' + v + '" ' + attr + '>';
  return '<input class="jh-input" value="' + v + '" ' + (f.ph ? 'placeholder="' + esc(f.ph) + '" ' : '') + attr + '>';
};
/** 항목 하나의 입력 양식(새로 만들기·수정) + 이력 편집 */
export function editHtml(st) {
  const e = st.edit; const T = GTYPES[e.type];
  const fields = T.fields.map((f) => '<div class="jh-field' + (f.t === 'area' ? ' jh-gen__wide' : '') + '"><label class="jh-field__label">' + esc(f.l) + (f.req ? ' *' : '') + '</label>' + inputFor(f, e.vals[f.k], 'data-gf="' + f.k + '"') + '</div>').join('');
  let log = '';
  if (T.log) {
    const L = T.log;
    const head = L.cols.map((c) => '<th>' + esc(c.l) + '</th>').join('') + '<th></th>';
    const rows = e.rows.map((r, i) => '<tr>' + L.cols.map((c) => '<td>' + inputFor(c, r[c.k], 'data-gl="' + i + ':' + c.k + '" aria-label="' + esc(c.l) + '"') + '</td>').join('') + '<td><button type="button" class="jh-btn" data-variant="ghost" data-g-logdel="' + i + '">삭제</button></td></tr>').join('');
    log = '<h4 class="jh-gen__sub">' + esc(L.l) + ' <span class="jh-field__hint">(' + e.rows.length + '줄)</span>' + (e.type === 'credit' ? ' <span class="jh-field__hint">· 현재 미결제 잔액 ' + won(creditRowsBalance(e.rows)) + '원 (외상 − 결제 − 반품)</span>' : '') + '</h4><div class="jh-gen__scroll"><table class="jh-gen-table"><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="' + (L.cols.length + 1) + '" class="jh-field__hint">이력이 없습니다.</td></tr>') + '</tbody></table></div><div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="ghost" data-g-logadd>+ 줄 추가</button></div>';
  }
  const title = (e.isNew ? T.add : T.label(e.vals) + ' 수정');
  return card(title, '<div class="jh-gen__pad"><div class="jh-gen__grid">' + fields + '</div>' + log + '<div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-g-act="save">저장</button><button type="button" class="jh-btn" data-variant="ghost" data-g-act="cancel">취소</button>' + (e.isNew ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-g-act="delete">삭제</button>') + '</div></div>');
}
/** 목록 표(검색·상태 거름 반영) */
export function tableHtml(st, type) {
  const T = GTYPES[type]; const q = (st.q || '').trim().toLowerCase(); const all = st.data[type] || [];
  const list = all.filter((d) => (!st.onlyActive || T.active(d)) && (!q || JSON.stringify(d).toLowerCase().includes(q)));
  const head = T.cols.map((c) => '<th' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + esc(c[0]) + '</th>').join('') + '<th>상태·알림</th>';
  const rows = list.map((d) => {
    const dues = T.dues(d).map((du) => { const n = dday(du.date, st.today); return n === null ? null : { n, what: du.what, lead: du.lead }; }).filter(Boolean).sort((a, b) => a.n - b.n)[0];
    let badge = '';
    if (type === 'lease') { const ps = leasePayState(d, st.today); if (ps) badge += chip(ps.text, ps.tone); }
    if (type === 'credit') { const b = creditBalance(d); badge += chip(b > 0 ? '미결제 ' + won(b) + '원' : b < 0 ? '선결제 ' + won(-b) + '원' : '정산 완료', b > 0 ? 'warn' : 'muted'); }
    if (dues && T.active(d) && dues.n <= Math.max(dues.lead, 0)) badge += ' ' + chip(ddayText(dues.n) + ' ' + dues.what, dues.n < 0 ? 'danger' : 'warn');
    return '<tr class="jh-gen__row' + (T.active(d) ? '' : ' jh-gen__off') + '" data-g-open="' + esc(d.id) + '">' + T.cols.map((c) => '<td' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + esc(c[1](d, st.today)) + '</td>').join('') + '<td>' + badge + '</td></tr>';
  }).join('');
  return list.length ? '<div class="jh-gen__scroll"><table class="jh-gen-table jh-gen-table--click"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">' + (all.length ? '조건에 맞는 항목이 없습니다.' : '아직 항목이 없습니다.') + '</div>';
}
export function listHtml(st, type) {
  const T = GTYPES[type]; const hasSeed = (st.seed || {})[type] > 0 && !(st.data[type] || []).length;
  const bar = '<div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-g-add>' + esc(T.add) + '</button><input class="jh-input jh-gen__q" data-g-q placeholder="검색" value="' + esc(st.q || '') + '" aria-label="검색"><label class="jh-field__hint"><input type="checkbox" data-g-active' + (st.onlyActive ? ' checked' : '') + '> ' + esc(T.activeFilter) + '만 보기</label>' + (hasSeed ? '<button type="button" class="jh-btn" data-variant="ghost" data-g-seed>엑셀 기준 첫 목록 넣기</button>' : '') + (type === 'vehicle' ? '<button type="button" class="jh-btn" data-variant="ghost" data-g-sync>운행일지 차량 목록 동기화</button>' : '') + '</div>';
  const crT = type === 'credit' ? creditTotals(st.data.credit) : null;
  const extra = type === 'credit' ? '<div class="jh-gen__pad"><div class="jh-field__hint"><strong>미결제 합계 ' + won(crT.balance) + '원</strong> (' + Object.keys(crT.byKind).map((k) => k + ' ' + won(crT.byKind[k]) + '원').join(' · ') + ') · 미결제 거래처 ' + crT.open + '곳</div><div class="jh-field__hint">거래처마다 항목을 열어 "거래 내역"에 외상·결제·반품을 한 줄씩 기록합니다(청구 법인은 어느 회사 몫의 구매인지, 결제 수단은 결제 줄에). 잔액 = 외상 합계 − 결제 합계 − 반품 합계. 자재·공구 구매, 식당처럼 월말에 정산하는 거래를 거래처별로 관리합니다.</div></div>' : type === 'lease' ? '<div class="jh-field__hint jh-gen__pad">월 납부액 = 월 임대료 + 월 부가세. 입금 이력은 항목을 열면 "귀속 월"별로 기록합니다.</div>' : type === 'vehicle' ? '<div class="jh-field__hint jh-gen__pad">차량을 저장하면 전자결재 "차량 운행일지"의 차량 선택 목록이 자동으로 갱신됩니다(사용 중인 차량만). 출고일·출고 시 계기판을 넣어 두면 운행일지가 그 시점부터 집계됩니다.</div>' : '';
  return (st.edit && st.edit.type === type ? editHtml(st) : '') + card(T.title + ' (' + (st.data[type] || []).length + ')', '<div class="jh-gen__pad">' + bar + '</div><div id="g-table">' + tableHtml(st, type) + '</div>' + extra);
}
/** 차량 운행일지 취합 — 전자결재로 올라온 일지를 시간 순으로 모아 일간·주간·월간·프로젝트별로 본다 */
const D_MODES = [['all', '전체(출고 이후)'], ['day', '일간'], ['week', '주간'], ['month', '월간'], ['project', '프로젝트별']];
const dKm = (n) => (Number(n) || 0).toLocaleString('ko-KR');
/** 운행일지 화면과 엑셀이 같은 거름 결과를 쓰도록 한 곳에서 계산 */
export function driveSelect(st) {
  const f = st.drive; const veh = st.data.vehicle || []; const vById = {}; veh.forEach((v) => { vById[v.id] = v; }); const all = driveAllRows(f.docs, f.hist, vById, { approvedOnly: f.approvedOnly }); const vsel = veh.find((v) => v.id === f.vehicleId) || null; const from = vsel && vsel.delivery ? vsel.delivery : '';
  const anchor = f.mode === 'month' ? f.ym : f.anchor; const base = driveFilter(all, { mode: f.mode === 'project' ? 'all' : f.mode, anchor, from, vehicleId: f.vehicleId, driver: f.driver, pjtKey: '' });
  return { all, veh, vsel, from, anchor, base, rows: f.pjtKey ? base.filter((x) => x.pjtKey === f.pjtKey) : base };
}
/** 과거 일지 가져오기 미리보기 — 차량·기간·주행거리 합계와 보정 내용을 보여 주고 확인 뒤에 저장한다 */
function importPreviewHtml(st) {
  const p = st.drive.imp; if (!p) return '';
  if (!p.ok) return card('과거 일지 가져오기', '<div class="jh-gen__pad"><div class="jh-alert" data-tone="danger" role="alert">가져올 수 없습니다:<br>' + p.errors.map(esc).join('<br>') + '</div><div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="ghost" data-d-imp-cancel>닫기</button></div></div>');
  const s = p.summary; const rp = s.report || {}; const exists = (st.drive.hist || []).length;
  const vt = '<div class="jh-gen__scroll"><table class="jh-gen-table"><thead><tr><th>차량</th><th class="num">줄</th><th class="num">주행거리(km)</th><th class="num">업무용(km)</th><th>출고일</th><th class="num">출고 시 계기판</th></tr></thead><tbody>' + s.vehicles.map((v) => '<tr><td>' + esc(v.name) + '</td><td class="num">' + v.n + '</td><td class="num">' + dKm(v.km) + '</td><td class="num">' + dKm(v.biz) + '</td><td>' + esc(v.delivery || '') + '</td><td class="num">' + dKm(v.deliveryOdo) + '</td></tr>').join('') + '</tbody></table></div>';
  const notes = [rp.skippedBlankTemplateRows ? '빈 양식 줄 ' + rp.skippedBlankTemplateRows + '개는 뺐습니다.' : '', rp.dateNotes && rp.dateNotes['모호(10·20·30일 가능)'] ? '날짜가 "5.2"처럼 모호한 칸 ' + rp.dateNotes['모호(10·20·30일 가능)'] + '곳은 앞뒤 순서로 확정했습니다.' : '', rp.dateNotes && rp.dateNotes['연도 보정'] ? '연도가 잘못된 날짜 ' + rp.dateNotes['연도 보정'] + '곳을 바로잡았습니다.' : '', (rp.anomalies || []).length ? '주행거리 칸과 계기판 차이가 다른 ' + rp.anomalies.length + '줄은 계기판 기준으로 반영했습니다.' : '', '주행거리는 모두 계기판 차이로 계산했습니다.'].filter(Boolean);
  return card('과거 일지 가져오기 — 미리보기', '<div class="jh-gen__pad"><div class="jh-alert" data-tone="info" role="status">' + s.rows + '줄 · ' + s.months + '개월(' + esc(s.from) + ' ~ ' + esc(s.to) + ')을 가져옵니다. 차량이 없으면 새로 등록하고, 이미 있는 달은 덮어씁니다(여러 번 가져와도 겹치지 않습니다).' + (exists ? ' 현재 이식된 달 ' + exists + '개.' : '') + '</div>' + vt + '<ul class="jh-gen__sub" style="font-size:var(--fs-sm)">' + notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul><div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-d-imp-go>가져오기</button><button type="button" class="jh-btn" data-variant="ghost" data-d-imp-cancel>취소</button></div></div>');
}
/** 이식한 과거 기록에 프로젝트 일괄 지정 카드 */
function assignHtml(st) {
  const f = st.drive; const hist = f.hist || []; if (!hist.length) return '';
  const pa = f.pa; const total = hist.reduce((s, m) => s + (m.rows || []).length, 0); const none = hist.reduce((s, m) => s + (m.rows || []).filter((r) => !r.pjtId).length, 0);
  const mt = matchHistory(hist, pa); const stats = driveKeywordStats(hist, 20);
  const chips = stats.length ? '<div class="jh-gen__bar">' + stats.map((x) => '<button type="button" class="jh-chip" data-tone="muted" data-d-kw="' + esc(x.word) + '" style="cursor:pointer" title="' + x.n + '줄 · ' + dKm(x.km) + 'km">' + esc(x.word) + ' ' + x.n + '</button>').join('') + '</div>' : '';
  const opts = '<option value="">프로젝트를 고르세요</option><option value="common"' + (pa.pjt === 'common' ? ' selected' : '') + '>공통 · 프로젝트 무관</option>' + (f.projects || []).map((p) => '<option value="' + esc(p.id) + '"' + (p.id === pa.pjt ? ' selected' : '') + '>' + esc((p.code ? p.code + ' · ' : '') + p.name) + '</option>').join('');
  const body = '<div class="jh-gen__pad"><div class="jh-field__hint">이식한 ' + total + '줄 중 프로젝트가 아직 없는 줄은 ' + none + '줄입니다. 내용에 들어 있는 말(예: #5, 2게이트)로 줄을 찾아 한 번에 프로젝트를 지정합니다. 아래 말을 누르면 입력됩니다(숫자는 그 말이 들어 있는 줄 수).</div>' + chips
    + '<div class="jh-gen__bar"><input class="jh-input" data-d-pa="kw" placeholder="내용에 들어 있는 말(예: #5)" value="' + esc(pa.kw) + '" aria-label="찾을 말"><select class="jh-select" data-d-pa="pjt" aria-label="프로젝트">' + opts + '</select><input class="jh-input" type="date" data-d-pa="from" value="' + esc(pa.from) + '" aria-label="시작일"><input class="jh-input" type="date" data-d-pa="to" value="' + esc(pa.to) + '" aria-label="종료일"><label class="jh-field__hint"><input type="checkbox" data-d-pa-over' + (pa.over ? ' checked' : '') + '> 이미 지정된 줄도 바꿈</label></div>'
    + '<div class="jh-gen__bar"><span class="jh-field__hint">' + (pa.kw ? '찾은 줄 <strong>' + mt.n + '줄</strong> · ' + dKm(mt.km) + ' km · ' + mt.months + '개월' : '찾을 말을 입력하세요') + '</span><button type="button" class="jh-btn" data-variant="primary" data-d-pa-go' + (mt.n && pa.pjt ? '' : ' disabled') + '>프로젝트 지정</button></div></div>';
  return card('이식한 과거 기록에 프로젝트 지정', body);
}
export function driveHtml(st) {
  const f = st.drive; const veh = st.data.vehicle || []; const vById = {}; veh.forEach((v) => { vById[v.id] = v; }); const all = driveAllRows(f.docs, f.hist, vById, { approvedOnly: f.approvedOnly }); const vsel = veh.find((v) => v.id === f.vehicleId) || null;
  const from = vsel && vsel.delivery ? vsel.delivery : ''; const anchor = f.mode === 'month' ? f.ym : f.anchor;
  const base = driveFilter(all, { mode: f.mode === 'project' ? 'all' : f.mode, anchor, from, vehicleId: f.vehicleId, driver: f.driver, pjtKey: '' });
  const rows = f.pjtKey ? base.filter((x) => x.pjtKey === f.pjtKey) : base; const t = driveTotals(rows);
  const range = driveRange(f.mode === 'project' ? 'all' : f.mode, anchor, from);
  const drivers = [...new Set(all.map((x) => x.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const mode = '<div class="jh-segmented" role="group" aria-label="보기">' + D_MODES.map(([k, l]) => '<button type="button" class="jh-segmented__item" data-d-mode="' + k + '" aria-pressed="' + (f.mode === k) + '">' + esc(l) + '</button>').join('') + '</div>';
  const pick = f.mode === 'day' ? '<button type="button" class="jh-btn" data-variant="ghost" data-d-nav="-1" aria-label="전날">◀</button><input class="jh-input" type="date" data-d-anchor value="' + esc(f.anchor) + '" aria-label="날짜"><button type="button" class="jh-btn" data-variant="ghost" data-d-nav="1" aria-label="다음 날">▶</button>'
    : f.mode === 'week' ? '<button type="button" class="jh-btn" data-variant="ghost" data-d-nav="-1" aria-label="지난주">◀</button><span class="jh-field__hint">' + esc(weekStart(f.anchor) + ' ~ ' + range.to) + '</span><button type="button" class="jh-btn" data-variant="ghost" data-d-nav="1" aria-label="다음 주">▶</button>'
    : f.mode === 'month' ? '<button type="button" class="jh-btn" data-variant="ghost" data-d-nav="-1" aria-label="지난달">◀</button><input class="jh-input" type="month" data-d-ym value="' + esc(f.ym) + '" aria-label="월"><button type="button" class="jh-btn" data-variant="ghost" data-d-nav="1" aria-label="다음 달">▶</button>' : '';
  const sel = (key, label, opts, cur) => '<select class="jh-select" data-d-f="' + key + '" aria-label="' + esc(label) + '"><option value="">' + esc(label) + ' 전체</option>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  const bar = '<div class="jh-gen__pad"><div class="jh-gen__bar">' + mode + pick + '</div><div class="jh-gen__bar">' + sel('vehicleId', '차량', veh.map((v) => [v.id, v.name + (v.plate ? ' (' + v.plate + ')' : '')]), f.vehicleId) + sel('driver', '사용자', drivers.map((d) => [d, d]), f.driver)
    + (f.pjtKey ? '<button type="button" class="jh-btn" data-variant="ghost" data-d-pjt="">프로젝트 거름 해제 ✕</button>' : '') + '<button type="button" class="jh-btn" data-variant="ghost" data-g-act="d-csv">운행기록부 엑셀(CSV)</button><label class="jh-btn" data-variant="ghost" style="cursor:pointer">과거 일지 가져오기(JSON)<input type="file" accept=".json,application/json" data-d-import hidden></label></div></div>';
  const kpi = [['운행 건수', t.n + '건', t.days + '일 운행'], ['주행거리', dKm(t.distance) + ' km', '비업무용 ' + dKm(t.nonBizKm) + ' km'], ['업무용 사용거리', dKm(t.bizKm) + ' km', '업무사용비율 ' + t.bizRate + '%'], ['기간', (range.from === '0000-00-00' ? '처음' : range.from) + ' ~ ' + (range.to === '9999-99-99' ? '현재' : range.to), from ? '출고일 ' + from + '부터' : '출고일 기준은 차량을 고르면 적용']];
  const k = '<div class="jh-kpi-grid">' + kpi.map(([l, v, h]) => '<div class="jh-kpi"><span class="jh-kpi__label">' + esc(l) + '</span><span class="jh-kpi__value">' + esc(v) + '</span><span class="jh-kpi__hint">' + esc(h) + '</span></div>').join('') + '</div>';
  let notice = '';
  const target = vsel ? all.filter((x) => x.vehicleId === vsel.id) : (veh.length === 1 ? all.filter((x) => x.vehicleId === veh[0].id) : null);
  if (target && target.length) { const oc = driveOdoCheck(target, (vsel || veh[0]).deliveryOdo); const gaps = oc.gaps.filter((g) => !g.overlap); const ov = oc.gaps.filter((g) => g.overlap);
    notice = (gaps.length ? '<div class="jh-alert" data-tone="warn" role="status">⚠ 일지가 이어지지 않는 구간이 ' + gaps.length + '곳 있습니다(계기판 전 일지의 "주행 후"와 다음 일지의 "주행 전"이 다름 — 일지가 빠졌거나 다른 사람이 운행했을 수 있습니다): ' + gaps.slice(0, 4).map((g) => esc(g.date + ' ' + dKm(g.from) + '→' + dKm(g.to) + 'km(+' + dKm(g.km) + ')')).join(' · ') + (gaps.length > 4 ? ' 외 ' + (gaps.length - 4) + '곳' : '') + '</div>' : '')
      + (ov.length ? '<div class="jh-alert" data-tone="danger" role="status">⚠ 계기판이 거꾸로 가거나 겹치는 일지가 ' + ov.length + '건 있습니다: ' + ov.slice(0, 3).map((g) => esc(g.date + ' ' + dKm(g.from) + '→' + dKm(g.to))).join(' · ') + '</div>' : '')
      + (oc.sinceDelivery !== null ? '<div class="jh-alert" data-tone="info" role="status">출고 이후 일지로 확인되는 계기판: ' + esc(dKm((vsel || veh[0]).deliveryOdo)) + ' → ' + esc(dKm(oc.last)) + ' km (+' + esc(dKm(oc.sinceDelivery)) + ' km)</div>' : ''); }
  const stChip = (s, src) => src === 'legacy' ? '<span class="jh-chip" data-tone="muted">이식(과거)</span>' : '<span class="jh-chip" data-tone="' + (s === 'approved' || s === 'posted' ? 'accent' : 'muted') + '">' + esc(DRIVE_STATUS[s] || s) + '</span>';
  let body;
  if (f.mode === 'project' && !f.pjtKey) {
    const g = driveByProject(base); body = g.length ? '<div class="jh-gen__scroll"><table class="jh-gen-table jh-gen-table--click"><thead><tr><th>프로젝트</th><th class="num">건수</th><th class="num">주행거리(km)</th><th class="num">업무용(km)</th><th>최근 운행</th></tr></thead><tbody>' + g.map((x) => '<tr class="jh-gen__row" data-d-pjt="' + esc(x.key) + '"><td>' + esc(x.pjt) + '</td><td class="num">' + x.n + '</td><td class="num">' + dKm(x.distance) + '</td><td class="num">' + dKm(x.bizKm) + '</td><td>' + esc(x.last) + '</td></tr>').join('') + '</tbody></table></div><div class="jh-field__hint jh-gen__pad">프로젝트를 누르면 그 프로젝트의 운행 내역만 시간 순으로 봅니다.</div>' : '<div class="jh-empty">조건에 맞는 운행일지가 없습니다.</div>';
  } else {
    const months = f.mode === 'all' ? driveByMonth(rows) : []; const mt = months.length > 1 ? '<h4 class="jh-gen__sub">월별 합계</h4><div class="jh-gen__scroll"><table class="jh-gen-table"><thead><tr><th>월</th><th class="num">건수</th><th class="num">주행거리(km)</th><th class="num">업무용(km)</th><th class="num">업무사용비율</th></tr></thead><tbody>' + months.map((m) => '<tr><td>' + esc(m.ym) + '</td><td class="num">' + m.n + '</td><td class="num">' + dKm(m.distance) + '</td><td class="num">' + dKm(m.bizKm) + '</td><td class="num">' + m.bizRate + '%</td></tr>').join('') + '</tbody></table></div>' : '';
    const lines = rows.map((x) => '<tr><td>' + esc(x.date) + '</td><td>' + esc(x.vehicle + (x.plate ? ' ' + x.plate : '')) + '</td><td>' + esc(x.driver) + '</td><td class="jh-gen__cell">' + esc(x.pjt) + '</td><td class="jh-gen__cell">' + esc(x.origin + ' → ' + x.destination) + '</td><td>' + esc(x.kind) + '</td><td class="num">' + dKm(x.odoStart) + ' → ' + dKm(x.odoEnd) + '</td><td class="num">' + dKm(x.distance) + '</td><td class="num">' + dKm(x.bizKm) + '</td><td class="jh-gen__cell">' + esc(x.purpose) + '</td><td>' + stChip(x.status, x.source) + '</td></tr>').join('');
    body = (rows.length ? mt + '<h4 class="jh-gen__sub">운행 내역 — 시간 순</h4><div class="jh-gen__scroll"><table class="jh-gen-table"><thead><tr><th>일자</th><th>차량</th><th>사용자</th><th>프로젝트</th><th>출발 → 도착</th><th>구분</th><th class="num">계기판(km)</th><th class="num">주행</th><th class="num">업무용</th><th>목적</th><th>상태</th></tr></thead><tbody>' + lines + '</tbody></table></div>' : '<div class="jh-empty">조건에 맞는 운행일지가 없습니다.</div>');
  }
  const hint = all.length === 0 ? '<div class="jh-alert" data-tone="info" role="status">아직 올라온 운행일지가 없습니다. 직원은 <strong>전자결재 → 작성 → 차량 운행일지</strong>에서 운행 후에 쓰고 <strong>기록하기</strong>만 누르면(결재 없음) 바로 여기에 시간 순으로 모입니다. 차량은 먼저 <strong>차량 탭에서 등록(출고일·출고 시 계기판 포함)</strong>해야 선택할 수 있습니다.</div>' : '';
  return importPreviewHtml(st) + hint + assignHtml(st) + card('차량 운행일지 취합', bar + '<div class="jh-gen__pad">' + k + notice + '</div>' + body);
}
export { leaseMonthly };
