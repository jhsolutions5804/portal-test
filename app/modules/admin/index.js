import { db, collection, getDocs, doc, setDoc, serverTimestamp } from '../../core/firebase.js?v=20261007c';
import { esc, toast } from '../../core/ui.js?v=20261007c';
import { deptOptions } from '../../shared/org.js?v=20261007c';
import { normalizeParticipants } from '../../shared/pjt-access.js?v=20261007c';
import { buildProjects, toggleTeam, addMember, removeMember, selectableUsers, sameParticipants } from './logic.js?v=20261007c';
import { tabsHtml, projectCardHtml } from './view.js?v=20261007c';

/** 포털 관리(관리자 전용): 지금은 "PJT 참여" — 프로젝트마다 참여 부서·개인을 지정한다(지정이 없으면 PJT 권한자 모두). */
export const manifest = { id: 'admin', order: 80, title: '포털 관리', icon: '🛠️', defaultHash: '#/admin/pjt', perm: (me) => !!(me && me.admin) };

async function loadAll() {
  const [us, ss, rs] = await Promise.all([getDocs(collection(db, 'portal_users')), getDocs(collection(db, 'pjt_settings')), getDocs(collection(db, 'pjt_registry'))]);
  const users = []; us.forEach((d) => users.push(Object.assign({ uid: d.id }, d.data())));
  const settings = []; ss.forEach((d) => settings.push(Object.assign({ id: d.id }, d.data()))); const registry = []; rs.forEach((d) => registry.push(Object.assign({ id: d.id }, d.data())));
  registry.sort((a, b) => ((a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0)));
  return { users, settings, registry };
}
export async function mount(root, route, ctx) {
  root.onclick = null; root.onchange = null; const me = ctx.me;
  root.innerHTML = '<div class="jh-admin">' + tabsHtml('pjt') + '<div id="ad-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#ad-body');
  let data; try { data = await loadAll(); } catch (e) { console.error('포털 관리 읽기', e); body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. (' + esc(e.code || e.message) + ')</div>'; body.removeAttribute('aria-busy'); return; }
  const picks = selectableUsers(data.users); const byUid = {}; data.users.forEach((u) => { byUid[u.uid] = u; }); const depts = deptOptions(data.users);
  let projects = buildProjects(data.settings, data.registry); let edit = null;   // edit = { key, draft }
  const paint = () => {
    body.innerHTML = '<p class="jh-field__hint">프로젝트마다 참여할 부서·개인을 지정합니다. 예) A 프로젝트는 PJT 1팀, B 프로젝트는 PJT 2팀, C 프로젝트는 PJT 1팀의 김○○와 PJT 2팀의 이○○.</p>' +
      projects.map((p) => projectCardHtml(p, byUid, edit && edit.key === p.key ? edit : null, picks, depts)).join('');
    body.removeAttribute('aria-busy');
  };
  paint();
  root.onclick = async (ev) => {
    const card = ev.target.closest('[data-pid]'); if (!card) return; const key = card.getAttribute('data-pid'); const p = projects.find((x) => x.key === key); if (!p) return; const t = ev.target;
    if (t.closest('[data-edit]')) { edit = { key, draft: normalizeParticipants(p.participants) }; paint(); return; }
    if (!edit || edit.key !== key) return;
    if (t.closest('[data-cancel]')) { edit = null; paint(); return; }
    const tb = t.closest('[data-team]'); if (tb) { edit.draft = toggleTeam(edit.draft, tb.getAttribute('data-team')); paint(); return; }
    const dm = t.closest('[data-del-member]'); if (dm) { edit.draft = removeMember(edit.draft, dm.getAttribute('data-del-member')); paint(); return; }
    if (t.closest('[data-add-member]')) { const sel = card.querySelector('[data-member-pick]'); if (sel && sel.value) { edit.draft = addMember(edit.draft, sel.value); paint(); } return; }
    if (t.closest('[data-clear]')) { edit.draft = { teams: [], members: [] }; paint(); return; }
    if (t.closest('[data-save]')) {
      const btn = t.closest('[data-save]'); btn.disabled = true; const next = normalizeParticipants(edit.draft);
      try {
        const ref = p.kind === 'fixed' ? doc(db, 'pjt_settings', p.id) : doc(db, 'pjt_registry', p.id);
        await setDoc(ref, { participants: next, participantsUpdatedAt: serverTimestamp(), participantsUpdatedBy: me.uid }, { merge: true });
        p.participants = next; edit = null; toast('참여자 지정을 저장했습니다.'); paint();
      } catch (e) { console.error('참여자 저장', e); btn.disabled = false; toast('저장하지 못했습니다. (' + (e.code || e.message) + ')'); }
    }
  };
}
