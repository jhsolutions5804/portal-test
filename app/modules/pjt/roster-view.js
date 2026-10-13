import { esc } from '../../core/ui.js?v=20261014i';
import { EDU, EDU_SK, EDU_OF, PORTAL_OF, COMPANIES, CO_TABS, HEALTH_TYPES, CHEM_REQ_HOURS, FILE_SLOTS, certCo, fmtKB, fmtMoney, fmtH, maskedOf, healthExpiry, eduStateOf, eduInfo, chemYearSum, legalAgg, filesMeta, SORT_OPTS, leaderChoices, canEditSlot } from './roster.js?v=20261014i';
const chip = (tone, text, title) => '<span class="jh-pjt__chip" data-tone="' + tone + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const stateChip = (r) => (r.state === 'expired' ? chip('red', '만료됨 (D+' + Math.abs(r.d) + ')') : r.state === 'soon' ? chip('amber', 'D-' + r.d) : r.chk && r.exp ? chip('blue', '유효') : '');
const wrap = (inner) => '<div class="jh-pjt jh-pjt--prog jh-ro"><div class="jh-pjt__main jh-pjt__mainwide">' + inner + '</div></div>';   // .jh-pjt 는 넓은 화면에서 2단(왼쪽 좁게)이라 전체 폭 화면은 --prog 로 감싼다
const legacyLink = '<a class="jh-ro__legacy" href="../pjt_roster/" target="_blank" rel="noopener" title="새 화면에서는 아직 조회만 됩니다. 등록·수정은 구포털 연명부에서 하세요(같은 데이터).">구포털 연명부 열기 ↗ <small>등록·수정은 임시로 여기서</small></a>';
const head = (right) => '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">👷 근로자 연명부</span>' + (right || '') + '</div>';
const initialOf = (n) => esc(String(n || '?').trim().slice(0, 1));
const lvTone = (lv) => (lv === 'danger' ? 'red' : lv === 'warn' ? 'amber' : 'gray');
const teamChip = (r) => (r.team.kind === 'lead' ? chip('blue', '팀장/독립') + (r.team.account ? ' ' + chip('gray', '🔗 ' + r.team.account, '내 팀 공수표 조회 계정') : '') : chip('gray', r.team.leader + ' 팀'));
const countOf = (r, lv) => r.issues.filter((i) => i.level === lv).length;
const flagHtml = (r) => (r.m.resigned ? chip('gray', '퇴사') : countOf(r, 'danger') ? chip('red', '만료 ' + countOf(r, 'danger')) : countOf(r, 'warn') ? chip('amber', '임박 ' + countOf(r, 'warn')) : '');

