"""
경량 PJT(pjt_light) 품목현황 — 날짜별 누적 체크 모델 전환에 따른 기존 이력 초기화 스크립트

배경:
  기존 toggleItemStage()는 체크할 때마다 items/{id}.stages 뿐 아니라
  item_checks/{오늘날짜} 문서에도 보조 기록을 남겼습니다(공사일보 자동반영용).
  이번 개편으로 item_checks/{날짜}가 "완료 여부"의 유일한 근거(날짜별 누적 병합)가 되므로,
  기존에 우연히 쌓인 item_checks 기록을 지우지 않으면 "전부 초기화" 결정과 달리
  예전에 체크했던 항목이 그대로 완료 상태로 되살아납니다.

동작:
  pjt_registry 컬렉션의 모든 프로젝트를 순회하며, 각 프로젝트의
  item_checks 서브컬렉션 문서를 전부 삭제합니다.
  (items/{id}.stages 필드는 더 이상 코드에서 읽지 않으므로 그대로 둬도 무방합니다)

실행 방법 (김짜장 PC 터미널):
  pip install firebase-admin
  python reset_item_checks.py --project prod   # 운영(p4ph2-fab-506a7)
  python reset_item_checks.py --project test   # 테스트(portal-test-6e0ff)

사전 준비:
  같은 폴더에 서비스 계정 JSON을 아래 이름으로 둘 것
  - prod: p4ph2-fab-506a7-firebase-adminsdk-fbsvc-f84b0371ec.json
  - test: portal-test-6e0ff-firebase-adminsdk-fbsvc-fd25dd577d.json
"""
import argparse
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", choices=["prod", "test"], required=True)
    parser.add_argument("--dry-run", action="store_true", help="삭제 없이 대상만 출력")
    args = parser.parse_args()

    import firebase_admin
    from firebase_admin import credentials, firestore

    cred_file = (
        "p4ph2-fab-506a7-firebase-adminsdk-fbsvc-f84b0371ec.json"
        if args.project == "prod"
        else "portal-test-6e0ff-firebase-adminsdk-fbsvc-fd25dd577d.json"
    )

    cred = credentials.Certificate(cred_file)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    pjt_docs = list(db.collection("pjt_registry").stream())
    print(f"[{args.project}] pjt_registry 프로젝트 수: {len(pjt_docs)}")

    total_deleted = 0
    for pjt in pjt_docs:
        pjt_id = pjt.id
        pjt_name = (pjt.to_dict() or {}).get("name", "(이름없음)")
        checks_ref = db.collection("pjt_registry").document(pjt_id).collection("item_checks")
        check_docs = list(checks_ref.stream())
        if not check_docs:
            continue
        print(f"  - {pjt_id} ({pjt_name}): item_checks {len(check_docs)}건")
        if not args.dry_run:
            for d in check_docs:
                d.reference.delete()
        total_deleted += len(check_docs)

    if args.dry_run:
        print(f"[dry-run] 삭제 대상 총 {total_deleted}건 (실제 삭제 안 함)")
    else:
        print(f"완료: 총 {total_deleted}건 삭제")


if __name__ == "__main__":
    main()
