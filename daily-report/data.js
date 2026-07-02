// =====================================================
// data.js — P4 Ph2 (FAB) 공유 데이터 (순수 데이터만)
// =====================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCyQxBJ_ftfM0ImBXubmqD5gfzFR54iPmE",
  authDomain: "p4ph2-fab-506a7.firebaseapp.com",
  projectId: "p4ph2-fab-506a7",
  storageBucket: "p4ph2-fab-506a7.firebasestorage.app",
  messagingSenderId: "36946317914",
  appId: "1:36946317914:web:c6ad5f3a1b98130c99fe63"
};

export const WORKERS = [
  {id:'w1',name:'서민우',role:'팀장'},
  {id:'w2',name:'김혁',role:''},
  {id:'w3',name:'심산',role:''},
  {id:'w4',name:'유지범',role:''},
  {id:'w5',name:'이미정',role:''},
  {id:'w6',name:'이승준',role:''},
  {id:'w7',name:'정대웅',role:''},
  {id:'w8',name:'태성원',role:''},
  {id:'w9',name:'미첼',role:''},
];

export const ALL_SCHEDULE = {
  '2026-06-22':[
    {time:'13:00',text:'안전팀장 회의 (가동1층대회의실)',tag:'meeting',tagLabel:'회의'},
    {time:'14:00',text:'지게차 안전점검표 서명 (중기팀)',tag:'admin',tagLabel:'행정'},
    {time:'17:00',text:'관리자 정기교육 (소교육장2)',tag:'edu',tagLabel:'교육'},
    {time:'19:00',text:'FCU 설치 야간작업',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'FCU 공장검수 (범양)',tag:'inspect',tagLabel:'검수'},
    {time:null,text:'W26·W27 지게차 배차 요청',tag:'admin',tagLabel:'행정'},
  ],
  '2026-06-23':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'17:00',text:'(Ph2) 기술인 6월 정기교육 (조용일 프로 참석)',tag:'edu',tagLabel:'교육'},
    {time:'19:00',text:'FCU 설치, 작업환경측정 (반납 4층 J57열)',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'FCU 공장검수 (물산)',tag:'inspect',tagLabel:'검수'},
    {time:null,text:'세무서 방문 — 회사명 변경',tag:'admin',tagLabel:'행정'},
    {time:null,text:'지게차 전중 체크리스트 제출 (KISCO 최연희 과장)',tag:'admin',tagLabel:'행정'},
    {time:null,text:'비상대피훈련 시나리오 검토',tag:'admin',tagLabel:'행정'},
    {time:null,text:'DRI 상신 — 6/24 작업 / 작업위치: 3F FIZ / 작업시간: 19:00~05:00',tag:'admin',tagLabel:'행정'},
    {time:null,text:'작업환경측정 도구 수령',tag:'admin',tagLabel:'행정'},
    {time:null,text:'이한영 사원 오전 반차',tag:'leave',tagLabel:'반차',leaveInfo:{name:'이한영 사원',type:'half-am'}},
  ],
  '2026-06-24':[
    {time:'13:00',text:'안전팀장 회의 (중회의실5)',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:'20:00',text:'비상대피훈련',tag:'edu',tagLabel:'교육'},
    {time:null,text:'FCU 공장검수 (감리)',tag:'inspect',tagLabel:'검수'},
    {time:null,text:'장비감시자 배치승인서 결재 (설비팀)',tag:'admin',tagLabel:'행정'},
  ],
  '2026-06-25':[
    {time:'08:00',text:'6/26 장비감시자 배치 요청 (성민개발)',tag:'admin',tagLabel:'행정'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'15:00',text:'관리자 특별교육 (김종화·정다애)',tag:'edu',tagLabel:'교육'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-06-26':[
    {time:'10:00',text:'품질안전공정회의 (가동 대회의실)',tag:'meeting',tagLabel:'회의'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 2차 반입 5대(810~814) + 부자재 19대',tag:'fcu',tagLabel:'반입'},
    {time:'23:00',text:'E/V #13 사용',tag:'admin',tagLabel:'행정'},
  ],
  '2026-06-27':[{time:'10:00',text:'FCU 입고검사 5대(810~814)',tag:'inspect',tagLabel:'검수'}],
  '2026-06-28':[{time:null,text:'휴무',tag:'off',tagLabel:'휴무'}],
  '2026-06-29':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 2차 반입 5대(815~819)',tag:'fcu',tagLabel:'반입'},
    {time:'23:00',text:'E/V #13 사용',tag:'admin',tagLabel:'행정'},
    {time:null,text:'W28 지게차 배차 요청',tag:'admin',tagLabel:'행정'},
    {time:null,text:'6/30 장비감시자 신청',tag:'admin',tagLabel:'행정'},
  ],
  '2026-06-30':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 2차 반입 5대(831~833,838~839)',tag:'fcu',tagLabel:'반입'},
    {time:null,text:'FCU 입고검사 5대(815~819)',tag:'inspect',tagLabel:'검수'},
    {time:'23:00',text:'E/V #13 사용',tag:'admin',tagLabel:'행정'},
  ],
  '2026-07-01':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'2차 반입분 입고검사 19EA + 5대(831~833,838~839)',tag:'inspect',tagLabel:'검수'},
  ],
  '2026-07-02':[
    {time:'종일',text:'Ph4 투입 명단 확정',tag:'admin',tagLabel:'행정'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-03':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-04':[{time:null,text:'휴무',tag:'off',tagLabel:'휴무'}],
  '2026-07-06':[
    {time:'13:00',text:'(Ph2) 안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(Ph2) FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'W29 지게차 배차 요청',tag:'admin',tagLabel:'행정'},
  ],
  '2026-07-07':[
    {time:'07:00',text:'(Ph4) 공구이동 (Ph2→Ph4)',tag:'admin',tagLabel:'행정'},
    {time:'09:00',text:'(Ph4) 특별교육',tag:'edu',tagLabel:'교육'},
    {time:'13:00',text:'(Ph2) 안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(Ph2) FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:'17:00',text:'(P4 Ph4) 하역장 사용 신청',tag:'admin',tagLabel:'행정'},
    {time:null,text:'7/8 장비감시자 신청',tag:'admin',tagLabel:'행정'},
  ],
  '2026-07-08':[
    {time:'07:00',text:'(Ph4) EHU 8대 반입 및 설치(#13·#14)',tag:'fcu',tagLabel:'반입'},
    {time:'11:00',text:'(Ph4) EHU 하역 및 운반 #14 하역장',tag:'fcu',tagLabel:'반입'},
    {time:'13:00',text:'(Ph2) 안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(Ph2) FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'(FAB FIZ) FCU 35EA 설치 완료',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-09':[
    {time:'07:00',text:'EHU 설치 (#17 2대)',tag:'fcu',tagLabel:'반입'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'(FAB FIZ) FCU 시공 상태 자체 검수 및 검측 준비',tag:'inspect',tagLabel:'검수'},
  ],
  '2026-07-10':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:null,text:'공구이동 (Ph4→Ph2)',tag:'admin',tagLabel:'행정'},
  ],
  '2026-07-13':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-14':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-15':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:'23:00',text:'(X-OB) FCU 6EA 반입(861~866)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-16':[
    {time:'10:00',text:'FCU 입고검사 6EA(861~866)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:'23:00',text:'(X-OB) FCU 6EA 반입(867~872)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-17':[
    {time:'10:00',text:'FCU 입고검사 6EA(867~872)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
    {time:'23:00',text:'(X-OB) FCU 7EA 반입(873~879)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-18':[
    {time:'10:00',text:'FCU 입고검사 7EA(873~879)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-20':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-21':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-22':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합3동) FCU 4EA 반입(351~354)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-23':[
    {time:'10:00',text:'FCU 4EA 입고검사(351~354)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합3동) FCU 5EA 반입(355~359)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-24':[
    {time:'10:00',text:'FCU 5EA 입고검사(355~359)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합3동) FCU 5EA 반입(360~364)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-25':[{time:'10:00',text:'FCU 5EA 입고검사(360~364)',tag:'inspect',tagLabel:'검수'}],
  '2026-07-27':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-28':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'FCU 설치',tag:'fcu',tagLabel:'FCU설치'},
  ],
  '2026-07-29':[
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합4동) FCU 4EA 반입(302A~302D)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-30':[
    {time:'10:00',text:'FCU 4EA 입고검사(302A~302D)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합4동) FCU 5EA 반입(302E~302I)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-07-31':[
    {time:'10:00',text:'FCU 5EA 입고검사(302E~302I)',tag:'inspect',tagLabel:'검수'},
    {time:'13:00',text:'안전팀장 회의',tag:'meeting',tagLabel:'회의'},
    {time:'19:00',text:'(복합4동) FCU 5EA 반입(302J~302N)',tag:'fcu',tagLabel:'반입'},
  ],
  '2026-08-01':[{time:'10:00',text:'FCU 5EA 입고검사(302J~302N)',tag:'inspect',tagLabel:'검수'}],
  '2026-08-07':[{time:null,text:'8/10 장비감시자 신청',tag:'admin',tagLabel:'행정'}],
  '2026-08-10':[
    {time:'19:00',text:'(2F 제조부속실) FCU 8EA 반입(801~802,811~816)',tag:'fcu',tagLabel:'반입'},
    {time:null,text:'8/11 장비감시자 신청',tag:'admin',tagLabel:'행정'},
  ],
  '2026-08-11':[{time:'19:00',text:'(2F 제조부속실) FCU 8EA 반입(817~824)',tag:'fcu',tagLabel:'반입'}],
  '2026-08-12':[{time:'10:00',text:'(2F 제조부속실) FCU 16EA 입고검사(801~802,811~824)',tag:'inspect',tagLabel:'검수'}],
};
