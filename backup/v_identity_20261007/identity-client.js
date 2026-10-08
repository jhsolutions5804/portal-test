/* 주민(외국인)등록번호 열람·저장 공용 클라이언트(옛 화면용 — 연명부·인사·모바일·옛 포털) · 설계서 §50
 * 전체 번호는 서버 함수 identityAct 만 안다. 이 파일은 (1) 열람 사유 선택 창 (2) 서버 호출 (3) 마스킹 값 보조 함수를 제공한다.
 * 번호를 저장소·콘솔·주소창에 남기지 않는다. 각 화면은 <script type="module" src="…/identity-client.js"> 로 불러 window.JH_IDENTITY 를 쓴다. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
const REASONS = ['4대보험 신고', '원천징수', '신분 확인', '기타'];
let fns = null;
const call = async (data) => { if (!fns) fns = getFunctions(getApp(), 'asia-northeast3'); const r = await httpsCallable(fns, 'identityAct')(data); return r.data; };
const errText = (e) => { const m = String((e && e.message) || ''); return /[가-힣]/.test(m) ? m : '서버 함수(identityAct)를 호출하지 못했습니다. 함수가 아직 배포되지 않았거나 네트워크 문제일 수 있습니다.'; };
/** 열람 사유를 고르게 한다 → 사유 문자열, 취소하면 null */
function askReason(title) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
    const box = document.createElement('div'); box.style.cssText = 'background:#fff;color:#1A2540;border-radius:12px;max-width:380px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3);font-size:14px;line-height:1.5';
    box.innerHTML = '<div style="font-weight:800;font-size:16px;margin-bottom:6px">' + (title || '주민(외국인)등록번호 보기') + '</div><div style="color:#5C6F8A;font-size:12.5px;margin-bottom:10px">열람 기록(누가·누구의 번호·언제·사유)이 3년간 남습니다. 업무상 필요할 때만 보세요.</div>' +
      REASONS.map((r, i) => '<label style="display:flex;gap:8px;align-items:center;padding:9px 6px;border:1px solid #E4EAF2;border-radius:8px;margin-bottom:6px;cursor:pointer"><input type="radio" name="jh-ident-reason" value="' + r + '"' + (i === 0 ? ' checked' : '') + '> ' + r + '</label>').join('') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button type="button" data-c style="padding:9px 14px;border:1px solid #CBD5E1;background:#fff;border-radius:8px;cursor:pointer">취소</button><button type="button" data-ok style="padding:9px 14px;border:0;background:#1D5BA6;color:#fff;border-radius:8px;font-weight:700;cursor:pointer">보기</button></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    const done = (v) => { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    box.querySelector('[data-c]').onclick = () => done(null); box.querySelector('[data-ok]').onclick = () => { const c = box.querySelector('input[name="jh-ident-reason"]:checked'); done(c ? c.value : null); };
    ov.addEventListener('click', (e) => { if (e.target === ov) done(null); }); box.querySelector('[data-ok]').focus();
  });
}
/** kind: 'roster'|'hr', 본인 번호(self=true)는 사유 선택 없이 "본인 확인". → { found, jumin, masked } 또는 null(취소·실패) */
async function reveal(kind, id, opt) {
  const self = !!(opt && opt.self); const reason = self ? '본인 확인' : await askReason(opt && opt.title); if (!reason) return null;
  try { return await call({ action: 'reveal', kind, workerId: id, reason }); } catch (e) { console.error('주민번호 열람', e && e.code); alert(errText(e)); return null; }
}
/** 저장(빈 문자열 = 삭제). 실패하면 오류를 던진다(문구는 errText) */
async function save(kind, id, jumin) { try { return await call({ action: 'save', kind, workerId: id, jumin: String(jumin || '') }); } catch (e) { const err = new Error(errText(e)); err.code = e && e.code; throw err; } }
const maskView = (m) => String(m || '').replace(/\*/g, '●');
const digits7 = (m) => String(m || '').replace(/\D/g, '').slice(0, 7);
/** 마스킹 값(또는 평문)에서 생년월일 YYYY-MM-DD — 성별 자리로 세기 판정 */
const birthOf = (m) => { const d = digits7(m); if (d.length < 7) return ''; const cen = { 1: 1900, 2: 1900, 5: 1900, 6: 1900, 3: 2000, 4: 2000, 7: 2000, 8: 2000 }[d[6]]; return cen ? (cen + parseInt(d.slice(0, 2), 10)) + '-' + d.slice(2, 4) + '-' + d.slice(4, 6) : ''; };
const birth6 = (m) => String(m || '').replace(/\D/g, '').slice(0, 6);   // YYMMDD
window.JH_IDENTITY = { REASONS, call, reveal, save, maskView, birthOf, birth6, errText };
