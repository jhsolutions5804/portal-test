# 보안 규칙 시험 (Firestore 에뮬레이터)
의존: Java 17+, `npm i firebase-tools @firebase/rules-unit-testing firebase` (저장소 밖 임시 폴더에서). 에뮬레이터 포트 8089.
- `eval_rules.test.mjs` — 평가 규칙 블록만(시험용 뼈대 `test.rules`: isApproved·isAdmin + 블록 + 전부 거부) 63건
- `eval_rules_latest.test.mjs` — **현재 게시 규칙 위에서** 같은 63건. 기본 규칙 파일 = `docs/rules/firestore.rules_테섭_평가추가본_2026-10-15.rules` (`RULES_FILE=경로` 로 바꿀 수 있음). 반드시 이쪽으로 확인한다 — 뼈대 위에서만 통과하면 맨 아래 catch-all 때문에 실제로는 보호가 없을 수 있다
- `eval_rules_ui.test.mjs` — 화면 로직(mine-logic.js)이 만든 문서가 규칙을 통과하는지 11건(`PORTAL_ROOT=저장소 경로`)
실행 예: `firebase emulators:exec --only firestore --project demo-eval 'node eval_rules_latest.test.mjs'`
- `eval_e2e.test.mjs` — **평가 전체 흐름**(과제 배정 → 시작 → 제출 → 마감 → 집계 → 점수 계산 → 저장 보존 → 익명) 16건. 서버는 실제 `firebase-admin`으로 `eval-act.js`, 직원·사장단은 보안 규칙을 적용받는 클라이언트, 제출 문서는 화면 코드(`mine-logic.js`)가 만든 것. 조각별 시험이 놓치는 "서버가 읽는 필드 ↔ 화면이 쓰는 필드" 불일치를 잡는다(서버가 읽는 필드 이름을 일부러 바꾸면 4건이 실패함을 확인). 서버 쪽 폴더는 `PORTAL_FUNCTIONS=경로`(npm install 완료), 저장소 루트는 `PORTAL_ROOT`.
  실행 예: `PORTAL_FUNCTIONS=... PORTAL_ROOT=... firebase emulators:exec --only firestore --project demo-eval 'node eval_e2e.test.mjs'`
