/* 입사 입력 검토(관리자) — 입사자가 Microsoft 로그인으로 직접 입력·제출한 내용을 확인하고 수동으로 근로자 명부에 반영하거나 반려한다.
 * 모든 조회·반영은 서버 함수 entryAct 로만(관리자 전용). 설계서 app-docs/worker-self-entry-design.md */
import { functions, httpsCallable } from '../../core/firebase.js?v=20261113c';
import { esc, toast } from '../../core/ui.js?v=20261113c';

export const manifest = { id: 'entry', order: 22, title: '입사 입력', icon: '📝', defaultHash: '#/entry/list', perm: (me) => !!me && me.admin === true };
const call = async (data) => (await httpsCallable(functions, 'entryAct')(data)).data;
const errMsg = (e) => String((e && e.message) || '').replace(/^.*?:\s*/, '') || '처리하지 못했습니다.';
const when = (ms) => (ms ? new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');
const SLOT = { photo: '증명사진', idcard: '신분증', cert: '건설기초 이수증', bank: '통장 사본', qual1: '자격증 1', qual2: '자격증 2', qual3: '자격증 3' };
const kv = (k, v) => (v ? '<div><b>' + esc(k) + '</b> ' + esc(v) + '</div>' : '');
const tbl = (title, rows, cols) => (rows && rows.length ? '<h4>' + title + '</h4><table class="jh-table" style="width:100%;font-size:13px"><tr>' + cols.map((c) => '<th>' + c[1] + '</th>').join('') + '</tr>' + rows.map((r) => '<tr>' + cols.map((c) => '<td>' + esc(c[0] === 'together' ? (r[c[0]] ? '동거' : '') : r[c[0]] || '') + '</td>').join('') + '</tr>').join('') + '</table>' : '');

export async function mount(root, route, ctx) {
  root.onclick = null; let items = []; let cur = null; let msg = '';
  const open = route && route.segs && route.segs[1] ? route.segs[1] : '';
  async function loadList() { root.innerHTML = '<div style="padding:16px">불러오는 중…</div>'; try { items = (await call({ action: 'list' })).items; } catch (e) { items = []; msg = errMsg(e); } paintList(); }
  function paintList() {
    root.innerHTML = '<div style="padding:16px;max-width:900px"><h2 style="margin:0 0 4px">입사 입력 검토</h2><div style="opacity:.75;margin-bottom:12px">입사자가 직접 입력해 제출한 내용입니다. 확인 후 [근로자 명부에 반영]하면 명부에 들어갑니다(수동 승인).</div>' + (msg ? '<div class="jh-alert" data-tone="danger">' + esc(msg) + '</div>' : '') +
      (items.length ? '<table class="jh-table" style="width:100%"><tr><th>성명</th><th>주민번호</th><th>휴대폰</th><th>상태</th><th>제출</th><th></th></tr>' + items.map((x) => '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.juminMasked) + '</td><td>' + esc(x.phone) + '</td><td>' + (x.status === 'submitted' ? '검토 대기' : '반려(수정 대기)') + '</td><td>' + esc(when(x.submittedAt)) + '</td><td><button class="jh-btn" data-open="' + esc(x.uid) + '">열기</button></td></tr>').join('') + '</table>' : '<p>도착한 입사 입력이 없습니다.</p>') + '</div>';
    root.onclick = (e) => { const b = e.target.closest('[data-open]'); if (b) openOne(b.getAttribute('data-open')); };
  }
  async function openOne(uid) {
    root.innerHTML = '<div style="padding:16px">불러오는 중…</div>';
    try { cur = await call({ action: 'view', uid }); cur.uid = uid; } catch (e) { msg = errMsg(e); await loadList(); return; } paintOne();
  }
  function paintOne() {
    const d = cur.draft || {}; const m = cur.match;
    root.innerHTML = '<div style="padding:16px;max-width:900px"><button class="jh-btn" data-variant="ghost" id="en-back">← 목록</button><h2 style="margin:8px 0">' + esc(d.name) + ' <span style="font-size:14px;opacity:.7">' + esc(d.juminMasked || '') + '</span></h2>' +
      '<div class="jh-alert" data-tone="' + (m ? 'warn' : 'info') + '">' + (m ? '기존 근로자 <b>' + esc(m.name) + ' (사번 ' + esc(m.empNo) + ')</b>와 이름·생년월일이 같습니다 → 반영하면 <b>그 사람의 정보를 업데이트</b>합니다(사번·기존 값 유지).' : '명부에 같은 사람이 없습니다 → 반영하면 <b>새 근로자로 등록</b>합니다(사번 자동 부여).') + '</div>' +
      (cur.status === 'rejected' ? '<div class="jh-alert" data-tone="warn">반려됨: ' + esc(cur.rejectReason) + ' (입사자 수정 대기)</div>' : '') +
      '<h4>인적사항</h4>' + kv('영문 이름', d.nameEn) + kv('휴대폰', d.phone) + kv('이메일', d.email) + kv('주소', [d.address, d.addressDetail].filter(Boolean).join(' ')) + kv('혈액형', d.bloodType) +
      kv('병역', d.military ? [d.military.kind, d.military.branch, d.military.mos, d.military.rank].filter(Boolean).join(' / ') : '') + kv('비상연락처', d.emergency ? [d.emergency.name, d.emergency.relation, d.emergency.phone].filter(Boolean).join(' / ') : '') + kv('건설기초 이수일', d.baseSafetyDate) +
      tbl('학력', d.education, [['school', '학교'], ['major', '전공'], ['from', '입학'], ['to', '졸업'], ['status', '구분']]) + tbl('경력', d.career, [['company', '회사'], ['from', '입사'], ['to', '퇴사'], ['position', '직위'], ['duty', '업무']]) +
      tbl('자격·면허', d.certs, [['name', '자격명'], ['date', '취득일'], ['issuer', '발급처']]) + tbl('가족관계(참고)', d.family, [['relation', '관계'], ['name', '성명'], ['age', '연령'], ['job', '직업'], ['together', '동거']]) +
      (d.selfIntro ? '<h4>자기소개서</h4><div style="white-space:pre-wrap;font-size:14px">' + esc(d.selfIntro) + '</div>' : '') +
      '<h4>서류·사진</h4><div style="display:flex;flex-wrap:wrap;gap:10px">' + Object.keys(cur.fileData || {}).map((s) => '<figure style="margin:0;width:150px"><img alt="' + esc(SLOT[s] || s) + '" src="' + esc(cur.fileData[s]) + '" style="width:150px;border:1px solid #ccc;border-radius:6px"><figcaption style="font-size:12px">' + esc(SLOT[s] || s) + '</figcaption></figure>').join('') + (Object.keys(cur.fileData || {}).length ? '' : '<span>없음</span>') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:18px;position:sticky;bottom:0;padding:10px 0;background:var(--jh-bg,#fff)">' + (cur.status === 'submitted' ? '<button class="jh-btn" id="en-ok">근로자 명부에 반영</button><button class="jh-btn" data-variant="secondary" id="en-no">반려(보완 요청)</button>' : '') + '</div></div>';
    root.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'en-back') { msg = ''; loadList(); return; }
      if (b.id === 'en-ok') { if (!confirm((m ? '기존 근로자 ' + m.name + ' 정보를 업데이트' : '새 근로자로 등록') + '합니다. 반영할까요?')) return; b.disabled = true;
        try { const r = await call({ action: 'approve', uid: cur.uid }); toast(r.created ? '새 근로자로 등록했습니다.' : '기존 근로자 정보를 업데이트했습니다.'); msg = ''; await loadList(); } catch (er) { toast(errMsg(er)); b.disabled = false; } return; }
      if (b.id === 'en-no') { const why = prompt('반려 사유(입사자에게 보입니다)'); if (!why) return; try { await call({ action: 'reject', uid: cur.uid, reason: why }); toast('반려했습니다.'); msg = ''; await loadList(); } catch (er) { toast(errMsg(er)); } }
    };
  }
  if (open) await openOne(open); else await loadList();
}
