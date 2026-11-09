/* 내 정보 입력 — 포털 계정은 있는데 근로자 명부에 연결되지 않은 직원이 본인 정보를 직접 입력한다(홈 출퇴근 칸의 "내 정보 입력하기" 버튼으로 진입, 사이드바에는 없음).
 * 저장·제출은 서버 함수 entryAct 로만 하고, 인사 담당자가 확인해 명부에 반영하면 계정과 연결된다. 설계서 app-docs/worker-self-entry-design.md */
import { renderEntry } from '../../shared/entry-form.js?v=20261109s';

export const manifest = { id: 'myinfo', order: 91, nav: false, title: '내 정보 입력', icon: '📝', defaultHash: '#/myinfo/form', perm: (me) => !!me && !me.isGuest };
export async function mount(root, route, ctx) { root.onclick = null; root.onchange = null; root.innerHTML = ''; renderEntry(root, { me: ctx.me, embedded: true }); }
