/* PJT 관리(통합 새 모듈) — 설계서 docs/pjt-design.md. Ph2·Ph4·경량PJT를 한 모듈로 합친다.
 * 지금은 데이터 접근 어댑터(adapter.js)와 근태·공수 규칙(attendance.js)만 있고 화면은 아직 없다 — 사이드바에는 올리지 않았다(modules/index.js 의 MODULES 에 없음).
 * 근태·공수 화면을 만든 뒤 구포털 PJT 항목(legacy/list.js 의 pjt)과 교체한다. manifest 는 모듈 규약상 남겨 둔다. */
export const manifest = { id: 'pjt', order: 40, title: 'PJT 관리', icon: '🏗️', defaultHash: '#/pjt/home', perm: (me) => !!me && me.admin === true };
export async function mount(root) { root.innerHTML = '<div class="jh-empty">PJT 새 모듈은 준비 중입니다.</div>'; }
