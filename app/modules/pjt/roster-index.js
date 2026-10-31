/* 근로자 연명부(새 화면) — 구포털 PJT 메뉴의 "근로자 연명부" 칸. 주소 #/pjt/roster(목록) · #/pjt/roster/<근로자 id>(상세 조회).
 * 왼쪽 명단(재직·조치 필요·퇴사·전체, 검색, 정렬) + 오른쪽(사람을 고르면 상세, 아니면 조치 필요 현황). 2단계: 카드마다 따로 수정(인적사항·급여/계좌·비고), 신규 등록, 삭제(관리자), 퇴사·팀장 연결, 주민번호 저장·보기(사유 선택, 서버 함수).
 * 첨부·건강검진·원청별 교육·자격 입력은 다음 단계. 규칙은 roster.js, 표시는 roster-view.js. */
import { db, storage, collection, doc, getDoc, getDocs, writeBatch, deleteField, serverTimestamp, arrayUnion, arrayRemove, storageRef, uploadBytesResumable, deleteObject, getBlob } from '../../core/firebase.js?v=20261031c';
import { esc, toast } from '../../core/ui.js?v=20261031c';
import { confirmDialog } from '../../core/dialog.js?v=20261031c';
import { revealWorker, saveJumin } from '../../shared/identity.js?v=20261031c';
import { compressImage } from './roster-image.js?v=20261031c';
import { validDateInput, mergePrivs, summaryOf, visibleList, rowOf, todayKey, birthFromJumin, parseJumin, fmtJumin, fmtPhone, fmtMoney, blankForm, formOfMaster, validateWorker, payOf, deleteBlock, pdfPathsOf, slotDocId, FILE_SLOTS, slotOf, filesMeta, fileMetaOf, photoDocOf, anyFile, downloadName, canEditSlot, healthRowsOf, blankHealthRow, healthRowSet, planHealth, checkPdf, pdfStoragePath, pdfMeta, pdfDownloadName, fmtKB, eduFormOf, eduToggle, eduExpSet, eduSavePatch, certRowsOf, blankCertRow, certRowSet, planCerts, legalRowsOf, addLegalRow, planLegal, contractorsOf, chemRowsOf, blankChemRow, chemFormOf, planChem, chemAccountPatch, chemDownloadName } from './roster.js?v=20261031c';
import { rosterHtml } from './roster-view.js?v=20261031c';
import { mountRosterTools } from './roster-tools-index.js?v=20261031c';
const pushHash = (h) => { if (location.hash === h) return; try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } };
const lst = (snap) => { const a = []; snap.forEach((d) => a.push({ id: d.id, data: d.data() })); return a; };
export async function mountRoster(root, route, ctx) {
  if (['_manday', '_migrate'].indexOf((((route && route.segs) || [])[0])) !== -1) return mountRosterTools(root, route, ctx, route.segs[0]);   // 월간 공수 보기·기존 인원 마이그레이션(연명부 도구)
  root.onclick = null; root.oninput = null; root.onchange = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const st = { allowed: !!(me.admin || (me.perms && me.perms.pjt)), admin: !!me.admin, ready: false, err: '', masters: [], privs: {}, accounts: [], hr: {}, filter: 'active', query: '', sortKey: null, sortDir: 1, sel: segs[0] || '', canEdit: !!(me.admin || (me.perms && me.perms.pjt)), busy: false, edit: null, jr: null, photo: null, allRows: [], alertRows: [], counts: { active: 0, resigned: 0, all: 0, alert: 0 }, coTab: 'samsung', coSub: 'legal', reveal: new Set(), today: todayKey(), rows: [], summary: { active: 0, resigned: 0, noHealth: 0, eduLack: 0 } };
  st.accountOf = (id) => st.accounts.find((u) => u.teamLeaderIds.indexOf(id) !== -1) || null; st.hrMatch = (name, birth) => (name && birth ? st.hr[String(name).trim() + '|' + birth] || null : null);
  root.innerHTML = '<div id="ro-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ro-body');
  const recompute = () => {
    st.contractors = contractorsOf(st.privs);   // 시공사 입력 자동완성(모든 근로자의 자격·법정교육에서)
    const byId = (id) => st.masters.find((m) => m.id === id); const c2 = { today: st.today, masterById: byId, accountOf: st.accountOf }; st.summary = summaryOf(st.masters, st.privs, st.today);
    st.allRows = st.masters.map((m) => rowOf(m, st.privs[m.id], c2)); const rowById = new Map(st.allRows.map((r) => [r.m.id, r]));
    const base = visibleList({ masters: st.masters, privs: st.privs, filter: st.filter === 'alert' ? 'active' : st.filter, query: st.query, sortKey: st.sortKey, sortDir: st.sortDir, today: st.today }).map((m) => rowById.get(m.id));
    st.rows = st.filter === 'alert' ? base.filter((r) => r.level) : base;   // 조치 필요 = 재직자 중 만료·임박이 있는 사람
    st.alertRows = st.allRows.filter((r) => !r.m.resigned && r.level).sort((a, b) => (a.level === 'danger' ? 0 : 1) - (b.level === 'danger' ? 0 : 1) || (a.m.name || '').localeCompare(b.m.name || '', 'ko'));
    st.counts = { active: st.summary.active, resigned: st.summary.resigned, all: st.masters.length, alert: st.alertRows.length };
  };
  const paint = () => {   // 다시 그려도 보던 위치(페이지·명단 스크롤)와 검색칸 커서를 유지한다
    const y = window.scrollY; const f = body.querySelector('[data-ro-q]'); const keep = f && document.activeElement === f ? f.selectionStart : -1; const ls = body.querySelector('.jh-ro__items'); const lsTop = ls ? ls.scrollTop : 0;
    body.innerHTML = rosterHtml(st); window.scrollTo(0, y); const ls2 = body.querySelector('.jh-ro__items'); if (ls2) ls2.scrollTop = lsTop;
    if (keep >= 0) { const g = body.querySelector('[data-ro-q]'); if (g) { g.focus(); try { g.setSelectionRange(keep, keep); } catch (e) { /* 일부 입력 형식은 커서 위치를 못 정함 */ } } }
  };
  if (!st.allowed) { body.removeAttribute('aria-busy'); paint(); return; }
  const load = async () => {
    const [ms, info, pay, users, ws, wp] = await Promise.all([getDocs(collection(db, 'master_workers')), getDocs(collection(db, 'master_worker_info')), st.admin ? getDocs(collection(db, 'master_worker_private')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'portal_users')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'workers')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'worker_private')).catch(() => null) : Promise.resolve(null)]);
    st.masters = lst(ms).map((x) => Object.assign({ id: x.id }, x.data)); st.privs = mergePrivs(lst(info), pay ? lst(pay) : []);
    st.accounts = []; if (users) lst(users).forEach((u) => { if (u.data.status === 'approved') st.accounts.push({ uid: u.id, name: u.data.name || '', rank: u.data.rank || '', email: u.data.email || '', teamLeaderIds: Array.isArray(u.data.teamLeaderIds) ? u.data.teamLeaderIds : [] }); });
    st.hr = {}; if (ws) { const pm = {}; if (wp) lst(wp).forEach((d) => { pm[d.id] = d.data; }); lst(ws).forEach((d) => { const w = d.data, p = pm[d.id] || {}; const b = birthFromJumin(p.juminMasked || p.jumin); if (w.name && b) st.hr[w.name + '|' + b] = { address: String(p.address || '').trim() }; }); }   // 인사 근로자 명단과 이름·생년월일로 대조(주소는 인사에서 관리)
  };
  try { await load(); st.ready = true; recompute(); } catch (e) { st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); }
  body.removeAttribute('aria-busy'); paint();
  const ident = (ctx && ctx.identity) || { reveal: revealWorker, save: saveJumin };   // 주민번호는 서버 함수만 안다(점검에서는 가짜로 바꿔 끼운다)
  const reload = async () => { await load(); recompute(); };
  const masterOf = (id) => st.masters.find((m) => m.id === id);
  /** 팀장 ↔ 포털 계정 연결(portal_users.teamLeaderIds — 관리자만 고칠 수 있는 필드): 이 팀장에게 연결된 계정을 newUid 하나로 맞춘다 */
  const syncLeaderLink = async (leaderId, newUid) => { for (const u of st.accounts) { const has = u.teamLeaderIds.indexOf(leaderId) !== -1; if (has && u.uid !== newUid) { const b = writeBatch(db); b.set(doc(db, 'portal_users', u.uid), { teamLeaderIds: arrayRemove(leaderId) }, { merge: true }); await b.commit(); } else if (!has && u.uid === newUid) { const b = writeBatch(db); b.set(doc(db, 'portal_users', u.uid), { teamLeaderIds: arrayUnion(leaderId) }, { merge: true }); await b.commit(); } } };
  const clearJr = () => { if (st.jrTimer) { clearTimeout(st.jrTimer); st.jrTimer = null; } st.jr = null; };
  const openEdit = (card) => {
    const m = masterOf(st.sel); if (!m) return; const p = st.privs[m.id] || {};
    if (card === 'personal') { const acc = !m.leaderId ? st.accountOf(m.id) : null; st.edit = { card, form: formOfMaster(m, p, acc ? acc.uid : ''), msg: '', jchange: false }; }
    else if (card === 'pay') { const r = p.dailyRate != null ? p.dailyRate : m.dailyRate; st.edit = { card, form: { rate: r ? fmtMoney(r) : '', bank: p.bank || '', account: p.account || '' }, msg: '' }; }
    else if (card === 'health') st.edit = { card, rows: healthRowsOf(p), msg: '' };
    else if (card === 'edu') st.edit = { card, form: eduFormOf(p, st.coTab), msg: '' };
    else if (card === 'chem') st.edit = { card, form: chemFormOf(p), rows: chemRowsOf(p), msg: '' };
    else if (card === 'cert') st.edit = { card, co: st.coTab, rows: certRowsOf(p, st.coTab), msg: '' };
    else if (card === 'legal') st.edit = { card, co: st.coTab, rows: legalRowsOf(p, st.coTab), msg: '' };
    else st.edit = { card: 'note', form: { note: p.note || '' }, msg: '' };
    paint();
  };
  const savePersonal = async () => {
    const e = st.edit, isNew = e.card === 'new'; const m = isNew ? null : masterOf(st.sel); const f = e.form;
    const guessBirth = f.birth || (f.jumin && parseJumin(f.jumin).birth) || '';
    const v = validateWorker(f, { editing: m, masters: st.masters, hrLinked: !!st.hrMatch(String(f.name || '').trim(), guessBirth) });
    if (!v.ok) { e.msg = v.errors[0]; paint(); return; }
    for (const c of v.confirms) { const ok = await confirmDialog({ title: '확인', body: c, confirmLabel: '그대로 저장' }); if (!ok.ok) return; }
    st.busy = true; e.msg = ''; paint();
    try {
      const b = writeBatch(db); b.set(doc(db, 'master_workers', v.id), v.base, { merge: true }); b.set(doc(db, 'master_worker_info', v.id), Object.assign({}, v.info, { updatedAt: serverTimestamp() }), { merge: true }); await b.commit();
      let warn = '';
      if (v.digits) { try { await ident.save('roster', v.id, v.digits); } catch (err) { warn = '근로자 정보는 저장했지만 주민번호는 저장하지 못했습니다: ' + ((err && err.message) || '') + ' — 다시 열어 [번호 변경]으로 입력해 주세요.'; } }
      if (st.admin) { try { await syncLeaderLink(v.id, f.leaderId ? '' : (f.portalUid || '')); } catch (err) { warn += (warn ? ' / ' : '') + '저장은 완료됐지만 포털 계정 연결에 실패했습니다: ' + ((err && err.message) || ''); } }   // 팀원이 된 경우엔 팀장 연결을 해제
      await reload(); st.edit = null; st.sel = v.id; pushHash('#/pjt/roster/' + encodeURIComponent(v.id)); toast(warn || (isNew ? '등록했습니다.' : '저장했습니다.'));
    } catch (err) { e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); }
    st.busy = false; paint();
  };
  const savePay = async () => {
    const m = masterOf(st.sel); if (!m || !st.admin) return; const e = st.edit; const pay = payOf(e.form); st.busy = true; e.msg = ''; paint();
    try { const b = writeBatch(db); b.set(doc(db, 'master_worker_private', m.id), pay, { merge: true }); b.set(doc(db, 'master_workers', m.id), { dailyRate: deleteField() }, { merge: true }); await b.commit(); await reload(); st.edit = null; toast('저장했습니다.'); }   // 일당은 모든 직원이 읽는 마스터가 아니라 관리자 전용 문서에만 둔다(예전 값은 함께 지움)
    catch (err) { e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); } st.busy = false; paint();
  };
  const saveNote = async () => {
    const m = masterOf(st.sel); if (!m) return; const e = st.edit; st.busy = true; e.msg = ''; paint();
    try { const b = writeBatch(db); b.set(doc(db, 'master_worker_info', m.id), { note: String(e.form.note || '').trim(), updatedAt: serverTimestamp() }, { merge: true }); await b.commit(); await reload(); st.edit = null; toast('저장했습니다.'); }
    catch (err) { e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); } st.busy = false; paint();
  };
  const deleteWorker = async () => {
    const m = masterOf(st.sel); if (!m || !st.admin) return; const why = deleteBlock(m, st.masters); if (why) { toast(why); return; }
    const ok = await confirmDialog({ title: '근로자 삭제', body: m.name + '님을 연명부에서 삭제할까요?\n개인정보·검진·사진 등 이 화면에서 관리하는 정보가 함께 삭제됩니다.\n(각 프로젝트에 이미 등록된 근태·공수 기록은 그대로 남습니다)', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
    st.busy = true; paint();
    try {
      const b = writeBatch(db); b.delete(doc(db, 'master_workers', m.id)); b.delete(doc(db, 'master_worker_info', m.id)); b.delete(doc(db, 'master_worker_private', m.id)); FILE_SLOTS.forEach((x) => b.delete(doc(db, 'master_worker_photos', slotDocId(m.id, x.k)))); await b.commit();
      for (const path of pdfPathsOf(st.privs[m.id])) { try { await deleteObject(storageRef(storage, path)); } catch (err) { /* 파일이 이미 없어도 삭제는 계속 */ } }
      try { await syncLeaderLink(m.id, ''); } catch (err) { /* 연결 해제 실패는 삭제를 막지 않는다 */ }
      await reload(); st.sel = ''; st.edit = null; clearJr(); pushHash('#/pjt/roster'); toast('삭제했습니다.');
    } catch (err) { toast('삭제 실패: ' + ((err && (err.code || err.message)) || '')); }
    st.busy = false; paint();
  };
  const revealJumin = async () => {
    const j = st.jr; if (!j || !st.sel) return; st.busy = true; j.err = ''; paint();
    try { const r = await ident.reveal('roster', st.sel, j.reason); if (!r || !r.found || !r.jumin) j.err = '저장된 번호가 없습니다.'; else { st.jr = { id: st.sel, value: fmtJumin(r.jumin) }; st.jrTimer = setTimeout(() => { st.jr = null; st.jrTimer = null; paint(); }, 20000); } }   // 번호는 화면에만 20초 보이고 어디에도 저장하지 않는다
    catch (err) { j.err = (err && err.message) || '열람하지 못했습니다.'; } st.busy = false; paint();
  };
  // ── 서류·사진 첨부: 파일을 고르면 줄여서 바로 저장(이미지 문서 + 실무자 문서의 files 메타), 삭제도 바로 ──
  const compress = (ctx && ctx.compressImage) || compressImage;
  const metaWrite = (m, files, b) => b.set(doc(db, 'master_worker_info', m.id), { files, hasPhoto: anyFile(files), photoName: '', photoSize: 0, photoW: 0, photoH: 0, updatedAt: serverTimestamp() }, { merge: true });   // 예전 단일 사진 필드는 files 로 통합되어 비운다
  const uploadFile = async (slot, file) => {
    const m = masterOf(st.sel); if (!m || !file || !canEditSlot(slot, st.admin, st.canEdit)) return;
    if (!/^image\//.test(file.type || '')) { toast('이미지 파일만 선택할 수 있습니다.'); return; }
    st.busy = true; paint();
    try {
      const r = await compress(file); const meta = fileMetaOf(file.name, slot, r.dataUrl, r.w, r.h); const files = Object.assign({}, filesMeta(st.privs[m.id]), { [slot]: meta });
      const b = writeBatch(db); b.set(doc(db, 'master_worker_photos', slotDocId(m.id, slot)), Object.assign(photoDocOf(slot, meta, r.dataUrl), { updatedAt: serverTimestamp() })); metaWrite(m, files, b); await b.commit();
      await reload(); toast(slotOf(slot).label + '을(를) 저장했습니다.');
    } catch (err) { toast('저장 실패: ' + ((err && (err.code || err.message)) || '')); }
    st.busy = false; paint();
  };
  const deleteFile = async (slot) => {
    const m = masterOf(st.sel); if (!m || !canEditSlot(slot, st.admin, st.canEdit)) return; const label = slotOf(slot).label;
    const ok = await confirmDialog({ title: label + ' 삭제', body: m.name + '님의 ' + label + ' 파일을 삭제할까요?', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
    st.busy = true; paint();
    try { const files = Object.assign({}, filesMeta(st.privs[m.id]), { [slot]: null }); const b = writeBatch(db); b.delete(doc(db, 'master_worker_photos', slotDocId(m.id, slot))); metaWrite(m, files, b); await b.commit(); await reload(); toast(label + '을(를) 삭제했습니다.'); }
    catch (err) { toast('삭제 실패: ' + ((err && (err.code || err.message)) || '')); }
    st.busy = false; paint();
  };
  const fetchPhoto = async (slot) => { const m = masterOf(st.sel); if (!m) return null; try { const snap = await getDoc(doc(db, 'master_worker_photos', slotDocId(m.id, slot))); if (!snap.exists()) { toast('저장된 파일을 찾을 수 없습니다.'); return null; } return { m, d: snap.data() }; } catch (err) { toast('파일을 불러오지 못했습니다: ' + ((err && (err.code || err.message)) || '')); return null; } };
  const viewFile = async (slot) => { const r = await fetchPhoto(slot); if (!r) return; st.photo = { slot, title: (r.m.name || '') + ' ' + slotOf(slot).label, src: r.d.dataUrl }; paint(); };   // 파일은 [보기]를 눌렀을 때만 읽어 화면에 연다
  const downloadFile = async (slot) => { const r = (st.photo && st.photo.slot === slot) ? { m: masterOf(st.sel), d: { dataUrl: st.photo.src } } : await fetchPhoto(slot); if (!r || !r.m) return; const a = document.createElement('a'); a.href = r.d.dataUrl; a.download = downloadName(r.m.name, slot); document.body.appendChild(a); a.click(); a.remove(); };
  // ── 건강검진(줄 편집기 + 결과 PDF): [저장]을 눌러야 반영. PDF 는 Storage(roster_health/<id>/…), 로그인한 권한으로 직접 내려받는다 ──
  const store = (ctx && ctx.store) || { upload: (path, file) => new Promise((res, rej) => { const t = uploadBytesResumable(storageRef(storage, path), file, { contentType: 'application/pdf' }); t.on('state_changed', null, rej, () => res()); }), remove: (path) => deleteObject(storageRef(storage, path)), blob: (path) => getBlob(storageRef(storage, path)) };
  const rnd = () => Math.random().toString(36).slice(2, 8);
  const saveHealth = async () => {
    const m = masterOf(st.sel); if (!m) return; const e = st.edit; const plan = planHealth(e.rows, (st.privs[m.id] || {}).health);
    if (!plan.ok) { e.msg = plan.error; paint(); return; }
    st.busy = true; e.msg = ''; paint(); const newPaths = [];
    try {
      for (const u of plan.uploads) { const path = pdfStoragePath(m.id, '', Date.now(), rnd()); await store.upload(path, u.file); newPaths.push(path); plan.health[u.index].pdf = pdfMeta(path, u.file, new Date().toISOString()); }   // PDF 가 하나라도 못 올라가면 저장 전체를 멈춘다
      const b = writeBatch(db); b.set(doc(db, 'master_worker_info', m.id), { health: plan.health, updatedAt: serverTimestamp() }, { merge: true }); await b.commit();
      for (const path of plan.oldPaths) { try { await store.remove(path); } catch (err) { /* 옛 파일이 이미 없어도 저장은 유효 */ } }   // 저장이 성공한 뒤에야 옛 PDF 를 지운다
      await reload(); st.edit = null; toast('저장했습니다.');
    } catch (err) { for (const path of newPaths) { try { await store.remove(path); } catch (e2) { /* 되돌리기 실패는 무시 */ } } e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); }   // 실패하면 방금 올린 새 PDF 는 지워 찌꺼기를 남기지 않는다
    st.busy = false; paint();
  };
  const saveChem = async () => {
    const m = masterOf(st.sel); if (!m) return; const e = st.edit; const plan = planChem(e.rows, (st.privs[m.id] || {}).chemEdu);
    if (!plan.ok) { e.msg = plan.error; paint(); return; }
    st.busy = true; e.msg = ''; paint(); const newPaths = [];
    try {
      for (const u of plan.uploads) { const path = pdfStoragePath(m.id, 'chem_', Date.now(), rnd()); await store.upload(path, u.file); newPaths.push(path); plan.chemEdu[u.index].pdf = pdfMeta(path, u.file, new Date().toISOString()); }
      const b = writeBatch(db); b.set(doc(db, 'master_worker_info', m.id), Object.assign({ chemEdu: plan.chemEdu }, chemAccountPatch(e.form), { updatedAt: serverTimestamp() }), { merge: true }); await b.commit();
      for (const path of plan.oldPaths) { try { await store.remove(path); } catch (err) { /* 옛 파일이 이미 없어도 저장은 유효 */ } }
      await reload(); st.edit = null; toast('저장했습니다.');
    } catch (err) { for (const path of newPaths) { try { await store.remove(path); } catch (e2) { /* 되돌리기 실패는 무시 */ } } e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); }
    st.busy = false; paint();
  };
  const downloadPdf = async (path) => {
    const m = masterOf(st.sel); if (!m) return; const pv = st.privs[m.id] || {}; const h = (pv.health || []).find((x) => x.pdf && x.pdf.path === path); const c = h ? null : (pv.chemEdu || []).find((x) => x.pdf && x.pdf.path === path); const name = c ? chemDownloadName(m.name, c.date) : pdfDownloadName(m.name, h && h.type, h && h.date);
    try { const blob = await store.blob(path); const url = (URL.createObjectURL ? URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) : '#'); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); if (URL.revokeObjectURL) setTimeout(() => URL.revokeObjectURL(url), 30000); }
    catch (err) { toast('다운로드 실패: ' + ((err && (err.code || err.message)) || '') + ' (권한이 있는 계정인지 확인해 주세요)'); }
  };
  const hfSet = (t) => { const [i, f] = String(t.getAttribute('data-ro-hf')).split('|'); const e = st.edit; if (!e || !e.rows || !e.rows[+i]) return false; if (isDateInput(t) && !validDateInput(t.value)) { st.dirtyDate = true; return true; } e.rows[+i] = e.card === 'chem' ? Object.assign({}, e.rows[+i], { [f]: t.value }) : healthRowSet(e.rows[+i], f, t.value); if (isDateInput(t)) st.dirtyDate = true; else paint(); return true; };
  const saveEdu = async () => {
    const m = masterOf(st.sel); if (!m) return; const e = st.edit; const patch = eduSavePatch(st.privs[m.id], e.form); st.busy = true; e.msg = ''; paint();
    try { const b = writeBatch(db); b.set(doc(db, 'master_worker_info', m.id), Object.assign({}, patch, { updatedAt: serverTimestamp() }), { merge: true }); await b.commit(); await reload(); st.edit = null; toast('저장했습니다.'); }
    catch (err) { e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); } st.busy = false; paint();
  };
  const efSet = (t) => { const e = st.edit; if (!e || (e.card !== 'edu' && e.card !== 'chem')) return false; const [kind, k] = String(t.getAttribute('data-ro-ef')).split('|'); if (e.card === 'edu' && kind === 'chk') { e.form = eduToggle(e.form, k, t.checked); paint(); } else if (e.card === 'edu' && kind === 'exp') { if (isDateInput(t) && !validDateInput(t.value)) { st.dirtyDate = true; return true; } e.form = eduExpSet(e.form, k, t.value); if (isDateInput(t)) st.dirtyDate = true; else paint(); } else if (kind === 'id') e.form.id = t.value; else if (kind === 'pw') e.form.pw = t.value; return true; };
  // ── 자격·인증 / 법정교육(원청별 줄 편집기): [저장]을 눌러야 반영, 저장은 그 원청 줄만 바꾼다 ──
  const saveRows = async (kind) => {
    const m = masterOf(st.sel); if (!m) return; const e = st.edit; const p = st.privs[m.id] || {}; const plan = kind === 'cert' ? planCerts(p, e.co, e.rows) : planLegal(p, e.co, e.rows);
    if (!plan.ok) { e.msg = plan.error; paint(); return; }
    st.busy = true; e.msg = ''; paint();
    try { const b = writeBatch(db); b.set(doc(db, 'master_worker_info', m.id), Object.assign(kind === 'cert' ? { certs: plan.certs } : { legalEdu: plan.legalEdu }, { updatedAt: serverTimestamp() }), { merge: true }); await b.commit(); await reload(); st.edit = null; toast('저장했습니다.'); }
    catch (err) { e.msg = '저장 실패: ' + ((err && (err.code || err.message)) || ''); } st.busy = false; paint();
  };
  const paintKeep = () => { const a = document.activeElement; let sel = ''; if (a instanceof Element) { for (const at of ['data-ro-ef', 'data-ro-rf', 'data-ro-hf', 'data-ro-f']) { if (a.hasAttribute(at)) { sel = '[' + at + '="' + a.getAttribute(at) + '"]'; break; } } } paint(); if (sel) { const n = body.querySelector(sel); if (n && typeof n.focus === 'function') n.focus(); } };   // 다시 그린 뒤에도 보던 칸에 커서를 돌려준다
  if (root._roFocusOut) root.removeEventListener('focusout', root._roFocusOut);
  root._roFocusOut = (ev) => { const t = ev.target; if (!st.dirtyDate || !(t instanceof Element) || t.type !== 'date') return; setTimeout(() => { if (!st.dirtyDate) return; const a = document.activeElement; if (a && a !== document.body && !/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return; /* 버튼을 누르는 중이면 그 버튼 동작이 다시 그린다(그 사이 버튼이 바뀌면 누른 것이 사라진다) */ st.dirtyDate = false; paintKeep(); }, 0); };
  root.addEventListener('focusout', root._roFocusOut);
  const isDateInput = (t) => !!t && t.type === 'date';   // 날짜 칸은 값이 확정될 때까지(연도를 한 글자씩 칠 때마다 change 가 온다) 화면을 다시 그리지 않고, 칸을 떠날 때 한 번만 다시 그린다
  const rfSet = (t, repaint) => { const e = st.edit; if (!e || !e.rows) return false; const [kind, i, f] = String(t.getAttribute('data-ro-rf')).split('|'); if (e.card !== kind || !e.rows[+i]) return false; if (isDateInput(t) && !validDateInput(t.value)) { st.dirtyDate = true; return true; } if (kind === 'cert') e.rows[+i] = certRowSet(e.rows[+i], f, t.value); else e.rows[+i] = Object.assign({}, e.rows[+i], { [f]: t.value }); if (repaint) { if (isDateInput(t)) st.dirtyDate = true; else paint(); } return true; };
  const setField = (t) => {
    if (!st.edit || !t.hasAttribute('data-ro-f')) return false; const k = t.getAttribute('data-ro-f'); st.edit.form[k] = t.value;
    if (k === 'jumin') { const pj = parseJumin(t.value); if (pj.valid) { const f = st.edit.form; if (!f.birth || f.birth !== pj.birth) { f.birth = pj.birth; const bi = body.querySelector('[data-ro-f="birth"]'); if (bi) bi.value = pj.birth; } if (!f.gender) { f.gender = pj.gender; const gi = body.querySelector('[data-ro-f="gender"]'); if (gi) gi.value = pj.gender; } } }   // 주민번호를 넣으면 생년월일·성별을 자동으로
    return true;
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-ro-open]'))) { st.sel = el.getAttribute('data-ro-open'); st.reveal = new Set(); st.coTab = 'samsung'; st.coSub = 'legal'; st.edit = null; st.photo = null; clearJr(); pushHash('#/pjt/roster/' + encodeURIComponent(st.sel)); paint(); if (window.matchMedia && window.matchMedia('(max-width: 899px)').matches) window.scrollTo(0, 0); return; }
    if (t.closest('[data-ro-back]')) { st.sel = ''; st.edit = null; st.photo = null; clearJr(); pushHash('#/pjt/roster'); paint(); return; }
    if (t.closest('[data-ro-new]')) { st.sel = ''; clearJr(); st.edit = { card: 'new', form: blankForm(), msg: '', jchange: true }; pushHash('#/pjt/roster'); paint(); return; }
    if ((el = t.closest('[data-ro-edit]'))) { openEdit(el.getAttribute('data-ro-edit')); return; }
    if (t.closest('[data-ro-cancel]')) { st.edit = null; paint(); return; }
    if (t.closest('[data-ro-jchange]')) { if (st.edit) { st.edit.jchange = true; paint(); } return; }
    if ((el = t.closest('[data-ro-save]')) && !st.busy) { const c = el.getAttribute('data-ro-save'); if (c === 'personal' || c === 'new') await savePersonal(); else if (c === 'pay') await savePay(); else if (c === 'note') await saveNote(); else if (c === 'health') await saveHealth(); else if (c === 'edu') await saveEdu(); else if (c === 'chem') await saveChem(); else if (c === 'cert' || c === 'legal') await saveRows(c); return; }
    if (t.closest('[data-ro-del]') && !st.busy) { await deleteWorker(); return; }
    if (t.closest('[data-ro-jask]')) { clearJr(); st.jr = { id: st.sel, ask: true, reason: '4대보험 신고' }; paint(); return; }
    if (t.closest('[data-ro-jgo]') && !st.busy) { await revealJumin(); return; }
    if (t.closest('[data-ro-jhide]')) { clearJr(); paint(); return; }
    if (t.closest('[data-ro-hadd]') && st.edit && st.edit.rows) { st.edit.rows.push(st.edit.card === 'chem' ? blankChemRow() : blankHealthRow()); paint(); return; }
    if ((el = t.closest('[data-ro-hdelrow]')) && st.edit && st.edit.rows) { st.edit.rows.splice(+el.getAttribute('data-ro-hdelrow'), 1); paint(); return; }
    if ((el = t.closest('[data-ro-hreset]')) && st.edit && st.edit.rows) { const i = +el.getAttribute('data-ro-hreset'); st.edit.rows[i] = healthRowSet(st.edit.rows[i], 'reset'); paint(); return; }
    if ((el = t.closest('[data-ro-hpdfx]')) && st.edit && st.edit.rows) { st.edit.rows[+el.getAttribute('data-ro-hpdfx')].pdfRemove = true; paint(); return; }
    if ((el = t.closest('[data-ro-hpdfu]')) && st.edit && st.edit.rows) { st.edit.rows[+el.getAttribute('data-ro-hpdfu')].pdfRemove = false; paint(); return; }
    if ((el = t.closest('[data-ro-hpdfc]')) && st.edit && st.edit.rows) { st.edit.rows[+el.getAttribute('data-ro-hpdfc')].pdfNew = null; paint(); return; }
    if ((el = t.closest('[data-ro-hdl]'))) { await downloadPdf(el.getAttribute('data-ro-hdl')); return; }
    if ((el = t.closest('[data-ro-fview]')) && !st.busy) { await viewFile(el.getAttribute('data-ro-fview')); return; }
    if ((el = t.closest('[data-ro-fdl]'))) { await downloadFile(el.getAttribute('data-ro-fdl')); return; }
    if ((el = t.closest('[data-ro-fdel]')) && !st.busy) { await deleteFile(el.getAttribute('data-ro-fdel')); return; }
    if (t.closest('[data-ro-fclose]')) { st.photo = null; paint(); return; }
    if ((el = t.closest('[data-ro-filter]'))) { st.filter = el.getAttribute('data-ro-filter'); recompute(); paint(); return; }
    if (t.closest('[data-ro-dir]')) { if (!st.sortKey) return; st.sortDir = -st.sortDir; recompute(); paint(); return; }
    if ((el = t.closest('[data-ro-cotab]'))) { st.coTab = el.getAttribute('data-ro-cotab'); if (st.edit && /^(edu|cert|legal|chem)$/.test(st.edit.card)) st.edit = null; paint(); return; }
    if ((el = t.closest('[data-ro-cosub]'))) { st.coSub = el.getAttribute('data-ro-cosub'); if (st.edit && /^(edu|cert|legal)$/.test(st.edit.card)) st.edit = null; paint(); return; }
    if ((el = t.closest('[data-ro-radd]')) && st.edit && st.edit.rows) { st.edit.rows = el.getAttribute('data-ro-radd') === 'cert' ? st.edit.rows.concat([blankCertRow()]) : addLegalRow(st.edit.rows); paint(); return; }
    if ((el = t.closest('[data-ro-rdel]')) && st.edit && st.edit.rows) { const [, i] = el.getAttribute('data-ro-rdel').split('|'); st.edit.rows.splice(+i, 1); paint(); return; }
    if ((el = t.closest('[data-ro-rreset]')) && st.edit && st.edit.rows) { const i = +el.getAttribute('data-ro-rreset'); st.edit.rows[i] = certRowSet(st.edit.rows[i], 'reset'); paint(); return; }
    if ((el = t.closest('[data-ro-pwt]'))) { const inp = el.parentNode.querySelector('input'); if (inp) inp.type = inp.type === 'password' ? 'text' : 'password'; return; }
    if (t.closest('[data-ro-pwc]')) { try { await navigator.clipboard.writeText((st.edit && st.edit.form && st.edit.form.pw) || ''); toast('비밀번호를 복사했습니다.'); } catch (err) { toast('복사하지 못했습니다. 👁 버튼으로 표시한 뒤 직접 복사해 주세요.'); } return; }
    if ((el = t.closest('[data-ro-pw]'))) { const k = el.getAttribute('data-ro-pw'); if (st.reveal.has(k)) st.reveal.delete(k); else st.reveal.add(k); paint(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.hasAttribute('data-ro-rf')) { if (!(t.type === 'date' || t.tagName === 'SELECT')) rfSet(t, false); return; } if (t.hasAttribute('data-ro-ef') && /^(id|pw)$/.test(t.getAttribute('data-ro-ef'))) { efSet(t); return; } if (setField(t)) return; if (t.hasAttribute('data-ro-q')) { st.query = t.value.trim(); recompute(); paint(); } };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.hasAttribute('data-ro-jreason')) { if (st.jr) st.jr.reason = t.value; return; }
    if (t.hasAttribute('data-ro-rf')) { rfSet(t, true); return; }
    if (t.hasAttribute('data-ro-ef')) { efSet(t); return; }
    if (t.hasAttribute('data-ro-hf')) { hfSet(t); return; }
    if (t.hasAttribute('data-ro-hpdf')) { const f = t.files && t.files[0]; const i = +t.getAttribute('data-ro-hpdf'); const row = st.edit && st.edit.rows && st.edit.rows[i]; t.value = ''; if (!f || !row) return; if (!row.date) { st.edit.msg = st.edit.card === 'chem' ? '교육일을 먼저 입력해 주세요.' : '검진 실시일을 먼저 입력해 주세요.'; paint(); return; } const why = checkPdf(f); if (why) { st.edit.msg = why; paint(); return; } row.pdfNew = f; row.pdfRemove = false; st.edit.msg = ''; paint(); return; }
    if (t.hasAttribute('data-ro-file')) { const f = t.files && t.files[0]; const slot = t.getAttribute('data-ro-file'); t.value = ''; if (f) uploadFile(slot, f); return; }
    if (setField(t)) { const k = t.getAttribute('data-ro-f'); if (k === 'phone') { st.edit.form.phone = fmtPhone(t.value); t.value = st.edit.form.phone; } if (k === 'leaderId') paint(); return; }   // 소속을 바꾸면 팀장 포털 계정 칸이 달라진다(인사 연동 주소는 저장할 때 이름·생년월일로 다시 판정)
    if (t.hasAttribute('data-ro-sortm')) { st.sortKey = t.value || null; if (!st.sortKey) st.sortDir = 1; recompute(); paint(); }
  };
}
