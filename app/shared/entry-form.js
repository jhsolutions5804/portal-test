/* 입사 입력(근로자 직접 기입) 화면 — Microsoft 로그인으로 들어온 "입사 입력 전용 계정"(portal_users.status = onboarding)에게만 보이는 전체 화면.
 * 저장·제출·서류 올리기는 전부 서버 함수 entryAct 로만 한다(클라이언트는 entry_* 컬렉션을 읽지도 쓰지도 못함). 설계서 app-docs/worker-self-entry-design.md */
import { functions, httpsCallable } from '../core/firebase.js?v=20261109r';
import { esc } from '../core/ui.js?v=20261109r';

const CONSENT_TEXT = '「개인정보 보호법」에 따라 아래와 같이 개인정보를 수집·이용하는 데 동의합니다.\n' +
  '① 수집·이용 목적: 입사 처리, 근로계약 체결, 4대보험 신고, 인사관리(근로자 명부), 현장 출입 및 발주처 제출 서류 작성\n' +
  '② 수집 항목: 성명, 주민등록번호, 연락처, 주소, 학력·경력·자격, 병역, 비상연락처, 가족관계, 사진·신분증·자격증·통장사본 등 입력·첨부한 모든 항목\n' +
  '③ 보유·이용 기간: 근로관계 종료 후 관계 법령에서 정한 기간까지(채용이 취소되거나 입사하지 않은 경우 지체 없이 파기)\n' +
  '④ 동의를 거부할 수 있으며, 거부하면 입사 처리가 어렵습니다.\n' +
  '⑤ 발주처(원청) 제출이 필요한 경우 별도 동의를 받습니다.';
const SLOT_LABEL = { photo: '증명사진', idcard: '신분증 사본', cert: '건설기초안전보건교육 이수증', bank: '통장 사본', qual1: '자격증 1', qual2: '자격증 2', qual3: '자격증 3' };
const ROWS = {
  education: { title: '학력', cols: [['school', '학교'], ['major', '전공'], ['from', '입학(YYYY-MM)'], ['to', '졸업(YYYY-MM)'], ['status', '졸업구분']] },
  career: { title: '경력(최근순)', cols: [['company', '회사'], ['from', '입사(YYYY-MM)'], ['to', '퇴사(YYYY-MM)'], ['position', '직위'], ['duty', '담당업무']] },
  certs: { title: '자격·면허(운전면허 제외)', cols: [['name', '자격명'], ['date', '취득일'], ['issuer', '발급처']] },
  family: { title: '가족관계(참고용)', cols: [['relation', '관계'], ['name', '성명'], ['age', '연령'], ['job', '직업'], ['together', '동거']] }
};
const call = async (data) => { const r = await httpsCallable(functions, 'entryAct')(data); return r.data; };
const errMsg = (e) => String((e && e.message) || '').replace(/^.*?:\s*/, '') || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/** 사진 → 긴 변 1600px JPEG, 서버 한도(약 900KB 문자열)에 맞을 때까지 화질을 낮춘다 */
function compress(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader(); fr.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
    fr.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('이미지 파일이 아닙니다.'));
      img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) { const u = c.toDataURL('image/jpeg', q); if (u.length <= 880 * 1024) { resolve(u); return; } } reject(new Error('사진이 너무 큽니다. 해상도를 낮춰 다시 촬영해 주세요.')); };
      img.src = String(fr.result); };
    fr.readAsDataURL(file);
  });
}

