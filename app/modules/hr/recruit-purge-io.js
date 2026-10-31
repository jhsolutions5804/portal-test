/* 지원서 파기·공고 설정 입출력 — 파이어베이스 함수는 밖에서 주입(시험: tests/hr-recruit-purge-io.test.mjs). 파기는 누르는 순간 문서와 공고를 다시 읽어 "기한이 지난 지원서"만 지운다(화면을 열어 둔 사이 상태가 바뀐 경우 방지). */
import { purgeInfo, destroyDoc, settingsPatch } from './recruit-purge.js?v=20261031d';

export function makePurgeIo(fb) {
  const { db, doc, getDoc, updateDoc, writeBatch, serverTimestamp } = fb;
  const whoOf = (by) => { const w = String(by || '').trim().toLowerCase(); if (!w) throw new Error('작업하는 사람의 이메일을 알 수 없습니다. 다시 로그인해 주세요.'); return w; };
  /** 공고 설정 저장 — 채용 확정일·보관기간 */
  async function saveSettings(postingId, decidedDate, retentionDays) {
    if (!postingId) throw new Error('공고를 찾을 수 없습니다.'); const r = settingsPatch(decidedDate, retentionDays); if (!r.ok) throw new Error(r.errors[0]);
    await updateDoc(doc(db, 'job_postings', postingId), Object.assign({}, r.data, { updatedAt: serverTimestamp() })); return r.data;
  }
  /** 파기 — ids: 지원서 문서 id 목록. 다시 읽어 상태가 "기한 지남(due)"인 것만 최소 기록으로 교체하고 나머지는 이유와 함께 건너뛴다 */
  async function destroy(ids, by, today) {
    const who = whoOf(by); const out = { destroyed: 0, destroyedIds: [], skipped: [] }; const jobs = {}; const ok = [];
    for (const id of ids || []) {
      const s = await getDoc(doc(db, 'recruit_applicants', id)); if (!s.exists()) { out.skipped.push({ id, reason: '지원서를 찾을 수 없음' }); continue; }
      const a = Object.assign({ id }, s.data()); if (a.jobKey && !(a.jobKey in jobs)) { const p = await getDoc(doc(db, 'job_postings', a.jobKey)); jobs[a.jobKey] = p.exists() ? Object.assign({ id: a.jobKey }, p.data()) : null; }
      const info = purgeInfo(a, a.jobKey ? jobs[a.jobKey] : null, today);
      if (info.state !== 'due') { out.skipped.push({ id, reason: info.state === 'done' ? '이미 파기됨' : info.state === 'kept' ? '합격자는 파기하지 않음' : '아직 파기 기한이 지나지 않음(' + info.state + ')' }); continue; }
      ok.push(a);
    }
    for (let i = 0; i < ok.length; i += 400) { const batch = writeBatch(db); ok.slice(i, i + 400).forEach((a) => batch.set(doc(db, 'recruit_applicants', a.id), destroyDoc(a, who, new Date().toISOString()))); await batch.commit(); }
    out.destroyed = ok.length; out.destroyedIds = ok.map((a) => a.id); return out;
  }
  return { saveSettings, destroy };
}
