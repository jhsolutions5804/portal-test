import { inboxHtml } from './inbox-view.js?v=20261031c';
import { canAssign, friendlyError } from '../../shared/pjt-log.js?v=20261031c';
/* 미분류 메일 받은함 부품 — PJT 메인 홈(프로젝트를 고르기 전)에 붙는다. 서버 함수 pjtLogAct 의 inboxList·inboxAssign·inboxDismiss 만 쓴다.
 * 서버가 권한을 판정한다: PJT 권한자·관리자가 아니면 서버가 거절하고 이 부품은 아무것도 그리지 않는다(오류 문구도 띄우지 않음 — 홈이 시끄럽지 않게).
 * host = 그려질 요소(요소에 직접 이벤트를 달아 바깥이 다시 그려져도 유지). o = { callLog(필수, 서버 함수 pjtLogAct 호출), confirm?, onChange? }  onChange = 지정·치우기 뒤 호출(이력 요약을 다시 읽게). 반환 { ready, reload, state } */
export function createInboxPanel(host, o) {
  const callLog = o && o.callLog; const confirm = (o && o.confirm) || (async () => true); // 서버 호출·확인 대화상자는 바깥(overview-index.js)에서 주입 — 브라우저 부품에 직접 기대지 않아 시험이 가능하다
  if (typeof callLog !== 'function') throw new Error('callLog 가 필요합니다.');
  const st = { data: null, pick: {}, busy: false, msg: '' };
  const paint = () => { const y = window.scrollY; host.innerHTML = inboxHtml(st); window.scrollTo(0, y); };
  const load = async () => {
    try { st.data = await callLog({ action: 'inboxList' }); }
    catch (e) { st.data = null; } // 권한이 없거나 서버가 안 될 때는 조용히 숨긴다
    paint();
  };
  const act = async (fn, okMsg) => { if (st.busy) return; st.busy = true; st.msg = ''; paint(); try { await fn(); st.msg = okMsg; if (o && typeof o.onChange === 'function') o.onChange(); await load(); } catch (e) { st.msg = friendlyError(e); } st.busy = false; paint(); };
  host.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; const id = t.getAttribute('data-ib-pick'); if (id) { st.pick[id] = t.value; paint(); } };
  host.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const el = t.closest('[data-ib-act]'); if (!el) return;
    const a = el.getAttribute('data-ib-act'), id = el.getAttribute('data-ib-id') || '';
    if (a === 'assign') {
      const sel = host.querySelector('select[data-ib-pick="' + id.replace(/"/g, '') + '"]'); const pid = sel ? sel.value : ''; if (!canAssign(pid)) { st.msg = '프로젝트를 먼저 선택해 주세요.'; paint(); return; }
      return act(() => callLog({ action: 'inboxAssign', id, pjtId: pid }), '이력에 후보로 넣었습니다. 확정은 해당 프로젝트 이력 탭에서 하세요.');
    }
    if (a === 'dismiss') {
      const ans = await confirm({ title: '이 현장 메일 아님', body: '이 메일을 미분류 목록에서 치웁니다. 이력에는 들어가지 않으며 같은 메일이 다시 나타나지 않습니다.', confirmLabel: '치우기' }); if (!ans || ans.ok !== true) return; // confirmDialog 는 { ok, reason } 객체를 돌려준다 — 객체 자체는 항상 참이라 ans.ok 를 봐야 한다(취소해도 { ok:false } 가 돌아온다)
      return act(() => callLog({ action: 'inboxDismiss', id }), '치웠습니다.');
    }
  };
  return { ready: load(), reload: load, state: st };
}
