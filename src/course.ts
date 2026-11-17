// 전산회계 오락실 코스 데이터. 금액은 모두 ledger(검증된 회계 계산)에서 가져온다.
import { ACCOUNTS, CATEGORIES, PRODUCT, type AccountId, type Category, type Tx } from './scenario.ts'
import { comma, josa, man, replay, summary, type Entry } from './ledger.ts'

// 처음에는 쉬운 말 → 같은 대상에 정식 용어를 함께 → 정식 용어 중심
export const EASY: Record<Category, string> = { asset: '가진 것', liability: '갚을 돈', equity: '내 몫', revenue: '판 금액', expense: '들어간 비용' }

export type Option = { id: string; label: string; sub?: string; clue?: string }
export type Block = { id: string; label: string; sub?: string; after?: string }
export type Target = { id: string; label: string; sub?: string; helper?: string; group?: string; multi?: boolean }
export type Vis =
  | { type: 'inflow'; amount: number; answer: string }
  | { type: 'swap'; cash: number; goods: number }
  | { type: 'coins'; received: number; cost: number }
  | { type: 'bars'; sales: number; cogs: number; rent?: number }
  | { type: 'tname'; amount: number }
  | { type: 'tminus'; base: number; minus: number }

type Base = { id: string; say: string; ask: string; result: string; term?: string; why?: string; posts?: string }
export type ChoiceRound = Base & { kind: 'choice'; options: Option[]; answer: string; vis?: Vis }
export type MoveRound = Base & {
  kind: 'move'; blocks: Block[]; targets: Target[]; answer: Record<string, string>; tally?: string[]
  clue: (block: string, target: string) => string
}
export type Round = ChoiceRound | MoveRound
export type Game = { no: number; title: string; goal: string; icon: string; rounds: Round[] }

const kindOf = <K extends Tx['kind']>(txs: Tx[], k: K) => txs.find((t) => t.kind === k) as Tx & { kind: K }

