/* 첨부파일 — 화면 규칙(순수 함수). 서버가 상신 때 저장소의 실제 파일을 다시 확인한다. */
export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'zip', 'txt', 'csv'];
export const ACCEPT = EXTS.map((e) => '.' + e).join(',');
export const extOf = (name) => { const m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };
export function fmtSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
/** 저장소 경로에 쓸 안전한 파일 이름: 경로 문자·제어 문자·따옴표 등을 바꾸고 80자 이내(확장자 보존) */
export function safeName(name) {
  let s = String(name == null ? '' : name).normalize('NFC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|#%\[\]{}^~`$&+=;@!,']/g, '_').replace(/\s+/g, ' ').trim().replace(/\.{2,}/g, '.').replace(/^\.+/, '');   // '..' 는 하나로 줄여 경로 조작·서버 검사에 걸리지 않게 한다
  const ext = extOf(s); if (s.length > 80) { const base = s.slice(0, s.length - (ext ? ext.length + 1 : 0)).slice(0, 80 - (ext ? ext.length + 1 : 0)); s = base + (ext ? '.' + ext : ''); }
  return s || 'file';
}
export function newFileId(now, rnd) { return (Number(now) || Date.now()).toString(36) + Math.floor((rnd || Math.random)() * 1296).toString(36).padStart(2, '0'); }
export const storagePath = (dtype, docId, id, name) => 'edoc/' + dtype + '/' + docId + '/' + id + '_' + safeName(name);
/** 올리기 전 검사. current = 이미 붙은 파일 목록(+올리는 중인 것) */
export function checkFile(file, current) {
  const list = current || []; const name = (file && file.name) || '';
  if (!file) return { ok: false, error: '파일을 확인할 수 없습니다.' };
  if (list.length >= MAX_FILES) return { ok: false, error: '첨부파일은 최대 ' + MAX_FILES + '개까지 붙일 수 있습니다.' };
  if (EXTS.indexOf(extOf(safeName(name))) === -1) return { ok: false, error: '"' + name + '" 은(는) 올릴 수 없는 형식입니다. (PDF·이미지·오피스·한글·압축·텍스트 파일만 가능)' };
  if (!(file.size > 0)) return { ok: false, error: '"' + name + '" 은(는) 비어 있는 파일입니다.' };
  if (file.size > MAX_BYTES) return { ok: false, error: '"' + name + '" 은(는) ' + fmtSize(file.size) + '로 너무 큽니다. 파일당 10MB까지 가능합니다.' };
  if (list.some((f) => f.name === name && Number(f.size) === file.size)) return { ok: false, error: '"' + name + '" 은(는) 이미 붙어 있습니다.' };
  return { ok: true, error: '' };
}
/** 문서에 저장할 첨부 정보(화면이 아는 값만 — 크기·형식은 서버가 저장소에서 다시 읽는다) */
export const metaOf = (id, file, path, now) => ({ id, name: String(file.name).slice(0, 120), size: file.size, contentType: file.type || '', path, uploadedAt: new Date(now == null ? Date.now() : now).toISOString() });
export const sanitizeList = (list) => (Array.isArray(list) ? list.filter((a) => a && typeof a.path === 'string' && a.path).map((a) => ({ id: String(a.id || ''), name: String(a.name || ''), size: Number(a.size) || 0, contentType: String(a.contentType || ''), path: a.path, uploadedAt: String(a.uploadedAt || '') })) : []);
