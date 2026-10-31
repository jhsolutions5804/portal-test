import { db, auth, functions, httpsCallable, sendPasswordResetEmail, collection, getDocs, getDoc, query, where, orderBy, limit, doc, updateDoc } from '../../core/firebase.js?v=20261031f';
import { esc, toast } from '../../core/ui.js?v=20261031f';
import { fmtPhone } from '../../core/profile-logic.js?v=20261031f';
import { deptOptions } from '../../shared/org.js?v=20261031f';
import { PERM_KEYS, validateStaffForm, staffUpdate, linkedWorkerOf, findWorkerMatch, workerSync, validateNewAccount, validateLoginId, validateExtEmail, ID_RE, newAccountPayload, callMessage, resetMailMessage, teamLeadChanges } from './staff-logic.js?v=20261031f';
import { staffListHtml, staffDialogHtml, newAccountDialogHtml, secretDialogHtml } from './staff-view.js?v=20261031f';
import { accessLogHtml } from './accesslog-view.js?v=20261031f';
import { toEntry, filterEntries, summarize, monthRange, addMonth, kstYm, kstText, tsMs } from './accesslog-logic.js?v=20261031f';
import { companyPerm } from '../../shared/company-perm.js?v=20261031f';
import { markChecked, identityErrorText } from '../../shared/identity.js?v=20261031f';
import { groupOrg, sortPolicies, buildOrgTree, isGuestUser, isOrgHidden } from './logic.js?v=20261031f';
import { orgHtml, rulesHtml, orgChartHtml, orgViewHtml, personCardHtml } from './view.js?v=20261031f';

