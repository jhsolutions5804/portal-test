/* PJT 공정 프로파일 — 프로젝트별 섹터·장비 목록, 공정 체크 컬렉션 이름, 단계 열(checkCols), 설치 하위 항목(installCols), 과거 공정 상수.
 * 두 모듈이 같이 쓰는 단일 출처다: 영업기획(청구서 공정 연동 계산)과 PJT 공정 탭(체크표). 구포털 기획·PJT(gihoek/index.html·pjt/index.html·pjt_ph4/index.html)의 데이터를 그대로 옮겼다(수정하지 않는다).
 * 새 현장(P4 Ph5 등)이 섹터×장비 방식을 쓰려면 PROGRESS_PROFILES 에 항목을 더한다. 섹터 없이 품목·단계를 자유롭게 정하는 프로젝트는 경량PJT(pjt_registry)다. */
export const PROGRESS_PROFILES = {
  'p4ph2': {
    label: 'P4 Ph2 (FAB)',
    client: '귀뚜라미 범양냉방', pptTitle: 'FCU 설치',   // 공정표 PPT 표지 기본 문구
    progCol: 'progress_checks_',
    mandayCol: 'worker_manday',
    checkCols: ['반입','입고검사','내진스토퍼','다이크','실링','동판','결선','시공검측'],
    installCols: ['내진스토퍼','다이크','실링','동판','결선'],
    zones: [
      {id:'fiz', name:'3F FIZ', total:39, eqs:Array.from({length:39},(_,i)=>String(801+i)), kw:['3F FIZ','FIZ']},
      {id:'xob', name:'X-OB', total:19, eqs:['861','862','863','864','865','866','867','868','869','870','871','872','873','874','875','876','877','878','879'], kw:['X-OB','XOB']},
      {id:'c3', name:'복합3동', total:14, eqs:['351','352','353','354','355','356','357','358','359','360','361','362','363','364'], kw:['복합3동','복합 3동']},
      {id:'c4', name:'복합4동', total:14, eqs:['302A','302B','302C','302D','302E','302F','302G','302H','302I','302J','302K','302L','302M','302N'], kw:['복합4동','복합 4동']},
      {id:'wob', name:'W-OB', total:81, eqs:Array.from({length:81},(_,i)=>'W-'+(101+i)), kw:['W-OB','WOB']},
      {id:'mfr', name:'2F 제조부속실', total:16, eqs:['801','802','811','812','813','814','815','816','817','818','819','820','821','822','823','824'], kw:['제조부속실','2F 제조']},
    ]
  },
  'p4ph4': {
    label: 'P4 Ph4 (SUP)',
    client: '귀뚜라미 범양냉방', pptTitle: 'EHU 설치',
    progCol: 'ph4_progress_',
    mandayCol: 'ph4_manday',
    checkCols: ['반입','입고검사','내진스토퍼','시공검측'],
    installCols: ['내진스토퍼'],
    zones: [
      {id:'core20', name:'(중공업) #20Core', total:3, eqs:['EHU_4F10701','EHU_4F10702','EHU_4F10703'], kw:['20Core','#20','중공업']},
      {id:'core13', name:'(물산) #13Core', total:3, eqs:['EHU_4F10511','EHU_4F10512','EHU_4F10513'], kw:['13Core','#13']},
      {id:'core14', name:'(물산) #14Core', total:3, eqs:['EHU_4F10803','EHU_4F10804','EHU_4F10805'], kw:['14Core','#14']},
      {id:'core17', name:'(물산) #17Core', total:2, eqs:['EHU_4F10801','EHU_4F10802'], kw:['17Core','#17']},
    ]
  }
};

// 워크스페이스 코드 상수로만 존재(Firestore 미저장)하는 과거 공정 데이터 — 자동계산 시 FAB(p4ph2)에서만 합산
export const PAST_PROGRESS_DAILY={
  '2026-06-17':{ fiz:{'801_반입':true,'802_반입':true,'803_반입':true,'804_반입':true,'805_반입':true,'806_반입':true} },
  '2026-06-18':{ fiz:{'807_반입':true,'808_반입':true,'809_반입':true,'820_반입':true,'821_반입':true,'822_반입':true,'823_반입':true,'801_입고검사':true,'802_입고검사':true,'803_입고검사':true,'804_입고검사':true,'805_입고검사':true,'806_입고검사':true} },
  '2026-06-19':{ fiz:{'824_반입':true,'825_반입':true,'826_반입':true,'827_반입':true,'828_반입':true,'829_반입':true,'830_반입':true,'807_입고검사':true,'808_입고검사':true,'809_입고검사':true,'820_입고검사':true,'821_입고검사':true,'822_입고검사':true,'823_입고검사':true} },
  '2026-06-20':{ fiz:{'824_입고검사':true,'825_입고검사':true,'826_입고검사':true,'827_입고검사':true,'828_입고검사':true,'829_입고검사':true,'830_입고검사':true} },
};
