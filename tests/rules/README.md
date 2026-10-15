# 보안 규칙 시험 (Firestore 에뮬레이터)
의존: Java 17+, `npm i firebase-tools @firebase/rules-unit-testing firebase` (저장소 밖 임시 폴더에서). 에뮬레이터 포트 8089.
- `eval_rules.test.mjs` — 평가 규칙 블록만(시험용 뼈대 `test.rules`: isApproved·isAdmin + 블록 + 전부 거부) 63건
- `eval_rules_latest.test.mjs` — **현재 게시 규칙 위에서** 같은 63건. 기본 규칙 파일 = `docs/rules/firestore.rules_테섭_평가추가본_2026-10-15.rules` (`RULES_FILE=경로` 로 바꿀 수 있음). 반드시 이쪽으로 확인한다 — 뼈대 위에서만 통과하면 맨 아래 catch-all 때문에 실제로는 보호가 없을 수 있다
- `eval_rules_ui.test.mjs` — 화면 로직(mine-logic.js)이 만든 문서가 규칙을 통과하는지 11건(`PORTAL_ROOT=저장소 경로`)
실행 예: `firebase emulators:exec --only firestore --project demo-eval 'node eval_rules_latest.test.mjs'`
