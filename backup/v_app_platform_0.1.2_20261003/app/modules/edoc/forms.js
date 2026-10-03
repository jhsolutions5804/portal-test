/* 문서 종류별 상세 표시 정의 (읽기 전용 단계). fmt: text | multiline | date | money | days | list */
export const FORMS = {
  daily: { rows: [
    { label: '프로젝트', get: d => [d.pjtCode, d.pjtName].filter(Boolean).join(' · ') },
    { label: '작성일', key: 'date', fmt: 'date' },
    { label: '금일 업무', key: 'todayWork', fmt: 'multiline' },
    { label: '명일 계획', key: 'tomorrowWork', fmt: 'multiline' },
    { label: '특이사항', key: 'issue', fmt: 'multiline' }
  ] },
  leave: { rows: [
    { label: '휴가 종류', key: 'leaveType' },
    { label: '기간', get: d => (d.startDate ? d.startDate + (d.endDate && d.endDate !== d.startDate ? ' ~ ' + d.endDate : '') : ''), fmt: 'dateRange' },
    { label: '일수', key: 'days', fmt: 'days' },
    { label: '사유', get: d => d.reason || d.note || '', fmt: 'multiline' },
    { label: '비상연락처', key: 'contact' }
  ] },
  resign: { rows: [
    { label: '구분', key: 'leaveKind' },
    { label: '퇴직/휴직 예정일', key: 'lastDate', fmt: 'date' },
    { label: '복직 예정일', key: 'returnDate', fmt: 'date' },
    { label: '사유', key: 'reason', fmt: 'multiline' }
  ] },
  cert: { rows: [
    { label: '용도', key: 'purpose' },
    { label: '발급 언어', key: 'language' },
    { label: '부수', key: 'copies' }
  ] },
  purchase: { rows: [
    { label: '공급업체', key: 'vendor' },
    { label: '구매 목적', key: 'purpose', fmt: 'multiline' },
    { label: '필요일', key: 'dueDate', fmt: 'date' },
    { label: '품목', key: 'item' },
    { label: '수량', key: 'qty' },
    { label: '단가(원)', key: 'unitPrice', fmt: 'money' },
    { label: '참고 링크', key: 'refUrls', fmt: 'list' }
  ] },
  expense: { rows: [
    { label: '지출일', key: 'expDate', fmt: 'date' },
    { label: '지출 구분', key: 'category' },
    { label: '금액(원)', key: 'amount', fmt: 'money' },
    { label: '거래처', key: 'vendor' },
    { label: '지출 목적', key: 'purpose', fmt: 'multiline' },
    { label: '증빙', key: 'receipt' }
  ] }
};