export function renderEntry(root, { me, onLogout, embedded }) {   // embedded: 이미 계정이 있는 직원이 포털 안에서 여는 경우(로그아웃 대신 홈으로 돌아가기)
  const st = { status: 'loading', draft: {}, files: [], reject: '', msg: '', busy: false, consent: false, jumin: '' };
  const D = () => st.draft;
  const val = (path) => path.split('.').reduce((o, k) => (o == null ? '' : o[k]), D()) || '';
  const inp = (path, label, o) => { o = o || {}; return '<label class="ef-f"><span>' + esc(label) + (o.req ? ' <b>*</b>' : '') + '</span><input data-k="' + path + '" type="' + (o.type || 'text') + '" value="' + esc(o.value != null ? o.value : val(path)) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.mode ? ' inputmode="' + o.mode + '"' : '') + (st.locked ? ' disabled' : '') + '></label>'; };
  const rowsHtml = (key) => { const R = ROWS[key]; const list = D()[key] && D()[key].length ? D()[key] : [{}];
    return '<h3>' + R.title + '</h3>' + list.map((row, i) => '<div class="ef-row">' + R.cols.map(([c, l]) => c === 'together'
      ? '<label class="ef-f ef-chk"><input type="checkbox" data-row="' + key + '" data-i="' + i + '" data-c="' + c + '"' + (row[c] ? ' checked' : '') + (st.locked ? ' disabled' : '') + '> ' + l + '</label>'
      : '<label class="ef-f"><span>' + l + '</span><input data-row="' + key + '" data-i="' + i + '" data-c="' + c + '" value="' + esc(row[c] || '') + '"' + (st.locked ? ' disabled' : '') + '></label>').join('') +
      (st.locked ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-del="' + key + ':' + i + '">삭제</button>') + '</div>').join('') + (st.locked ? '' : '<button type="button" class="jh-btn" data-variant="secondary" data-add="' + key + '">+ 줄 추가</button>'); };
  const fileHtml = () => Object.keys(SLOT_LABEL).map((s) => '<div class="ef-file"><span>' + SLOT_LABEL[s] + (st.files.indexOf(s) !== -1 ? ' <b class="ef-ok">✓ 올림</b>' : '') + '</span>' + (st.locked ? '' : '<input type="file" accept="image/*" data-slot="' + s + '">') + '</div>').join('');
  function paint() {
    st.locked = st.status === 'submitted' || st.status === 'approved';
    if (st.status === 'loading') { root.innerHTML = '<div class="ef-wrap"><p>불러오는 중…</p></div>'; return; }
    root.innerHTML = '<style>.ef-wrap{max-width:760px;margin:0 auto;padding:20px 16px 80px;font-size:15px;line-height:1.5}.ef-wrap h1{font-size:22px;margin:0 0 4px}.ef-wrap h2{font-size:17px;margin:26px 0 8px;padding-top:10px;border-top:1px solid var(--jh-border,#ddd)}.ef-wrap h3{font-size:15px;margin:14px 0 6px}.ef-f{display:flex;flex-direction:column;gap:3px;margin:6px 0}.ef-f span{font-size:13px;opacity:.8}.ef-f input,.ef-f select,.ef-f textarea{padding:9px 10px;border:1px solid var(--jh-border,#bbb);border-radius:8px;font:inherit;background:transparent;color:inherit}.ef-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;align-items:end;padding:8px;border:1px dashed var(--jh-border,#ccc);border-radius:8px;margin:6px 0}.ef-chk{flex-direction:row;align-items:center}.ef-file{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--jh-border,#e5e5e5);flex-wrap:wrap}.ef-ok{color:#1a7f37}.ef-consent{white-space:pre-wrap;font-size:13px;padding:12px;border:1px solid var(--jh-border,#ccc);border-radius:8px;max-height:220px;overflow:auto}.ef-bar{position:sticky;bottom:0;display:flex;gap:8px;padding:10px 0;background:var(--jh-bg,#fff)}.ef-msg{padding:10px 12px;border-radius:8px;margin:10px 0;background:rgba(0,120,212,.1)}.ef-bad{background:rgba(209,52,56,.12)}</style><div class="ef-wrap">' +
      '<h1>입사 정보 입력</h1><div style="opacity:.75">' + esc(me.email || '') + ' · 입력하신 내용은 인사 담당자가 확인한 뒤 근로자 명부에 반영됩니다. <b>*</b>는 필수입니다.</div>' +
      (st.status === 'submitted' ? '<div class="ef-msg">제출이 완료되었습니다. 인사 담당자가 확인 중입니다. 수정이 필요하면 담당자에게 알려 주세요.</div>' : '') +
      (st.status === 'approved' ? '<div class="ef-msg">입력하신 내용이 근로자 명부에 반영되었습니다.' + (embedded ? ' 홈으로 돌아가면 출퇴근 등을 사용할 수 있습니다.' : ' 포털 사용 권한은 관리자 승인 후 열립니다.') + '</div>' : '') +
      (st.status === 'rejected' ? '<div class="ef-msg ef-bad">보완이 필요합니다: ' + esc(st.reject) + '<br>내용을 고친 뒤 다시 제출해 주세요.</div>' : '') +
      (st.msg ? '<div class="ef-msg' + (st.bad ? ' ef-bad' : '') + '">' + esc(st.msg) + '</div>' : '') +
      '<h2>개인정보 수집·이용 동의 <b>*</b></h2><div class="ef-consent">' + esc(CONSENT_TEXT) + '</div><label class="ef-f ef-chk"><input type="checkbox" id="ef-consent"' + (st.consent || D().consent ? ' checked' : '') + (st.locked ? ' disabled' : '') + '> 위 내용을 읽었으며 동의합니다.</label>' +
      '<h2>인적사항</h2>' + inp('name', '성명(한글)', { req: 1 }) + inp('nameEn', '영문 이름') +
      '<label class="ef-f"><span>주민등록번호 <b>*</b>' + (D().juminMasked ? ' — 저장됨: ' + esc(D().juminMasked) + ' (바꾸려면 다시 입력)' : '') + '</span><input id="ef-jumin" inputmode="numeric" autocomplete="off" placeholder="000000-0000000" value="' + esc(st.jumin) + '"' + (st.locked ? ' disabled' : '') + '></label>' +
      inp('phone', '휴대폰', { req: 1, mode: 'tel' }) + inp('email', '개인 이메일', { type: 'email' }) + inp('address', '주소', { req: 1 }) + inp('addressDetail', '상세 주소') +
      '<label class="ef-f"><span>혈액형</span><select data-k="bloodType"' + (st.locked ? ' disabled' : '') + '>' + ['', 'A', 'B', 'O', 'AB'].map((b) => '<option value="' + b + '"' + (val('bloodType') === b ? ' selected' : '') + '>' + (b || '선택 안 함') + '</option>').join('') + '</select></label>' +
      '<h2>병역</h2>' + inp('military.kind', '구분(군필·미필·면제·해당없음)') + inp('military.branch', '군별') + inp('military.mos', '병과') + inp('military.rank', '계급') +
      '<h2>비상연락처 <b>*</b></h2>' + inp('emergency.name', '성명', { req: 1 }) + inp('emergency.relation', '관계') + inp('emergency.phone', '전화', { req: 1, mode: 'tel' }) +
      '<h2>학력·경력·자격</h2>' + rowsHtml('education') + rowsHtml('career') + rowsHtml('certs') +
      '<h2>건설기초안전보건교육</h2>' + inp('baseSafetyDate', '이수일', { type: 'date' }) +
      '<h2>가족관계</h2>' + rowsHtml('family') +
      '<h2>서류·사진</h2><div style="opacity:.75;font-size:13px">촬영하거나 사진을 고르면 바로 올라갑니다. 글자가 읽히도록 밝은 곳에서 찍어 주세요.</div>' + fileHtml() +
      '<h2>자기소개서</h2><label class="ef-f"><textarea data-k="selfIntro" rows="8"' + (st.locked ? ' disabled' : '') + '>' + esc(val('selfIntro')) + '</textarea></label>' +
      '<div class="ef-bar">' + (st.locked ? '' : '<button class="jh-btn" data-variant="secondary" id="ef-save" type="button"' + (st.busy ? ' disabled' : '') + '>임시저장</button><button class="jh-btn" id="ef-submit" type="button"' + (st.busy ? ' disabled' : '') + '>제출</button>') + (embedded ? '<a class="jh-btn" data-variant="ghost" href="#/home">← 홈으로</a>' : '<button class="jh-btn" data-variant="ghost" id="ef-out" type="button">로그아웃</button>') + '</div></div>';
  }
  function collect() {
    const f = JSON.parse(JSON.stringify(D())); delete f.juminMasked; delete f.consent;
    root.querySelectorAll('[data-k]').forEach((el) => { const p = el.getAttribute('data-k').split('.'); let o = f; while (p.length > 1) { const k = p.shift(); o[k] = o[k] || {}; o = o[k]; } o[p[0]] = el.value; });
    Object.keys(ROWS).forEach((key) => { f[key] = []; });
    root.querySelectorAll('[data-row]').forEach((el) => { const key = el.getAttribute('data-row'), i = +el.getAttribute('data-i'), c = el.getAttribute('data-c'); f[key][i] = f[key][i] || {}; f[key][i][c] = el.type === 'checkbox' ? el.checked : el.value; });
    const j = root.querySelector('#ef-jumin'); st.jumin = j ? j.value : ''; if (st.jumin.replace(/[^0-9]/g, '')) f.jumin = st.jumin; return f;
  }
  const keep = (f) => { Object.keys(f).forEach((k) => { if (k !== 'jumin') st.draft[k] = f[k]; }); };
  async function save(quiet) {
    const f = collect(); keep(f); const ck = root.querySelector('#ef-consent'); st.consent = !!(ck && ck.checked);
    const r = await call({ action: 'save', fields: f, consent: st.consent }); st.draft.juminMasked = r.juminMasked || st.draft.juminMasked; if (f.jumin) st.jumin = ''; if (st.consent) st.draft.consent = { ok: true };
    if (!quiet) { st.msg = '임시저장했습니다.'; st.bad = false; } return r;
  }
  async function guard(fn) { if (st.busy) return; st.busy = true; st.bad = false; try { await fn(); } catch (e) { st.msg = errMsg(e); st.bad = true; } st.busy = false; paint(); }
  root.onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'ef-out') { if (onLogout) onLogout(); return; }
    if (t.id === 'ef-save') { guard(() => save()); return; }
    if (t.id === 'ef-submit') { guard(async () => { await save(true); await call({ action: 'submit' }); st.status = 'submitted'; st.msg = ''; window.scrollTo(0, 0); }); return; }
    const add = t.getAttribute('data-add'); if (add) { keep(collect()); (st.draft[add] = st.draft[add] || []).push({}); if (!st.draft[add].length) st.draft[add].push({}); paint(); return; }
    const del = t.getAttribute('data-del'); if (del) { const [key, i] = del.split(':'); keep(collect()); st.draft[key].splice(+i, 1); paint(); }
  };
  root.onchange = (e) => {
    const el = e.target; if (!el.matches || !el.matches('input[data-slot]') || !el.files || !el.files[0]) return; const slot = el.getAttribute('data-slot');
    guard(async () => { const dataUrl = await compress(el.files[0]); await call({ action: 'upload', slot, dataUrl }); if (st.files.indexOf(slot) === -1) st.files.push(slot); st.msg = SLOT_LABEL[slot] + ' 올림'; });
  };
  paint();
  call({ action: 'get' }).then((r) => { st.status = r.status === 'new' ? 'draft' : r.status; st.draft = r.draft || {}; if (!st.draft.name && r.prefillName) st.draft.name = r.prefillName; st.files = r.files || []; st.reject = r.rejectReason || ''; if (!st.draft.education) st.draft.education = []; paint(); })
    .catch((e) => { st.status = 'draft'; st.msg = errMsg(e); st.bad = true; paint(); });
}
