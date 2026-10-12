/* PJT 데이터 접근 어댑터 — 프로젝트 하나(Ph2·Ph4·경량PJT)가 데이터를 어느 경로에 두는지를 한 곳에서 정한다(순수 규칙, 화면·네트워크 없음).
 * 새 PJT 모듈의 화면은 Firestore 경로를 직접 쓰지 않고 이 어댑터가 돌려주는 경로만 쓴다. 그러면 화면과 코드는 한 벌이고, 프로젝트 종류는 "경로 + 켜기/끄기"로만 다르다.
 * 경로는 구포털 PJT 3개 앱이 실제로 쓰는 것을 그대로 옮겼다(동결): 영업기획의 공정 연동·공수 연동·팀별 노무비가 같은 경로를 읽는다 — 이 파일의 값을 바꾸면 그 계산이 어긋난다.
 * 키: 'p4ph2'(FAB) · 'p4ph4'(SUP) · 'reg_<등록 id>'(경량PJT, 앞으로 생길 새 프로젝트도 같은 형식). */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const FIXED_KEYS = ['p4ph2', 'p4ph4'];
/** 키를 풀어 종류와 등록 id 를 돌려준다. 모르는 키·위험한 문자는 null */
export function parseKey(key) {
  const k = String(key == null ? '' : key);
  if (k === 'p4ph2') return { kind: 'p4ph2', id: '' };
  if (k === 'p4ph4') return { kind: 'p4ph4', id: '' };
  if (k.indexOf('reg_') === 0 && ID.test(k.slice(4))) return { kind: 'light', id: k.slice(4) };
  return null;
}
export const keyOfRegistry = (id) => (ID.test(String(id)) ? 'reg_' + id : null);
/** 프로젝트가 켜 둔 기능: 장비 배치도·주간 공정회의 PPT 는 Ph2 에서만 켜져 있다(설정에서 켜는 선택 기능으로 다른 프로젝트도 쓸 수 있게 열어 둔다).
 *  defaultManday: 출역을 체크할 때 공수 칸에 자동으로 넣는 값(경량PJT 는 1, Ph2·Ph4 는 지금까지처럼 자동 입력 없음 = null) */
export function featuresOf(key, settings) {
  const p = parseKey(key); if (!p) return null; const s = settings || {};
  const base = { zones: p.kind !== 'light', layoutMap: p.kind === 'p4ph2', weeklyReportPpt: p.kind === 'p4ph2', defaultManday: p.kind === 'light' ? 1 : null };
  if (s.features) Object.keys(base).forEach((f) => { if (s.features[f] !== undefined) base[f] = s.features[f]; });
  return base;
}
/** 프로젝트의 데이터 경로. 컬렉션은 'a/b/c' 문자열(홀수 토막), 날짜별 문서는 doc(db, 컬렉션, 날짜)로 읽는다 */
export function pathsFor(key) {
  const p = parseKey(key); if (!p) return null;
  if (p.kind === 'p4ph2') return { key, kind: 'p4ph2', label: 'P4 Ph2 (FAB)', settings: { col: 'pjt_settings', id: 'p4ph2' }, roster: 'pjt_workers_fab', attendance: 'worker_attendance', manday: 'worker_manday', schedules: 'user_schedules', reports: 'daily_report_docs',
    progress: { model: 'zones', checks: (d) => 'progress_checks_' + d, checklist: 'checklist_state', layouts: 'zone_layouts' }, legacyReports: (d) => 'daily_reports_' + d };
  if (p.kind === 'p4ph4') return { key, kind: 'p4ph4', label: 'P4 Ph4 (SUP)', settings: { col: 'pjt_settings', id: 'p4ph4' }, roster: 'pjt_workers_ph4', attendance: 'ph4_attendance', manday: 'ph4_manday', schedules: 'ph4_schedules', reports: 'ph4_reports',
    progress: { model: 'zones', checks: (d) => 'ph4_progress_' + d, checklist: 'ph4_checklist', layouts: null }, legacyReports: (d) => 'ph4_daily_' + d };
  const r = 'pjt_registry/' + p.id + '/';
  return { key, kind: 'light', label: '경량PJT', registryId: p.id, settings: { col: 'pjt_registry', id: p.id }, roster: r + 'workers', attendance: r + 'attendance', manday: r + 'manday', schedules: r + 'schedules', reports: r + 'reports',
    progress: { model: 'items', items: r + 'items', checks: r + 'progress_checks', itemChecks: r + 'item_checks' }, legacyReports: null };
}
/** 날짜 키(YYYY-MM-DD) 검사 — 경로에 들어가므로 형식이 맞지 않으면 쓰지 않는다 */
export const isDateKey = (d) => DATE.test(String(d || ''));
/** 한 날짜의 문서 위치 [컬렉션, 문서 id] — 출역·공수·공사일보·일정(날짜 문서가 아닌 일정은 제외) */
export function dayDoc(key, what, dateKey) {
  const P = pathsFor(key); if (!P || !isDateKey(dateKey)) return null;
  if (what === 'attendance') return [P.attendance, dateKey]; if (what === 'manday') return [P.manday, dateKey]; if (what === 'report') return [P.reports, dateKey];
  if (what === 'progress') return P.progress.model === 'zones' ? { collection: P.progress.checks(dateKey), perZone: true } : [P.progress.checks, dateKey];
  return null;
}
