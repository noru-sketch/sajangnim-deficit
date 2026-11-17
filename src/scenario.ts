// 학습 콘텐츠(시나리오 데이터). 계산은 ledger.ts, 화면은 components가 담당한다.
// 문장 속 {qty} {price} {cost} {amount} {item} {stock} 등은 ledger.fill()이 거래 데이터로 채운다.

export type AccountId = 'cash' | 'inventory' | 'loan' | 'capital' | 'sales' | 'cogs' | 'rent'
export type Category = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type Side = 'debit' | 'credit'
export type Dir = 'up' | 'down'

export const CATEGORIES: Record<Category, { name: string; normal: Side }> = {
  asset: { name: '자산', normal: 'debit' },
  liability: { name: '부채', normal: 'credit' },
  equity: { name: '자본', normal: 'credit' },
  revenue: { name: '수익', normal: 'credit' },
  expense: { name: '비용', normal: 'debit' },
}

export const ACCOUNTS: Record<AccountId, { name: string; category: Category }> = {
  cash: { name: '현금', category: 'asset' },
  inventory: { name: '상품', category: 'asset' },
  loan: { name: '차입금', category: 'liability' },
  capital: { name: '자본금', category: 'equity' },
  sales: { name: '상품매출', category: 'revenue' },
  cogs: { name: '매출원가', category: 'expense' },
  rent: { name: '임차료', category: 'expense' },
}
export const ACCOUNT_ORDER: AccountId[] = ['cash', 'inventory', 'loan', 'capital', 'sales', 'cogs', 'rent']

export const PRODUCT = { name: '병커피', unitCost: 1000, unitPrice: 2000 }

export type Help = 'demo' | 'guide' | 'free'

export type PartContent = {
  tip: string // 계정 선택 단계의 도움말
  accountHints: Partial<Record<AccountId, string>> // 잘못 고른 계정별 맞춤 힌트
}

export type ApplyQ =
  | { type: 'choice'; prompt: string; options: { label: string; correct?: boolean; hint?: string }[] }
  | { type: 'classify'; account: AccountId; prompt: string; hints: Partial<Record<Category, string>> }
  | { type: 'saleCost'; qty: number }
  | { type: 'overstock'; extra: number }

type Common = {
  id: string
  no: string
  title: string
  story: string
  help: Help
  predictDistractors: [AccountId, Dir][][]
  parts: PartContent[]
  reason: string
  apply: ApplyQ[]
}

export type Tx =
  | (Common & { kind: 'contribution' | 'borrow' | 'rent'; amount: number })
  | (Common & { kind: 'purchase'; qty: number; unitCost: number })
  | (Common & { kind: 'sale'; qty: number; unitPrice: number })

export const INTRO = {
  amount: 1_000_000,
  question: '가게 통장에 100만 원이 들어왔어요. 통장 내역만 보고 상품을 판 돈인지 알 수 있을까요?',
  stories: [
    { id: 'contribution', title: '사장님이 넣은 돈', who: '사장님(나)', text: '내 저금을 가게 통장에 넣었어요. 가게 주인의 몫이 늘어요.', account: 'capital' as AccountId },
    { id: 'borrow', title: '은행에서 빌린 돈', who: '은행', text: '은행에서 빌렸어요. 나중에 갚아야 해요.', account: 'loan' as AccountId },
    { id: 'sale', title: '상품을 판 돈', who: '손님', text: '손님에게 병커피를 팔고 바로 받았어요.', account: 'sales' as AccountId },
  ],
  needQuestion: '매출은 100만 원이에요. 가게에 얼마가 남았는지는 무엇을 더 알아야 할까요?',
  needs: [
    { id: 'cost', label: '팔린 상품의 원가 (들여올 때 낸 돈)', correct: true },
    { id: 'opex', label: '가게 운영비 (임차료 등)', correct: true },
    { id: 'balance', label: '통장 잔액', correct: false, hint: '통장 잔액에는 넣은 돈·빌린 돈도 섞여 있어요.' },
    { id: 'customers', label: '손님 수', correct: false, hint: '손님 수는 남은 돈을 직접 알려 주지 않아요.' },
  ],
  purpose: '회계는 경제활동을 기록하고 정리해서, 나와 다른 사람이 상황을 이해하고 판단할 수 있게 하는 정보 전달 방법입니다.',
}

