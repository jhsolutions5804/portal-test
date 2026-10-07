import { storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from '../../core/firebase.js?v=20261007d';
import { storagePath, newFileId, metaOf } from './attach-logic.js?v=20261007d';

/** 파일 하나 올리기. 진행률은 onProgress(0~100)로 알린다. 성공하면 문서에 저장할 첨부 정보를 돌려준다. */
export function uploadFile({ dtype, docId, file, onProgress }) {
  const id = newFileId(); const path = storagePath(dtype, docId, id, file.name);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type || 'application/octet-stream' });
    task.on('state_changed', (s) => { if (onProgress && s.totalBytes) onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
      (e) => reject(uploadError(e)), () => resolve(metaOf(id, file, path)));
  });
}
export async function removeFile(path) {
  try { await deleteObject(storageRef(storage, path)); }
  catch (e) { if (!e || e.code !== 'storage/object-not-found') throw uploadError(e); }
}
export async function openFile(path) {
  const url = await getDownloadURL(storageRef(storage, path));
  const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
}
export function uploadError(e) {
  const code = String((e && e.code) || '');
  if (code === 'storage/unauthorized') return new Error('파일을 올리거나 지울 권한이 없습니다. (작성자 본인의 임시저장·반려 문서에서만 가능합니다)');
  if (code === 'storage/canceled') return new Error('올리기를 취소했습니다.');
  if (code === 'storage/object-not-found') return new Error('파일을 찾을 수 없습니다.');
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') return new Error('네트워크가 불안정해 올리지 못했습니다. 다시 시도해 주세요.');
  return new Error('파일을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}
