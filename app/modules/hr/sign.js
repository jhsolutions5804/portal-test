/* 원격 서명·열람 링크·메일 발송 — 구포털(hr)의 문서 확인·서명 링크(sign.html) 규칙을 옮겼다(순수 함수, 화면·네트워크 없음).
 * · 링크 메타(sign_links/{token})에는 공개 가능한 최소 정보(문서 종류·이름·인증 번호·만료·상태)만 둔다.
 * · 문서 내용(주민번호는 마스킹본)·회사 직인은 sign_links/{token}/secure/payload 에 스냅샷으로 저장한다 — 링크에 지정된 번호로 문자 인증(OTP)을 통과한 사람만 열람(보안 규칙).
 *   서명 결과는 secure/result 에 기록되고, 관리자 화면이 계약서 원본에 반영한다(syncDecision). 서명 후 내용이 바뀌었는지 확인하려고 링크 생성 때 계약 내용 해시를 같이 저장한다.
 * · 열람 전용 링크는 저장 당시 양식(tplVer)으로 그린 HTML 만 담는다(양식 동결 원칙). 서명 링크 유효 72시간, 열람 링크 180일. */
export const SIGN_TTL_MS = 72 * 3600 * 1000, VIEW_TTL_MS = 180 * 24 * 3600 * 1000, MAX_PAYLOAD = 900000;
/** 메일 발송은 본섭에서만 — 테섭 구포털도 메일 설정이 자리표시 값이라 꺼져 있었다(시험 중 실제 직원에게 메일이 나가지 않게). 테섭에서는 링크·QR 로 확인한다 */
export const emailjsFor = (isTest) => (isTest ? null : EMAILJS);
export const EMAILJS = { serviceId: 'service_7iova18', templateId: 'template_jto208l', publicKey: 'VxJuVh6ZVpDoIurYp', sdk: 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js' };   // 공개 키(브라우저용)
export const DOC_LABEL = { annual: '연봉계약서', labor: '근로계약서', payslip: '급여명세서', offer: '연봉제안서', leavepromo: '연차사용촉진 서면 통지', evalresult: '평가 결과 통보서' };
/** 휴대폰 번호 → +82 국제 형식(010·011·016~019 만), 올바르지 않으면 빈 문자열 */
export function phoneE164(p) { const d = String(p || '').replace(/\D/g, ''); if (!d) return ''; const e = '+82' + d.replace(/^0/, ''); return /^\+821[016789]\d{7,8}$/.test(e) ? e : ''; }
/** 주민번호 마스킹: 앞 6자리-성별 1자리 + ●(최소 6개) */
export function maskJumin(j) { if (!j) return ''; const dg = String(j).replace(/\D/g, ''); if (dg.length < 7) return j; return dg.slice(0, 6) + '-' + dg.slice(6, 7) + '●'.repeat(Math.max(dg.length - 7, 6)); }
export function stableStringify(o) { if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o); if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']'; if (typeof o.toMillis === 'function') return JSON.stringify({ t: o.toMillis() }); return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}'; }
/** 계약 내용 해시(서명·저장 메타 필드는 제외) — 링크 생성 후 내용이 바뀌었는지 확인용 */
export async function contractContentHash(d) { const c = Object.assign({}, d); ['savedAt', 'savedBy', 'signData', 'remoteSigned', 'signedAt', 'signedIp', 'signedUserAgent'].forEach((k) => { delete c[k]; }); const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableStringify(c))); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
/** 서명 링크(보내서 서명받는 링크) 문서: meta + payload. 계약서(labor·annual)는 ref(원본 위치·내용 해시)를 담아 서명 결과를 되돌려 반영할 수 있게 한다 */
export function buildSignLink(o) {
  const x = o || {}; const src = x.src || {}; const snapDoc = Object.assign({}, src); if ('jumin' in snapDoc) snapDoc.jumin = maskJumin(snapDoc.jumin); let seal = x.seal || {}; const size = () => JSON.stringify({ snapDoc, seal }).length;
  if (size() > MAX_PAYLOAD && seal.kjh) seal = { kjh: seal.kjh }; if (size() > MAX_PAYLOAD + 50000) return { ok: false, error: '문서가 너무 커서 링크를 만들 수 없습니다. (이미지·첨부 용량 확인)' };
  const now = x.now || Date.now(); const expMs = now + SIGN_TTL_MS; const payload = { docType: x.docType, doc: snapDoc, seal, ref: {} }; if (x.coll) payload.ref = { coll: x.coll, workerId: x.workerId, contractId: x.contractId, contentHash: x.contentHash };
  return { ok: true, expMs, meta: { docType: x.docType, workerName: x.workerName || src.name || '', phoneE164: x.e164, status: 'pending', synced: false, expiresAt: new Date(expMs).toISOString() }, payload };
}
/** 열람 전용 링크: 저장 당시 양식으로 그린 HTML 만 담는다(서명·수정 불가, 문자 인증 후 열람, 180일) */
export function buildViewLink(o) {
  const x = o || {}; if (!['labor', 'annual', 'payslip', 'leavepromo', 'evalresult'].includes(x.docType)) return { ok: false, error: '열람 링크는 근로계약서·연봉계약서·급여명세서·연차사용촉진 서면·평가 결과 통보서만 지원합니다.' }; if (String(x.html || '').length > MAX_PAYLOAD) return { ok: false, error: '문서가 너무 커서 링크를 만들 수 없습니다. (이미지·첨부 용량 확인)' };
  const expMs = (x.now || Date.now()) + VIEW_TTL_MS; return { ok: true, expMs, meta: { docType: x.docType, workerName: x.workerName || (x.src && x.src.name) || '', phoneE164: x.e164, status: 'view', viewOnly: true, synced: true, expiresAt: new Date(expMs).toISOString() }, payload: { docType: x.docType, viewOnly: true, html: x.html, title: x.title || '', ref: {} } };
}
export const NO_PHONE_ERROR = '받는 분의 휴대폰 번호가 없거나 형식이 올바르지 않아 링크를 만들 수 없습니다.\n문서 확인 시 이 번호로 문자 인증을 하므로, 근로자 명부(또는 채용 지원서)에 휴대폰 번호를 등록한 뒤 다시 시도해 주세요.';
/** 서명 결과를 계약서 원본에 반영할지 결정(링크 하나에 대해). 반환 {synced, patch?}: synced 는 링크에 기록할 상태(true·invalid·missing·already·conflict), 없으면 아직 판단 불가(재시도) */
export async function syncDecision(link, payload, result, current) {
  if (link.docType !== 'labor' && link.docType !== 'annual') return { synced: true };
  if (!payload || !result) return null; const ref = payload.ref || {}, r = result;
  if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(r.signData || '')) return { synced: 'invalid' };
  if (!current) return { synced: 'missing' }; if (current.signData) return { synced: 'already' };
  if (ref.contentHash && (await contractContentHash(current)) !== ref.contentHash) return { synced: 'conflict' };
  const signedAt = r.signedAt && r.signedAt.toDate ? r.signedAt.toDate().toISOString() : (r.signedAtIso || new Date().toISOString());
  return { synced: true, patch: { signData: r.signData, remoteSigned: true, signedAt, signedIp: r.signedIp || '', signedUserAgent: r.signedUserAgent || '' } };
}
export const maskEmail = (e) => { const [a, b] = String(e || '').split('@'); return b ? a.slice(0, 2) + '***@' + b : ''; };
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
/** 발송 이력 기록 내용(링크 토큰은 남기지 않는다 — 전 직원이 읽을 수 있는 컬렉션) */
export function sendLogEntry(o) { const x = o || {}; const lp = x.linkParams || {}; return { channel: 'email', kind: x.kind || '', recipientId: x.id || '', docLabel: x.docLabel || '', docType: lp.docType || '', workerId: lp.workerId || lp.payslipWid || '', contractId: lp.contractId || lp.payslipMonth || '', offerId: lp.offerId || '', payslipMonth: lp.payslipMonth || '', linkKind: lp.viewOnly ? 'view' : 'sign', toMasked: maskEmail(x.email) }; }
/** 근로자별 발송 이력 → { '<문서종류>:<문서번호>': {sentAt(Date), toMasked, count} } */
export function summarizeSendLog(entries) { const out = {}; (entries || []).forEach((v) => { if (!v.contractId) return; const k = v.docType + ':' + v.contractId; const t = v.sentAt && v.sentAt.toDate ? v.sentAt.toDate() : (v.sentAt instanceof Date ? v.sentAt : null); const o = out[k] || (out[k] = { sentAt: null, toMasked: '', count: 0 }); o.count++; if (t && (!o.sentAt || t > o.sentAt)) { o.sentAt = t; o.toMasked = v.toMasked || ''; } }); return out; }
export function sendLogText(o) { if (!o || !o.sentAt) return '✉ 발송 이력 없음'; const d = o.sentAt; const p = (n) => String(n).padStart(2, '0'); return '✉ 최근 발송 ' + d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' → ' + (o.toMasked || '-') + ' (총 ' + o.count + '회)'; }
export const qrUrl = (url) => 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