// ── 입력 폼(2단계): 카드마다 따로 수정, 입력값은 st.edit.form 에 쌓는다 ──
const fld = (label, name, value, o) => { o = o || {}; return '<div class="jh-ro__fld"' + (o.wide ? ' data-wide="1"' : '') + '><label>' + esc(label) + (o.req ? ' <b>*</b>' : '') + '</label><input class="jh-input" data-ro-f="' + name + '" type="' + (o.type || 'text') + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' autocomplete="off" value="' + esc(value) + '">' + (o.hint ? '<small>' + o.hint + '</small>' : '') + '</div>'; };
const sel = (label, name, value, opts, o) => '<div class="jh-ro__fld"' + ((o && o.wide) ? ' data-wide="1"' : '') + '><label>' + esc(label) + '</label><select class="jh-input" data-ro-f="' + name + '">' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>';
const saveBar = (st, card) => '<div class="jh-ro__fbar">' + (st.edit && st.edit.msg ? '<span class="jh-ro__msg" data-bad="1" role="alert">' + esc(st.edit.msg) + '</span>' : '<span></span>') + '<span><button type="button" class="jh-btn" data-variant="secondary" data-ro-cancel>취소</button> <button type="button" class="jh-btn" data-variant="primary" data-ro-save="' + card + '"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '저장 중...' : '저장') + '</button></span></div>';
const editBtn = (st, card) => (st.canEdit && !st.edit ? '<button type="button" class="jh-btn" data-variant="secondary" data-ro-edit="' + card + '">✏️ 수정</button>' : '');
/** 인적사항 입력 폼(신규 등록과 수정이 같은 폼): m 이 없으면 신규 */
function personalForm(st, m) {
  const f = st.edit.form; const isNew = !m; const hm = st.hrMatch(f.name, f.birth); const masked = m ? maskedOf(st.privs[m.id] || {}) : '';
  const leaders = leaderChoices(st.masters, m ? m.id : '', m ? m.leaderId : ''); const sub = (st.edit.jchange || isNew);
  return '<div class="jh-ro__form">' + fld('이름', 'name', f.name, { req: 1 }) + fld('생년월일', 'birth', f.birth, { type: 'date', req: 1 }) + sel('성별', 'gender', f.gender, [['', '선택 안 함'], ['남', '남'], ['여', '여']]) + fld('입사일', 'hireDate', f.hireDate, { type: 'date' })
    + sel('소속', 'leaderId', f.leaderId, [['', '팀장/독립']].concat(leaders.map((x) => [x.id, x.name + ' 팀'])))
    + fld('퇴사일', 'resignedDate', f.resignedDate, { type: 'date', hint: f.resignedDate ? '⚠ 퇴사로 처리됩니다. 날짜를 지우면 재직으로 돌아갑니다.' : '재직 중 — 퇴사일을 넣으면 퇴사로 처리됩니다.' })
    + fld('전화번호', 'phone', f.phone, { mode: 'tel', ph: '010-0000-0000' })
    + (hm ? '<div class="jh-ro__fld" data-wide="1"><label>주소 <small>· 인사 명단 연동</small></label><div class="jh-ro__ro">' + (hm.address ? esc(hm.address) : '<span class="jh-field__hint">인사 명단에 주소가 없습니다</span>') + '</div><small>직원은 인사 근로자 명단에서 관리됩니다. 고치려면 인사 › 근로자 명단에서 수정하세요.</small></div>' : fld('주소', 'address', f.address, { wide: 1, ph: '예: 충청남도 공주시 우체국길 24-2' }))
    + (sub ? fld('주민(외국인)등록번호', 'jumin', f.jumin, { mode: 'numeric', max: 14, wide: 1, ph: '13자리 숫자 — 입력하면 생년월일·성별이 자동으로 채워집니다', hint: isNew ? '서버가 암호화해서 보관하고, 화면에는 마스킹 값만 보입니다.' : '새 번호를 입력하면 바뀝니다(서버가 암호화해 보관).' })
      : '<div class="jh-ro__fld" data-wide="1"><label>주민(외국인)등록번호</label><div class="jh-ro__ro">' + esc(masked) + ' <button type="button" class="jh-btn" data-variant="secondary" data-ro-jchange>번호 변경</button></div></div>')
    + (st.admin && !f.leaderId ? sel('팀장 포털 계정 (내 팀 공수표 조회용)', 'portalUid', f.portalUid, [['', '연결 안 함']].concat(st.accounts.map((u) => [u.uid, u.name + (u.rank ? ' (' + u.rank + ')' : '') + ' · ' + u.email])), { wide: 1 }) : '')
    + '</div>' + saveBar(st, isNew ? 'new' : 'personal');
}
const payForm = (st) => { const f = st.edit.form; return '<div class="jh-ro__form">' + fld('일당 (원)', 'rate', f.rate, { mode: 'numeric', ph: '예: 200,000' }) + fld('은행', 'bank', f.bank) + fld('계좌번호', 'account', f.account) + '</div>' + saveBar(st, 'pay'); };
const noteForm = (st) => '<div class="jh-ro__form"><div class="jh-ro__fld" data-wide="1"><textarea class="jh-textarea" data-ro-f="note" rows="4">' + esc(st.edit.form.note) + '</textarea></div></div>' + saveBar(st, 'note');
const REASONS = ['4대보험 신고', '원천징수', '신분 확인', '기타'];
/** 주민번호 보기(사유 선택): 사유를 고르면 서버가 열람 기록을 남기고 번호를 돌려준다 — 화면에만 잠깐 보이고 저장하지 않는다 */
const juminTool = (st, m) => {
  if (!st.canEdit) return ''; const j = st.jr && st.jr.id === m.id ? st.jr : null;
  if (j && j.value) return ' <code class="jh-ro__jv">' + esc(j.value) + '</code> <button type="button" class="jh-btn" data-variant="secondary" data-ro-jhide>가리기</button> <small class="jh-field__hint">20초 뒤 자동으로 가려집니다</small>';
  if (j && j.ask) return '<div class="jh-ro__reason" role="group" aria-label="열람 사유">' + REASONS.map((r) => '<label><input type="radio" name="jh-ro-reason" data-ro-jreason value="' + esc(r) + '"' + (j.reason === r ? ' checked' : '') + '> ' + esc(r) + '</label>').join('') + '<div><button type="button" class="jh-btn" data-variant="primary" data-ro-jgo' + (st.busy ? ' disabled' : '') + '>보기</button> <button type="button" class="jh-btn" data-variant="secondary" data-ro-jhide>취소</button></div><small class="jh-field__hint">열람 기록(누가·누구의 번호·언제·사유)이 3년간 남습니다. 업무상 필요할 때만 보세요.</small>' + (j.err ? '<div class="jh-ro__msg" data-bad="1" role="alert">' + esc(j.err) + '</div>' : '') + '</div>';
  return ' <button type="button" class="jh-btn" data-variant="secondary" data-ro-jask>보기 (사유 선택)</button>';
};
/** 신규 등록(오른쪽 영역 전체) */
const newPanel = (st) => '<div class="jh-ro__newhd"><button type="button" class="jh-btn jh-ro__back" data-variant="secondary" data-ro-cancel>← 명단</button></div>' + card('신규 근로자 등록', personalForm(st, null));
/** 왼쪽 명단: 필터(재직·퇴사·전체·조치 필요) + 검색 + 정렬 + 사람 목록 */
function listPanel(st) {
  const C = st.counts; const f = (k, label, n) => '<button type="button" class="jh-pjt__cat" data-ro-filter="' + k + '"' + (st.filter === k ? ' aria-pressed="true"' : '') + '>' + label + ' <small>' + n + '</small></button>';
  const filters = '<div class="jh-pjt__cats">' + f('active', '재직', C.active) + f('alert', '⚠ 조치 필요', C.alert) + f('resigned', '퇴사', C.resigned) + f('all', '전체', C.all) + '</div>';
  const tools = '<div class="jh-ro__tools"><input class="jh-input jh-ro__q" type="search" data-ro-q placeholder="이름·전화번호·자격 검색" value="' + esc(st.query) + '" aria-label="검색"><select class="jh-input" data-ro-sortm aria-label="정렬">' + SORT_OPTS.map((o) => '<option value="' + o[0] + '"' + ((st.sortKey || '') === o[0] ? ' selected' : '') + '>' + (o[0] ? '정렬: ' : '') + o[1] + '</option>').join('') + '</select><button type="button" class="jh-btn" data-variant="secondary" data-ro-dir' + (st.sortKey ? '' : ' disabled') + ' title="정렬 방향">' + (st.sortDir === 1 ? '▲' : '▼') + '</button></div>';
  const items = st.rows.length ? st.rows.map((r) => { const m = r.m; return '<button type="button" class="jh-ro__it" data-ro-open="' + esc(m.id) + '"' + (st.sel === m.id ? ' aria-current="true"' : '') + (m.resigned ? ' data-resigned="1"' : '') + '><span class="jh-ro__av" data-lv="' + r.level + '">' + initialOf(m.name) + '</span><span class="jh-ro__tx"><strong class="jh-ro__nm">' + esc(m.name) + '</strong><small>' + esc(r.team.kind === 'lead' ? '팀장/독립' : r.team.leader + ' 팀') + (m.hireDate ? ' · ' + esc(m.hireDate) : '') + '</small></span><span class="jh-ro__fl">' + flagHtml(r) + '</span></button>'; }).join('') : '<div class="jh-empty">' + (st.masters.length ? '조건에 맞는 근로자가 없습니다.' : '등록된 근로자가 없습니다.') + '</div>';
  return '<aside class="jh-ro__list jh-card">' + (st.canEdit ? '<div class="jh-ro__lh"><button type="button" class="jh-btn" data-variant="primary" data-ro-new>＋ 신규 등록</button></div>' : '') + filters + tools + '<div class="jh-ro__items">' + items + '</div></aside>';
}
/** 오른쪽 기본 화면: 조치 필요 현황(누가 무엇이 만료·임박인지) */
function dashboard(st) {
  const rows = st.alertRows; const S = st.summary;
  const kpis = '<div class="jh-ro__kpis">' + [['재직 인원', S.active, ''], ['조치 필요', rows.length, rows.length ? 'danger' : ''], ['일반검진 기록 없음', S.noHealth, ''], ['사내화 교육(삼성) 미완료·만료', S.eduLack, '']].map(([l, n, w]) => '<div class="jh-ro__kpi"' + (w ? ' data-warn="1"' : '') + '><span>' + l + '</span><strong>' + n + '<small> 명</small></strong></div>').join('') + '</div>';
  const body = rows.length ? '<div class="jh-ro__issues">' + rows.map((r) => '<button type="button" class="jh-ro__ir" data-ro-open="' + esc(r.m.id) + '"><span class="jh-ro__av" data-lv="' + r.level + '">' + initialOf(r.m.name) + '</span><span class="jh-ro__tx"><strong class="jh-ro__nm">' + esc(r.m.name) + '</strong><small>' + esc(r.team.kind === 'lead' ? '팀장/독립' : r.team.leader + ' 팀') + '</small></span><span class="jh-ro__ichips">' + r.issues.filter((i) => i.level !== 'info').map((i) => chip(lvTone(i.level), i.text)).join(' ') + '</span></button>').join('') + '</div>' : '<div class="jh-empty">✓ 만료됐거나 30일 안에 만료되는 검진·교육·자격이 없습니다.</div>';
  return kpis + card('조치 필요 현황', body, '<span class="jh-field__hint">만료됐거나 30일 안에 만료되는 항목 · 재직자 기준</span>');
}
const kv2 = (label, val, wide) => '<div class="jh-ro__kv"' + (wide ? ' data-wide="1"' : '') + '><span>' + esc(label) + '</span><div>' + (val === '' || val == null ? '<span class="jh-field__hint">—</span>' : val) + '</div></div>';
/** 오른쪽 상세: 머리 카드 → 조치 필요 → 카드들(인적사항·서류·건강검진·원청별·급여·비고) */
function detailPanel(st) {
  const r = st.rows.find((x) => x.m.id === st.sel) || st.allRows.find((x) => x.m.id === st.sel); const back = '<button type="button" class="jh-btn jh-ro__back" data-variant="secondary" data-ro-back>← 명단</button>';
  if (!r) return back + '<div class="jh-alert" data-tone="warn" role="status">찾을 수 없는 근로자입니다.</div>';
  const m = r.m, p = r.p; const members = !m.leaderId ? st.masters.filter((x) => x.leaderId === m.id) : []; const acc = !m.leaderId ? st.accountOf(m.id) : null; const hm = st.hrMatch(m.name, m.birth); const fm = filesMeta(p);
  const meta = [m.birth, m.gender, m.hireDate ? '입사 ' + m.hireDate : '', p.phone].filter(Boolean).map(esc).join(' · ');
  const top = '<div class="jh-ro__top jh-card"><span class="jh-ro__av jh-ro__av--lg" data-lv="' + r.level + '">' + initialOf(m.name) + '</span><div class="jh-ro__ti"><h2>' + esc(m.name) + (m.resigned ? ' ' + chip('gray', '퇴사 ' + (m.resignedDate || '')) : '') + '</h2><div>' + teamChip(r) + '</div><div class="jh-field__hint">' + (meta || '인적사항이 비어 있습니다') + '</div></div>' + back + '</div>';
  const iss = r.issues; const issBody = iss.length ? '<div class="jh-ro__ichips jh-ro__ichips--pad">' + iss.map((i) => chip(lvTone(i.level), i.text)).join(' ') + '</div>' : '<div class="jh-ro__ok">✓ 만료됐거나 임박한 검진·교육·자격이 없습니다.</div>';
  const issues = card(r.level ? '조치 필요' : '상태', m.resigned ? '<div class="jh-field__hint jh-ro__pad">퇴사자는 알림 대상이 아닙니다.</div>' : issBody);
  const personal = (st.edit && st.edit.card === 'personal') ? card('인적사항 수정', personalForm(st, m)) : card('인적사항', '<div class="jh-ro__kvs">' + kv2('생년월일', esc(m.birth || '')) + kv2('성별', esc(m.gender || '')) + kv2('입사일', esc(m.hireDate || '')) + kv2('퇴사일', m.resigned ? esc(m.resignedDate || '(일자 없음)') : '재직 중') + kv2('주민(외국인)등록번호', esc(maskedOf(p)) + juminTool(st, m), true) + kv2('전화번호', esc(p.phone || '')) + kv2('주소' + (hm ? ' · 인사 명단 연동' : ''), hm ? (hm.address ? esc(hm.address) : '<span class="jh-field__hint">인사 명단에 주소가 없습니다</span>') : esc(p.address || ''), true) + (!m.leaderId ? kv2('팀원', members.length ? esc(members.map((x) => x.name).join(', ')) : '') + (st.admin ? kv2('팀장 포털 계정', acc ? esc(acc.name + (acc.rank ? ' (' + acc.rank + ')' : '') + ' · ' + acc.email) : '') : '') : '') + '</div>', editBtn(st, 'personal'));
  const slotRow = (x) => { const meta = fm[x.k]; const can = canEditSlot(x.k, st.admin, st.canEdit); const busy = st.busy ? ' disabled' : '';
    const info = meta ? '📎 ' + esc(meta.name || '') + (meta.w ? ' · ' + meta.w + '×' + meta.h : '') + (meta.size ? ' · ' + fmtKB(meta.size) : '') : '<span class="jh-field__hint">등록된 파일 없음</span>';
    const acts = (meta ? '<button type="button" class="jh-btn" data-variant="secondary" data-ro-fview="' + x.k + '">보기</button> <button type="button" class="jh-btn" data-variant="secondary" data-ro-fdl="' + x.k + '">⬇ 다운로드</button> ' : '')
      + (can ? '<label class="jh-btn" data-variant="secondary" aria-disabled="' + (st.busy ? 'true' : 'false') + '">' + (meta ? '교체' : '파일 선택') + '<input type="file" accept="image/*" hidden data-ro-file="' + x.k + '"' + busy + '></label>' + (meta ? ' <button type="button" class="jh-btn" data-variant="danger" data-ro-fdel="' + x.k + '"' + busy + '>삭제</button>' : '') : '');
    return '<div class="jh-ro__frow"><div class="jh-ro__fl2">' + esc(x.label) + '</div><div class="jh-ro__fi">' + info + '</div><div class="jh-ro__fa">' + acts + '</div></div>'; };
  const files = card('서류·사진', '<div class="jh-ro__files">' + FILE_SLOTS.filter((x) => !x.admin || st.admin).map(slotRow).join('') + '</div><div class="jh-field__hint jh-ro__pad">파일은 화면에 바로 표시하지 않고 보관하며, [보기]를 눌렀을 때만 열립니다. 올리면 긴 변 2000px·약 700KB 이하로 줄여 저장합니다(이미지 파일만).</div>');
  const pay = st.admin ? (st.edit && st.edit.card === 'pay') ? card('급여·계좌 수정 (관리자 전용)', payForm(st)) : card('급여·계좌 (관리자 전용)', '<div class="jh-ro__kvs">' + kv2('일당', (p.dailyRate != null ? p.dailyRate : m.dailyRate) ? esc(fmtMoney(p.dailyRate != null ? p.dailyRate : m.dailyRate)) + '원' : '') + kv2('은행', esc(p.bank || '')) + kv2('계좌번호', esc(p.account || '')) + '</div>', editBtn(st, 'pay')) : '';
  const health = card('건강검진', healthHtml(p, st.today));
  const company = card('원청별 교육 · 자격 · 계정', companyHtml(st, p));
  const note = (st.edit && st.edit.card === 'note') ? card('비고 수정', noteForm(st)) : card('비고', p.note ? '<div class="jh-ro__note">' + esc(p.note) + '</div>' : '<div class="jh-field__hint jh-ro__pad">비고가 없습니다.</div>', editBtn(st, 'note'));
  const danger = st.admin ? '<div class="jh-ro__danger"><span class="jh-field__hint">연명부에서 이 근로자와 그 정보(개인정보·검진·사진 등)를 지웁니다. 각 프로젝트의 근태·공수 기록은 남습니다.</span><button type="button" class="jh-btn" data-variant="danger" data-ro-del>이 근로자 삭제</button></div>' : '';
  const editingPersonal = st.edit && st.edit.card === 'personal';   // 수정 중인 인적사항은 전체 폭으로(반쪽 카드에서는 입력칸이 한 줄로 길게 늘어진다)
  return top + issues + (editingPersonal ? personal + '<div class="jh-ro__grid">' + files + '</div>' : '<div class="jh-ro__grid">' + personal + files + '</div>') + health + company + '<div class="jh-ro__grid">' + pay + note + '</div>' + danger;
}
/** 연명부 화면 전체: 왼쪽 명단 + 오른쪽(사람을 고르면 상세, 아니면 조치 필요 현황). 폰에서는 둘 중 하나만 보인다 */
export function rosterHtml(st) {
  if (!st.allowed) return wrap(head() + '<div class="jh-alert" data-tone="warn" role="status">연명부는 PJT 권한이 있는 직원과 관리자만 볼 수 있습니다.</div>');
  if (!st.ready) return wrap(head() + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>'));
  const photo = st.photo ? '<div class="jh-dialog" role="dialog" aria-modal="true" aria-label="' + esc(st.photo.title) + '"><div class="jh-dialog__backdrop" data-ro-fclose></div><div class="jh-dialog__panel jh-ro__ph"><h3 class="jh-dialog__title">' + esc(st.photo.title) + '</h3><div class="jh-dialog__body"><img class="jh-ro__img" alt="' + esc(st.photo.title) + '" src="' + esc(st.photo.src) + '"></div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="secondary" data-ro-fdl="' + esc(st.photo.slot) + '">⬇ 다운로드</button><button type="button" class="jh-btn" data-variant="primary" data-ro-fclose>닫기</button></div></div></div>' : '';
  return wrap(head(legacyLink) + '<div class="jh-ro__shell" data-view="' + (st.sel || (st.edit && st.edit.card === 'new') ? 'detail' : 'list') + '">' + listPanel(st) + '<div class="jh-ro__main">' + (st.sel ? detailPanel(st) : (st.edit && st.edit.card === 'new') ? newPanel(st) : dashboard(st)) + '</div></div>' + photo);
}
const kv = (label, val, wide) => '<div class="jh-ro__kv"' + (wide ? ' data-wide="1"' : '') + '><span>' + esc(label) + '</span><div>' + (val === '' || val == null ? '<span class="jh-field__hint">—</span>' : val) + '</div></div>';
const dateRow = (s) => esc(s || '—');
function healthHtml(p, today) {
  const rows = ((p && p.health) || []).filter((h) => h.date).slice().sort((a, b) => b.date.localeCompare(a.date)); if (!rows.length) return '<div class="jh-field__hint">등록된 검진 이력이 없습니다.</div>';
  return '<table class="jh-ro__t"><thead><tr><th>종류</th><th>실시일</th><th>만료일</th><th>상태</th><th>결과 PDF</th></tr></thead><tbody>' + rows.map((h) => { const exp = h.expiry || healthExpiry({ health: [h] }, h.type); return '<tr><td>' + esc(HEALTH_TYPES[h.type] || h.type) + '</td><td>' + esc(h.date) + '</td><td>' + esc(exp || '—') + (h.expiryManual ? ' ' + chip('amber', '수정됨') : '') + '</td><td>' + (exp ? stateChip(eduStateOf(true, exp, today)) : '') + '</td><td>' + (h.pdf ? '📄 ' + esc(h.pdf.name || '') : '<span class="jh-field__hint">—</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
}
function legalHtml(p, co, year) {
  const rows = ((p && p.legalEdu) || []).filter((r) => certCo(r) === co).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const list = rows.length ? '<table class="jh-ro__t"><thead><tr><th>시공사</th><th>교육 종류</th><th>교육일</th><th>시간</th><th>비고</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.contractor || '—') + '</td><td>' + esc(r.type || '') + '</td><td>' + esc(r.date || '') + '</td><td>' + esc(fmtH(Number(r.hours) || 0)) + '</td><td>' + esc(r.note || '') + '</td></tr>').join('') + '</tbody></table>' : '<div class="jh-field__hint">등록된 법정교육 이력이 없습니다.</div>';
  const agg = legalAgg((p && p.legalEdu) || [], co, year); let sum = '<div class="jh-field__hint">교육 이력이 있으면 시공사·교육 종류별 누계가 여기에 표시됩니다.</div>';
  if (agg.length) { let rowsH = '', cur = null, sub = null; const flush = () => { if (sub && sub.rows > 1) rowsH += '<tr data-subtotal="1"><td colspan="2">' + esc(sub.c) + ' 소계</td><td>' + fmtH(sub.total) + '</td><td>' + fmtH(sub.year) + '</td><td></td></tr>'; };
    agg.forEach((o) => { if (!cur || cur !== o.c) { flush(); cur = o.c; sub = { c: o.c, total: 0, year: 0, rows: 0 }; } sub.total += o.total; sub.year += o.year; sub.rows++; rowsH += '<tr><td>' + esc(o.c) + '</td><td>' + esc(o.t) + ' <span class="jh-field__hint">(' + o.n + '회)</span></td><td><b>' + fmtH(o.total) + '</b></td><td>' + fmtH(o.year) + '</td><td>' + o.q.map((v, i) => (i + 1) + '분기 ' + fmtH(v)).join(' · ') + '</td></tr>'; }); flush();
    sum = '<table class="jh-ro__t"><thead><tr><th>시공사</th><th>교육 종류</th><th>누계</th><th>' + year + '년</th><th>' + year + '년 분기별</th></tr></thead><tbody>' + rowsH + '</tbody></table>'; }
  return '<h4>법정교육</h4>' + list + '<h4>누계 <small>(시공사별로 따로 집계)</small></h4>' + sum;
}
function certHtml(p, co) {
  const rows = ((p && p.certs) || []).filter((c) => certCo(c) === co); if (!rows.length) return '<div class="jh-field__hint">등록된 자격·인증이 없습니다.</div>';
  return '<table class="jh-ro__t"><thead><tr><th>자격/인증</th><th>현장</th><th>시공사</th><th>취득일</th><th>만료일</th><th>상태</th></tr></thead><tbody>' + rows.map((c) => '<tr><td>' + esc(c.name || '') + '</td><td>' + esc(c.site || '') + '</td><td>' + esc(c.contractor || '') + '</td><td>' + dateRow(c.acquired) + '</td><td>' + dateRow(c.expiry) + (c.expiryManual ? ' ' + chip('amber', '수정됨') : '') + '</td><td>' + (c.expiry ? stateChip(eduStateOf(true, c.expiry)) : '') + '</td></tr>').join('') + '</tbody></table>';
}
function eduPortalHtml(st, p, co) {
  const list = EDU_OF[co] || EDU; const pt = PORTAL_OF[co]; const pw = (p || {})[pt.pwK] || ''; const shown = st.reveal.has(pt.pwK);
  const edu = list.map((e) => { const i = eduInfo(p, e.k, st.today); return '<div class="jh-ro__edu"><span>' + (i.chk ? '☑' : '☐') + ' ' + esc(e.label) + '</span><span>' + (i.chk && i.exp ? esc('만료 ' + i.exp) + ' ' : '') + stateChip(i) + '</span></div>'; }).join('');
  return '<h4>' + esc(pt.label) + ' 계정</h4><div class="jh-ro__kvs">' + kv('아이디', esc((p || {})[pt.idK] || '')) + kv('비밀번호', pw ? (shown ? '<code>' + esc(pw) + '</code>' : '••••••') + ' <button type="button" class="jh-btn" data-variant="secondary" data-ro-pw="' + pt.pwK + '">' + (shown ? '숨기기' : '표시') + '</button>' : '') + '</div><div class="jh-field__hint">⚠️ 비밀번호는 암호화되지 않고 저장됩니다. 개인 비밀번호가 아닌 업무용·초기 비밀번호만 보관해 주세요.</div><h4>사내화 교육 이수 여부</h4>' + edu;
}
function chemHtml(st, p) {
  const rows = ((p && p.chemEdu) || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))); const y = +st.today.slice(0, 4); const ys = new Set([y]); rows.forEach((r) => { const m = /^(\d{4})-/.exec(r.date || ''); if (m) ys.add(+m[1]); });
  const sum = Array.from(ys).sort((a, b) => b - a).map((yy) => { const s = chemYearSum(rows, yy), ok = s >= CHEM_REQ_HOURS; return '<tr><td>' + yy + '년</td><td><b>' + fmtH(s) + '</b> / ' + CHEM_REQ_HOURS + 'h</td><td>' + (ok ? chip('blue', '이수') : yy === y ? chip('amber', '미이수 (잔여 ' + fmtH(CHEM_REQ_HOURS - s) + ')') : chip('red', '미이수')) + '</td></tr>'; }).join('');
  const kcPw = (p || {}).kcPw || '', shown = st.reveal.has('kcPw');
  return '<h4>화학물질안전원 교육시스템 계정</h4><div class="jh-ro__kvs">' + kv('아이디', esc((p || {}).kcId || '')) + kv('비밀번호', kcPw ? (shown ? '<code>' + esc(kcPw) + '</code>' : '••••••') + ' <button type="button" class="jh-btn" data-variant="secondary" data-ro-pw="kcPw">' + (shown ? '숨기기' : '표시') + '</button>' : '') + '</div>'
    + '<h4>종사자 교육과정 <small>(연 ' + CHEM_REQ_HOURS + '시간)</small></h4>' + (rows.length ? '<table class="jh-ro__t"><thead><tr><th>교육일</th><th>시간</th><th>비고</th><th>수료증 PDF</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.date || '') + '</td><td>' + fmtH(Number(r.hours) || 0) + '</td><td>' + esc(r.note || '') + '</td><td>' + (r.pdf ? '📄 ' + esc(r.pdf.name || '') : '—') + '</td></tr>').join('') + '</tbody></table>' : '<div class="jh-field__hint">등록된 종사자 교육 이력이 없습니다.</div>')
    + '<h4>연도별 이수 현황</h4><table class="jh-ro__t"><thead><tr><th>연도</th><th>누계 / 기준</th><th>상태</th></tr></thead><tbody>' + sum + '</tbody></table>';
}
function companyHtml(st, p) {
  const year = +st.today.slice(0, 4); const legalCnt = (k) => ((p && p.legalEdu) || []).filter((r) => certCo(r) === k).length, certCnt = (k) => ((p && p.certs) || []).filter((c) => certCo(c) === k).length, eduCnt = (k) => (EDU_OF[k] || []).filter((e) => eduInfo(p, e.k, st.today).chk).length;
  const tabCnt = (k) => (k === 'chem' ? ((p && p.chemEdu) || []).length : legalCnt(k) + certCnt(k));
  const tabs = '<div class="jh-pjt__cats">' + CO_TABS.map((x) => '<button type="button" class="jh-pjt__cat" data-ro-cotab="' + x.k + '"' + (st.coTab === x.k ? ' aria-pressed="true"' : '') + '>' + esc(x.label) + ' <small>' + tabCnt(x.k) + '</small></button>').join('') + '</div>';
  if (st.coTab === 'chem') return tabs + chemHtml(st, p);
  const co = COMPANIES.find((x) => x.k === st.coTab) || COMPANIES[0]; const pt = PORTAL_OF[co.k];
  const subs = [['legal', '법정교육', legalCnt(co.k)], ['cert', '자격 · 인증', certCnt(co.k)], ['edu', '사내화 교육 · ' + pt.label, eduCnt(co.k)]];
  const subTabs = '<div class="jh-pjt__cats">' + subs.map(([k, l, n]) => '<button type="button" class="jh-pjt__cat" data-ro-cosub="' + k + '"' + (st.coSub === k ? ' aria-pressed="true"' : '') + '>' + esc(l) + ' <small>' + n + '</small></button>').join('') + '</div>';
  return tabs + subTabs + (st.coSub === 'cert' ? '<h4>자격 · 인증 <small>(' + esc(co.label) + ')</small></h4>' + certHtml(p, co.k) : st.coSub === 'edu' ? eduPortalHtml(st, p, co.k) : legalHtml(p, co.k, year));
}
