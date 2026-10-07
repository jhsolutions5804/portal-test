import { esc } from '../../core/ui.js?v=__VER__';
import { sampleSummary } from './logic.js?v=__VER__';
import { __VIEW_IMPORTS__ } from './view.js?v=__VER__';
import { loadItems } from './data.js?v=__VER__';

/** __TITLE__ 모듈 — 플랫폼에 꽂는 새 모듈의 기본 틀(scripts/new_module.py 로 만듦).
 *  규약: ① 다른 모듈(modules/B)을 직접 불러오지 않는다 — 함께 쓸 것은 shared/ 에 둔다 ② core/ 와 shared/ 만 불러온다
 *        ③ 이 파일은 manifest 와 mount 를 내놓는다 ④ 모듈을 빼려면 python3 scripts/new_module.py --remove __ID__ 로 이 모듈의 줄만 지우면 된다 */
export const manifest = {
  id: '__ID__',
  order: __ORDER__,                       // 사이드바 순서(작을수록 위). 내 팀 공수표(90)보다 위로 두면 맨 아래가 유지된다
  title: '__TITLE__', icon: '__ICON__',
  defaultHash: '#/__ID__/home',
  perm: (me) => !!me && !me.isGuest,      // 누구에게 보일지 — 예: me.admin(관리자만), me.perms.pjt(PJT 권한자), !me.isGuest(GUEST 제외)
__NAV_LINE____WIDGETS_LINE____CALENDAR_LINE__};

/** 화면 한 장. route.segs = 주소의 # 뒤 경로 조각(예: ['home']), route.query = ? 뒤 값, ctx.me = 로그인 정보 */
export async function mount(root, route, ctx) {
  root.onclick = null;   // 이전 화면의 클릭 처리 해제(화면을 오갈 때 이벤트가 쌓이지 않게)
  root.innerHTML = '<div class="jh-__ID__"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>';   // 불러오는 동안 자리 확보(레이아웃이 밀리지 않게)
  try {
    const items = await loadItems(ctx.me);
    root.innerHTML = pageHtml(items, sampleSummary(items));
  } catch (e) {
    console.error('__TITLE__ 불러오기', e);
    root.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요. (' + esc(e.code || e.message) + ')</div>';
  }
}
__WIDGET_CODE____CALENDAR_CODE__
