# GUEST 사번 일정 규칙 (2026-09-30)

> 상태: **테섭 게시 완료**(규칙셋 `35fe2038…`, 이전 `f809f692…`, 2026-09-30T15:40:17Z) · **본섭 미게시**

## 요구 (대표님)
- GUEST 사번은 회사 일정을 못 보게, PJT 일정만 볼 수 있게 / 일정 등록 못 하게 / 화면에서는 PJT·회사 구분 없이 “일정”으로 통일

## 규칙
- GUEST = 계정 문서 `empNo`가 `guest`로 시작(대소문자 무시). `empNo`는 관리자만 수정 가능(직원 본인 수정 불가) → 우회 불가. 사번이 없거나 문자열이 아니면 GUEST 아님.
- `company_schedules`: 승인 직원 읽기·쓰기, **GUEST 제외**(읽기도 차단 — 연차 등 직원 정보 포함)
- `user_schedules`·`ph4_schedules`·`pjt_registry/{id}/schedules`: 읽기 승인 직원 전체(GUEST 포함), **쓰기 GUEST 제외**(등록·수정·삭제·완료 체크)
- 일정 컬렉션 4종은 포괄 규칙(`/{document=**}`)에서 **제외**(`isScheduleCollection()`) — 제외하지 않으면 OR 평가로 GUEST 쓰기가 다시 열림.

## ⚠️ 구현 중 발견한 결함 (수정 완료)
`isScheduleCollection()`을 처음엔 `request.path.size() > 5 && request.path[5] == 'schedules'`로 썼으나, **경로가 짧은 문서(`pjt_registry/{id}`, 길이 5)에서 `request.path[5]` 접근이 오류가 되어 규칙 전체가 거부로 평가**되어 경량 PJT 문서 읽기가 막혔음(GUEST 뿐 아니라 일반 직원도 영향). 에뮬레이터 접근 시험에서 발견. 인덱스 접근 없이 `string(request.path).matches('.*/pjt_registry/[^/]+/schedules/[^/]+$')` 패턴으로 교체하고, 경량 PJT 문서·목록·다른 하위 컬렉션(근로자·근태)·이름이 비슷한 컬렉션(`schedules_backup`)이 영향받지 않음을 시험으로 고정.

## 파일
| 파일 | 내용 |
|------|------|
| `firestore.rules.test_sched` | **현재 테섭 게시본** |
| `firestore.rules.prod_sched` | 본섭 게시용(현재 본섭 최종 규칙 + 일정 규칙, 미게시) |

## 검증
에뮬레이터 20항목(일반·관리자·GUEST 3종 표기·경계 사번·일정 4종·다른 하위 컬렉션·우회 시도·회귀) + 계정/비밀번호/팀 단가 회귀 32항목 + 실제 로그인 환경 종합 10항목(GUEST 토큰 REST 직접 조회·등록·완료·삭제 403 확인).

## 롤백
테섭 이전 규칙셋 `f809f692…`(= 비밀번호 이동 최종 규칙). 화면은 GUEST 판별이 규칙과 독립이라 규칙을 되돌려도 화면 동작은 유지.
