/* 4대보험 대조 화면의 "📝 신고 입력표" 보기 — HTML 만 만드는 순수 함수(시험: tests/hr-insurance-edi.test.mjs). 입력은 index.js 의 mountInsurance 가 data-edi-* 속성으로 연결한다. */
import { esc } from '../../core/ui.js?v=20261026j';
import { insurancePageHtml } from './insurance-view.js?v=20261026j';
import { recentHires, sheetOfState, leftText, won } from './insurance-edi.js?v=20261026j';
export const ediInit = () => ({ loaded: false, loading: false, err: '', workers: [], sel: '', annual: null, labor: null, jumin: '', payOv: '', hoursOv: '', busy: false });
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const tone = (n) => (n == null ? '' : n < 0 ? ' data-tone="danger"' : n <= 3 ? ' data-tone="warn"' : ' data-tone="accent"');
const dchip = (n) => (n == null ? '' : '<span class="jh-chip"' + tone(n) + '>' + esc(leftText(n)) + '</span>');
/** 월별 대조 / 신고 입력표 전환 + 선택한 보기 */
export function insuranceShellHtml(st) {
  const v = st && st.view === 'edi' ? 'edi' : 'recon';
  const seg = '<div class="jh-hr__bar"><div class="jh-segmented" role="group" aria-label="보기"><button type="button" class="jh-segmented__item" data-ins-view="recon" aria-pressed="' + (v === 'recon') + '">📊 월별 대조</button><button type="button" class="jh-segmented__item" data-ins-view="edi" aria-pressed="' + (v === 'edi') + '">📝 신고 입력표</button></div></div>';
  return seg + (v === 'edi' ? ediPanelHtml((st && st.edi) || ediInit(), st && st.today) : insurancePageHtml(st));
}
function recentTable(list, sel) {
  if (!list.length) return '<div class="jh-empty">최근 60일 안에 입사한(또는 30일 안에 입사 예정인) 근로자가 없습니다. 아래에서 근로자를 직접 고를 수 있습니다.</div>';
  const rows = list.map((r) => '<tr' + (r.id === sel ? ' aria-selected="true"' : '') + '><td><button type="button" class="jh-btn" data-variant="ghost" data-edi-pick="' + esc(r.id) + '">' + esc(r.name) + (r.empNo ? ' <span class="jh-hr__muted">' + esc(r.empNo) + '</span>' : '') + '</button></td><td>' + esc(r.hireDate) + '</td><td>' + dchip(r.dl && r.dl.healthLeft) + ' <span class="jh-hr__muted">' + esc(r.dl ? r.dl.health : '') + '</span></td><td>' + dchip(r.dl && r.dl.othersLeft) + ' <span class="jh-hr__muted">' + esc(r.dl ? r.dl.others : '') + '</span></td></tr>').join('');
  return '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>이름</th><th>입사일</th><th>건강보험 기한(14일 이내)</th><th>연금·고용·산재 기한(다음 달 15일)</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function rowHtml(r) {
  const jb = r.id === 'jumin' ? (r.copy ? ' <button type="button" class="jh-btn" data-variant="ghost" data-edi="hide">가리기</button>' : ' <button type="button" class="jh-btn" data-variant="secondary" data-edi="reveal">🔍 열람</button>') : '';
  const cp = r.copy ? '<button type="button" class="jh-btn" data-variant="ghost" data-edi-copy="' + esc(r.id) + '" aria-label="' + esc(r.label) + ' 복사">복사</button>' : '';
  return '<tr><th scope="row">' + esc(r.label) + '</th><td><span' + (r.tone ? ' data-tone="' + esc(r.tone) + '"' : '') + '>' + esc(r.text) + '</span>' + jb + '</td><td>' + cp + '</td><td class="jh-hr__muted">' + esc(r.hint || '') + '</td></tr>';
}
export function ediPanelHtml(e, today) {
  const s = e || ediInit();
  if (s.loading && !s.loaded) return '<div class="jh-skeleton" style="height:var(--u-220)" aria-busy="true"></div>';
  if (s.err) return '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc(s.err) + '</div>';
  const list = recentHires(s.workers, today); const active = (s.workers || []).filter((w) => w.status !== 'resigned');
  const opts = '<option value="">근로자를 고르세요</option>' + active.map((w) => '<option value="' + esc(w.id) + '"' + (w.id === s.sel ? ' selected' : '') + '>' + esc((w.empNo ? w.empNo + ' · ' : '') + (w.name || '') + (w.hireDate ? ' (입사 ' + w.hireDate + ')' : '')) + '</option>').join('');
  const intro = card('📝 건강보험 EDI 신고 입력표 — 입사(자격 취득)', '<div class="jh-hr__pad"><div class="jh-field__hint">사업장 EDI <b>직장가입자 자격 취득 신고서(피부양자 포함)</b> 화면의 항목 순서대로 값을 보여 드립니다. 항목 옆 <b>복사</b>를 눌러 EDI 칸에 붙여 넣으세요. 날짜·금액은 숫자만 복사됩니다(첫 신고 때 날짜 칸이 이 방식으로 들어가는지 확인해 주세요). <b>퇴사(자격 상실)</b> 입력표는 EDI 상실 화면을 받은 뒤 추가합니다.</div></div><div class="jh-hr__pad">' + recentTable(list, s.sel) + '<div class="jh-field"><label class="jh-field__label" for="edi-w">다른 근로자 고르기</label><select id="edi-w" class="jh-select" data-edi-worker>' + opts + '</select></div></div>');
  if (!s.sel) return intro;
  const w = (s.workers || []).find((x) => x.id === s.sel); if (!w) return intro;
  const sh = sheetOfState(s, today); const dl = sh.deadlines;
  const head = card('🧾 ' + (w.name || '') + (w.empNo ? ' (' + w.empNo + ')' : '') + ' — 입사 ' + (w.hireDate || '미입력'), '<div class="jh-hr__pad"><div class="jh-hr__bar">' + (dl ? '<span>건강보험 신고 기한 <b>' + esc(dl.health) + '</b> ' + dchip(dl.healthLeft) + '</span><span>국민연금·고용·산재 <b>' + esc(dl.others) + '</b> ' + dchip(dl.othersLeft) + '</span>' : '<span class="jh-hr__muted">입사일이 없어 기한을 계산하지 못했습니다.</span>') + '</div>' + (s.busy ? '<div class="jh-field__hint" role="status">불러오는 중…</div>' : '') + '<div class="jh-hr__grid"><div class="jh-field"><label class="jh-field__label" for="edi-pay">월 보수(원) — 연금·건강·고용·산재에 같이 쓰입니다</label><input id="edi-pay" class="jh-input" inputmode="numeric" data-edi-pay value="' + esc(s.payOv) + '" placeholder="' + esc(sh.pay > 0 ? won(sh.pay) : '직접 입력') + '" style="text-align:right"><div class="jh-field__hint">' + esc(sh.paySource ? '기본값 출처: ' + sh.paySource + ' · 비과세(식대 등)가 있으면 빼고 입력' : '계약서에서 알 수 없어 직접 입력해야 합니다') + '</div></div><div class="jh-field"><label class="jh-field__label" for="edi-hours">1주 소정근로시간</label><input id="edi-hours" class="jh-input" inputmode="numeric" data-edi-hours value="' + esc(s.hoursOv) + '" placeholder="' + esc(String(sh.hours)) + '" style="text-align:right"></div></div></div>');
  const warn = sh.warnings.map((m) => '<div class="jh-alert" data-tone="warn" role="status">' + esc(m) + '</div>').join('');
  const secs = sh.sections.map((sec) => card(sec.title, '<div class="jh-hr__scroll"><table class="jh-hr-table jh-edi__tbl"><colgroup><col class="jh-edi__c1"><col class="jh-edi__c2"><col class="jh-edi__c3"><col class="jh-edi__c4"></colgroup><thead><tr><th>EDI 항목</th><th>값</th><th>복사</th><th>메모</th></tr></thead><tbody>' + sec.rows.map(rowHtml).join('') + '</tbody></table></div>')).join('');
  return intro + head + warn + secs;
}
