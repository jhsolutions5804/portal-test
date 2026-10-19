// 평가 결과 통보 — 불러오기·미리보기·발송 전 재확인·권한·테섭 차단(가짜 Firestore·가짜 발송 함수)
import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { JSDOM } = require('../scripts/dev/node_modules/jsdom');
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const IO = await import('../app/modules/eval/result-io.js?v=' + VER), VW = await import('../app/modules/eval/result-view.js?v=' + VER), E = await import('../app/modules/eval/evaluation.js?v=' + VER), RR = await import('../app/modules/eval/result-report.js?v=' + VER);
const MK = await import('../app/shared/mask.js?v=' + VER); const SG = await import('../app/modules/hr/sign.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>'); const root = dom.window.document.getElementById('root'); globalThis.Element = dom.window.Element; globalThis.document = dom.window.document;
// ── 가짜 저장소(경로 → 문서)와 문서 모양
const W = (id, name, dept, rank) => ({ id, name, dept, rank, empNo: 'E' + id, hireDate: '2023-01-01', status: 'active' }); const workers = [W('w1', '도하린', 'PJT팀', '사원'), W('w2', '강바다', 'PJT팀', '사원'), W('w3', '김철수', 'PJT팀', '대리')];
const itP = (r) => E.areaItems('PJT팀', r); const conf = (w, areas, o) => Object.assign(E.emptyCycle(w, 2026), { leadAgg: { areas, n: 1, by: 'uL' }, peerAgg: { avg: 4, n: 3 }, ceo: { approved: true }, confirmed: true, self: { text: '메모 ' + w.name } }, o || {});
const mkDb = () => { const data = { 'evaluations/w1/cycles/2026': conf(workers[0], { achievement: 4, competency: 5, conduct: 3 }), 'evaluations/w2/cycles/2026': conf(workers[1], { achievement: 3, competency: 3, conduct: 3 }, { confirmed: false }) }; return { data, reads: [], db: {}, doc: (_, p) => ({ p }), collection: (_, p) => ({ p }), getDoc: async (r) => { dbx.reads.push(r.p); const v = dbx.data[r.p]; return { exists: () => v !== undefined, data: () => JSON.parse(JSON.stringify(v)) }; }, getDocs: async (r) => { const pre = r.p + '/'; const ks = Object.keys(dbx.data).filter((k) => k.startsWith(pre) && !k.slice(pre.length).includes('/')); dbx.reads.push(r.p + '/*'); return { forEach: (f) => ks.forEach((k) => f({ id: k.slice(pre.length), data: () => JSON.parse(JSON.stringify(dbx.data[k])) })) }; } }; };
let dbx = mkDb();
const mkCtl = async (o) => { dbx = mkDb(); const st = { evWorkers: workers }; const calls = { send: [], link: [], show: [], toast: [], dialog: [], paints: 0 }; let confirmAnswer = true;
  const deps = Object.assign({ db: dbx.db, collection: dbx.collection, getDocs: dbx.getDocs, getDoc: dbx.getDoc, doc: dbx.doc, toast: (m) => calls.toast.push(m), confirmDialog: async (x) => { calls.dialog.push(x); return { ok: confirmAnswer }; }, paint: () => { calls.paints++; root.innerHTML = st.rs.preview ? VW.resultPanelHtml(st) : VW.resultBoardHtml(st); }, st, ctx: { me: { uid: 'u1', admin: true, rank: '대리' } }, root, mailOn: true,
    sendResult: async (x) => { calls.send.push(x); return { ok: true, email: 'kimyoungseo@example.com' }; }, makeResultLink: async (x) => { calls.link.push(x); return 'TOKEN123'; }, showLink: (t, n) => calls.show.push([t, n]) }, o || {});
  const c = IO.createResultController(deps); await c.load(); deps.paint(); return { c, st, calls, setConfirm: (v) => { confirmAnswer = v; }, click: async (sel) => { const el = root.querySelector(sel); if (!el) throw new Error('버튼 없음: ' + sel); return c.onClick({ target: el }); } }; };
