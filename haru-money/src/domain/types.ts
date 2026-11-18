export type AccountKind = 'bank' | 'cash' | 'card' | 'invest';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** 시작 잔액 (카드는 0) */
  initial: number;
  color: string;
  /** 카드 전용: 결제일(대금 납부일), 결제일 기준 사용 기간 마감일(승인 마감일) */
  card?: { closingDay: number; dueDay: number; limit: number; payFromId: string | null };
  /** 투자 전용: 현재 평가액 (수동 입력) */
  invest?: { currentValue: number; valuedAt: string };
  archived?: boolean;
  createdAt: number;
}

export type TxType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TxType;
  /** 양수, 원 단위 */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  accountId: string;
  /** 이체 받는 계좌 (transfer 전용) */
  toAccountId?: string | null;
  categoryId: string | null;
  note: string;
  /** 할부: 같은 구매의 회차들이 groupId 를 공유 */
  installment?: { groupId: string; index: number; count: number; total: number } | null;
  /** 카드 청구서에 속하는 달 (YYYY-MM). 카드 지출에만 사용 */
  billMonth?: string | null;
  /** 카드 대금 납부(은행 → 카드 이체) 표시 */
  cardPayment?: boolean;
  /** 고정 지출에서 생성됐으면 그 id */
  recurringId?: string | null;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Ionicons 이름
  color: string; // 파스텔 ink
  type: 'expense' | 'income';
  keywords: string[];
}

export interface Budget {
  categoryId: string;
  /** 월 예산 */
  amount: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD */
  deadline: string | null;
  color: string;
  createdAt: number;
}

export interface Recurring {
  id: string;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string | null;
  accountId: string;
  /** 매달 며칠 */
  day: number;
  remind: boolean;
  notifId?: string | null;
  active: boolean;
}

export type DebtKind = 'loan' | 'financing' | 'agreement' | 'personal';

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  /** 빌린 원금 */
  principal: number;
  /** 매달 내는 금액 */
  installment: number;
  /** 총 회차 */
  count: number;
  /** 첫 납부일 YYYY-MM-DD */
  firstDue: string;
  /** 납부한 회차 번호들 (1부터) */
  paid: number[];
  remind: boolean;
  notifIds?: string[];
  createdAt: number;
}

export interface Settings {
  currency: 'KRW' | 'USD' | 'EUR' | 'JPY';
  lock: boolean;
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
  defaultAccountId: string | null;
  backupReminder: 'off' | 'weekly' | 'monthly';
  lastBackupAt: number | null;
}

export interface AppData {
  version: 1;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  debts: Debt[];
  settings: Settings;
}
