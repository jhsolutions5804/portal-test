// 업무일지 일괄 결재(대기열 2-5-104) — 화면과 분리한 순수 계산. 서버는 건별 승인 그대로 쓴다(결재 기록·알림이 건별과 똑같다).
import { myTurn } from './logic.js?v=20261113b';

/** 일괄 결재를 허용하는 문서 종류(업무일지만 — 연차·지출·구매는 내용을 보고 결재해야 한다) */
export const BULK_DTYPES = ['daily'];
/** 한 번에 처리하는 최대 건수(넘으면 나눠서 한다) */
export const BULK_MAX = 50;
/** 연속으로 이만큼 실패하면 멈춘다(권한·네트워크 문제에 계속 두드리지 않는다) */
export const BULK_STOP_AFTER = 3;

const keyOf = (d) => d.dtype + '/' + d.id;

/** 일괄 결재 대상인가: 결재 중인 업무일지이고 지금이 **내 차례**일 때만(대리 승인은 문서를 열어 건별로) */
export function bulkEligible(d, me) {
  return !!d && BULK_DTYPES.indexOf(d.dtype) !== -1 && d.status === 'pending' && myTurn(d, me) === true;
}

/** 목록에서 대상만 오래된 순으로 */
export function bulkTargets(docs, me) {
  return (docs || []).filter((d) => bulkEligible(d, me)).sort((a, b) => (Number(a._ms) || 0) - (Number(b._ms) || 0));
}

/** 확인 창에 보일 요약: 건수와 작성자별 건수(많은 순) */
export function bulkSummary(items) {
  const m = new Map();
  (items || []).forEach((d) => { const n = d.authorName || '-'; m.set(n, (m.get(n) || 0) + 1); });
  return { count: (items || []).length, byAuthor: Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')) };
}

/** 확인 창 본문 */
export function bulkConfirmBody(items) {
  const s = bulkSummary(items);
  const parts = s.byAuthor.map((a) => a.name + ' ' + a.count + '건').join(', ');
  return '업무일지 ' + s.count + '건을 한 번에 승인합니다.\n' + parts + '\n\n내용을 열어 보지 않은 문서도 승인됩니다. 반려가 필요한 문서는 제외하고 문서를 열어 건별로 반려해 주세요.' + (s.count > BULK_MAX ? '\n(' + BULK_MAX + '건씩 나눠서 처리합니다.)' : '');
}

/** 앞에서 BULK_MAX 건씩 나눔 */
export function bulkChunks(items) {
  const out = []; for (let i = 0; i < (items || []).length; i += BULK_MAX) out.push(items.slice(i, i + BULK_MAX)); return out;
}

/**
 * 건별 승인 호출을 순서대로 반복한다(동시 호출 없음).
 * act: ({dtype, docId, action:'approve', comment}) → Promise   items: 문서 배열
 * opts: { onProgress(done, total, key, ok), shouldCancel() → boolean, comment }
 * 반환: { ok: [key], failed: [{key, message}], stopped: boolean, remaining: [key] }
 */
export async function runBulk(items, act, opts) {
  const o = opts || {}; const ok = []; const failed = []; let streak = 0; let stopped = false;
  const list = items || [];
  for (let i = 0; i < list.length; i++) {
    if (typeof o.shouldCancel === 'function' && o.shouldCancel()) { stopped = true; break; }
    const d = list[i]; const key = keyOf(d);
    try {
      await act({ dtype: d.dtype, docId: d.id, action: 'approve', comment: o.comment || '' });
      ok.push(key); streak = 0;
      if (typeof o.onProgress === 'function') o.onProgress(i + 1, list.length, key, true);
    } catch (e) {
      failed.push({ key, message: (e && e.message) || '승인하지 못했습니다.' }); streak++;
      if (typeof o.onProgress === 'function') o.onProgress(i + 1, list.length, key, false);
      if (streak >= BULK_STOP_AFTER) { stopped = true; break; }
    }
  }
  const done = new Set(ok.concat(failed.map((f) => f.key)));
  return { ok, failed, stopped, remaining: list.filter((d) => !done.has(keyOf(d))).map(keyOf) };
}

/** 결과를 한 줄로 */
export function bulkResultText(r) {
  let t = r.ok.length + '건을 승인했습니다.';
  if (r.failed.length) t += ' 실패 ' + r.failed.length + '건: ' + r.failed.slice(0, 3).map((f) => f.message).join(' / ') + (r.failed.length > 3 ? ' 외' : '');
  if (r.stopped && r.remaining.length) t += ' (연속 실패로 ' + r.remaining.length + '건은 처리하지 않고 멈췄습니다.)';
  return t;
}
