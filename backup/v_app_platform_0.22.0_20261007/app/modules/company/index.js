import { db, auth, functions, httpsCallable, sendPasswordResetEmail, collection, getDocs, query, where, orderBy, doc, updateDoc } from '../../core/firebase.js?v=20261007i';
import { esc, toast } from '../../core/ui.js?v=20261007i';
import { fmtPhone } from '../../core/profile-logic.js?v=20261007i';
import { deptOptions } from '../../shared/org.js?v=20261007i';
import { PERM_KEYS, validateStaffForm, staffUpdate, linkedWorkerOf, findWorkerMatch, workerSync, validateNewAccount, newAccountPayload, callMessage, resetMailMessage } from './staff-logic.js?v=20261007i';
import { staffListHtml, staffDialogHtml, newAccountDialogHtml, secretDialogHtml } from './staff-view.js?v=20261007i';
import { groupOrg, sortPolicies, buildOrgTree, isGuestUser } from './logic.js?v=20261007i';
import { tabsHtml, orgHtml, rulesHtml, orgChartHtml, orgViewHtml, personCardHtml } from './view.js?v=20261007i';

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
export async function mount(root, route, ctx) {
  const me = (ctx && ctx.me) || {}; const want = route.segs[0]; const tab = want === 'rules' ? 'rules' : (want === 'staff' && me.admin ? 'staff' : 'org');
  if (want === 'staff' && !me.admin) { location.replace('#/company/org'); return; }   // 직원 관리는 관리자만
  root.onclick = null; root.oninput = null;
  root.innerHTML = '<div class="jh-company">' + tabsHtml(tab, !!me.admin) + '<div id="co-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
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
    } else if (tab === 'staff') {
      const users = []; const workers = [];
      const reload = async () => { const [us, ws] = await Promise.all([getDocs(collection(db, 'portal_users')), getDocs(collection(db, 'workers'))]); users.length = 0; workers.length = 0; us.forEach((d) => users.push(Object.assign({ uid: d.id }, d.data()))); ws.forEach((d) => workers.push(Object.assign({ id: d.id }, d.data()))); };
      await reload();
      const paint = () => { body.innerHTML = staffListHtml(users, workers, me.uid); }; paint();
      const callAdmin = async (payload) => (await httpsCallable(functions, 'adminAct')(payload)).data;
      /** 어디서든 쓰는 작은 창 도우미 */
      const openBox = (id, html, trigger) => { const w = document.createElement('div'); w.className = 'jh-dialog'; w.id = id; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'sf-title'); w.innerHTML = html; document.body.appendChild(w); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; const close = () => { document.removeEventListener('keydown', onKey, true); w.remove(); document.body.style.overflow = prev; if (trigger && trigger.focus) trigger.focus(); }; function onKey(e) { if (e.key === 'Escape' && w.querySelector('[data-close]')) { e.preventDefault(); close(); } } document.addEventListener('keydown', onKey, true); return { w, close }; };
      /** 임시 비밀번호 결과 창(닫을 때 화면에서 지운다) */
      const showSecret = (title, email, pw) => { const { w, close } = openBox('jh-secret-dialog', secretDialogHtml(title, email, pw)); w.addEventListener('click', async (e) => { if (e.target.closest('[data-secret-copy]')) { const inp = w.querySelector('#sf-secret'); try { await navigator.clipboard.writeText(inp.value); toast('복사했습니다.'); } catch (er) { inp.select(); toast('복사하지 못했습니다. 선택된 글자를 직접 복사해 주세요.'); } return; } if (e.target.closest('[data-secret-close]')) { w.querySelector('#sf-secret').value = ''; close(); } }); const b = w.querySelector('[data-secret-copy]'); if (b) b.focus(); };
      const openNew = (trigger) => {
        if (document.getElementById('jh-new-dialog')) return; const depts = deptOptions(users); const { w, close } = openBox('jh-new-dialog', newAccountDialogHtml(depts), trigger); const perms = { edoc: true };
        const msg = (t, bad) => { const el = w.querySelector('[data-sf-msg]'); el.textContent = t; el.style.color = bad ? 'var(--c-danger)' : 'var(--c-success)'; };
        w.addEventListener('input', (e) => { if (e.target.id === 'nf-phone') e.target.value = fmtPhone(e.target.value); if (e.target.id === 'nf-id') e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); });
        w.addEventListener('click', async (e) => {
          if (e.target.closest('[data-close]')) { close(); return; }
          const pb = e.target.closest('[data-nf-perm]'); if (pb) { const k = pb.getAttribute('data-nf-perm'); perms[k] = !perms[k]; pb.setAttribute('aria-pressed', String(!!perms[k])); return; }
          if (e.target.closest('[data-nf-save]')) {
            const f = { id: w.querySelector('#nf-id').value, name: w.querySelector('#nf-name').value, empNo: w.querySelector('#nf-emp').value, rank: w.querySelector('#nf-rank').value, dept: w.querySelector('#nf-dept').value, phone: w.querySelector('#nf-phone').value, perms };
            const bad = validateNewAccount(f, users); if (bad) { msg(bad, true); return; } const btn = e.target.closest('[data-nf-save]'); btn.disabled = true; msg('만드는 중…');
            try { const r = await callAdmin(newAccountPayload(f)); close(); showSecret('새 직원 계정을 만들었습니다', r.email, r.tempPassword); try { await reload(); paint(); } catch (er) { console.warn('목록 다시 읽기', er); } }
            catch (er) { console.error('계정 생성', er); btn.disabled = false; msg(callMessage(er), true); }
          }
        });
        const first = w.querySelector('#nf-id'); if (first) first.focus();
      };
      root.onclick = async (ev) => {
        const pb = ev.target.closest('[data-perm]');
        if (pb) {
          const u = users.find((x) => x.uid === pb.getAttribute('data-uid')); if (!u) return; const k = pb.getAttribute('data-perm'); const on = !(u.perms && u.perms[k] === true);
          u.perms = Object.assign({}, u.perms || {}, { [k]: on }); paint();   // 먼저 화면에 반영하고 저장 — 실패하면 되돌린다
          try { await updateDoc(doc(db, 'portal_users', u.uid), { ['perms.' + k]: on }); } catch (e) { console.error('권한 저장', e); u.perms = Object.assign({}, u.perms, { [k]: !on }); paint(); toast('권한을 저장하지 못했습니다. (' + (e.code || e.message) + ')'); }
          return;
        }
        const nb = ev.target.closest('[data-staff-new]'); if (nb) { openNew(nb); return; }
        const eb = ev.target.closest('[data-staff-edit]'); if (eb) openStaff(users.find((x) => x.uid === eb.getAttribute('data-staff-edit')), eb);
      };
      const openStaff = (u, trigger) => {
        if (!u || document.getElementById('jh-staff-dialog')) return; const depts = deptOptions(users); const w = document.createElement('div'); w.className = 'jh-dialog'; w.id = 'jh-staff-dialog'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'sf-title');
        let lw = linkedWorkerOf(workers, u.uid); const draw = () => { w.innerHTML = staffDialogHtml(u, lw, depts, lw ? null : findWorkerMatch(workers, u), u.uid === me.uid); }; draw(); document.body.appendChild(w); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
        const close = () => { document.removeEventListener('keydown', onKey, true); w.remove(); document.body.style.overflow = prev; if (trigger && trigger.focus) trigger.focus(); };
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } } document.addEventListener('keydown', onKey, true);
        const msg = (t, bad) => { const el = w.querySelector('[data-sf-msg]'); el.textContent = t; el.style.color = bad ? 'var(--c-danger)' : 'var(--c-success)'; };
        w.addEventListener('input', (e) => { if (e.target.id === 'sf-phone') e.target.value = fmtPhone(e.target.value); });
        w.addEventListener('click', async (e) => {
          if (e.target.closest('[data-close]')) { close(); return; }
          if (e.target.closest('[data-staff-link]')) {
            const mt = findWorkerMatch(workers, u); if (!mt) return;
            try { await updateDoc(doc(db, 'workers', mt.id), { portalUid: u.uid }); mt.portalUid = u.uid; lw = mt; draw(); msg('인사 명부와 연동했습니다.'); paint(); } catch (er) { console.error('명부 연동', er); msg('연동하지 못했습니다. (' + (er.code || er.message) + ')', true); }
            return;
          }
          if (e.target.closest('[data-staff-pw]')) {
            if (!window.confirm((u.name || '이 직원') + '님의 임시 비밀번호를 발급할까요?\n열려 있는 로그인이 끊기고, 기존 비밀번호는 쓸 수 없게 됩니다.')) return;
            const btn = e.target.closest('[data-staff-pw]'); btn.disabled = true; msg('발급하는 중…');
            try { const r = await callAdmin({ action: 'resetPassword', uid: u.uid }); close(); showSecret('임시 비밀번호를 발급했습니다', r.email || u.email, r.tempPassword); } catch (er) { console.error('임시 비밀번호', er); btn.disabled = false; msg(callMessage(er), true); }
            return;
          }
          if (e.target.closest('[data-staff-mail]')) {
            if (!u.email) { msg('이 계정에는 메일 주소가 없습니다.', true); return; } if (!window.confirm(u.email + ' 로 비밀번호 재설정 메일을 보낼까요?\n(받은편지함을 쓰는 실제 메일 주소여야 받을 수 있습니다.)')) return;
            const btn = e.target.closest('[data-staff-mail]'); btn.disabled = true;
            try { await sendPasswordResetEmail(auth, u.email); msg('재설정 메일을 보냈습니다.'); } catch (er) { console.error('재설정 메일', er); msg(resetMailMessage(er), true); } btn.disabled = false;
            return;
          }
          if (e.target.closest('[data-staff-status]')) {
            const to = e.target.closest('[data-staff-status]').getAttribute('data-to'); const off = to === 'suspended';
            if (!window.confirm(off ? (u.name || '이 직원') + '님의 계정을 사용 중지할까요?\n로그인이 막히고 열려 있는 로그인이 끊깁니다. 언제든 다시 사용 재개할 수 있습니다.' : (u.name || '이 직원') + '님의 계정을 다시 사용하게 할까요?')) return;
            const btn = e.target.closest('[data-staff-status]'); btn.disabled = true;
            try { await callAdmin({ action: 'setStatus', uid: u.uid, status: to }); u.status = to; paint(); toast(off ? '사용 중지했습니다.' : '다시 사용하게 했습니다.'); close(); } catch (er) { console.error('상태 변경', er); btn.disabled = false; msg(callMessage(er), true); }
            return;
          }
          if (e.target.closest('[data-staff-save]')) {
            const f = { name: w.querySelector('#sf-name').value, empNo: w.querySelector('#sf-emp').value, rank: w.querySelector('#sf-rank').value, dept: w.querySelector('#sf-dept').value, phone: w.querySelector('#sf-phone').value };
            const bad = validateStaffForm(f, users, u.uid); if (bad) { msg(bad, true); return; } const upd = staffUpdate(f); const btn = e.target.closest('[data-staff-save]'); btn.disabled = true;
            try {
              await updateDoc(doc(db, 'portal_users', u.uid), upd);
              if (lw) { try { await updateDoc(doc(db, 'workers', lw.id), workerSync(upd)); Object.assign(lw, workerSync(upd)); } catch (er) { console.error('명부 동기화', er); toast('계정은 저장했지만 인사 명부를 같이 고치지 못했습니다.'); } }
              Object.assign(u, upd); paint(); toast('저장했습니다.'); close();
            } catch (er) { console.error('직원 저장', er); btn.disabled = false; msg('저장하지 못했습니다. (' + (er.code || er.message) + ')', true); }
          }
        });
        const first = w.querySelector('#sf-name'); if (first) first.focus();
      };
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
