/* 전자결재 사이드 내비게이션 구성(순수) — 영업기획·인사총무·재무회계·PJT 관리와 같은 공용 사이드 내비게이션(shared/sidenav.js, 너비 220px)을 쓴다.
 * 결재함 탭·필터는 주소(?tab=…&status=…)로 정해지므로 메뉴 항목도 같은 주소를 가리킨다. */
import { buildHash } from '../../core/router.js?v=20261031a';
import { tabDefs } from './logic.js?v=20261031a';
export const URL_DEFAULTS = { tab: 'todo', type: 'all', status: 'all', page: '1', size: '20' };   // 주소에서 생략하는 기본값
const box = (patch) => buildHash('edoc', '/box', patch, URL_DEFAULTS);
/** route: { segs, query } → { label, title, current, sections } */
export function edocSideCfg(me0, route) {
  const me = me0 || {};   // 로그인 정보가 없어도 안전하게
  const seg = (route && route.segs && route.segs[0]) || ''; const q = (route && route.query) || {};
  const sections = [
    { title: '현황', items: [{ key: 'home', label: '전자결재 홈', href: '#/edoc/home', hint: '내 할 일·근무·연차 요약' }] },
    { title: '결재함', items: tabDefs(me).map((t) => ({ key: 'box/' + t.key, label: t.label, href: box({ tab: t.key }) })) },
    { title: '내 문서', items: [{ key: 'new', label: '새 문서 작성', href: '#/edoc/new', hint: '문서 종류를 골라 새로 작성' }, { key: 'box/mine/draft', label: '임시저장', href: box({ tab: 'mine', status: 'draft' }) }, { key: 'box/mine/rejected', label: '반려된 문서', href: box({ tab: 'mine', status: 'rejected' }) }] }
  ];
  if (me && me.admin) sections.push({ title: '설정', items: [{ key: 'admin', label: '관리', href: '#/edoc/admin', hint: '결재 정책·기준 정보' }] });
  let current;
  if (seg === 'new' || seg === 'edit') current = 'new'; else if (seg === 'home') current = 'home'; else if (seg === 'admin') current = 'admin';
  else { const tab = q.tab || 'todo'; current = tab === 'mine' && q.status === 'draft' ? 'box/mine/draft' : tab === 'mine' && q.status === 'rejected' ? 'box/mine/rejected' : 'box/' + tab; }   // 결재함·문서 상세는 보던 탭이 현재
  return { label: '전자결재 메뉴', title: '✍ 전자결재', current, sections };
}
