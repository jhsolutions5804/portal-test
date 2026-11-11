/* 내 이력서(직원 본인) — 포털 로그인 상태에서 자기 이력서를 열람한다(대기열 1-3-27-4, 대표님 2026-11-05 단순화: 메일·문자 인증 링크 없이 포털 안에서).
 * 모든 조회는 서버 함수 myResumeAct 로만. 열람마다 신청 번호와 열람 기록이 남고, 열람본에는 이름·신청 번호 워터마크가 들어간다. */
import { functions, httpsCallable } from '../../core/firebase.js?v=20261109x';
import { toast } from '../../core/ui.js?v=20261109x';
import { resumeHtml } from '../../shared/resume-print.js?v=20261109x';
import { myResumeHtml } from './view.js?v=20261109x';

export const manifest = { id: 'myresume', order: 93, nav: false, title: '내 이력서', icon: '📄', defaultHash: '#/myresume/view', perm: (me) => !!me && !me.isGuest };
const call = async (data) => (await httpsCallable(functions, 'myResumeAct')(data)).data;
const errMsg = (e) => String((e && e.message) || '').replace(/^.*?:\s*/, '') || '처리하지 못했습니다.';
const kstYm = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
export async function mount(root) {
  const st = { loading: true, error: '', data: null, busy: false };
  const paint = () => { root.innerHTML = myResumeHtml(st); };
  root.onclick = async (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-mr-open]'); if (!b || st.busy) return;
    st.busy = true; paint(); let win = null;
    try {
      win = window.open('', '_blank'); if (win) win.document.write('<p style="font-family:sans-serif;padding:24px;">이력서를 준비하는 중...</p>');
      const r = await call({ action: 'view' });
      const html = resumeHtml(r.resume, { viewer: { no: r.request.no, at: r.request.at, name: r.resume.worker.name }, noFamily: true, projectPage: false, todayYm: kstYm() });
      if (win) { win.document.open(); win.document.write(html); win.document.close(); } else toast('팝업이 차단되어 이력서 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 눌러 주세요.');
      st.data = Object.assign({}, st.data, { recent: r.recent });
    } catch (e) { if (win) win.close(); toast(errMsg(e)); }
    st.busy = false; paint();
  };
  root.onchange = null; paint();
  try { st.data = await call({ action: 'recent' }); st.error = ''; } catch (e) { st.error = errMsg(e); st.data = null; }
  st.loading = false; paint();
}
