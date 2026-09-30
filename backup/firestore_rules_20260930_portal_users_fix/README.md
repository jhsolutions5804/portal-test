# 계정 문서(portal_users) 규칙 보강안 — 게시 전 보관본 (2026-09-30)

> 상태: **미게시(검증만 완료)**. 이 폴더의 파일은 Firestore 콘솔/API에 아직 게시되지 않았다.

## 배경
포괄 규칙(`/{document=**}`)이 `portal_users`에도 적용되어, 승인된 직원이면 누구나 다른 직원의 계정 문서를 읽고(`_pw` 포함) 자기 계정을 관리자로 바꿀 수 있었다(테섭·본섭 모두 동일 구조, 에뮬레이터로 재현).

## 변경 요점
- `portal_users`를 포괄 규칙 제외 목록(`isAdminOnlyCollection`)에 추가
- 읽기: 승인된 직원(직원 목록용) + 본인 문서(로그인 승인 체크용)
- 쓰기: 관리자만. 직원 본인은 `_pw`, `phone`, `phoneVerified`, `phoneVerifiedAt`, `dailyViewTargets` 5개 필드만 수정 가능
- 기존 최초 관리자 부트스트랩 규칙 유지

## 파일
| 파일 | 내용 |
|------|------|
| `firestore.rules.prod_fixed` | 현재 본섭 규칙 + 위 보강 |
| `firestore.rules.test_fixed` | 현재 테섭 규칙 + `team_rates`(팀장 자기 팀 단가 조회) + 위 보강 |
| `firestore.rules.prod_before` / `test_before` | 조회 시점(2026-09-30)의 게시본 (롤백 기준) |

## 검증
에뮬레이터 31항목(정상 동작 유지·차단 동작·부트스트랩·회귀). 남은 위험: 계정 문서의 `_pw`(base64 저장 비밀번호)는 승인된 직원이 여전히 읽을 수 있음 → 별도 조치(비밀번호 저장 위치 이동) 필요.
