/* 평가 결과 — 불러오기·미리보기·링크 만들기·메일 발송. 발송(링크 생성·메일)은 인사 모듈의 기존 흐름(본인 확인 링크)을 쓰되, 평가 모듈이 인사 모듈을 직접 가져오지 않도록 deps.sendResult / deps.makeResultLink 로 주입받는다(modules/index.js 에서 연결).
 *  원칙: 열 때마다 최신 문서를 다시 읽어 통보서를 만들고, 발송 직전에 한 번 더 만든다(미리보기와 발송 내용이 어긋나지 않게). 확정되지 않은 평가는 만들지 않는다. */
import { isEvalTarget, teamTypeOf, cycleSummary, areaItems } from './evaluation.js?v=20261031a';
import { buildResultData, resultHtml, RESULT_DOC_TYPE, RESULT_TITLE, resultPrintHtml, resultPrintTitle } from './result-report.js?v=20261031a';
import { maskEmail } from '../../shared/mask.js?v=20261031a';
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
/** deps: { db, collection, getDocs, getDoc, doc, toast, confirmDialog, paint, st, ctx, sendResult({ workerId, workerName, html, title, year }) → { ok, email, cancelled }, makeResultLink({ workerId, workerName, html, title }) → token, showLink(token, 이름), mailOn } */
export function createResultController(deps) {
  const { db, collection, getDocs, getDoc, doc, toast, confirmDialog, paint, st, ctx } = deps; const me = (ctx && ctx.me) || {}; const year = deps.year || 2026;
  st.rs = { year, rows: [], sel: '', preview: null, sent: {}, canSend: me.admin === true, mailOn: !!deps.mailOn, busy: false };
  const cycOf = async (wid) => { try { const s = await getDoc(doc(db, 'evaluations/' + wid + '/cycles/' + year)); return s.exists() ? s.data() : null; } catch (e) { return null; } };
  /** 한 직원의 통보서 자료를 지금 읽어서 만든다: 정기평가 문서 + 수시평가 문서들(+ 프로젝트 성과 문서) */
  const build = async (w) => {
    const cycle = await cycOf(w.id); let adhoc = [];
    try { const s = await getDocs(collection(db, 'evaluations/' + w.id + '/adhoc')); const recs = []; s.forEach((d) => recs.push(Object.assign({ pid: d.id }, d.data())));
      adhoc = await Promise.all(recs.map(async (rec) => { let proj = null; try { const ps = await getDoc(doc(db, 'evaluations/_pjt/adhoc/' + rec.pid)); proj = ps.exists() ? ps.data() : null; } catch (e) { /* 프로젝트 성과 없음 */ } return { pjtName: rec.pjtName || (proj && proj.pjtName) || rec.pid, rec, proj }; })); } catch (e) { adhoc = []; }
    return buildResultData({ year, worker: w, cycle, adhoc });
  };
  const load = async () => {
    const ws = (st.evWorkers || []).filter((w) => isEvalTarget(w, year));
    st.rs.rows = await Promise.all(ws.map(async (w) => { const cycle = await cycOf(w.id); let sm = null; if (cycle) sm = cycleSummary(cycle, { teamType: teamTypeOf(w.dept), items: areaItems(w.dept, w.rank) });
      const base = { id: w.id, name: w.name || '', dept: w.dept || '', rank: w.rank || '' };
      if (!cycle) return Object.assign(base, { ok: false, reason: '평가 기록 없음' });
      if (sm.final == null) return Object.assign(base, { ok: false, reason: '확정 전' });
      return Object.assign(base, { ok: true, final: sm.final, grade: sm.grade }); }));
  };
  const workerOf = (id) => (st.evWorkers || []).find((w) => w.id === id);
  const open = async (id) => {
    const w = workerOf(id); if (!w) return; st.rs.busy = true; paint();
    try { const r = await build(w); if (!r.ok) { toast(r.reason); st.rs.busy = false; paint(); return; } st.rs.sel = id; st.rs.preview = { data: r.data, html: resultHtml(r.data, { today: kstToday() }) }; }
    catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); }
    st.rs.busy = false; paint(); mountFrame();
  };
  /** 미리보기 iframe 에 문서를 넣는다 — 속성이 아니라 프로퍼티로(이스케이프한 글자가 되살아나지 않게) */
  const mountFrame = () => { try { const f = (deps.root || document).querySelector('[data-rs-frame]'); if (f && st.rs.preview) f.srcdoc = st.rs.preview.html; } catch (e) { /* 화면 없음 */ } };
  /** 발송·링크 직전에 다시 만든다 — 미리보기를 열어 둔 사이 평가가 바뀌었거나 확정이 취소됐으면 중단 */
  const rebuild = async () => { const w = workerOf(st.rs.sel); if (!w) return null; const r = await build(w); if (!r.ok) { toast('지금은 통보할 수 없습니다: ' + r.reason); return null; } const html = resultHtml(r.data, { today: kstToday() }); if (st.rs.preview && html !== st.rs.preview.html) { st.rs.preview = { data: r.data, html }; paint(); mountFrame(); toast('평가 내용이 바뀌어 미리보기를 새로 만들었습니다. 내용을 확인한 뒤 다시 눌러 주세요.'); return null; } return { w, r, html }; };
  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const rs = st.rs;
    const op = t.closest('[data-rs-open]'); if (op) { await open(op.getAttribute('data-rs-open')); return true; }
    const b = t.closest('[data-rs-act]'); if (!b) return false; const act = b.getAttribute('data-rs-act');
    if (act === 'back') { rs.sel = ''; rs.preview = null; paint(); return true; }
    /* 인쇄(대기열 1-2-7 ②): 미리보기는 sandbox="" iframe 이라 바깥에서 contentWindow.print() 를 부를 수 없어(교차 출처 차단) 예전 버튼은 늘 안내만 보여 줬다 → 영업기획 문서처럼 새 창에 인쇄용 문서(제목 = 문서 이름)를 쓴다. 직원에게 가는 resultHtml 은 바꾸지 않는다 */
    if (act === 'print') { const pv = rs.preview; if (!pv) { toast('미리보기를 불러온 뒤 다시 눌러 주세요.'); return true; } try { const w = (deps.openWindow || ((u, n) => window.open(u, n)))('', '_blank'); if (!w) { toast('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러 주세요.'); return true; } w.document.write(resultPrintHtml(pv.html, resultPrintTitle(pv.data))); w.document.close(); } catch (e) { toast('인쇄 창을 열지 못했습니다. 팝업을 허용했는지 확인해 주세요.'); } return true; }
    if (!rs.canSend) { toast('통보서 발송은 관리자 계정만 할 수 있습니다.'); return true; } if (rs.busy) return true;
    if (act === 'link' || act === 'mail') {
      rs.busy = true; paint(); mountFrame();
      try {
        const cur = await rebuild(); if (!cur) { rs.busy = false; paint(); mountFrame(); return true; }
        if (act === 'link') { const token = await deps.makeResultLink({ workerId: cur.w.id, workerName: cur.w.name, html: cur.html, title: RESULT_TITLE }); deps.showLink(token, cur.w.name); }
        else {
          if (!deps.mailOn) { toast('테섭에서는 메일 발송이 꺼져 있습니다. "링크 만들기"로 확인해 주세요. 본섭에서는 발송됩니다.'); }
          else { const ok = await confirmDialog({ title: '결과 통보서 발송', body: cur.w.name + '님에게 ' + year + '년 인사평가 결과 통보서 확인 링크를 메일로 보냅니다.\n메일에는 점수가 없고, 링크를 열면 등록된 휴대폰 번호로 본인 확인(문자 인증)을 한 뒤에만 결과가 보입니다.', confirmLabel: '발송' }); if (ok && ok.ok) { const r = await deps.sendResult({ workerId: cur.w.id, workerName: cur.w.name, html: cur.html, title: RESULT_TITLE, year }); if (r && r.ok) rs.sent[cur.w.id] = new Date().toTimeString().slice(0, 5) + (r.email ? ' · ' + maskEmail(r.email) : ''); } }
        }
      } catch (e) { toast((e && e.message) || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
      rs.busy = false; paint(); mountFrame(); return true;
    }
    return false;
  };
  return { load, onClick, RESULT_DOC_TYPE };
}
