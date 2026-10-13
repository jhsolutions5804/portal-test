/* 도면 이미지 도구(브라우저 전용) — 올린 이미지를 줄여 데이터 URL 로 만들고, 이미지의 원래 크기를 알아낸다. 시험에서는 이 함수들을 ctx.readImage·ctx.imageInfo 로 대신한다. */
export const MAX_IMAGE_CHARS = 700000;   // Firestore 문서 한 개는 1MB 가 한계라 데이터 URL 이 이 길이를 넘지 않게 줄인다
/** 파일 → 데이터 URL(JPEG): 가로 1800px 이하로 줄이고, 용량이 크면 품질·크기를 더 낮춘다 */
export async function fileToDataUrl(file) {
  const raw = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('파일을 읽지 못했습니다.')); r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지 형식을 읽지 못했습니다.')); i.src = raw; });
  let maxW = 1800, q = 0.85;
  for (let k = 0; k < 8; k++) { const sc = Math.min(1, maxW / img.naturalWidth); const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc); const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); const url = c.toDataURL('image/jpeg', q); if (url.length <= MAX_IMAGE_CHARS) return url; maxW = Math.round(maxW * 0.8); q = Math.max(0.5, q - 0.08); }
  throw new Error('이미지가 너무 커서 줄이지 못했습니다. 더 작은 이미지를 올려 주세요.');
}
/** 이미지 주소(URL·데이터 URL)의 원래 크기: { exists, w, h } */
export function imageInfo(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res({ exists: true, w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ exists: false, w: 0, h: 0 }); i.src = src; }); }