// ── 목록
{ const t = await mkCtl(); const rows = Object.fromEntries(t.st.rs.rows.map((r) => [r.id, r]));
  ok(rows.w1.ok && rows.w1.final === 80 && rows.w1.grade === 'A' && !rows.w2.ok && rows.w2.reason === '확정 전' && !rows.w3.ok && rows.w3.reason === '평가 기록 없음', '★ 목록: 확정된 직원만 통보 가능(도하린 80점·A), 확정 전(강바다)·기록 없음(김철수)은 사유와 함께 막힘');
  ok(root.textContent.includes('확정 1명 / 대상 3명') && root.querySelectorAll('[data-rs-open]').length === 1 && root.textContent.includes('점수가 아니라 본인 확인 링크'), '화면: 확정 1명 / 대상 3명, "보기" 버튼은 확정된 직원에게만, 점수가 아니라 본인 확인 링크가 나간다는 안내');
  ok(dbx.reads.every((p) => /^evaluations\/w[123]\/cycles\/2026$/.test(p)), '목록을 만들 때는 정기평가 문서만 읽음(수시평가·계정·명부 개인 정보를 읽지 않음): ' + [...new Set(dbx.reads)].join(','));
}
// ── 열기·미리보기
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); const p = t.st.rs.preview;
  ok(p && p.data.worker.name === '도하린' && p.data.final === 80 && p.html.includes('도하린') && !p.html.includes('<script'), '열면 그 직원의 통보서가 만들어짐(80점)');
  ok(root.querySelector('iframe[sandbox]') && root.textContent.includes('도하린님 결과 통보서') && root.querySelectorAll('[data-rs-act]').length === 4, '미리보기는 sandbox iframe 이고 버튼(목록·메일·링크·인쇄)이 있음');
  ok(dbx.reads.filter((x) => x === 'evaluations/w1/cycles/2026').length >= 2, '★ 열 때 최신 정기평가 문서를 다시 읽음(목록을 만들 때 읽은 값을 그대로 쓰지 않음)');
  ok(dbx.reads.includes('evaluations/w1/adhoc/*'), '수시평가 문서도 그 직원 것만 읽음');
}
// ── 확정 전 직원: 열리지 않음
{ const t = await mkCtl(); dbx.data['evaluations/w2/cycles/2026'].confirmed = false; const c2 = t.c; const w2el = { target: Object.assign(dom.window.document.createElement('button'), {}) }; w2el.target.setAttribute('data-rs-open', 'w2'); await c2.onClick({ target: w2el.target.closest ? w2el.target : w2el.target });
  ok(!t.st.rs.preview && t.calls.toast.some((m) => /확정되지 않은/.test(m)), '★ 확정 전 직원의 결과는 열려 해도 열리지 않고 이유를 알림'); }
// ── 링크 만들기
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); const html = t.st.rs.preview.html; await t.click('[data-rs-act="link"]');
  ok(t.calls.link.length === 1 && t.calls.link[0].workerId === 'w1' && t.calls.link[0].html === html && t.calls.link[0].title === '인사평가 결과 통보서' && JSON.stringify(t.calls.show) === '[["TOKEN123","도하린"]]', '★ 링크 만들기: 미리보기와 똑같은 HTML 로 링크가 만들어지고 링크·QR 팝업이 열림'); }
