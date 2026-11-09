/* 투입 확인 — 직원 본인 화면의 HTML 만 만드는 순수 함수(시험: tests/deploy-view.test.mjs). 읽기·클릭 연결은 index.js.
 * 확인서 문구는 서버(deployAct)가 정해서 보내 주고 화면은 그대로 보여 준다. 동의·동의 안 함·철회는 직원 본인만 하고 직원 id 는 보내지 않는다(서버가 로그인 계정으로 찾음). */
import { esc } from '../../core/ui.js?v=20261109o';
import { deployStatus, deployWhen } from '../../shared/deploy-fmt.js?v=20261109o';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const btn = (label, attr, variant, disabled) => '<button type="button" class="jh-btn" data-variant="' + variant + '" ' + attr + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
const kv = (k, v) => '<tr><th scope="row">' + esc(k) + '</th><td>' + (v ? esc(v) : '<span class="jh-field__hint">-</span>') + '</td></tr>';
const alertBox = (tone, text) => '<div class="jh-alert" data-tone="' + tone + '" role="' + (tone === 'warn' ? 'alert' : 'status') + '">' + esc(text) + '</div>';
const termsHtml = (t, open) => '<details class="dp-terms"' + (open ? ' open' : '') + '><summary>' + esc(t.title) + ' (읽기)</summary><p>' + esc(t.intro) + '</p><div class="jh-hr__scroll"><table class="jh-hr-table"><tbody>' + t.rows.map((r) => '<tr><th scope="row">' + esc(r.label) + '</th><td>' + esc(r.text) + '</td></tr>').join('') + '</tbody></table></div></details>';

function itemHtml(it, terms, busy) {
  const st = deployStatus(it.status); const att = ' data-pjt="' + esc(it.pjtId) + '"'; const off = !!busy;
  const info = '<table class="jh-hr-table"><tbody>' + kv('발주처', it.client) + kv('시공사', it.contractor) + kv('현장', it.site) + kv('시작일', it.from) + kv('내 역할', it.role) + '</tbody></table>';
  let body = '';
  if (it.canDecide) {
    const decided = it.status !== 'pending';
    const last = decided && it.at ? '<div class="jh-field__hint">' + esc(st.label) + ' · ' + esc(deployWhen(it.at)) + '</div>' : '';
    let bar;
    if (it.status === 'agreed') bar = btn('철회하기', 'data-dp-act="withdraw"' + att, 'secondary', off);
    else bar = btn(terms.agree, 'data-dp-act="agree"' + att, 'primary', off) + btn(terms.decline, 'data-dp-act="decline"' + att, 'secondary', off);
    body = termsHtml(terms, !decided) + last + '<div class="jh-hr__bar">' + bar + '</div>' + (it.status === 'declined' ? '<div class="jh-field__hint">동의하지 않은 사업에는 투입되지 않습니다. 마음이 바뀌면 다시 선택할 수 있습니다.</div>' : '') + (it.status === 'withdrawn' ? '<div class="jh-field__hint">철회했습니다. 다시 투입하려면 위에서 다시 선택해 주세요.</div>' : '');
  } else {
    body = '<div class="jh-field__hint">' + (it.removed ? '투입 명단에서 빠진 프로젝트입니다. ' : '끝난 프로젝트입니다. ') + (it.at ? esc(st.label) + ' · ' + esc(deployWhen(it.at)) + '. ' : '') + '기록은 그대로 보관됩니다.</div>';
  }
  return '<section class="jh-card" data-dp-item="' + esc(it.pjtId) + '"><div class="jh-panel__head"><h3>' + esc(it.name) + '</h3>' + chip(st.label, st.tone) + '</div><div class="jh-hr__pad">' + info + body + '</div></section>';
}
/** st: { loading, error, data: { linked, reason, items, terms }, busy: 프로젝트 id | '' } */
export function deployHtml(st) {
  const s = st || {};
  if (s.loading) return '<div class="jh-hr__pad"><div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div></div>';
  if (s.error || !s.data) return '<div class="jh-hr__pad">' + alertBox('warn', s.error || '불러오지 못했습니다.') + '</div>';
  const d = s.data; const terms = d.terms;
  const draft = terms && terms.draft ? alertBox('warn', '시험용 문구입니다(노무사 확인 전). 시험 서버에서만 사용하며, 실제 투입 확인에는 쓰지 않습니다.') : '';
  const head = '<h2 class="jh-hr__title">프로젝트 투입 확인</h2><div class="jh-field__hint">프로젝트에 투입될 때마다 투입을 확인하고, 투입에 필요한 개인정보 제공에 동의 여부를 직접 선택합니다. 동의하지 않으면 그 사업에는 투입되지 않습니다.</div>';
  if (!d.linked) return '<div class="jh-hr__pad" data-dp-root>' + head + draft + '<div class="jh-empty">' + esc(d.reason === 'worker' ? '계정과 연결된 직원 정보가 없습니다. 인사 담당자에게 문의해 주세요.' : '연명부와 연결되지 않아 확인할 투입 건이 없습니다. 인사 담당자에게 문의해 주세요.') + '</div></div>';
  const items = d.items || []; const pending = items.filter((x) => x.status === 'pending' && x.canDecide).length;
  const sum = pending ? alertBox('warn', '확인이 필요한 투입 건이 ' + pending + '건 있습니다.') : '';
  return '<div class="jh-hr__pad" data-dp-root data-dp-version="' + esc(terms ? terms.version : '') + '">' + head + draft + sum + (items.length ? items.map((it) => itemHtml(it, terms, s.busy)).join('') : '<div class="jh-empty">확인할 투입 건이 없습니다.</div>') + '</div>';
}
