# 개발용 점검 도구 (배포 파일 아님)

앱 코드를 올리기 전에 돌리는 점검들. 이 폴더에서 한 번만 `npm i espree eslint-scope jsdom` 을 하면 된다(`node_modules` 는 저장소에 올리지 않는다).

| 파일 | 하는 일 |
|---|---|
| `static_names_check.mjs` | 가져오기(import) 이름이 실제로 있는지, 정의·가져오기 안 한 이름을 쓰는 곳이 없는지(빠진 import·오타) — **순수 함수 시험이 못 잡는 화면 코드 오류** |
| `smoke_ui.mjs` (+ `smoke_register.mjs`, `smoke_hooks.mjs`) | 가짜 브라우저·가짜 저장소로 인사·총무·재무회계 화면을 전부 열고(`--click` 이면 버튼도 눌러) 오류 화면을 찾는다 |
| `shot_ui.py` | 실제 브라우저(Chromium)로 화면을 띄워 **캡처** — 가짜 로그인·샘플 데이터. 화면 모양(겹침·잘림·글자 깨짐)을 눈으로 확인 |
| `build_frozen_docs.mjs` · `build_leave_promo_docs.mjs` | 구포털 동결 양식(근로·연봉계약서·급여명세서 / 연차사용촉진 통보서)을 원본 그대로 옮기는 생성기 |

배포 전 게이트: `tests/*.test.mjs` 전부 + `static_names_check.mjs` + `smoke_ui.mjs` + `scripts/*.py` 점검. 화면을 바꿨으면 `shot_ui.py` 로 캡처해 눈으로도 확인한다.
