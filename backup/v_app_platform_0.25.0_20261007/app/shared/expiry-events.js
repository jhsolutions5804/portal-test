/* 연명부 만료 일정 계산 — 근로자 기본 문서(master_workers)와 실무자 문서(master_worker_info)에서 자격·인증, 사내화 교육, 건강검진의 만료 일정을 뽑는다.
 * (처음에는 서버가 만든 요약본(expiry_events)을 쓰려 했으나, 연명부를 실무자에게 열기로 해서 화면이 원본에서 바로 계산한다 — 서버 함수 불필요)
 * 일정에 담는 것: 이름 · 항목 이름 · 소속 원청 · 만료일. 주민번호·연락처·계좌 등은 이 계산에 쓰이지 않는다. */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const EDU_LABEL = { e1: '안전담당자/화재감시자 기본 인증과정', e2: '중량물/양중작업(통합) 안전인증과정', e3: '화학물질취급작업 안전인증과정', e4: '화학물질안전원 온라인 안전교육' };
const CO_LABEL = { samsung: '삼성전자', skhynix: 'SK하이닉스' };
export const KEEP_PAST_DAYS = 90;           // 만료된 지 이 일수까지는 계속 보여 준다(최근 만료 확인용)
const HEALTH_VALID_YEARS = 1;               // 연명부와 같은 기본 유효기간
export const isYmd = (s) => typeof s === 'string' && YMD.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export function addYears(ymd, n) { if (!isYmd(ymd)) return ''; const d = new Date(ymd + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); }
export function addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const slug = (s) => clean(s, 60).toLowerCase().replace(/[^0-9a-z가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** masters: { id: {name, resigned} }, infos: { id: {certs, health, inhouseEdu, inhouseEduExp} }, todayYmd → 만료 일정 배열(만료일 순) */
export function buildExpiryEvents(masters, infos, todayYmd) {
  const floor = addDays(todayYmd, -KEEP_PAST_DAYS); const out = new Map();
  const put = (workerId, name, kind, label, company, expiry) => {
    if (!isYmd(expiry) || expiry < floor) return;
    const id = workerId + '_' + kind + '_' + slug(label) + '_' + expiry; out.set(id, { id, workerId, name, kind, label, company, expiry });
  };
  Object.keys(masters || {}).forEach((wid) => {
    const m = masters[wid] || {}; if (m.resigned === true) return;     // 퇴사자는 만료 일정을 만들지 않는다
    const name = clean(m.name, 40); if (!name) return;
    const p = (infos && infos[wid]) || {};
    (Array.isArray(p.certs) ? p.certs : []).forEach((c) => {
      if (!c || !clean(c.name, 80)) return;
      const exp = isYmd(c.expiry) ? c.expiry : (c.validYears && isYmd(c.acquired) ? addYears(c.acquired, Number(c.validYears)) : '');
      put(wid, name, 'cert', clean(c.name, 80), CO_LABEL[c.co] || (c.co ? '' : CO_LABEL.samsung), exp);   // co 없던 기존 자격은 삼성전자로 본다(연명부 규칙)
    });
    const edu = p.inhouseEdu || {}; const eduExp = p.inhouseEduExp || {};
    Object.keys(EDU_LABEL).forEach((k) => { if (edu[k] && isYmd(eduExp[k])) put(wid, name, 'inhouse', EDU_LABEL[k], CO_LABEL.samsung, eduExp[k]); });
    const hs = (Array.isArray(p.health) ? p.health : []).filter((h) => h && isYmd(h.date)).sort((a, b) => a.date.localeCompare(b.date));
    const last = hs[hs.length - 1];   // 가장 최근 검진만(예전 검진의 만료일은 이미 대체됨)
    if (last) put(wid, name, 'health', '건강검진', '', isYmd(last.expiry) ? last.expiry : addYears(last.date, HEALTH_VALID_YEARS));
  });
  return Array.from(out.values()).sort((a, b) => a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name) || a.label.localeCompare(b.label));
}
