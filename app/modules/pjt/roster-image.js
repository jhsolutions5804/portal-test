/* 연명부 첨부 이미지 줄이기(브라우저 전용) — 구포털 compressImage 와 같은 규칙: 긴 변 2000px 이하, 데이터 URL 이 950,000자를 넘지 않게 화질·크기를 단계적으로 낮춘다. 시험에서는 ctx.compressImage 로 대신한다. */
import { PHOTO_MAX_CHARS, PHOTO_MAX_EDGE } from './roster.js?v=20261031f';
const loadImage = (file) => new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없습니다.')); }; img.src = url; });
/** 파일 → { dataUrl(JPEG), w, h } */
export async function compressImage(file) {
  const img = await loadImage(file); let maxEdge = PHOTO_MAX_EDGE, q = 0.86, out = '', w = 0, h = 0;
  for (let i = 0; i < 12; i++) {
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)); h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    out = c.toDataURL('image/jpeg', q); if (out.length <= PHOTO_MAX_CHARS) return { dataUrl: out, w, h };
    q -= 0.08; if (q < 0.55) { q = 0.85; maxEdge = Math.round(maxEdge * 0.85); }
  }
  throw new Error('사진 용량을 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.');
}
