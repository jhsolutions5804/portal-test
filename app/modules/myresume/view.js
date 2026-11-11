/* 내 이력서(직원 본인) — 화면 HTML 만 만드는 순수 함수(시험: tests/myresume-view.test.mjs). 읽기·클릭 연결은 index.js.
 * 열람본은 서버(myResumeAct)가 로그인 계정으로 본인 것만 준다(비상연락처 포함·가족관계 제외·주민번호 마스킹·계좌 제외). */
import { esc } from '../../core/ui.js?v=20261109x';
import { deployWhen } from '../../shared/deploy-fmt.js?v=20261109x';

const btn = (label, attr, variant, disabled) => '<button type="button" class="jh-btn" data-variant="' + variant + '" ' + attr + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
/** st: { loading, error, data: { linked, recent:[{no, at}] }, busy } */
export function myResumeHtml(st) {
  const s = st || {};
  if (s.loading) return '<div class="jh-hr__pad"><div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div></div>';
  if (s.error || !s.data) return '<div class="jh-hr__pad"><div class="jh-alert" data-tone="warn" role="alert">' + esc(s.error || '불러오지 못했습니다.') + '</div></div>';
  const d = s.data; const head = '<h2 class="jh-hr__title">내 이력서</h2>';
  if (!d.linked) return '<div class="jh-hr__pad" data-mr-root>' + head + '<div class="jh-empty">계정과 연결된 직원 정보가 없습니다. 인사 담당자에게 문의해 주세요.</div></div>';
  const rows = (d.recent || []).map((r) => '<tr><td>' + esc(r.no) + '</td><td>' + esc(deployWhen(r.at)) + '</td></tr>').join('');
  return '<div class="jh-hr__pad" data-mr-root>' + head
    + '<div class="jh-field__hint">입사 때 입력한 정보와 회사에 기록된 경력으로 만든 내 이력서를 열람합니다. 열람할 때마다 신청 번호가 부여되고 열람 기록이 남으며, 화면에는 이름과 신청 번호가 워터마크로 들어갑니다.</div>'
    + '<div class="jh-field__hint">본인 열람본에는 비상연락처가 포함되고 가족관계는 나오지 않습니다. 주민등록번호는 일부만 보이고 계좌는 나오지 않습니다.</div>'
    + '<div class="jh-hr__bar">' + btn('📄 내 이력서 열람', 'data-mr-open', 'primary', s.busy) + '</div>'
    + (rows ? '<h4 class="jh-hr__sub">최근 열람 기록</h4><div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>신청 번호</th><th>열람 일시</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">아직 열람 기록이 없습니다.</div>')
    + '</div>';
}
