/* PJT 데이터 접근 어댑터 — 모든 프로젝트가 같은 저장 구조를 쓴다(순수 규칙, 화면·네트워크 없음).
 * 프로젝트 하나 = pjt_registry/<id> 문서 하나 + 그 아래 하위 컬렉션들. 프로젝트 키는 등록 id 그대로이고(예: p4ph2 · p4ph4 · 새로 만든 프로젝트의 문서 id), 프로젝트마다 다른 것은 내용(구조·설정값·데이터)뿐이다 —
 * 코드에는 "프로젝트 종류"가 없다. 화면은 Firestore 경로를 직접 쓰지 않고 이 어댑터의 경로만 쓴다.
 *   pjt_registry/<id>                      프로젝트 문서(기본정보·상태·참여자·progressStructure·defaultManday)
 *   pjt_registry/<id>/workers/<근로자 id>   참여 근로자 명부
 *   pjt_registry/<id>/attendance/<날짜>     출역 { checks }          pjt_registry/<id>/manday/<날짜>   공수 { md }
 *   pjt_registry/<id>/progress_days/<날짜>  그날 새로 체크한 공정 { groups: { <섹터 id>: { '<품목>_<단계>': true } } }
 *   pjt_registry/<id>/schedules/<일정 id>   일정               pjt_registry/<id>/reports/<날짜>  공사일보
 *   pjt_registry/<id>/layouts/<섹터 id>     장비 배치도 { points, image? }
 * 이 구조는 영업기획의 공정·공수 연동과 포털 홈 통합 캘린더가 함께 읽는다 — 바꾸면 그 계산이 어긋난다. */
import { isProjectKey, RESERVED_KEYS } from '../../shared/pjt-key.js?v=20261031h';
export { isProjectKey, RESERVED_KEYS };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 프로젝트의 데이터 경로. 컬렉션은 'a/b/c' 문자열(홀수 토막), 날짜별 문서는 doc(db, 컬렉션, 날짜)로 읽는다. 모르는 키·위험한 문자는 null */
export function pathsFor(key) {
  if (!isProjectKey(key)) return null; const r = 'pjt_registry/' + key + '/';
  return { key, id: key, settings: { col: 'pjt_registry', id: key }, roster: r + 'workers', attendance: r + 'attendance', manday: r + 'manday', schedules: r + 'schedules', reports: r + 'reports', progress: { days: r + 'progress_days', layouts: r + 'layouts' } };
}
/** 날짜 키(YYYY-MM-DD) 검사 — 경로에 들어가므로 형식이 맞지 않으면 쓰지 않는다 */
export const isDateKey = (d) => DATE.test(String(d || ''));
/** 한 날짜의 문서 위치 [컬렉션, 문서 id] — 출역·공수·공정·공사일보 */
export function dayDoc(key, what, dateKey) {
  const P = pathsFor(key); if (!P || !isDateKey(dateKey)) return null;
  if (what === 'attendance') return [P.attendance, dateKey]; if (what === 'manday') return [P.manday, dateKey]; if (what === 'report') return [P.reports, dateKey]; if (what === 'progress') return [P.progress.days, dateKey];
  return null;
}
/** 프로젝트가 켜 둔 선택 기능(구조 데이터의 features): 장비 배치도·주간 공정회의 PPT — 정하지 않았으면 꺼짐. 모든 프로젝트가 같은 기본값이고 설정에서만 바꾼다 */
export function featuresOf(features) { const f = features || {}; return { layoutMap: f.layoutMap === true, weeklyReportPpt: f.weeklyReportPpt === true }; }
/** 출역을 체크할 때 공수 칸에 자동으로 넣는 값(프로젝트 문서의 defaultManday) — 정하지 않았으면 자동 입력 없음(null). 프로젝트마다 설정에서 정한다 */
export function defaultMandayOf(projDoc) { const v = projDoc && projDoc.defaultManday; return typeof v === 'number' && isFinite(v) && v > 0 ? v : null; }