export const TRANSACTIONS: Tx[] = [
  {
    id: 't1', no: '①', kind: 'contribution', amount: 1_000_000, help: 'demo',
    title: '사업주 출자',
    story: '사장님(나)이 모아 둔 돈 {amount}을 가게 통장에 넣었어요.',
    predictDistractors: [[['cash', 'up'], ['sales', 'up']], [['cash', 'up'], ['loan', 'up']]],
    parts: [{
      tip: '돈이 들어온 곳(현금)과, 그 돈이 누구의 몫인지(사장님 몫 = 자본금)를 찾아보세요.',
      accountHints: {
        sales: '물건을 팔지 않았어요. 사장님이 넣은 돈은 가게가 번 돈이 아니에요.',
        loan: '사장님은 이 돈을 돌려받기로 하지 않았어요. 갚을 의무가 없는 주인의 몫은 무엇일까요?',
      },
    }],
    reason: '현금(자산)이 {amount} 늘고, 같은 금액만큼 사장님 몫인 자본금이 생겼어요. 들어온 돈이지만 가게가 번 돈(수익)은 아니에요.',
    apply: [{
      type: 'choice',
      prompt: '사장님이 개인 돈 5만 원을 가게에 더 넣었어요. 대변에는 무엇을 기록할까요?',
      options: [
        { label: '상품매출 5만 원', hint: '물건을 팔지 않았어요. 주인이 넣은 돈은 가게가 번 돈이 아니에요.' },
        { label: '자본금 5만 원', correct: true },
        { label: '차입금 5만 원', hint: '사장님은 이 돈을 돌려받기로 하지 않았어요. 주인의 몫은 어떤 계정일까요?' },
      ],
    }],
  },
  {
    id: 't2', no: '②', kind: 'borrow', amount: 500_000, help: 'guide',
    title: '은행 차입',
    story: '운영자금이 더 필요해서 은행에서 {amount}을 빌렸어요. 나중에 갚아야 해요.',
    predictDistractors: [[['cash', 'up'], ['sales', 'up']], [['cash', 'up'], ['capital', 'up']]],
    parts: [{
      tip: '현금이 들어왔고, 은행에 갚아야 할 의무가 생겼어요.',
      accountHints: {
        sales: '돈을 준 사람은 고객일까요, 은행일까요? 나중에 갚아야 하는지 떠올려 보세요.',
        capital: '은행은 가게 주인이 아니에요. 나중에 돌려줘야 하는 돈은 어떤 계정일까요?',
      },
    }],
    reason: '현금(자산)이 {amount} 늘었지만, 갚아야 할 차입금(부채)도 같은 금액만큼 생겼어요. 그래서 이익이 아니에요.',
    apply: [{
      type: 'choice',
      prompt: '친구에게 20만 원을 빌리고 다음 달에 갚기로 했어요. 대변에 놓을 계정은 무엇일까요?',
      options: [
        { label: '상품매출 20만 원', hint: '돈을 준 사람은 고객일까요, 친구일까요? 나중에 갚아야 하는지 떠올려 보세요.' },
        { label: '자본금 20만 원', hint: '친구는 가게 주인이 아니에요. 돌려줘야 하는 돈은 부채예요.' },
        { label: '차입금 20만 원', correct: true },
      ],
    }],
  },
  {
    id: 't3', no: '③', kind: 'purchase', qty: 100, unitCost: 1000, help: 'free',
    title: '병커피 매입',
    story: '{item} {qty}개를 개당 {cost}원에 현금으로 사서 선반에 채웠어요.',
    predictDistractors: [[['cash', 'down'], ['cogs', 'up']], [['cash', 'down'], ['capital', 'down']]],
    parts: [{
      tip: '현금이 나가고, 그만큼의 병커피가 선반에 들어왔어요. 둘 다 가게가 가진 것(자산)이에요.',
      accountHints: {
        cogs: '병커피가 아직 선반에 있어요. 아직 팔리지 않은 물건은 비용이 아니라 가게가 가진 물건이에요.',
        rent: '공간 사용료를 낸 거래가 아니에요. 돈을 주고 무엇을 받았는지 보세요.',
        capital: '사장님 몫이 줄어든 게 아니에요. 현금이 다른 자산으로 바뀌었어요.',
      },
    }],
    reason: '현금 {amount}이 같은 금액의 상품으로 바뀌었어요. 가게가 가진 것의 모양만 바뀌어서 총자산은 그대로예요.',
    apply: [{
      type: 'classify', account: 'inventory',
      prompt: '선반 위에 있는 병커피(상품)는 어디에 분류할까요?',
      hints: {
        expense: '병커피가 아직 선반에 있어요. 가게가 지금 가지고 있는 물건은 어디에 표시할까요?',
        revenue: '수익은 팔았을 때 생겨요. 지금은 아직 팔지 않고 가지고 있어요.',
        liability: '병커피는 누군가에게 갚아야 할 돈이 아니에요.',
        equity: '자본은 사장님이 넣은 몫과 이익이에요. 병커피는 가게가 가진 물건이에요.',
      },
    }],
  },
  {
    id: 't4', no: '④', kind: 'rent', amount: 30_000, help: 'free',
    title: '첫 주 임차료',
    story: '가게 공간의 첫 주 사용료 {amount}을 현금으로 냈어요. 이번 주에 공간을 모두 사용해요.',
    predictDistractors: [[['cash', 'down'], ['inventory', 'up']], [['cash', 'down'], ['loan', 'down']]],
    parts: [{
      tip: '현금이 나갔고, 그 돈은 이번 주 가게 운영에 쓰였어요(비용).',
      accountHints: {
        inventory: '공간 사용료는 선반에 남는 물건이 아니에요. 이번 주에 다 써 버린 돈은 무엇일까요?',
        capital: '자본금은 사장님이 넣은 돈이라 그대로 둬요. 운영에 쓴 돈은 비용 계정에 기록해요.',
        loan: '빌린 돈을 갚은 게 아니에요. 공간을 쓰는 대가로 낸 돈이에요.',
        cogs: '매출원가는 팔린 상품의 원가예요. 공간 사용료에 맞는 비용 계정을 찾아보세요.',
      },
    }],
    reason: '현금이 {amount} 줄고 같은 금액이 비용(임차료)이 됐어요. 비용은 이번 주 이익을 줄여 자본 합계를 줄여요. 장부의 자본금 계정은 그대로예요.',
    apply: [{
      type: 'choice',
      prompt: '이번 주 전기요금 1만 원을 현금으로 냈어요. 차변에는 무엇을 기록할까요?',
      options: [
        { label: '상품 1만 원', hint: '전기는 선반에 남지 않고 이번 주에 써 버렸어요.' },
        { label: '수도광열비(비용) 1만 원', correct: true },
        { label: '자본금 1만 원', hint: '자본금은 사장님이 넣은 돈이에요. 운영에 쓴 돈은 비용으로 기록해요.' },
      ],
    }],
  },
  {
    id: 't5', no: '⑤', kind: 'sale', qty: 60, unitPrice: 2000, help: 'free',
    title: '병커피 판매',
    story: '손님들이 {item} {qty}개를 개당 {price}원에 사 갔어요. 대금은 바로 받았어요.',
    predictDistractors: [[['cash', 'up'], ['sales', 'up']], [['cash', 'up'], ['inventory', 'down']]],
    parts: [
      {
        tip: '손님에게 받은 돈이 들어오고(현금), 상품을 판 수익(상품매출)이 생겨요.',
        accountHints: {
          inventory: '선반에서 빠진 병커피는 다음 기록(판매 원가)에서 다뤄요. 먼저 받은 돈과 판매 수익을 기록해요.',
          capital: '사장님이 넣은 돈이 아니에요. 손님에게 상품을 팔아 번 돈이에요.',
          loan: '손님에게 받은 돈은 갚을 필요가 없어요.',
        },
      },
      {
        tip: '선반을 떠난 {qty}개만큼 상품이 줄고, 그 매입원가가 비용(매출원가)이 돼요.',
        accountHints: {
          sales: '상품매출은 앞에서 이미 기록했어요. 이번에는 팔린 병커피의 원가를 기록해요.',
          cash: '원가 기록에서는 돈이 오가지 않아요. 선반에서 빠진 것은 무엇일까요?',
          rent: '임차료가 아니라 팔린 상품의 원가예요.',
        },
      },
    ],
    reason: '판매 대금으로 현금이 {sales} 늘고, 선반을 떠난 {qty}개의 매입원가 {cogs}만큼 상품이 줄었어요.',
    apply: [{ type: 'saleCost', qty: 20 }, { type: 'overstock', extra: 10 }],
  },
]

// 검증용: ?sold=40 처럼 판매 수량만 바꿔 같은 계산이 따라오는지 확인한다. 기본은 60개.
export function loadScenario(search: string): Tx[] {
  const sold = Number(new URLSearchParams(search).get('sold'))
  return TRANSACTIONS.map((t) => (t.kind === 'sale' && Number.isInteger(sold) && sold > 0 ? { ...t, qty: sold } : t))
}
