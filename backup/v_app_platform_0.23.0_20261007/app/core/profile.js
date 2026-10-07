import { auth, db, doc, getDoc, getDocs, updateDoc, collection, query, where, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from './firebase.js?v=20261007j';
import { esc, toast } from './ui.js?v=20261007j';
import { validateNewPassword, passwordErrorMessage, fmtPhone, isPhone, maskJumin, fmtJumin, maskAccount } from './profile-logic.js?v=20261007j';

/** 내 정보 창 — 전화번호·비밀번호 변경, 내 인사 정보(주민번호·주소·계좌) 보기.
 *  비밀번호는 현재 비밀번호로 다시 인증한 뒤 바꾸며, 어디에도 따로 저장하지 않는다(옛 포털은 사본을 portal_secrets 에 남겼다). */
export function openProfile(me, trigger) {
  if (document.getElementById('jh-profile-dialog')) return;
  const wrap = document.createElement('div'); wrap.className = 'jh-dialog'; wrap.id = 'jh-profile-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'jh-profile-title');
  const dl = [['이름', me.name], ['직급', me.rank], ['부서', me.dept], ['사번', me.empNo], ['메일', me.email]].map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v || '-') + '</dd>').join('');
  wrap.innerHTML = '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel jh-profile">' +
    '<h3 class="jh-dialog__title" id="jh-profile-title">내 정보</h3><div class="jh-dialog__body jh-profile__body">' +
    '<dl class="jh-profile__dl">' + dl + '</dl>' +
    '<section class="jh-profile__sec" aria-label="전화번호"><label class="jh-field"><span class="jh-field__label">전화번호</span><input class="jh-input" id="pf-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"></label>' +
      '<div class="jh-profile__row"><button type="button" class="jh-btn" data-variant="secondary" data-save-phone>전화번호 저장</button><span class="jh-field__hint" data-msg-phone role="status"></span></div></section>' +
    '<details class="jh-profile__sec jh-profile__details" aria-label="비밀번호 변경"><summary>비밀번호 변경</summary>' +
      '<label class="jh-field"><span class="jh-field__label">현재 비밀번호</span><input class="jh-input" id="pf-cur" type="password" autocomplete="current-password"></label>' +
      '<label class="jh-field"><span class="jh-field__label">새 비밀번호 (8자 이상)</span><input class="jh-input" id="pf-new" type="password" autocomplete="new-password"></label>' +
      '<label class="jh-field"><span class="jh-field__label">새 비밀번호 확인</span><input class="jh-input" id="pf-new2" type="password" autocomplete="new-password"></label>' +
      '<div class="jh-profile__row"><button type="button" class="jh-btn" data-variant="secondary" data-save-pw>비밀번호 변경</button><span class="jh-field__hint" data-msg-pw role="status"></span></div></details>' +
    '<details class="jh-profile__sec jh-profile__details" aria-label="내 인사 정보"><summary>내 인사 정보 (주민번호·주소·계좌)</summary><div data-hr><button type="button" class="jh-btn" data-variant="ghost" data-load-hr>불러오기</button></div></details>' +
    '</div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="primary" data-close>닫기</button></div></div>';
  document.body.appendChild(wrap); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const $ = (s) => wrap.querySelector(s); const phone = $('#pf-phone');
  getDoc(doc(db, 'portal_users', me.uid)).then((s) => { if (s.exists()) phone.value = fmtPhone(s.data().phone || ''); }).catch(() => {});
  phone.addEventListener('input', () => { const p = phone.selectionStart; phone.value = fmtPhone(phone.value); try { phone.setSelectionRange(phone.value.length, phone.value.length); } catch (e) { /* 일부 브라우저는 tel 입력칸의 커서 이동을 막는다 */ } void p; });
  const close = () => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev; if (trigger && trigger.focus) trigger.focus(); };
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  document.addEventListener('keydown', onKey, true); phone.focus();
  const say = (sel, text, bad) => { const el = $(sel); el.textContent = text; el.style.color = bad ? 'var(--c-danger)' : 'var(--c-success)'; };
  wrap.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('[data-close]')) { close(); return; }
    if (t.closest('[data-save-phone]')) {
      const v = phone.value.trim(); if (!isPhone(v)) { say('[data-msg-phone]', '전화번호 형식을 확인해 주세요. (예: 010-1234-5678)', true); return; }
      try { await updateDoc(doc(db, 'portal_users', me.uid), { phone: v }); say('[data-msg-phone]', '저장했습니다.'); toast('전화번호를 저장했습니다.'); } catch (e) { console.error(e); say('[data-msg-phone]', '저장하지 못했습니다.', true); }
      return;
    }
    if (t.closest('[data-save-pw]')) {
      const cur = $('#pf-cur').value, nw = $('#pf-new').value, nw2 = $('#pf-new2').value; const bad = validateNewPassword(cur, nw, nw2); if (bad) { say('[data-msg-pw]', bad, true); return; }
      const btn = t.closest('[data-save-pw]'); btn.disabled = true;
      try { const u = auth.currentUser; await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur)); await updatePassword(u, nw); ['#pf-cur', '#pf-new', '#pf-new2'].forEach((s) => { $(s).value = ''; }); say('[data-msg-pw]', '비밀번호를 바꿨습니다.'); toast('비밀번호를 바꿨습니다.'); }
      catch (e) { console.error('비밀번호 변경', e && e.code); say('[data-msg-pw]', passwordErrorMessage(e && e.code), true); }
      finally { btn.disabled = false; }
      return;
    }
    if (t.closest('[data-load-hr]')) {
      const box = $('[data-hr]'); box.innerHTML = '<span class="jh-field__hint">불러오는 중…</span>';
      try {
        const ws = await getDocs(query(collection(db, 'workers'), where('portalUid', '==', me.uid))); if (ws.empty) { box.innerHTML = '<div class="jh-field__hint">인사 명부와 연동되어 있지 않습니다. 관리자에게 연동을 요청해 주세요.</div>'; return; }
        const wid = ws.docs[0].id; const ps = await getDoc(doc(db, 'worker_private', wid)); const p = ps.exists() ? ps.data() : {};
        const rows = [['주민번호', maskJumin(p.jumin), fmtJumin(p.jumin)], ['주소', p.address || '—', p.address || '—'], ['계좌', maskAccount(p.bankAccount), p.bankAccount || '—']];
        box.innerHTML = '<dl class="jh-profile__dl">' + rows.map(([k, m, f], i) => '<dt>' + k + '</dt><dd><span data-val="' + i + '">' + esc(m) + '</span> ' + (m !== f ? '<button type="button" class="jh-btn" data-variant="ghost" data-reveal="' + i + '" aria-pressed="false">표시</button>' : '') + '</dd>').join('') + '</dl>' +
          '<div class="jh-field__hint">내용은 화면에만 표시되고 저장되지 않습니다. 정보가 달라졌다면 인사 담당자에게 알려 주세요.</div>';
        box._rows = rows;
      } catch (e) { console.error('내 인사 정보', e); box.innerHTML = '<div class="jh-field__hint" style="color:var(--c-danger)">불러오지 못했습니다.</div>'; }
      return;
    }
    const rv = t.closest('[data-reveal]');
    if (rv) { const i = +rv.getAttribute('data-reveal'); const box = $('[data-hr]'); const on = rv.getAttribute('aria-pressed') !== 'true'; rv.setAttribute('aria-pressed', String(on)); rv.textContent = on ? '가리기' : '표시'; $('[data-val="' + i + '"]').textContent = on ? box._rows[i][2] : box._rows[i][1]; }
  });
}
