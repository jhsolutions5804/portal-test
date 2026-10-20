/* PJT 설정 — 순수 규칙(화면·네트워크 없이 시험 가능): 기본정보 폼 ↔ 프로젝트 문서, 검증, 변경 요약.
 * 저장 위치(동결): pjt_registry/<id> — 모든 프로젝트 같은 필드(code·name·site·client·contractor·partner·content·item·qty·startDate). 관리자 전용. */
export const FIELDS = [['code', 'PJT 코드'], ['name', '프로젝트명'], ['site', '현장명'], ['client', '거래처(발주처)'], ['contractor', '시공사'], ['partner', '협력사'], ['content', 'PJT 내용'], ['item', '품목'], ['qty', '물량'], ['startDate', '공사 시작일']];
const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ''));
const str = (v) => String(v == null ? '' : v).trim();
/** 프로젝트 문서 → 폼 값(없으면 빈 문자열) */
export function formOf(doc) { const d = doc || {}; const f = {}; FIELDS.forEach(([k]) => { f[k] = k === 'qty' ? (d.qty != null && d.qty !== '' ? String(d.qty) : '') : str(d[k]); }); return f; }
/** 폼 값 → 저장할 필드. 프로젝트명은 필수(메뉴 이름), 물량은 0 이상의 정수, 시작일은 날짜 형식 */
export function buildData(form) {
  const f = form || {}; const data = {}; FIELDS.forEach(([k]) => { if (k !== 'qty') data[k] = str(f[k]); });
  if (!data.name) return { error: '프로젝트명을 입력하세요.' };   // 메뉴·화면에 표시되는 이름 — 모든 프로젝트 필수
  const q = str(f.qty); if (q !== '' && !/^\d+$/.test(q)) return { error: '물량은 0 이상의 정수로 입력하세요.' }; data.qty = q === '' ? 0 : parseInt(q, 10);
  if (data.startDate && !isKey(data.startDate)) return { error: '공사 시작일 형식이 올바르지 않습니다.' };
  return { data };
}
/** 저장 전 변경 요약: 바뀐 항목의 이름 목록 */
export function changedFields(doc, form) { const a = formOf(doc), b = formOf(Object.assign({}, form)); const bd = buildData(form); const nb = bd.data ? formOf(bd.data) : b; const n = (k, v) => (k === 'qty' && (v === '' || v === '0') ? '0' : v); return FIELDS.filter(([k]) => n(k, a[k]) !== n(k, nb[k])).map(([, l]) => l); }   // 물량이 비어 있는 것과 0 은 같은 값
/** 출역 체크 시 공수 칸에 자동으로 넣는 값(프로젝트 문서의 defaultManday): 빈 값 = 자동 입력 없음, 0 보다 큰 숫자(0.5 단위가 아니어도 됨, 상한 없음) */
export function parseDefaultManday(v) { const t = String(v == null ? '' : v).trim(); if (t === '') return { value: null }; const n = Number(t); if (!isFinite(n) || n <= 0) return { error: '자동 공수는 0 보다 큰 숫자로 입력하세요(비우면 자동 입력 없음).' }; return { value: Math.round(n * 10) / 10 }; }
export const endText = (ended, label) => (ended ? '"' + label + '" 프로젝트를 다시 진행 중으로 되돌립니다. 위 메뉴의 프로젝트 목록에 다시 나타납니다.' : '"' + label + '" 프로젝트를 종료 처리합니다. 위 메뉴의 프로젝트 목록에서 "종료 PJT"로 이동하고, 일정·공정·출역·공사일보 화면은 열 수 없게 됩니다(데이터는 그대로 보존됩니다).');
