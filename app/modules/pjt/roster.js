/* 근로자 연명부 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 연명부(pjt_roster 2.5.1)의 계산·표시 규칙을 그대로 옮겼다.
 * 데이터(동결): master_workers/<id>(기본: 이름·생년월일·성별·입사일·팀장·퇴사), master_worker_info/<id>(실무자 문서: 연락처·주소·검진·자격·교육·계정·비고·첨부 메타),
 * master_worker_private/<id>(관리자 전용: 일당·은행·계좌), master_worker_photos/<id>[__idcard|__cert|__bank](첨부 이미지). 주민번호는 문서에 쓰지 않고 서버 함수(identityAct)가 암호화해 보관, 문서에는 마스킹 값(juminMasked)만 둔다. */
export const EDU = [{ k: 'e1', label: '안전담당자/화재감시자 기본 인증과정' }, { k: 'e2', label: '중량물/양중작업(통합) 안전인증과정' }, { k: 'e3', label: '화학물질취급작업 안전인증과정' }, { k: 'e4', label: '화학물질안전원 온라인 안전교육' }];
export const EDU_SK = [{ k: 's1', label: '기본안전교육(자율책임작업 등)' }, { k: 's2', label: '기본안전교육(A~D급)' }, { k: 's3', label: '신호수/중량물 교육' }, { k: 's4', label: '안전Leaders 교육' }, { k: 's5', label: '화학물질취급 교육' }];
export const EDU_OF = { samsung: EDU, skhynix: EDU_SK };
export const PORTAL_OF = { samsung: { label: '상생협력포탈', idK: 'ssId', pwK: 'ssPw' }, skhynix: { label: '행복한 만남', idK: 'hmId', pwK: 'hmPw' } };
export const CHEM_REQ_HOURS = 2;   // 화학물질안전원 종사자 교육과정 — 연 2시간
export const HEALTH_TYPES = { general: '일반검진', preplace: '배치전검진' };
export const HEALTH_VALID_YEARS = 1;   // 만료일 = 실시일 + 1년(직접 고칠 수 있음)
export const FILE_SLOTS = [{ k: 'photo', label: '사진', short: '사진', suffix: '' }, { k: 'idcard', label: '신분증', short: '신분증', suffix: '__idcard' }, { k: 'cert', label: '건설기초이수증', short: '이수증', suffix: '__cert' }, { k: 'bankbook', label: '통장사본', short: '통장', suffix: '__bank', admin: true }];
export const PHOTO_SLOTS = FILE_SLOTS.filter((x) => !x.admin);
export const COMPANIES = [{ k: 'samsung', label: '삼성전자', short: '삼성' }, { k: 'skhynix', label: 'SK하이닉스', short: 'SK' }];
export const CO_TABS = COMPANIES.concat([{ k: 'chem', label: '화학물질안전원 교육시스템', short: '화안원' }]);
export const certCo = (c) => (c && c.co) || 'samsung';   // 원청 구분이 없던 기존 자격은 삼성전자로 본다
export const slotOf = (k) => FILE_SLOTS.find((x) => x.k === k);
export const slotDocId = (id, k) => id + slotOf(k).suffix;
const pad = (n) => String(n).padStart(2, '0');
export const todayKey = (now) => { const d = new Date((now == null ? Date.now() : now) + 9 * 3600000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
export const fmtMoney = (n) => (n || 0).toLocaleString('ko-KR');
export const parseMoney = (s) => parseInt(String(s || '').replace(/[^0-9]/g, ''), 10) || 0;
export const makeId = (name, birth) => (String(name || '') + '_' + String(birth || '')).replace(/[^a-zA-Z0-9가-힣_]/g, '');
/** 주민번호 13자리 → 900101-1234567 */
export const fmtJumin = (d) => { const x = String(d || '').replace(/[^0-9]/g, ''); return x.length > 6 ? x.slice(0, 6) + '-' + x.slice(6, 13) : x; };
export const fmtPhone = (v) => { const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 11); if (d.length <= 3) return d; if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3); return d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6); };
export const fmtKB = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB');
/** 주민(외국인)등록번호 검증: 13자리·생년월일·성별 자리·검증번호 → { valid, digits, birth, gender, foreign, checksumOk } */
export function parseJumin(raw) {
  const d = String(raw || '').replace(/[^0-9]/g, ''); if (d.length !== 13) return { valid: false, digits: d };
  const yy = +d.slice(0, 2), mm = +d.slice(2, 4), dd = +d.slice(4, 6), g = +d[6]; if (!(g >= 1 && g <= 8) && g !== 9 && g !== 0) return { valid: false, digits: d };
  const century = g === 1 || g === 2 || g === 5 || g === 6 ? 1900 : g === 3 || g === 4 || g === 7 || g === 8 ? 2000 : 1800; const y = century + yy; const dt = new Date(y, mm - 1, dd);
  if (dt.getFullYear() !== y || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return { valid: false, digits: d };
  const w = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5]; let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * w[i];
  return { valid: true, digits: d, birth: y + '-' + pad(mm) + '-' + pad(dd), gender: g % 2 === 1 ? '남' : '여', foreign: g >= 5 && g <= 8, checksumOk: (11 - (s % 11)) % 10 === +d[12] };
}
export const birthFromJumin = (j) => { const d = String(j || '').replace(/\D/g, ''); if (d.length < 7) return ''; const cen = { 1: 1900, 2: 1900, 5: 1900, 6: 1900, 3: 2000, 4: 2000, 7: 2000, 8: 2000 }[d[6]]; return cen ? (cen + parseInt(d.slice(0, 2), 10)) + '-' + d.slice(2, 4) + '-' + d.slice(4, 6) : ''; };
const maskJumin = (j) => { const x = String(j || '').replace(/[^0-9]/g, ''); return x.length === 13 ? x.slice(0, 6) + '-' + x[6] + '●●●●●●' : (x ? '형식 확인 필요' : '—'); };
/** 목록·상세에는 마스킹 값(juminMasked)만 쓴다. 이전 전 문서(평문 jumin)는 같은 모양으로 가려서 보여 준다 */
export const maskedOf = (p) => (p && p.juminMasked ? String(p.juminMasked).replace(/\*/g, '●') : (p && p.jumin ? maskJumin(p.jumin) : '—'));
/** 날짜 + N년 (2/29 는 평년 2/28 로). 타이핑 중간값(연도 1900 미만·2100 초과)은 무시 */
export function addYearsYmd(ymd, n) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ''; const yy = +ymd.slice(0, 4); if (yy < 1900 || yy > 2100) return ''; const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7), d = +ymd.slice(8, 10); if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y + n, m - 1, d)); if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0); return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
}
export const latestHealth = (p, type) => { const l = ((p && p.health) || []).filter((h) => h.type === type && h.date).map((h) => h.date).sort(); return l.length ? l[l.length - 1] : ''; };
/** 종류별 가장 최근 검진의 만료일(저장된 만료일 우선, 없으면 실시일 + 1년) */
export function healthExpiry(p, type) { const l = ((p && p.health) || []).filter((h) => h.type === type && h.date).sort((a, b) => a.date.localeCompare(b.date)); if (!l.length) return ''; const h = l[l.length - 1]; return h.expiry || addYearsYmd(h.date, HEALTH_VALID_YEARS); }
export const latestHealthRow = (p, type) => { const l = ((p && p.health) || []).filter((h) => h.type === type && h.date).sort((a, b) => a.date.localeCompare(b.date)); return l.length ? l[l.length - 1] : null; };
/** 첨부 메타: 예전 단일 사진 필드(photoName 등)는 '사진' 칸으로 승격해서 읽는다 */
export function filesMeta(p) { const f = Object.assign({}, (p && p.files) || {}); if (!f.photo && p && p.hasPhoto && p.photoName) f.photo = { name: p.photoName, size: p.photoSize || 0, w: p.photoW || 0, h: p.photoH || 0 }; return f; }
/** 교육·검진 상태: none(미이수) | ok(유효/만료일 없음) | soon(30일 이내 만료) | expired(만료) */
export function eduStateOf(chk, exp, today) {
  if (!chk) return { chk: false, exp: '', state: 'none' }; if (!exp) return { chk: true, exp: '', state: 'ok' };
  const t = today || todayKey(); const d = Math.round((new Date(exp + 'T00:00:00') - new Date(t + 'T00:00:00')) / 86400000); return { chk: true, exp, d, state: d < 0 ? 'expired' : d <= 30 ? 'soon' : 'ok' };
}
export const eduInfo = (p, k, today) => eduStateOf(!!((p && p.inhouseEdu) || {})[k], ((p && p.inhouseEduExp) || {})[k] || '', today);
export const eduDoneCount = (p, list, today) => (list || EDU).filter((x) => eduInfo(p, x.k, today).chk).length;
export const eduCountBy = (p, state, list, today) => (list || EDU).filter((x) => eduInfo(p, x.k, today).state === state).length;
const num = (v) => parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
/** 화학물질안전원 종사자 교육과정 — 연도별 누계 시간(연 2시간 이상이면 이수) */
export function chemYearSum(rows, y) { let s = 0; (rows || []).forEach((r) => { const h = num(r.hours); const m = /^(\d{4})-/.exec(r.date || ''); if (h > 0 && m && +m[1] === y) s += h; }); return s; }
export const chemOk = (rows, y) => chemYearSum(rows, y) >= CHEM_REQ_HOURS;
/** 법정교육 누계(시공사 × 교육 종류): [{ c, t, total, n, year, q:[1~4분기] }] — 원청 co 의 이력만, 시공사·종류 이름순 */
export function legalAgg(rows, co, year) {
  const g = {};
  (rows || []).filter((r) => certCo(r) === co).forEach((r) => { const h = num(r.hours); if (!(h > 0)) return; const c = (r.contractor || '').trim() || '(시공사 미입력)', t = (r.type || '').trim() || '(종류 미입력)';
    const o = g[c + '||' + t] || (g[c + '||' + t] = { c, t, total: 0, n: 0, year: 0, q: [0, 0, 0, 0] }); o.total += h; o.n++; const m = /^(\d{4})-(\d{2})/.exec(r.date || ''); if (m && +m[1] === year) { o.year += h; o.q[Math.ceil(+m[2] / 3) - 1] += h; } });
  return Object.values(g).sort((a, b) => a.c.localeCompare(b.c, 'ko') || a.t.localeCompare(b.t, 'ko'));
}
export const fmtH = (n) => (Math.round(n * 100) / 100) + 'h';
/** 마스터·실무자 문서·관리자 문서를 합쳐 근로자별 정보(privs)로: 같은 항목이 양쪽에 있으면 실무자 문서(info)가 우선 */
export function mergePrivs(infoDocs, payDocs) { const o = {}; (payDocs || []).forEach((d) => { o[d.id] = Object.assign({}, d.data); }); (infoDocs || []).forEach((d) => { o[d.id] = Object.assign({}, o[d.id] || {}, d.data); }); return o; }
/** 목록 위 요약 카드 */
export function summaryOf(masters, privs, today) {
  const act = masters.filter((m) => !m.resigned); const noHealth = act.filter((m) => !latestHealth(privs[m.id], 'general')).length;
  const eduLack = act.filter((m) => { const p = privs[m.id]; return eduDoneCount(p, null, today) < EDU.length || eduCountBy(p, 'expired', null, today) > 0; }).length;
  return { active: act.length, resigned: masters.length - act.length, noHealth, eduLack };
}
/** 정렬값(구포털 sortVal) */
export function sortVal(m, key, privs, masterById, today) {
  const p = privs[m.id] || {};
  switch (key) {
    case 'name': return m.name || ''; case 'gender': return m.gender || ''; case 'jumin': return String(p.juminMasked || p.jumin || '').replace(/[^0-9]/g, ''); case 'phone': return String(p.phone || '').replace(/[^0-9]/g, ''); case 'hire': return m.hireDate || '';
    case 'team': { const l = m.leaderId ? masterById(m.leaderId) : null; return m.leaderId ? '1' + (l ? l.name : '') : '0'; }
    case 'general': return healthExpiry(p, 'general') || ''; case 'preplace': return healthExpiry(p, 'preplace') || '';
    case 'edu': return eduDoneCount(p, null, today) * 10 - Math.min(9, eduCountBy(p, 'expired', null, today)); case 'cert': return (p.certs || []).length; case 'files': { const fm = filesMeta(p); return PHOTO_SLOTS.filter((x) => fm[x.k]).length; }
  }
  return '';
}
export const SORT_OPTS = [['', '기본 순서'], ['name', '이름'], ['gender', '성별'], ['hire', '입사일'], ['phone', '전화번호'], ['team', '소속'], ['general', '일반검진 만료'], ['preplace', '배치전검진 만료'], ['edu', '사내화 교육 이수'], ['cert', '자격·인증 수'], ['files', '첨부 등록 수']];
/** 값이 없는 사람은 정렬 방향과 관계없이 항상 아래, 같으면 이름순 */
export function sortList(list, key, dir, privs, masterById, today) {
  const vals = new Map(list.map((m) => [m.id, sortVal(m, key, privs, masterById, today)]));
  return list.sort((a, b) => { const va = vals.get(a.id), vb = vals.get(b.id), ea = va === '' || va == null, eb = vb === '' || vb == null; if (ea !== eb) return ea ? 1 : -1; const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko'); return c ? c * dir : (a.name || '').localeCompare(b.name || '', 'ko'); });
}
/** 보이는 목록: 재직/퇴사/전체 + 검색(이름·전화번호 숫자·자격 이름·현장·시공사) + 정렬(없으면 재직 먼저 → 팀장/독립 먼저 → 팀장별 → 이름) */
export function visibleList(o) {
  const { masters, privs, filter, query, sortKey, sortDir, today } = o; const byId = (id) => masters.find((m) => m.id === id);
  let list = masters.filter((m) => (filter === 'all' ? true : filter === 'resigned' ? !!m.resigned : !m.resigned));
  if (query) { const q = query.toLowerCase(), qd = query.replace(/[^0-9]/g, ''); list = list.filter((m) => { const p = privs[m.id] || {}; return (m.name || '').toLowerCase().includes(q) || (qd && String(p.phone || '').replace(/[^0-9]/g, '').includes(qd)) || (p.certs || []).some((c) => ((c.name || '') + ' ' + (c.site || '') + ' ' + (c.contractor || '')).toLowerCase().includes(q)); }); }
  if (sortKey) return sortList(list, sortKey, sortDir || 1, privs, byId, today);
  return list.sort((a, b) => { if (!!a.resigned !== !!b.resigned) return a.resigned ? 1 : -1; const aL = !a.leaderId, bL = !b.leaderId; if (aL !== bL) return aL ? -1 : 1; return (a.leaderId || '').localeCompare(b.leaderId || '') || (a.name || '').localeCompare(b.name || '', 'ko'); });
}
/** 목록 한 줄에 쓰는 표시 값(표와 폰 카드가 같은 값을 쓴다) */
export function rowOf(m, p, ctx) {
  const today = ctx.today, masterById = ctx.masterById; const leader = m.leaderId ? masterById(m.leaderId) : null; const acc = !m.leaderId ? (ctx.accountOf ? ctx.accountOf(m.id) : null) : null; p = p || {};
  const n = eduDoneCount(p, null, today), ex = eduCountBy(p, 'expired', null, today), so = eduCountBy(p, 'soon', null, today);
  const extra = []; const ns = eduDoneCount(p, EDU_SK, today); if (ns > 0) extra.push({ k: 'sk', n: ns, total: EDU_SK.length, expired: eduCountBy(p, 'expired', EDU_SK, today), soon: eduCountBy(p, 'soon', EDU_SK, today) });
  const cr = p.chemEdu || []; if (cr.length) { const y = +today.slice(0, 4); const s = chemYearSum(cr, y); extra.push({ k: 'chem', hours: Math.round(s * 100) / 100, ok: s >= CHEM_REQ_HOURS, pdf: cr.some((r) => r.pdf) }); }
  const fm = filesMeta(p);
  const issues = m.resigned ? [] : issuesOf(p, today); return { m, p, issues, level: worstLevel(issues), team: m.leaderId ? { kind: 'member', leader: leader ? leader.name : '?' } : { kind: 'lead', account: acc ? acc.name : '' },
    general: { date: latestHealth(p, 'general'), exp: healthExpiry(p, 'general'), pdf: !!(latestHealthRow(p, 'general') || {}).pdf }, preplace: { date: latestHealth(p, 'preplace'), exp: healthExpiry(p, 'preplace'), pdf: !!(latestHealthRow(p, 'preplace') || {}).pdf },
    edu: { n, total: EDU.length, expired: ex, soon: so }, extra,
    certs: COMPANIES.map((co) => { const cs = (p.certs || []).filter((c) => certCo(c) === co.k); return cs.length ? { co, n: cs.length, expired: cs.filter((c) => eduStateOf(true, c.expiry || '', today).state === 'expired').length } : null; }).filter(Boolean),
    files: PHOTO_SLOTS.map((x) => ({ slot: x, has: !!fm[x.k] })), masked: maskedOf(p) };
}

/** 조치 필요 항목(재직자 기준): 검진·사내화 교육·자격의 만료(danger)·30일 이내 임박(warn), 일반검진 기록 없음(info — 알림에는 세지 않음, 입력이 덜 된 상태라 모두에게 뜨면 의미가 없다).
 *  반환: [{ k: 'health'|'edu'|'cert', level: 'danger'|'warn'|'info', text }] — 위험한 것부터 */
export function issuesOf(p, today) {
  p = p || {}; const out = [];
  const hs = (type, label) => { const e = healthExpiry(p, type); if (!e) { if (type === 'general') out.push({ k: 'health', level: 'info', text: label + ' 기록 없음' }); return; } const r = eduStateOf(true, e, today); if (r.state === 'expired') out.push({ k: 'health', level: 'danger', text: label + ' 만료 (D+' + Math.abs(r.d) + ')' }); else if (r.state === 'soon') out.push({ k: 'health', level: 'warn', text: label + ' 만료 임박 (D-' + r.d + ')' }); };
  hs('general', '일반검진'); hs('preplace', '배치전검진');
  [['삼성전자', EDU], ['SK하이닉스', EDU_SK]].forEach(([label, list]) => { const ex = eduCountBy(p, 'expired', list, today), so = eduCountBy(p, 'soon', list, today); if (ex) out.push({ k: 'edu', level: 'danger', text: label + ' 사내화 교육 ' + ex + '건 만료' }); if (so) out.push({ k: 'edu', level: 'warn', text: label + ' 사내화 교육 ' + so + '건 만료 임박' }); });
  const cs = (p.certs || []).map((c) => ({ c, r: eduStateOf(true, c.expiry || '', today) })); const nm = (a) => a.map((x) => x.c.name || '자격').join('·');
  const cex = cs.filter((x) => x.r.state === 'expired'), cso = cs.filter((x) => x.r.state === 'soon');
  if (cex.length) out.push({ k: 'cert', level: 'danger', text: '자격·인증 만료: ' + nm(cex) }); if (cso.length) out.push({ k: 'cert', level: 'warn', text: '자격·인증 만료 임박: ' + nm(cso) });
  const rank = { danger: 0, warn: 1, info: 2 }; return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
/** 가장 심각한 단계: 'danger' | 'warn' | ''(문제 없음, info 는 제외) */
export const worstLevel = (issues) => ((issues || []).some((i) => i.level === 'danger') ? 'danger' : (issues || []).some((i) => i.level === 'warn') ? 'warn' : '');

// ── 2단계: 등록·수정 규칙(구포털 saveWorker 의 검증 순서·문구 그대로) ──
export const blankForm = () => ({ name: '', birth: '', gender: '', hireDate: '', leaderId: '', resignedDate: '', phone: '', address: '', jumin: '', portalUid: '' });
/** 마스터·실무자 문서 → 인적사항 수정 폼 값(주민번호는 문서에 없고 서버에만 있다 — 비워 두면 변경 없음) */
export const formOfMaster = (m, p, portalUid) => ({ name: m.name || '', birth: m.birth || '', gender: m.gender || '', hireDate: m.hireDate || '', leaderId: m.leaderId || '', resignedDate: m.resigned ? (m.resignedDate || '') : '', phone: (p && p.phone) || '', address: (p && p.address) || '', jumin: '', portalUid: portalUid || '' });
/** 소속 선택지: 팀장/독립인 사람(자기 자신 제외) — 이름순. 지금 소속된 팀장이 퇴사했어도 목록에 남긴다 */
export function leaderChoices(masters, selfId, currentId) { return (masters || []).filter((m) => !m.leaderId && m.id !== selfId && (!m.resigned || m.id === currentId)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')); }
/** 인적사항 저장 검증 → { ok, errors[], confirms[], id, base, info, digits }
 *  o = { editing: 수정 중인 마스터 | null, masters, hrLinked(이름·생년월일이 인사 명단과 맞아 주소를 인사가 관리하면 true) }. confirms 는 "그래도 저장할까요?" 확인이 필요한 경고 */
export function validateWorker(f, o) {
  const errors = [], confirms = []; const name = String(f.name || '').trim(); const editing = o.editing || null; const masters = o.masters || [];
  if (!name) return { ok: false, errors: ['이름을 입력하세요.'], confirms, id: '', base: null, info: null, digits: '' };
  const pj = f.jumin ? parseJumin(f.jumin) : null; if (f.jumin && !pj.valid) return { ok: false, errors: ['주민(외국인)등록번호 형식이 올바르지 않습니다. (13자리, 생년월일 확인)'], confirms, id: '', base: null, info: null, digits: '' };
  const birth = f.birth || (pj && pj.birth) || ''; if (!birth) return { ok: false, errors: ['생년월일을 입력하세요. (주민등록번호를 입력하면 자동으로 채워집니다)'], confirms, id: '', base: null, info: null, digits: '' };
  if (pj && pj.birth !== birth) confirms.push('입력한 생년월일(' + birth + ')이 주민등록번호의 생년월일(' + pj.birth + ')과 다릅니다.\n그대로 저장할까요?');
  if (pj && !pj.checksumOk) confirms.push('주민(외국인)등록번호 검증번호가 일치하지 않습니다' + (pj.foreign ? ' (외국인등록번호는 정상일 수 있습니다)' : '') + '.\n그대로 저장할까요?');
  const id = editing ? editing.id : makeId(name, birth); if (!id) return { ok: false, errors: ['이름 또는 생년월일이 올바르지 않습니다.'], confirms, id: '', base: null, info: null, digits: '' };
  if (!editing && masters.some((m) => m.id === id)) errors.push('같은 이름·생년월일의 근로자가 이미 등록되어 있습니다.');
  const isLeader = masters.some((m) => m.leaderId === id);
  if (editing && f.leaderId && isLeader) errors.push(name + '님은 팀장으로 지정된 인원이 있어 다른 팀 소속으로 변경할 수 없습니다. 먼저 팀원들의 소속을 변경해주세요.');
  const resigned = !!f.resignedDate;   // 퇴사일을 넣으면 퇴사, 비우면 재직
  if (editing && resigned && !editing.resigned && isLeader) errors.push(name + '님은 팀장으로 지정된 인원이 있어 퇴사 처리할 수 없습니다. 먼저 팀원들의 소속을 변경해주세요.');
  const gender = f.gender || (pj && pj.gender) || '';
  const base = { name, birth, gender, hireDate: f.hireDate || '', leaderId: f.leaderId || '', resigned, resignedDate: resigned ? f.resignedDate : null };
  const info = { phone: String(f.phone || '').trim() }; if (!o.hrLinked) info.address = String(f.address || '').trim();   // 인사 명단과 연동된 직원의 주소는 인사에서 관리 — 연명부에는 저장하지 않음
  return { ok: !errors.length, errors, confirms, id, base, info, digits: pj ? pj.digits : '' };
}
/** 급여·계좌(관리자 전용 문서) 저장 값 */
export const payOf = (f) => ({ bank: String(f.bank || '').trim(), account: String(f.account || '').trim(), dailyRate: parseMoney(f.rate) });
/** 삭제 가능 여부: 팀장으로 지정된 팀원이 남아 있으면 불가 */
export const deleteBlock = (m, masters) => ((masters || []).some((x) => x.leaderId === m.id) ? m.name + '님은 팀장으로 지정된 인원이 있어 삭제할 수 없습니다. 먼저 팀원들의 소속을 변경해주세요.' : '');
/** 삭제할 때 함께 지울 Storage 파일 경로(검진 결과·화학물질안전원 수료증 PDF) */
export const pdfPathsOf = (p) => [].concat(((p && p.health) || []).map((h) => h.pdf && h.pdf.path), ((p && p.chemEdu) || []).map((c) => c.pdf && c.pdf.path)).filter(Boolean);

// ── 3단계: 서류·사진 첨부(구포털 규칙 그대로) ──
export const PHOTO_MAX_CHARS = 950000;   // 데이터 URL 문자 수 상한(≈ 원본 710KB) — 보안 규칙 1,000,000자 미만, Firestore 문서 1MiB 한도 여유
export const PHOTO_MAX_EDGE = 2000;      // 긴 변 최대 픽셀
export const dataUrlBytes = (u) => Math.round((String(u || '').length - 23) * 3 / 4);
/** 첨부 한 칸의 메타(실무자 문서 files.<칸>): 파일 이름은 원래 이름 + .jpg(줄이면서 JPEG 로 바꾸므로) */
export function fileMetaOf(fileName, slot, dataUrl, w, h) { const label = slotOf(slot).label; return { name: String(fileName || label).replace(/\.[^.]+$/, '') + '.jpg', size: dataUrlBytes(dataUrl), w: w || 0, h: h || 0 }; }
/** 첨부 이미지 문서(master_worker_photos/<근로자 id><접미사>) */
export const photoDocOf = (slot, meta, dataUrl) => ({ dataUrl, mime: 'image/jpeg', fileName: meta.name, size: meta.size, slot });
/** 칸을 하나라도 쓰고 있는가(hasPhoto) */
export const anyFile = (files) => FILE_SLOTS.some((x) => !!(files || {})[x.k]);
/** 내려받을 때 파일 이름: 이름_칸이름.jpg (파일 이름에 못 쓰는 문자는 _ 로) */
export const downloadName = (name, slot) => ((name || '근로자') + '_' + slotOf(slot).label + '.jpg').replace(/[\\/:*?"<>|]/g, '_');
/** 이 사람이 이 칸을 고칠 수 있는가: 통장사본은 관리자만, 나머지는 PJT 권한자 */
export const canEditSlot = (slot, admin, canEdit) => (slotOf(slot).admin ? !!admin : !!canEdit);
