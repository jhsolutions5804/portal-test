import { db, collection, getDocs, query, where, orderBy } from '../../core/firebase.js?v=20261007b';
import { esc } from '../../core/ui.js?v=20261007b';
import { groupOrg, sortPolicies, buildOrgTree, isGuestUser } from './logic.js?v=20261007b';
import { tabsHtml, orgHtml, rulesHtml, orgChartHtml, orgViewHtml, personCardHtml } from './view.js?v=20261007b';

/** 회사 영역(플랫폼 기본 모듈): 조직도·규정을 읽기 전용으로. GUEST 계정에는 보이지 않는다(연락처·내부 규정) */
export const manifest = { id: 'company', order: 45, title: '회사', icon: '🏢', defaultHash: '#/company/org', perm: (me) => !!me && !me.isGuest };
let orgCache = null; let polCache = null; let orgView = 'chart';   // 60초 캐시(화면을 오가도 다시 읽지 않음). 조직도 기본은 다이어그램
const fresh = (c) => c && Date.now() - c.t < 60000;
async function loadUsers() {
  if (fresh(orgCache)) return orgCache.v;
  const s = await getDocs(query(collection(db, 'portal_users'), where('status', '==', 'approved')));
  const v = []; s.forEach((d) => v.push(Object.assign({ uid: d.id }, d.data()))); orgCache = { t: Date.now(), v }; return v;
}
async function loadPolicies() {
  if (fresh(polCache)) return polCache.v;
  const s = await getDocs(collection(db, 'company_policies')); const v = []; s.forEach((d) => v.push(Object.assign({ id: d.id }, d.data()))); polCache = { t: Date.now(), v: sortPolicies(v) }; return polCache.v;
}
export async function mount(root, route) {
  const tab = route.segs[0] === 'rules' ? 'rules' : 'org'; root.onclick = null; root.oninput = null;
  root.innerHTML = '<div class="jh-company">' + tabsHtml(tab) + '<div id="co-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#co-body');
  try {
    if (tab === 'org') {
      const users = (await loadUsers()).filter((u) => !isGuestUser(u)); let q = ''; let view = orgView;   // GUEST 계정은 조직도·목록에서 제외
      const paint = () => {
        body.innerHTML = orgViewHtml(view) + (view === 'chart' ? orgChartHtml(buildOrgTree(users)) : orgHtml(groupOrg(users, q), users.length, q));
        body.querySelectorAll('[data-org-view]').forEach((b) => { b.onclick = () => { view = b.getAttribute('data-org-view'); orgView = view; paint(); }; });
        body.querySelectorAll('.jh-org__p').forEach((b) => { b.onclick = () => { const u = users.find((x) => x.uid === b.getAttribute('data-uid')); if (u) openPerson(u, b); }; });
        const inp = body.querySelector('#org-q'); if (inp) { inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; const list = body.querySelector('[data-org-list]'); const tmp = document.createElement('div'); tmp.innerHTML = orgHtml(groupOrg(users, q), users.length, q); list.innerHTML = tmp.querySelector('[data-org-list]').innerHTML; inp.setSelectionRange(pos, pos); }; }
      };
      paint();
    } else { const list = await loadPolicies(); body.innerHTML = rulesHtml(list, route.query && route.query.doc); }
    body.removeAttribute('aria-busy'); const top = document.getElementById('jh-main'); if (top && tab === 'rules') top.scrollTop = 0;
  } catch (e) { console.error('회사 영역 불러오기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요. (' + esc(e.code || e.message) + ')</div>'; body.removeAttribute('aria-busy'); }
}
/** 사람 연락처 작은 창 */
function openPerson(u, trigger) {
  const w = document.createElement('div'); w.className = 'jh-dialog'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', '연락처');
  w.innerHTML = '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel jh-profile"><h3 class="jh-dialog__title">' + esc(u.name || '') + ' ' + esc(u.rank || '') + '</h3><div class="jh-dialog__body">' + personCardHtml(u) + '</div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="primary" data-close>닫기</button></div></div>';
  document.body.appendChild(w); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const close = () => { document.removeEventListener('keydown', onKey, true); w.remove(); document.body.style.overflow = prev; if (trigger && trigger.focus) trigger.focus(); };
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  w.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); }); document.addEventListener('keydown', onKey, true); const b = w.querySelector('[data-close].jh-btn'); if (b) b.focus();
}
