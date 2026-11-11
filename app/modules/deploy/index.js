/* 투입 확인(직원 본인) — 프로젝트에 투입될 때마다 「투입 확인서」(투입 확인 + 소개서 제공 동의)에 본인이 직접 응답한다(대기열 1-3-27-6).
 * 모든 조회·응답은 서버 함수 deployAct 로만. 확인 기록은 서버 전용 문서에 저장되고, 동의하지 않으면 그 사업에는 투입되지 않는다. 설계: Claude 문서 「사업별 투입 확인서」. */
import { functions, httpsCallable } from '../../core/firebase.js?v=20261109x';
import { confirmDialog } from '../../core/dialog.js?v=20261109x';
import { toast } from '../../core/ui.js?v=20261109x';
import { deployHtml } from './view.js?v=20261109x';

export const manifest = { id: 'deploy', order: 92, nav: false, title: '투입 확인', icon: '🧾', defaultHash: '#/deploy/list', perm: (me) => !!me && !me.isGuest };
const call = async (data) => (await httpsCallable(functions, 'deployAct')(data)).data;
const errMsg = (e) => String((e && e.message) || '').replace(/^.*?:\s*/, '') || '처리하지 못했습니다.';
const ASK = {
  decline: { title: '동의하지 않음', body: '동의하지 않으면 이 사업에는 투입되지 않습니다. 급여·평가 등 다른 불이익은 없습니다. 계속할까요?', confirmLabel: '동의하지 않음' },
  withdraw: { title: '동의 철회', body: '철회하면 이 사업의 소개서 제공이 중단되고 투입이 어려워질 수 있습니다. 이미 제공한 정보는 제공받은 자에게 삭제를 요청합니다. 철회할까요?', confirmLabel: '철회' }
};
export async function mount(root) {
  const st = { loading: true, error: '', data: null, busy: '' };
  const paint = () => { root.innerHTML = deployHtml(st); };
  const load = async () => { try { st.data = await call({ action: 'mine' }); st.error = ''; } catch (e) { st.error = errMsg(e); st.data = null; } st.loading = false; paint(); };
  root.onclick = async (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-dp-act]'); if (!b || st.busy) return;
    const act = b.getAttribute('data-dp-act'); const pjtId = b.getAttribute('data-pjt'); const rootEl = root.querySelector('[data-dp-root]'); const version = rootEl ? rootEl.getAttribute('data-dp-version') : '';
    if (ASK[act]) { const ok = await confirmDialog(Object.assign({}, ASK[act])); if (!ok || !ok.ok) return; }
    st.busy = pjtId; paint();
    try {
      st.data = await call(act === 'withdraw' ? { action: 'withdraw', pjtId } : { action: 'respond', pjtId, decision: act, version });
      toast(act === 'agree' ? '투입을 확인했습니다.' : (act === 'decline' ? '동의하지 않음으로 기록했습니다.' : '철회했습니다.'));
    } catch (e) { toast(errMsg(e)); }
    st.busy = ''; paint();
  };
  root.onchange = null; paint(); await load();
}
