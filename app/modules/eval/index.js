/* 평가 모듈 — 내 평가(전 직원, 폰에서도 작성)와 평가 운영(사장단·인사팀: 정기평가·수시평가).
 * 인사 모듈에서 분리한 이유: 인사 모듈은 모듈 전체가 관리자 전용이고 화면 단위 권한이 없어, 인사총무팀 일부(비관리자)에게 열면
 * 급여명세서·근로계약서·연봉계약서·주민번호 화면이 주소로 열릴 수 있다(설계서 docs/hr-evaluation-design.md 9-1절).
 * 규약: 다른 모듈을 직접 불러오지 않는다(권한 판정은 shared/eval-perm.js, 청구·지급 요약은 shared/pjt-summary.js). */
import { esc } from '../../core/ui.js?v=20261031a';
import { isEvalUser } from '../../shared/eval-perm.js?v=20261031a';
import { mountOps } from './ops.js?v=20261031a';
import { mountMine } from './mine.js?v=20261031a';

export const manifest = { id: 'eval', order: 47, title: '평가', icon: '📝', defaultHash: '#/eval/mine', perm: isEvalUser };

/** route.segs[0] = 화면: mine(내 평가) · cycle(정기평가 운영) · adhoc(수시평가) · result(평가 결과 통보 — 관리자·인사팀) */
export async function mount(root, route, ctx, extra) {
  const me = (ctx && ctx.me) || {}; const key = (route && route.segs && route.segs[0]) || 'mine';
  if (!isEvalUser(me)) { root.innerHTML = '<div class="jh-card"><div class="jh-empty">평가는 정직원 계정으로만 열 수 있습니다.</div></div>'; return; }
  if (key === 'cycle' || key === 'adhoc' || key === 'result') return mountOps(root, key, ctx, extra);
  if (key === 'mine') return mountMine(root, ctx);
  root.innerHTML = '<div class="jh-card"><div class="jh-empty">' + esc(key) + ' 화면을 찾을 수 없습니다.</div></div>';
}
