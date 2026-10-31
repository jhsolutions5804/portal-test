/* 캡스 업로드 — 파일 읽기·포털 기존 근태 불러오기·일괄 저장(파이어스토어는 주입). 시험: tests/hr-caps-import.test.mjs(가짜 주입) */
import { parseCapsRows, capsMonths, buildCapsPlan } from './caps-import.js?v=20261031h';
import { capsInit } from './caps-view.js?v=20261031h';
const BATCH = 400; // 한 번에 쓰는 문서 수(파이어스토어 한도 500 미만)
export function makeCapsIo({ db, collection, getDocs, query, where, writeBatch, doc, serverTimestamp, readSpreadsheet }) {
  const loadExisting = async (months) => { const m = new Map(); for (const ym of months) { const s = await getDocs(query(collection(db, 'worker_attendance_log'), where('yearMonth', '==', ym))); s.forEach((d) => m.set(d.id, d.data())); } return m; };
  return {
    loadExisting,
    async readFile(file) { const wb = await readSpreadsheet(await file.arrayBuffer()); let last = null; for (const sh of (wb && wb.sheets) || []) { const r = parseCapsRows(sh.rows); if (r.ok) return r; last = r; } return last || parseCapsRows([]); },
    async save(plan, onProgress) { const w = plan.writes; let n = 0; for (let i = 0; i < w.length; i += BATCH) { const b = writeBatch(db); w.slice(i, i + BATCH).forEach((it) => b.set(doc(db, 'worker_attendance_log', it.key), Object.assign({}, it.data, { source: 'caps', capsAppliedAt: serverTimestamp(), updatedAt: serverTimestamp() }), { merge: true })); await b.commit(); n += Math.min(BATCH, w.length - i); if (onProgress) onProgress(n, w.length); } return n; }
  };
}
/** 기본 시작일 = 포털에 근태 기록이 있는 가장 이른 달의 1일(없으면 파일 시작일). 종료일 = 파일 마지막 날(오늘 이후는 잘림) */
export function capsDefaultRange(parse, existing, today) { const f = parse.stats.from, t = parse.stats.to; const yms = [...existing.keys()].map((k) => (existing.get(k) && existing.get(k).yearMonth) || '').filter(Boolean).sort(); const first = yms.find((ym) => ym + '-01' >= f.slice(0, 7) + '-01'); return { from: first ? first + '-01' : f, to: today && t > today ? today : t }; }
/** 근로시간 화면에 연결하는 동작 묶음 — st.caps 에 상태를 두고 paint() 로 다시 그린다 */
export function capsActions({ st, io, paint, toast, reload, workers, today }) {
  const ensure = () => { if (!st.caps) st.caps = capsInit(); return st.caps; };
  const plan = (c) => { c.plan = buildCapsPlan({ records: c.parse.records, workers: workers(), existing: c.existing, from: c.from, to: c.to, today: today() }); };
  return {
    async change(t) {
      const c = ensure();
      if (t.matches('[data-caps-file]')) {
        const file = t.files && t.files[0]; if (!file) return; Object.assign(c, capsInit(), { fileName: file.name, busy: true, progress: '파일을 읽는 중…' }); paint();
        try {
          const r = await io.readFile(file); if (!r.ok) { Object.assign(c, { busy: false, err: r.error, stage: 'pick' }); paint(); return; } c.parse = r; c.progress = '포털의 기존 근태를 불러오는 중…'; paint();
          c.existing = await io.loadExisting(capsMonths(r.stats.from, r.stats.to)); const rg = capsDefaultRange(r, c.existing, today()); c.from = rg.from; c.to = rg.to; plan(c); c.stage = 'preview'; c.busy = false; c.progress = ''; paint();
        } catch (e) { Object.assign(c, { busy: false, err: '파일을 처리하지 못했습니다: ' + ((e && (e.message || e.code)) || String(e)), stage: 'pick' }); paint(); }
        return;
      }
      if (!c.parse) return; if (t.matches('[data-caps-from]')) c.from = t.value; if (t.matches('[data-caps-to]')) c.to = t.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(c.from) && /^\d{4}-\d{2}-\d{2}$/.test(c.to) && c.from <= c.to) { c.err = ''; plan(c); } else c.err = '반영할 기간을 올바르게 입력해 주세요(시작일이 종료일보다 늦을 수 없습니다).'; paint();
    },
    async click(act) {
      const c = ensure(); if (act === 'reset') { st.caps = capsInit(); paint(); return; }
      if (act === 'save') {
        if (!c.plan || c.busy || !c.plan.writes.length) return; c.busy = true; c.err = ''; c.progress = '저장 중… 0/' + c.plan.writes.length; paint();
        try { const n = await io.save(c.plan, (a, b) => { c.progress = '저장 중… ' + a + '/' + b; paint(); }); c.busy = false; c.progress = ''; c.stage = 'done'; c.saved = { n }; toast('캡스 근태 ' + n + '건을 반영했습니다.'); if (reload) await reload(); paint(); /* 이 화면의 reload 는 데이터만 다시 불러오고 그리지 않는다 — 반드시 뒤에 paint */ }
        catch (e) { c.busy = false; c.progress = ''; c.err = '저장하지 못했습니다(일부만 저장됐을 수 있으니 같은 파일을 다시 올려 미리보기를 확인하세요): ' + ((e && (e.message || e.code)) || String(e)); paint(); }
      }
    }
  };
}
