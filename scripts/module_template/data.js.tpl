import { db, collection, getDocs, query, orderBy } from '../../core/firebase.js?v=__VER__';

/* __TITLE__ 의 데이터 읽기·쓰기 — Firestore 를 만지는 코드는 이 파일에만 둔다.
 * ⚠ 새 컬렉션을 쓰면 보안 규칙을 꼭 정한다: 규칙에 적지 않은 컬렉션은 "승인된 직원 전원이 읽고 쓰는" 포괄 규칙을 따른다.
 *    민감한 내용이면 규칙 파일에 관리자 전용/본인 전용 블록을 추가하고(대표님이 게시), 에뮬레이터로 시험한 뒤 올린다. */
export const COLLECTION = '__ID___items';   // 예시 컬렉션 이름 — 실제 이름으로 바꾸세요

/** 예시: 최근 항목 20건. 실제 조회로 바꾸세요. */
export async function loadItems(me) {
  const s = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  const out = []; s.forEach((d) => out.push(Object.assign({ id: d.id }, d.data()))); return out.slice(0, 20);   // (firebase.js 가 내보내는 함수만 쓴다 — 필요한 함수가 없으면 core/firebase.js 에 추가)
}
