/* PJT 프로젝트 키 규칙(순수) — 모든 프로젝트의 키는 pjt_registry 문서 id 그대로다(예: p4ph2 · p4ph4 · 새로 만든 프로젝트의 문서 id).
 * 메뉴의 프로젝트가 아닌 칸(PJT 전체 홈·종료 PJT·근로자 연명부)은 프로젝트 키로 쓸 수 없다. PJT 모듈의 어댑터와 구포털 틀(메뉴)이 같은 규칙을 쓴다. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const RESERVED_KEYS = ['home', 'ended', 'roster'];
export const isProjectKey = (k) => { const s = String(k == null ? '' : k); return ID.test(s) && RESERVED_KEYS.indexOf(s) === -1; };