export function buildCourse(txs: Tx[]): Game[] {
  const contrib = kindOf(txs, 'contribution'), borrow = kindOf(txs, 'borrow'), purchase = kindOf(txs, 'purchase')
  const rent = kindOf(txs, 'rent'), sale = kindOf(txs, 'sale')
  const full = replay(txs) // 재고 초과 설정이면 여기서 오류 → 화면에서 안내
  const week = summary(full)
  const beforeBuy = summary(replay(txs.slice(0, txs.indexOf(purchase))))
  const buyAmt = purchase.qty * purchase.unitCost
  const cost = PRODUCT.unitCost, price = sale.unitPrice

  const g1: Round[] = [
    {
      id: 'g1-borrow', kind: 'choice', say: `은행에서 ${man(borrow.amount)}을 빌렸어요.`, ask: '돈과 함께 무엇이 늘었을까요?',
      vis: { type: 'inflow', amount: borrow.amount, answer: '갚을 돈' },
      options: [{ id: 'debt', label: '갚을 돈' }, { id: 'earn', label: '번 돈', clue: '이 돈을 은행에 다시 돌려줘야 하나요?' }],
      answer: 'debt', result: `갚을 돈이 ${man(borrow.amount)} 늘었어요.`,
      why: '빌린 돈은 가게에 들어왔지만 나중에 은행에 돌려줘야 해요. 그래서 번 돈이 아니에요.',
    },
    {
      id: 'g1-owner', kind: 'choice', say: `사장님이 자기 돈 ${man(contrib.amount)}을 넣었어요.`, ask: '돈과 함께 무엇이 늘었을까요?',
      vis: { type: 'inflow', amount: contrib.amount, answer: '내 몫' },
      options: [{ id: 'earn', label: '번 돈', clue: '물건을 팔아서 생긴 돈인가요?' }, { id: 'mine', label: '내 몫' }],
      answer: 'mine', result: `사장님 몫이 ${man(contrib.amount)} 늘었어요.`,
      why: '사장님이 넣은 돈은 가게 주인의 몫이에요. 장사해서 번 돈이 아니에요.',
    },
    {
      id: 'g1-sale', kind: 'choice', say: `병커피 1개를 팔고 ${comma(price)}원을 받았어요.`, ask: '돈과 함께 무엇이 늘었을까요?',
      vis: { type: 'inflow', amount: price, answer: '판 금액' },
      options: [
        { id: 'debt', label: '갚을 돈', clue: '손님에게 돌려줄 돈인가요?' },
        { id: 'sales', label: '판 금액' },
        { id: 'mine', label: '내 몫', clue: '사장님이 넣은 돈인가요?' },
      ],
      answer: 'sales', result: `판 금액이 ${comma(price)}원 늘었어요. 이게 다 남은 돈일까요?`,
      why: `판 금액(매출) ${comma(price)}원 안에는 병커피를 사 올 때 쓴 돈이 들어 있어요. 얼마가 남았는지는 게임 3에서 계산해요.`,
    },
  ]

  const g2: Round[] = [
    {
      id: 'g2-buy1', kind: 'move', say: `${comma(cost)}원으로 병커피 1개를 사 왔어요.`, ask: '돈 블록을 선반으로 옮겨요.',
      blocks: [{ id: 'coin', label: `${comma(cost)}원`, sub: '현금', after: '☕ 병커피 1개' }],
      targets: [{ id: 'shelf', label: '선반', sub: '상품 칸' }],
      answer: { coin: 'shelf' }, clue: () => '선반을 눌러요.',
      tally: [`현금 ${comma(cost)}원 → 0원 ▼`, '병커피 0개 → 1개 ▲'],
      result: `현금 ${comma(cost)}원이 병커피 1개로 바뀌었어요.`,
      term: '돈과 물건은 모두 가게가 가진 것, 자산이에요.',
      why: '돈을 내고 같은 값의 물건을 받았어요. 가게가 가진 것의 모양만 바뀌었어요.',
    },
    {
      id: 'g2-buy100', kind: 'choice', say: `이번엔 병커피 ${purchase.qty}개를 ${man(buyAmt)}에 사 왔어요.`, ask: '가게가 가진 것(자산)의 합계는?',
      vis: { type: 'swap', cash: beforeBuy.b.cash, goods: buyAmt },
      options: [{ id: 'same', label: '그대로예요' }, { id: 'down', label: '줄었어요', clue: '현금이 나간 만큼 무엇이 들어왔나요?' }],
      answer: 'same', result: `가진 것(자산)은 ${man(beforeBuy.assets)} 그대로예요.`,
      term: '현금 ↓ 상품 ↑ · 둘 다 자산',
      why: `현금 ${man(buyAmt)}이 같은 값의 상품으로 바뀌었어요. 물건을 산 것만으로는 가게 재산이 줄지 않아요.`,
    },
  ]

  const gross = week.grossProfit, sales = week.b.sales, cogs = week.b.cogs, ni = week.netIncome
  const g3: Round[] = [
    {
      id: 'g3-sell1', kind: 'move', say: `${comma(cost)}원에 사 온 병커피를 ${comma(price)}원에 팔아요.`, ask: '병커피를 손님에게 건네요.',
      blocks: [{ id: 'bottle', label: '☕ 병커피', after: `💰 ${comma(price)}원 받음` }],
      targets: [{ id: 'customer', label: '손님', sub: '🙂' }],
      answer: { bottle: 'customer' }, clue: () => '손님을 눌러요.',
      tally: ['병커피 1개 → 0개 ▼', `현금 0원 → ${comma(price)}원 ▲`],
      result: `판 금액 ${comma(price)}원이 들어왔어요.`,
    },
    {
      id: 'g3-cost1', kind: 'choice', say: '팔린 병커피의 값을 떼어 내요.', ask: '얼마를 떼어 낼까요?',
      vis: { type: 'coins', received: price, cost },
      options: [{ id: 'cost', label: `${comma(cost)}원`, sub: '사 온 값' }, { id: 'price', label: `${comma(price)}원`, sub: '판 값', clue: '그 병커피를 얼마에 사 왔었나요?' }],
      answer: 'cost', result: `${comma(price)}원 − ${comma(cost)}원 = 남은 ${comma(price - cost)}원`,
      term: '판 금액(수익) − 들어간 비용(비용)',
      why: `팔린 병커피는 ${comma(cost)}원을 주고 사 왔어요. 그 값이 판매에 들어간 비용(매출원가)이에요.`,
    },
    {
      id: 'g3-week', kind: 'choice', say: `이번 주엔 병커피 ${sale.qty}개를 팔았어요.`, ask: '판매로 남은 금액은?',
      vis: { type: 'bars', sales, cogs },
      options: [{ id: 'sales', label: man(sales), clue: `${sale.qty}개의 원가 ${man(cogs)}을 떼어 냈나요?` }, { id: 'gross', label: man(gross) }],
      answer: 'gross', result: `판매로 남은 금액은 ${man(gross)}이에요.`,
      why: `판 금액 ${man(sales)}에서 팔린 ${sale.qty}개의 원가(${sale.qty}개 × ${comma(cost)}원 = ${man(cogs)})를 빼요.`,
    },
    {
      id: 'g3-rent', kind: 'choice', say: `가게 사용료 ${man(rent.amount)}도 냈어요.`, ask: '이번 주에 번 돈(순이익)은?',
      vis: { type: 'bars', sales, cogs, rent: rent.amount },
      options: dedupe([
        { id: 'gross', label: man(gross), clue: '가게 사용료도 들어간 비용이에요.' },
        { id: 'ni', label: man(ni) },
        { id: 'sales', label: man(sales), clue: '원가와 사용료를 모두 떼어 내요.' },
      ]),
      answer: 'ni', result: `순이익은 ${man(ni)}. 판 금액 ${man(sales)}과 달라요!`,
      term: '판 금액(수익) − 들어간 비용(비용) = 순이익',
      why: `팔린 상품의 원가 ${man(cogs)}와 사용료 ${man(rent.amount)}가 모두 이번 주 비용이에요. ${man(sales)} − ${man(cogs + rent.amount)} = ${man(ni)}.`,
    },
  ]

  const tSide = (group: string, helperLeft?: string, helperRight?: string, named = false): Target[] => [
    { id: `${group}:L`, group, label: named ? '차변' : '왼쪽', helper: helperLeft },
    { id: `${group}:R`, group, label: named ? '대변' : '오른쪽', helper: helperRight },
  ]
  const g4: Round[] = [
    {
      id: 'g4-cash', kind: 'move', say: `현금이 ${man(borrow.amount)} 늘었어요.`, ask: '블록을 T의 한쪽에 놓아요.',
      blocks: [{ id: 'cash', label: `현금 +${man(borrow.amount)}` }], targets: tSide('현금 · 가진 것', '현금이 늘어나는 쪽'),
      answer: { cash: '현금 · 가진 것:L' }, clue: () => '‘현금이 늘어나는 쪽’ 표시를 찾아요.',
      result: '현금이 늘면 왼쪽에 적어요.',
    },
    {
      id: 'g4-loan', kind: 'move', say: `갚을 돈(차입금)이 ${man(borrow.amount)} 늘었어요.`, ask: '블록을 T의 한쪽에 놓아요.',
      blocks: [{ id: 'loan', label: `차입금 +${man(borrow.amount)}` }], targets: tSide('차입금 · 갚을 돈', undefined, '갚을 돈이 늘어나는 쪽'),
      answer: { loan: '차입금 · 갚을 돈:R' }, clue: () => '‘갚을 돈이 늘어나는 쪽’ 표시를 찾아요.',
      result: '갚을 돈이 늘면 오른쪽에 적어요.',
    },
    {
      id: 'g4-capital', kind: 'move', say: `내 몫(자본금)이 ${man(contrib.amount)} 늘었어요.`, ask: '이번엔 표시 없이 놓아요.',
      blocks: [{ id: 'capital', label: `자본금 +${man(contrib.amount)}` }], targets: tSide('자본금 · 내 몫'),
      answer: { capital: '자본금 · 내 몫:R' }, clue: () => '내 몫은 갚을 돈과 같은 쪽에서 늘어요.',
      result: '내 몫도 오른쪽에서 늘어요.',
      why: '가진 것(자산)은 왼쪽에서, 갚을 돈(부채)과 내 몫(자본)은 오른쪽에서 늘어나요.',
    },
    {
      id: 'g4-name', kind: 'choice', say: 'T의 왼쪽은 차변, 오른쪽은 대변이라고 불러요.', ask: '현금 블록이 있는 쪽의 이름은?',
      vis: { type: 'tname', amount: borrow.amount },
      options: [{ id: 'dr', label: '차변' }, { id: 'cr', label: '대변', clue: '현금 블록은 왼쪽에 있어요.' }],
      answer: 'dr', result: '왼쪽 = 차변, 오른쪽 = 대변', term: '차변(왼쪽) · 대변(오른쪽)',
    },
    {
      id: 'g4-minus', kind: 'choice', say: `병커피를 사느라 현금이 ${man(buyAmt)} 줄었어요.`, ask: '줄어든 현금은 어느 쪽에 적을까요?',
      vis: { type: 'tminus', base: beforeBuy.b.cash, minus: buyAmt },
      options: [{ id: 'dr', label: '차변', sub: '왼쪽', clue: '늘어나는 쪽의 반대편이에요.' }, { id: 'cr', label: '대변', sub: '오른쪽' }],
      answer: 'cr', result: '줄어들면 반대편, 대변에 적어요.',
      why: '어느 쪽에서 늘어나는지는 계정 종류가 정해요. 현금(자산)은 차변에서 늘고, 줄어들 때는 대변에 적어요.',
    },
    {
      id: 'g4-pair', kind: 'move', say: `은행에서 ${man(borrow.amount)}을 빌렸어요.`, ask: '두 블록을 각각 놓아요.',
      blocks: [{ id: 'cash', label: `현금 +${man(borrow.amount)}` }, { id: 'loan', label: `차입금 +${man(borrow.amount)}` }],
      targets: [...tSide('현금', undefined, undefined, true), ...tSide('차입금', undefined, undefined, true)],
      answer: { cash: '현금:L', loan: '차입금:R' },
      clue: (b, t) => (b === 'cash' && !t.startsWith('현금')) || (b === 'loan' && !t.startsWith('차입금'))
        ? `${b === 'cash' ? '현금' : '차입금'} 블록은 ${b === 'cash' ? '현금' : '차입금'} T에 놓아요.`
        : b === 'cash' ? '가진 것(현금)은 차변에서 늘어요.' : '갚을 돈(차입금)은 대변에서 늘어요.',
      result: `차변 ${man(borrow.amount)} = 대변 ${man(borrow.amount)}. 양쪽이 같아요!`,
      why: '거래 하나는 늘 두 곳을 바꿔요. 그래서 차변과 대변의 금액이 같아져요.',
    },
  ]

  // 게임 5: 이미 플레이한 거래를 순서대로 분개. 정답을 맞힌 거래만 내 가게 장부에 반영한다.
  const briefs = (e: Entry) => {
    const tx = txs.find((t) => t.id === e.txId)!
    const amt = man(e.lines[0].amount)
    switch (tx.kind) {
      case 'contribution': return `사장님이 ${amt}을 넣었어요.`
      case 'borrow': return `은행에서 ${amt}을 빌렸어요.`
      case 'purchase': return `병커피 ${tx.qty}개를 ${amt}에 사 왔어요.`
      case 'rent': return `가게 사용료 ${amt}을 냈어요.`
      case 'sale': return e.part === 0 ? `병커피 ${tx.qty}개를 팔고 ${amt}을 받았어요.` : `팔린 ${tx.qty}개의 원가 ${amt}만큼 상품이 줄었어요.`
    }
  }
  const extra: Record<string, AccountId | undefined> = { 't3:0': 'cogs', 't4:0': 'inventory', 't5:0': 'loan', 't5:1': 'sales' }
  const g5: Round[] = full.entries.map((e, i) => {
    const [d, c] = e.lines
    const accs = [d.account, c.account, extra[`${e.txId}:${e.part}`]].filter(Boolean) as AccountId[]
    const lastPart = !full.entries[i + 1] || full.entries[i + 1].txId !== e.txId
    const card = (a: AccountId): Block => {
      const cat = ACCOUNTS[a].category
      return { id: a, label: ACCOUNTS[a].name, sub: i < 3 ? `${CATEGORIES[cat].name} · ${EASY[cat]}` : CATEGORIES[cat].name }
    }
    return {
      id: `g5-${e.txId}-${e.part}`, kind: 'move', say: briefs(e), ask: i === 0 ? '카드를 차변·대변 칸에 놓아요.' : '한 줄 기록을 완성해요.',
      blocks: (i % 2 ? [...accs].reverse() : accs).map(card),
      targets: [
        { id: 'debit', label: '차변', sub: comma(d.amount) + '원', helper: i === 0 ? '늘어난 현금' : undefined },
        { id: 'credit', label: '대변', sub: comma(c.amount) + '원' },
      ],
      answer: { [d.account]: 'debit', [c.account]: 'credit' },
      clue: (b) => {
        const line = e.lines.find((l) => l.account === b)
        if (!line) return `이 거래에서 ${josa(ACCOUNTS[b as AccountId].name, '은/는')} 변하지 않아요.`
        const cat = ACCOUNTS[line.account].category
        const up = line.side === CATEGORIES[cat].normal
        return up
          ? `${josa(ACCOUNTS[line.account].name, '이/가')} 늘었어요. ${josa(EASY[cat], '은/는')} 어느 쪽에서 늘었나요?`
          : `${josa(ACCOUNTS[line.account].name, '이/가')} 줄었어요. 늘어나는 쪽의 반대편이에요.`
      },
      result: i === 0 ? '이렇게 거래를 기록하는 것을 분개라고 해요.' : `차변 ${ACCOUNTS[d.account].name} / 대변 ${ACCOUNTS[c.account].name}`,
      term: i === 0 ? '분개 = 거래 한 줄 기록' : undefined,
      posts: lastPart ? e.txId : undefined,
    }
  })

  return [
    { no: 1, icon: '💵', title: '돈의 정체 맞히기', goal: '들어온 돈이 어떤 돈인지 골라요', rounds: g1 },
    { no: 2, icon: '🔄', title: '돈이 물건으로 바뀌기', goal: '돈을 물건으로 바꿔 봐요', rounds: g2 },
    { no: 3, icon: '🧮', title: '팔면 얼마가 남을까?', goal: '판 금액에서 비용을 떼어 내요', rounds: g3 },
    { no: 4, icon: '⊤', title: '왼쪽·오른쪽에 기록하기', goal: '블록을 T의 한쪽에 놓아요', rounds: g4 },
    { no: 5, icon: '✍️', title: '거래 한 줄 완성하기', goal: '카드로 한 줄 기록을 만들어요', rounds: g5 },
  ]
}

function dedupe(opts: Option[]) {
  return opts.filter((o, i) => opts.findIndex((x) => x.label === o.label) === i)
}
