/* PJT 프로젝트 홈 — 순수 규칙(화면·네트워크 없이 시험 가능): 시작일 D+, 이달 누적 공수, 최근 공사일보, 기본정보 표시.
 * 홈은 프로젝트를 고르면 처음 보이는 새 화면이다(구포털 홈 탭의 요약 카드·바로가기·기본정보를 모든 프로젝트 같은 형식으로). */
const ms = (k) => { const [y, m, d] = String(k).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ''));
/** 시작일부터 오늘까지 지난 일수(시작일 당일 = 0). 시작일이 없거나 잘못되면 null, 시작 전이면 음수 */
export function dday(startDate, today) { if (!isKey(startDate) || !isKey(today)) return null; return Math.round((ms(today) - ms(startDate)) / 86400000); }
/** 이달 누적 공수: 그 달(YYYY-MM)의 날짜별 공수 맵들의 합계(명부 밖 사람의 공수도 집계표와 같게 포함). mdByDay = { 'YYYY-MM-DD': md 맵 } */
export function monthMandayTotal(mdByDay, ym) { let t = 0; Object.keys(mdByDay || {}).forEach((k) => { if (k.slice(0, 7) !== ym) return; Object.keys(mdByDay[k] || {}).forEach((id) => { t += parseFloat(mdByDay[k][id]) || 0; }); }); return Math.round(t * 10) / 10; }
/** 최근 공사일보 n개(날짜 내림차순): docs = [{ id(날짜 키), data }] → [{ date, author, content, note }] — 옛 형식 문서도 읽는다 */
export function latestReports(docs, n) {
  return (docs || []).filter((d) => isKey(d.id)).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, n || 3).map((d) => { const x = d.data || {}; const legacy = x.content === undefined && (x.today !== undefined || x.remarks !== undefined);
    return { date: d.id, author: String(x.author || ''), content: String((legacy ? x.today : x.content) || ''), note: String((legacy ? x.remarks : x.note) || '') }; });
}
/** 기본정보 표시용 값(프로젝트 문서 → 줄 목록): 없으면 "미설정". 고정 프로젝트(pjt_settings)와 경량(pjt_registry) 문서의 필드가 같다 */
export function infoRows(doc, unit) {
  const d = doc || {}; const v = (x) => (x != null && String(x).trim() !== '' ? String(x) : '미설정'); const rows = [['현장명', v(d.site)], ['프로젝트명', v(d.name)], ['거래처(발주처)', v(d.client)], ['PJT 내용', v(d.content)], ['품목', v(d.item)], ['물량', d.qty != null && d.qty !== '' ? d.qty + (unit || '대') : '미설정'], ['공사 시작일', v(d.startDate)]];
  if (d.contractor) rows.splice(3, 0, ['시공사', String(d.contractor)]); if (d.partner) rows.splice(4, 0, ['협력사', String(d.partner)]); return rows;
}
export const statusLabel = (doc) => (doc && doc.status === 'ended' ? '종료' : '진행 중');
