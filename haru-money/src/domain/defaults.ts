import type { Account, AppData, Category, Settings } from './types';

// 파스텔 ink 색 (theme.ts 의 PASTELS 와 같은 값)
export const INK = {
  lavender: '#5B45B8', mint: '#1F7A55', peach: '#A84B24', sky: '#2A5FA8', butter: '#7D5F00', rose: '#A8335E', stone: '#5A5560',
};

const c = (id: string, name: string, icon: string, color: string, type: Category['type'], keywords: string[]): Category =>
  ({ id, name, icon, color, type, keywords });

export const DEFAULT_CATEGORIES: Category[] = [
  c('food', '식비', 'restaurant-outline', INK.peach, 'expense',
    ['밥', '점심', '저녁', '아침', '식사', '식당', '배달', '배민', '요기요', '쿠팡이츠', '치킨', '피자', '햄버거', '버거', '국밥', '분식', '김밥', '라면', '고기', '삼겹살', '회식', '족발', '초밥', '중식', '짜장', '맥도날드', '롯데리아', 'lunch', 'dinner', 'breakfast', 'food']),
  c('cafe', '카페·간식', 'cafe-outline', INK.butter, 'expense',
    ['커피', '카페', '스타벅스', '스벅', '이디야', '메가커피', '빽다방', '투썸', '디저트', '빵', '베이커리', '케이크', '아이스크림', '간식', '음료', 'coffee']),
  c('grocery', '장보기·생활', 'basket-outline', INK.mint, 'expense',
    ['마트', '장보기', '이마트', '홈플러스', '롯데마트', '코스트코', '편의점', 'gs25', 'cu', '세븐일레븐', '다이소', '생필품', '쿠팡', '휴지', '세제', '식료품', 'grocery']),
  c('transport', '교통', 'bus-outline', INK.sky, 'expense',
    ['버스', '지하철', '택시', '카카오택시', 'ktx', 'srt', '기차', '주유', '기름', '주차', '톨게이트', '하이패스', '교통', '따릉이', '킥보드', 'taxi', 'bus', 'uber']),
  c('shopping', '쇼핑', 'bag-handle-outline', INK.rose, 'expense',
    ['옷', '신발', '가방', '쇼핑', '무신사', '지그재그', '올리브영', '화장품', 'tv', '티비', '노트북', '컴퓨터', '휴대폰', '아이폰', '갤럭시', '가전', '냉장고', '세탁기', '에어컨', '가구', '이케아', '전자제품']),
  c('housing', '주거·공과금', 'home-outline', INK.stone, 'expense',
    ['월세', '관리비', '전기', '전기세', '가스', '가스비', '수도', '수도세', '전세', '이자', '공과금', 'rent']),
  c('phone', '통신', 'phone-portrait-outline', INK.sky, 'expense', ['통신', '통신비', '휴대폰요금', '핸드폰요금', '인터넷', 'skt', 'kt', 'lg유플러스', '알뜰폰']),
  c('subs', '구독', 'repeat-outline', INK.lavender, 'expense',
    ['구독', '넷플릭스', '유튜브', '유튜브프리미엄', '멜론', '스포티파이', '디즈니', '티빙', '웨이브', '쿠팡와우', '네이버플러스', 'chatgpt', '클로드', 'icloud', '애플뮤직', 'netflix', 'spotify']),
  c('health', '의료·건강', 'medkit-outline', INK.mint, 'expense', ['병원', '약국', '약', '치과', '한의원', '안과', '피부과', '헬스', '필라테스', '요가', '운동', '건강검진']),
  c('fun', '문화·여가', 'film-outline', INK.lavender, 'expense', ['영화', 'cgv', '메가박스', '공연', '콘서트', '전시', '여행', '숙소', '호텔', '항공', '비행기', '게임', '책', '도서', '노래방', '취미', 'pc방']),
  c('edu', '교육', 'school-outline', INK.sky, 'expense', ['학원', '강의', '수강', '교재', '인강', '학비', '등록금', '자격증', '시험']),
  c('gift', '경조사·선물', 'gift-outline', INK.rose, 'expense', ['선물', '축의금', '부조', '조의금', '생일', '기념일', '용돈드림', '경조사', '꽃']),
  c('insurance', '보험', 'shield-checkmark-outline', INK.stone, 'expense', ['보험', '보험료', '실비']),
  c('etc', '기타 지출', 'ellipsis-horizontal-circle-outline', INK.stone, 'expense', []),
  c('salary', '급여', 'briefcase-outline', INK.mint, 'income', ['월급', '급여', '월급날', '상여', '보너스', '성과급', 'salary']),
  c('side', '부수입', 'sparkles-outline', INK.butter, 'income', ['용돈', '알바', '부업', '아르바이트', '중고', '당근', '판매', '환급', '캐시백', '리워드']),
  c('interest', '이자·배당', 'trending-up-outline', INK.lavender, 'income', ['이자수익', '배당', '배당금', '예금이자']),
  c('income_etc', '기타 수입', 'add-circle-outline', INK.stone, 'income', ['수입', '입금']),
];

export const defaultSettings: Settings = {
  currency: 'KRW', lock: false, theme: 'system', onboarded: false, defaultAccountId: null, backupReminder: 'monthly', lastBackupAt: null,
};

export function freshData(uid: () => string): AppData {
  const now = Date.now();
  const bank: Account = { id: uid(), name: '주거래 통장', kind: 'bank', initial: 0, color: INK.sky, createdAt: now };
  const cash: Account = { id: uid(), name: '현금', kind: 'cash', initial: 0, color: INK.mint, createdAt: now + 1 };
  const card: Account = {
    id: uid(), name: '신용카드', kind: 'card', initial: 0, color: INK.lavender, createdAt: now + 2,
    card: { closingDay: 31, dueDay: 14, limit: 3000000, payFromId: bank.id },
  };
  return {
    version: 1,
    accounts: [bank, cash, card],
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((x) => ({ ...x, keywords: [...x.keywords] })),
    budgets: [],
    goals: [],
    recurring: [],
    debts: [],
    settings: { ...defaultSettings, defaultAccountId: bank.id },
  };
}