// ── 메일 발송
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); const html = t.st.rs.preview.html; await t.click('[data-rs-act="mail"]');
  ok(t.calls.dialog.length === 1 && /도하린님에게 2026년 인사평가 결과 통보서 확인 링크/.test(t.calls.dialog[0].body) && /메일에는 점수가 없고/.test(t.calls.dialog[0].body), '★ 발송 확인 창: 받는 사람 이름과 "메일에는 점수가 없고 본인 확인 후에만 보인다"는 설명이 보임');
  ok(t.calls.send.length === 1 && t.calls.send[0].workerId === 'w1' && t.calls.send[0].html === html && t.calls.send[0].year === 2026, '★ 발송에 쓰인 HTML 이 미리보기와 똑같음(문자 하나도 다르지 않음)');
  ok(t.st.rs.sent.w1 && /ki\*\*\*@example\.com/.test(t.st.rs.sent.w1) && !t.st.rs.sent.w1.includes('kimyoungseo'), '발송 후 목록에 "발송함"이 보이고 이메일은 가려서 표시(전체 주소 노출 없음)');
  ok(MK.maskEmail('kimyoungseo@example.com') === SG.maskEmail('kimyoungseo@example.com') && MK.maskEmail('') === SG.maskEmail('') && MK.maskEmail('a@b.kr') === SG.maskEmail('a@b.kr'), '공용 마스킹이 인사 모듈의 마스킹과 같은 결과를 냄'); }
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); t.setConfirm(false); await t.click('[data-rs-act="mail"]'); ok(t.calls.send.length === 0 && !t.st.rs.sent.w1, '확인 창에서 취소하면 발송하지 않음'); }
// ── 발송 직전 재계산: 미리보기를 열어 둔 사이 평가가 바뀌면 중단
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); dbx.data['evaluations/w1/cycles/2026'].leadAgg.areas = { achievement: 5, competency: 5, conduct: 5 }; await t.click('[data-rs-act="mail"]');
  ok(t.calls.send.length === 0 && t.calls.dialog.length === 0 && t.calls.toast.some((m) => /평가 내용이 바뀌어/.test(m)) && t.st.rs.preview.data.final > 80, '★ 미리보기를 열어 둔 사이 평가가 바뀌면 발송하지 않고 미리보기를 새로 만들어 다시 확인하게 함(옛 내용이 나가지 않음)');
  await t.click('[data-rs-act="mail"]'); ok(t.calls.send.length === 1 && t.calls.send[0].html === t.st.rs.preview.html, '새 미리보기를 확인하고 다시 누르면 새 내용으로 발송됨'); }
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); dbx.data['evaluations/w1/cycles/2026'].confirmed = false; await t.click('[data-rs-act="link"]'); ok(t.calls.link.length === 0 && t.calls.toast.some((m) => /지금은 통보할 수 없습니다/.test(m)), '★ 열어 둔 사이 확정이 취소되면 링크도 만들지 않음'); }
// ── 권한·테섭
{ const t = await mkCtl({ ctx: { me: { uid: 'h', admin: false, rank: '사원', perms: { hrEval: true } } } }); await t.click('[data-rs-open="w1"]'); ok(root.textContent.includes('관리자 계정만 할 수 있습니다') && /data-rs-act="mail" disabled/.test(root.innerHTML) && /data-rs-act="link" disabled/.test(root.innerHTML), '★ 관리자가 아니면 미리보기만 되고 발송·링크 버튼은 잠김'); await t.c.onClick({ target: root.querySelector('[data-rs-act="mail"]') }); ok(t.calls.send.length === 0 && t.calls.link.length === 0, '잠긴 버튼을 눌러도 발송·링크가 일어나지 않음'); }
{ const t = await mkCtl({ mailOn: false }); await t.click('[data-rs-open="w1"]'); ok(root.textContent.includes('테섭에서는 메일 발송이 꺼져 있습니다'), '테섭에서는 메일 꺼짐 안내가 보임'); await t.click('[data-rs-act="mail"]'); ok(t.calls.send.length === 0 && t.calls.dialog.length === 0 && t.calls.toast.some((m) => /메일 발송이 꺼져 있습니다/.test(m)), '★ 테섭(mailOn=false)에서는 메일 버튼을 눌러도 발송·확인 창이 없음'); await t.click('[data-rs-act="link"]'); ok(t.calls.link.length === 1, '테섭에서도 링크 만들기는 됨(시험용)'); }
// ── 오류 처리
{ const t = await mkCtl({ sendResult: async () => { throw new Error('받는 분의 휴대폰 번호가 없거나 형식이 올바르지 않아 링크를 만들 수 없습니다.'); } }); await t.click('[data-rs-open="w1"]'); await t.click('[data-rs-act="mail"]'); ok(t.calls.toast.some((m) => /휴대폰 번호가 없거나/.test(m)) && !t.st.rs.sent.w1 && t.st.rs.busy === false, '★ 발송이 실패하면(휴대폰 번호 없음 등) 이유를 알리고 "발송함"으로 표시하지 않으며 버튼이 다시 풀림'); }
{ const t = await mkCtl({ sendResult: async () => ({ ok: false }) }); await t.click('[data-rs-open="w1"]'); await t.click('[data-rs-act="mail"]'); ok(!t.st.rs.sent.w1, '발송 함수가 실패(ok:false)를 돌려주면 "발송함"으로 표시하지 않음'); }
{ const t = await mkCtl(); await t.click('[data-rs-open="w1"]'); await t.click('[data-rs-act="back"]'); ok(!t.st.rs.preview && root.querySelectorAll('[data-rs-open]').length === 1, '목록으로 돌아가면 미리보기가 닫힘'); }
// ── 소스: 모듈 규약
const src = fs.readFileSync(new URL('../app/modules/eval/result-io.js', import.meta.url), 'utf8');
ok(!/from '\.\.\/hr\//.test(src) && !/payslips|annual_contracts|labor_contracts|worker_private|worker_identity|salary_offers|severance/.test(src) && !/sendDocLinkByEmail|createDocLink|createResultLink|showLinkModal/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), '★ 평가 모듈(result-io)은 인사 모듈을 직접 가져오지 않고 급여·계약서·주민번호 컬렉션도 읽지 않음 — 발송 기능은 주입받음');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
