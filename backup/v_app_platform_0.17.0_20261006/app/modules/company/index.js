import { db, collection, getDocs, query, where, orderBy } from '../../core/firebase.js?v=20261006f';
import { esc } from '../../core/ui.js?v=20261006f';
import { groupOrg, sortPolicies } from './logic.js?v=20261006f';
import { tabsHtml, orgHtml, rulesHtml } from './view.js?v=20261006f';

/** 회사 영역(플랫폼 기본 모듈): 조직도·규정을 읽기 전용으로. GUEST 계정에는 보이지 않는다(연락처·내부 규정) */
export const manifest = { id: 'company', order: 45, title: '회사', icon: '🏢', defaultHash: '#/company/org', perm: (me) => !!me && !me.isGuest };
let orgCache = null; let polCache = null;   // 60초 캐시(화면을 오가도 다시 읽지 않음)
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
      const users = await loadUsers(); let q = '';
      const paint = () => { body.innerHTML = orgHtml(groupOrg(users, q), users.length, q); const inp = body.querySelector('#org-q'); if (inp) { inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; const list = body.querySelector('[data-org-list]'); const tmp = document.createElement('div'); tmp.innerHTML = orgHtml(groupOrg(users, q), users.length, q); list.innerHTML = tmp.querySelector('[data-org-list]').innerHTML; inp.setSelectionRange(pos, pos); }; } };
      paint();
    } else { const list = await loadPolicies(); body.innerHTML = rulesHtml(list, route.query && route.query.doc); }
    body.removeAttribute('aria-busy'); const top = document.getElementById('jh-main'); if (top && tab === 'rules') top.scrollTop = 0;
  } catch (e) { console.error('회사 영역 불러오기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요. (' + esc(e.code || e.message) + ')</div>'; body.removeAttribute('aria-busy'); }
}