/** 회사 영역(플랫폼 기본 모듈): 조직도·규정을 읽기 전용으로. GUEST 계정에는 보이지 않는다(연락처·내부 규정) */
/** 실제 메뉴 등록은 공용 틀(modules/legacy/list.js 의 company 정의 — 인사총무와 같은 사이드바·내용 영역). 여기의 값은 규약(manifest+mount)용이며 권한은 같은 함수를 쓴다 */
export const manifest = { id: 'company', order: 45, title: '회사', icon: '🏢', defaultHash: '#/company/org', perm: companyPerm };
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
/** 규정 문서 목록을 틀(사이드바)에 알린다 — 틀이 "규정" 묶음을 문서마다 한 항목으로 그린다 */
function announcePolicies(list) { try { window.dispatchEvent(new CustomEvent('jh:company-policies', { detail: { policies: (list || []).map((p) => ({ id: p.id, title: String(p.title || p.id) })) } })); } catch (e) { /* 알림 실패는 화면 동작을 막지 않는다 */ } }
export async function mount(root, route, ctx) {
  const me = (ctx && ctx.me) || {}; const want = route.segs[0]; const tab = want === 'rules' ? 'rules' : (want === 'staff' && me.admin ? 'staff' : (want === 'alog' && me.admin ? 'alog' : 'org'));
  if ((want === 'staff' || want === 'alog') && !me.admin) { location.replace('#/company/org'); return; }   // 직원 관리·열람 기록은 관리자만
  root.onclick = null; root.oninput = null;
  root.innerHTML = '<div class="jh-company"><div id="co-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#co-body');
  if (tab !== 'rules') loadPolicies().then(announcePolicies, () => { /* 규정 목록을 못 읽어도 다른 화면은 그대로 */ });
  try {
    if (tab === 'org') {
      const users = (await loadUsers()).filter((u) => !isGuestUser(u) && !isOrgHidden(u)); let q = ''; let view = orgView;   // GUEST 계정은 조직도·목록에서 제외
      const paint = () => {
        body.innerHTML = orgViewHtml(view) + (view === 'chart' ? orgChartHtml(buildOrgTree(users)) : orgHtml(groupOrg(users, q), users.length, q));
        body.querySelectorAll('[data-org-view]').forEach((b) => { b.onclick = () => { view = b.getAttribute('data-org-view'); orgView = view; paint(); }; });
        body.querySelectorAll('.jh-org__p').forEach((b) => { b.onclick = () => { const u = users.find((x) => x.uid === b.getAttribute('data-uid')); if (u) openPerson(u, b); }; });
        const inp = body.querySelector('#org-q'); if (inp) { inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; const list = body.querySelector('[data-org-list]'); const tmp = document.createElement('div'); tmp.innerHTML = orgHtml(groupOrg(users, q), users.length, q); list.innerHTML = tmp.querySelector('[data-org-list]').innerHTML; inp.setSelectionRange(pos, pos); }; }
      };
      paint();
    } else if (tab === 'alog') {
      const maxYm = kstYm(Date.now()); const st = { ym: maxYm, maxYm, all: [], list: [], sum: summarize([]), actorOptions: [], filter: { actor: '', action: '', q: '' }, check: null, truncated: false };
      const loadMonth = async () => {
        const [a, b] = monthRange(st.ym);
        const snap = await getDocs(query(collection(db, 'access_log'), where('at', '>=', new Date(a)), where('at', '<', new Date(b)), orderBy('at', 'desc'), limit(501)));   // 단일 필드 범위 + 같은 필드 정렬 — 색인 필요 없음
        const rows = []; snap.forEach((d) => rows.push(toEntry(d.id, d.data()))); st.truncated = rows.length > 500; st.all = rows.slice(0, 500);
        const cs = await getDoc(doc(db, 'access_log_checks', st.ym)); st.check = cs.exists() ? (() => { const x = cs.data(); return { checkedByName: x.checkedByName || '', note: x.note || '', when: tsMs(x.checkedAt) ? kstText(tsMs(x.checkedAt)) : '' }; })() : null;
        const seen = {}; st.actorOptions = []; st.all.forEach((e) => { if (e.actorUid && !seen[e.actorUid]) { seen[e.actorUid] = 1; st.actorOptions.push({ uid: e.actorUid, name: e.actorName || e.actorUid }); } });
        if (st.filter.actor && !seen[st.filter.actor]) st.filter.actor = '';
        recalc();
      };
      const recalc = () => { st.sum = summarize(st.all); st.list = filterEntries(st.all, st.filter); paint(); };
      const paint = () => { body.innerHTML = accessLogHtml(st); };
      paint(); await loadMonth();
      root.onclick = async (ev) => {
        const mb = ev.target.closest('[data-alog-month]'); if (mb) { const nx = addMonth(st.ym, Number(mb.getAttribute('data-alog-month'))); if (nx > st.maxYm) return; st.ym = nx; try { await loadMonth(); } catch (e) { console.error('열람 기록', e); toast('불러오지 못했습니다.'); } return; }
        const ck = ev.target.closest('[data-alog-check]'); if (ck) {
          if (!window.confirm(st.ym + ' 열람 기록을 확인했고 점검을 완료했다고 표시할까요?')) return; ck.disabled = true; const note = (root.querySelector('#alog-note') || {}).value || '';
          try { await markChecked(st.ym, note); toast('점검 완료로 표시했습니다.'); await loadMonth(); } catch (e) { console.error('월 점검', e); toast(identityErrorText(e)); ck.disabled = false; }
        }
      };
      root.onchange = (ev) => { const t = ev.target; if (t.hasAttribute && t.hasAttribute('data-alog-actor')) { st.filter.actor = t.value; recalc(); } else if (t.hasAttribute && t.hasAttribute('data-alog-action')) { st.filter.action = t.value; recalc(); } };
      root.oninput = (ev) => { const t = ev.target; if (t.hasAttribute && t.hasAttribute('data-alog-q')) { st.filter.q = t.value.trim(); st.list = filterEntries(st.all, st.filter); const lst = root.querySelector('.jh-alog__list'); const tmp = document.createElement('div'); tmp.innerHTML = accessLogHtml(st); const nl = tmp.querySelector('.jh-alog__list'); if (lst && nl) lst.innerHTML = nl.innerHTML; } };   // 검색어를 칠 때는 입력칸을 다시 그리지 않고 목록만 바꾼다
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
            const f = { id: w.querySelector('#nf-id').value, name: w.querySelector('#nf-name').value, empNo: w.querySelector('#nf-emp').value, rank: w.querySelector('#nf-rank').value, dept: w.querySelector('#nf-dept').value, phone: w.querySelector('#nf-phone').value, email: (w.querySelector('#nf-email') || { value: '' }).value, perms };
            const bad = validateNewAccount(f, users); if (bad) { msg(bad, true); return; } const btn = e.target.closest('[data-nf-save]'); btn.disabled = true; msg('만드는 중…');
            try { const r = await callAdmin(newAccountPayload(f)); close(); showSecret('새 직원 계정을 만들었습니다', r.email, r.tempPassword); try { await reload(); paint(); } catch (er) { console.warn('목록 다시 읽기', er); } }
            catch (er) { console.error('계정 생성', er); btn.disabled = false; msg(callMessage(er), true); }
          }
        });
        const first = w.querySelector('#nf-id'); if (first) first.focus();
      };
      root.onclick = async (ev) => {
        const tl = ev.target.closest('[data-teamlead]');
        if (tl) {   // 팀장 지정/해제 — 같은 팀에는 한 명만(새로 지정하면 기존 팀장은 자동 해제), 먼저 화면에 반영하고 저장 실패하면 되돌린다
          const uid = tl.getAttribute('data-teamlead'); const u = users.find((x) => x.uid === uid); if (!u) return; const ch = teamLeadChanges(users, uid, u.teamLead !== true); const before = {}; Object.keys(ch).forEach((k) => { const x = users.find((y) => y.uid === k); if (x) { before[k] = x.teamLead === true; x.teamLead = ch[k]; } }); paint();
          try { await Promise.all(Object.keys(ch).map((k) => updateDoc(doc(db, 'portal_users', k), { teamLead: ch[k] }))); toast(ch[uid] ? (u.name || '') + ' 님을 ' + (u.dept || '') + ' 팀장으로 지정했습니다.' : '팀장 지정을 해제했습니다.'); } catch (e) { console.error('팀장 저장', e); Object.keys(before).forEach((k) => { const x = users.find((y) => y.uid === k); if (x) x.teamLead = before[k]; }); paint(); toast('팀장을 저장하지 못했습니다: ' + ((e && e.message) || '')); }
          return;
        }
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
          if (e.target.closest('[data-staff-loginid]')) {   // GUEST 로그인 아이디 재설정 — 새 아이디를 정하면 서버가 로그인 계정에 이메일·임시 비밀번호를 넣고 열려 있는 로그인을 끊는다
            const sug = String(u.empNo || '').toLowerCase(); const ask = window.prompt((u.name || '이 직원') + '님의 새 로그인 아이디를 입력하세요.\n영문 소문자·숫자·점·밑줄·하이픈 2~30자이고, 로그인은 아이디@jhsol.kr 로 합니다.\n임시 비밀번호가 함께 발급되고 열려 있는 로그인은 끊깁니다.', ID_RE.test(sug) ? sug : '');
            if (ask == null) return; const bad = validateLoginId(ask, users, u.uid); if (bad) { msg(bad, true); return; }
            const btn = e.target.closest('[data-staff-loginid]'); btn.disabled = true; msg('재설정하는 중…');
            try { const r = await callAdmin({ action: 'setLoginId', uid: u.uid, id: String(ask).trim().toLowerCase() }); close(); showSecret('로그인 아이디를 재설정했습니다', r.email, r.tempPassword); try { await reload(); paint(); } catch (er) { console.warn('목록 다시 읽기', er); } } catch (er) { console.error('로그인 아이디 재설정', er); btn.disabled = false; msg(callMessage(er), true); }
            return;
          }
          if (e.target.closest('[data-staff-extlogin]')) {   // 본인 이메일 로그인 — 회사 이메일이 없는 계약직·GUEST 가 본인 이메일 + 임시 비밀번호로 로그인하게 한다
        const eb = e.target.closest('[data-staff-extlogin]'); const contract = eb.hasAttribute('data-contract');
        if (contract && !window.confirm((u.name || '이 직원') + '님을 "계약직 계정"으로 보고 로그인을 본인 이메일 방식으로 바꿀까요?\n정규 직원은 Microsoft 계정으로 로그인하므로 계약직·외부 인력만 바꾸세요.\n바꾸면 Microsoft 로그인은 이 계정에 쓰지 못합니다.')) return;
        const ask = window.prompt((u.name || '이 직원') + '님의 본인 이메일 주소를 입력하세요.\n회사 이메일(@jhsol.kr)이 아닌 이메일(네이버·지메일 등)이어야 합니다.\n임시 비밀번호가 함께 발급되고 열려 있는 로그인은 끊깁니다.', '');
        if (ask == null) return; const bad = validateExtEmail(ask, users, u.uid); if (bad) { msg(bad, true); return; }
        eb.disabled = true; msg('바꾸는 중…');
        try { const r = await callAdmin(Object.assign({ action: 'setLoginId', uid: u.uid, email: String(ask).trim().toLowerCase() }, contract ? { contract: true } : {})); close(); showSecret('본인 이메일 로그인으로 바꿨습니다', r.email, r.tempPassword); try { await reload(); paint(); } catch (er) { console.warn('목록 다시 읽기', er); } } catch (er) { console.error('본인 이메일 로그인', er); eb.disabled = false; msg(callMessage(er), true); }
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
    } else {
      const list = await loadPolicies(); announcePolicies(list); const docId = route.segs[1] || (route.query && route.query.doc) || '';
      if (!docId && list.length) { location.replace('#/company/rules/' + encodeURIComponent(list[0].id)); return; }   // 문서를 고르지 않고 들어오면 첫 문서(사이드바의 현재 표시도 맞게)
      body.innerHTML = rulesHtml(list, docId);
    }
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
