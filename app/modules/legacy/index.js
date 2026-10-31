import { LEGACY_DEFS } from './list.js?v=20261031h';
import { mountLegacy, hostNative } from './frame.js?v=20261031h';
import { CAL_SOURCES } from './calendar-sources.js?v=20261031h';

/** 옛 모듈을 플랫폼 틀 안에 끼워 넣는 어댑터. 화면 틀은 항상 플랫폼이고, 옛 페이지는 틀 안쪽(iframe)에서 임베드 모드(via=portal)로 열린다 */
export const modules = LEGACY_DEFS.map((def) => ({
  manifest: { id: def.id, order: def.order, mobileTab: def.mobileTab, title: def.title, icon: def.icon, defaultHash: '#/' + def.id, keepAlive: true, perm: def.perm, legacy: true, calendar: CAL_SOURCES[def.id] || [] },
  mount: (root, route, ctx) => mountLegacy(def, root, route, ctx)
}));

/** 옛 모듈 화면 틀 안의 한 구역을 새 모듈이 그리도록 연결(예: 인사총무의 총무) — modules/index.js 에서만 부른다 */
export { hostNative };
