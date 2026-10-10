/* 프로젝트 설정 탭의 "참여 부서·개인" 구역 — FAB·SUP·경량 PJT 화면이 각자의 설정 탭(관리자 전용)에서 불러다 쓴다.
 * 순수 규칙(toggleTeam 등)은 시험하고, mountParticipants 는 화면을 만든다(옛 화면과 같은 모양이 되도록 자체 스타일을 넣는다).
 * 저장 위치: 고정 PJT = pjt_settings/{p4ph2|p4ph4}, 경량 PJT = pjt_registry/{id} 의 participants (보안 규칙이 이미 관리자만 허용). */
import { participantsOf, normalizeParticipants } from './pjt-access.js?v=20261008m';
import { isGuestUser, byRank, NO_DEPT, deptOptions } from './org.js?v=20261008m';

export const toggleTeam = (p, team) => { const t = participantsOf({ participants: p }); const i = t.teams.indexOf(team); if (i === -1) t.teams.push(team); else t.teams.splice(i, 1); return t; };
export const addMember = (p, uid) => { const t = participantsOf({ participants: p }); if (uid && t.members.indexOf(uid) === -1) t.members.push(uid); return t; };
export const removeMember = (p, uid) => { const t = participantsOf({ participants: p }); t.members = t.members.filter((x) => x !== uid); return t; };
/** 선택 가능한 개인: 승인 직원(GUEST 제외), 부서 → 직급 → 사번 순 */
export function selectableUsers(users) {
  return (users || []).filter((u) => (!u.status || u.status === 'approved') && !isGuestUser(u)).slice().sort((a, b) => (!a.dept - !b.dept) || String(a.dept || '').localeCompare(String(b.dept || ''), 'ko') || byRank(a, b));
}
export const userLabel = (u) => (u.name || '-') + ' (' + [u.rank, u.dept || NO_DEPT].filter(Boolean).join(' · ') + ')';
export function summaryText(p, usersByUid) {
  const t = participantsOf({ participants: p }); if (!t.teams.length && !t.members.length) return '지정 없음 — PJT 권한이 있는 사람 모두';
  const names = t.members.map((id) => (usersByUid && usersByUid[id] ? usersByUid[id].name : '(알 수 없는 계정)'));
  return [t.teams.length ? '부서 ' + t.teams.join('·') : '', names.length ? '개인 ' + names.slice(0, 3).join('·') + (names.length > 3 ? ' 외 ' + (names.length - 3) + '명' : '') : ''].filter(Boolean).join(' / ');
}
export const sameParticipants = (a, b) => JSON.stringify(normalizeParticipants(a)) === JSON.stringify(normalizeParticipants(b));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CSS = `
.ppt{font-family:inherit;font-size:13px;color:#1A2540}
.ppt-t{font-size:15px;font-weight:700;margin:0 0 4px}.ppt-sub{font-weight:400;color:#9AAABF;font-size:11px}
.ppt-sum{margin:0 0 12px;padding:8px 12px;border-radius:9px;background:#f0f6ff;color:#1D5BA6;font-weight:600;overflow-wrap:anywhere}
.ppt-l{margin:12px 0 6px;font-size:12px;font-weight:700;color:#5C6F8A}
.ppt-chips,.ppt-members{display:flex;flex-wrap:wrap;gap:6px}
.ppt-chip{padding:7px 13px;border:1.5px solid #dde4ef;border-radius:999px;background:#fff;color:#5C6F8A;font:inherit;font-weight:700;cursor:pointer}
.ppt-chip[aria-pressed="true"]{background:#1D5BA6;border-color:#1D5BA6;color:#fff}
.ppt-mem{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 12px;border:1.5px solid #cfe0f5;border-radius:999px;background:#f0f6ff;font-weight:700}
.ppt-mem button{border:0;background:none;cursor:pointer;color:#86868b;font-size:14px;padding:2px 6px}
.ppt-add{display:flex;gap:6px;margin-top:8px}.ppt-add select{flex:1;min-width:0;padding:8px 10px;border:1.5px solid #dde4ef;border-radius:9px;font:inherit;background:#fff}
.ppt-btn{padding:9px 14px;border:1px solid #e5e5e5;border-radius:10px;background:#f5f5f7;color:#555;font:inherit;font-weight:600;cursor:pointer}
.ppt-btn.pri{background:#1D5BA6;border-color:#1D5BA6;color:#fff;font-weight:700}.ppt-btn:disabled{opacity:.6;cursor:default}
.ppt-hint{margin:10px 0;color:#86868b;font-size:12px;line-height:1.5}
.ppt-act{display:flex;flex-wrap:wrap;gap:8px}.ppt-msg{margin-top:8px;min-height:18px;font-size:12.5px}
`;
const draw = (box, S) => {
  const taken = new Set(S.draft.members); const opts = S.picks.filter((u) => !taken.has(u.uid)).map((u) => '<option value="' + esc(u.uid) + '">' + esc(userLabel(u)) + '</option>').join('');
  const mem = S.draft.members.length ? S.draft.members.map((id) => '<span class="ppt-mem">' + esc(S.byUid[id] ? S.byUid[id].name : '(알 수 없는 계정)') + '<button type="button" data-ppt-del="' + esc(id) + '" aria-label="지정 해제">✕</button></span>').join('') : '<span class="ppt-hint" style="margin:0">지정한 개인이 없습니다.</span>';
  box.innerHTML = '<div class="ppt"><div class="ppt-t">👥 참여 부서·개인 <span class="ppt-sub">(관리자)</span></div>' +
    '<div class="ppt-sum" data-ppt-sum>' + esc(summaryText(S.draft, S.byUid)) + (sameParticipants(S.draft, S.saved) ? '' : ' <small>· 저장 전</small>') + '</div>' +
    '<div class="ppt-l">참여 부서 (눌러서 선택·해제)</div><div class="ppt-chips">' + S.depts.map((t) => '<button type="button" class="ppt-chip" data-ppt-team="' + esc(t) + '" aria-pressed="' + (S.draft.teams.indexOf(t) !== -1) + '">' + esc(t) + '</button>').join('') + '</div>' +
    '<div class="ppt-l">참여 개인 (부서와 따로 한 사람씩)</div><div class="ppt-members">' + mem + '</div>' +
    '<div class="ppt-add"><select data-ppt-pick aria-label="추가할 직원"><option value="">직원 선택…</option>' + opts + '</select><button type="button" class="ppt-btn" data-ppt-add>추가</button></div>' +
    '<div class="ppt-hint">비워 두면 지금처럼 <b>PJT 권한이 있는 사람 모두</b>가 이 프로젝트에 들어갑니다. 하나라도 지정하면 <b>지정된 부서·개인(과 관리자)만</b> 들어갈 수 있습니다. 부서는 이름이 같은 사람만 해당됩니다(본부를 골라도 산하 팀은 자동 포함되지 않음). 연명부는 이 지정과 별개로 PJT 권한자·관리자만 봅니다.</div>' +
    '<div class="ppt-act"><button type="button" class="ppt-btn pri" data-ppt-save>참여자 지정 저장</button><button type="button" class="ppt-btn" data-ppt-reset>되돌리기</button><button type="button" class="ppt-btn" data-ppt-clear>지정 모두 해제</button></div><div class="ppt-msg" data-ppt-msg role="status"></div></div>';
};
/** box 안에 구역을 만든다. opts = { db, kind: 'fixed' | 'light', id, me: { uid } } */
export async function mountParticipants(box, opts) {
  if (!box) return; if (!document.getElementById('ppt-style')) { const st = document.createElement('style'); st.id = 'ppt-style'; st.textContent = CSS; document.head.appendChild(st); }
  box.innerHTML = '<div class="ppt"><div class="ppt-hint">참여자 지정을 불러오는 중…</div></div>';
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'); const { db, kind, id, me } = opts;
  const col = kind === 'fixed' ? 'pjt_settings' : 'pjt_registry'; const ref = fs.doc(db, col, id);
  const [ps, us] = await Promise.all([fs.getDoc(ref), fs.getDocs(fs.collection(db, 'portal_users'))]);
  const users = []; us.forEach((d) => users.push(Object.assign({ uid: d.id }, d.data()))); const byUid = {}; users.forEach((u) => { byUid[u.uid] = u; });
  const saved = normalizeParticipants(ps.exists() ? ps.data().participants : null);
  const S = { saved, draft: normalizeParticipants(saved), picks: selectableUsers(users), byUid, depts: deptOptions(users) };
  const say = (t, bad) => { const m = box.querySelector('[data-ppt-msg]'); if (m) { m.textContent = t; m.style.color = bad ? '#c0392b' : '#1e8e3e'; } };
  draw(box, S);
  box.onclick = async (ev) => {
    const t = ev.target; const tb = t.closest('[data-ppt-team]'); const dm = t.closest('[data-ppt-del]');
    if (tb) { S.draft = toggleTeam(S.draft, tb.getAttribute('data-ppt-team')); draw(box, S); return; }
    if (dm) { S.draft = removeMember(S.draft, dm.getAttribute('data-ppt-del')); draw(box, S); return; }
    if (t.closest('[data-ppt-add]')) { const sel = box.querySelector('[data-ppt-pick]'); if (sel && sel.value) { S.draft = addMember(S.draft, sel.value); draw(box, S); } return; }
    if (t.closest('[data-ppt-clear]')) { S.draft = { teams: [], members: [] }; draw(box, S); return; }
    if (t.closest('[data-ppt-reset]')) { S.draft = normalizeParticipants(S.saved); draw(box, S); return; }
    if (t.closest('[data-ppt-save]')) {
      const btn = t.closest('[data-ppt-save]'); btn.disabled = true; const next = normalizeParticipants(S.draft);
      try { await fs.setDoc(ref, { participants: next, participantsUpdatedAt: fs.serverTimestamp(), participantsUpdatedBy: me && me.uid ? me.uid : '' }, { merge: true }); S.saved = normalizeParticipants(next); S.draft = normalizeParticipants(next); draw(box, S); say('저장했습니다.'); }
      catch (e) { console.error('참여자 저장', e); btn.disabled = false; say('저장하지 못했습니다. (' + (e.code || e.message) + ')', true); }
    }
  };
}
