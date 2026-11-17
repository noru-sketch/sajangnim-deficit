// 회계 규칙: 거래 → 분개 → 장부(재고·잔액·손익·재무상태). 화면 코드와 분리되어 있고 node로 검산할 수 있다.
import {
  ACCOUNTS, ACCOUNT_ORDER, CATEGORIES, PRODUCT,
  type AccountId, type ApplyQ, type Category, type Dir, type Side, type Tx,
} from './scenario.ts'

export type Line = { account: AccountId; side: Side; amount: number }
export type Entry = { txId: string; no: string; part: number; title: string; detail: string; lines: Line[] }
export type Book = {
  posted: string[]
  entries: Entry[]
  stock: number
  stockValue: number
  purchasedQty: number
  soldQty: number
}

export const emptyBook: Book = { posted: [], entries: [], stock: 0, stockValue: 0, purchasedQty: 0, soldQty: 0 }

// ── 표기 ──────────────────────────────────────────────
export const comma = (n: number) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
export const won = (n: number) => `${n < 0 ? '−' : ''}${comma(n)}원`
export const man = (n: number) => (n % 10000 === 0 && n !== 0 ? `${n < 0 ? '−' : ''}${comma(Math.abs(n) / 10000)}만 원` : won(n))
export const signedMan = (n: number) => (n > 0 ? `+${man(n)}` : n === 0 ? '0원' : man(n))

const hasBatchim = (word: string) => {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false
}
/** 받침에 맞춰 조사를 붙인다. josa('현금','은/는') → '현금은' */
export const josa = (word: string, pair: '은/는' | '이/가' | '을/를' | '이에요/예요') => {
  const [a, b] = pair.split('/')
  return word + (hasBatchim(word) ? a : b)
}

export const fill = (t: string, vars: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

export const unitCostOf = (book: Book) => (book.stock ? book.stockValue / book.stock : PRODUCT.unitCost)

export function txVars(tx: Tx, book: Book): Record<string, string | number> {
  const v: Record<string, string | number> = { item: PRODUCT.name, stock: book.stock, cost: comma(PRODUCT.unitCost), price: comma(PRODUCT.unitPrice) }
  if ('amount' in tx) v.amount = man(tx.amount)
  if (tx.kind === 'purchase') Object.assign(v, { qty: tx.qty, cost: comma(tx.unitCost), amount: man(tx.qty * tx.unitCost) })
  if (tx.kind === 'sale') {
    const unit = unitCostOf(book)
    Object.assign(v, { qty: tx.qty, price: comma(tx.unitPrice), cost: comma(unit), sales: man(tx.qty * tx.unitPrice), cogs: man(Math.round(tx.qty * unit)) })
  }
  return v
}

// ── 분개 생성 ─────────────────────────────────────────
export function stockProblem(tx: Tx, book: Book): string | null {
  if (tx.kind !== 'sale' || tx.qty <= book.stock) return null
  return `선반에 ${josa(PRODUCT.name, '이/가')} ${book.stock}개뿐이라 ${tx.qty}개를 팔 수 없어요.`
}

const pair = (debit: AccountId, credit: AccountId, amount: number): Line[] => [
  { account: debit, side: 'debit', amount },
  { account: credit, side: 'credit', amount },
]

export function journalFor(tx: Tx, book: Book): Entry[] {
  const e = (part: number, title: string, detail: string, lines: Line[]): Entry => ({ txId: tx.id, no: tx.no, part, title, detail, lines })
  switch (tx.kind) {
    case 'contribution':
      return [e(0, '출자 기록', '사장님이 넣은 돈', pair('cash', 'capital', tx.amount))]
    case 'borrow':
      return [e(0, '차입 기록', '은행에서 빌린 돈', pair('cash', 'loan', tx.amount))]
    case 'rent':
      return [e(0, '임차료 기록', '첫 주 공간 사용료', pair('rent', 'cash', tx.amount))]
    case 'purchase':
      return [e(0, '매입 기록', `${tx.qty}개 × 매입가 ${comma(tx.unitCost)}원`, pair('inventory', 'cash', tx.qty * tx.unitCost))]
    case 'sale': {
      const problem = stockProblem(tx, book)
      if (problem) throw new Error(problem)
      const unit = unitCostOf(book)
      return [
        e(0, '판매 대금 기록', `${tx.qty}개 × 판매가 ${comma(tx.unitPrice)}원`, pair('cash', 'sales', tx.qty * tx.unitPrice)),
        e(1, '판매 원가 기록', `${tx.qty}개 × 매입가 ${comma(unit)}원`, pair('cogs', 'inventory', Math.round(tx.qty * unit))),
      ]
    }
  }
}

/** 거래를 장부에 반영한다. 이미 반영된 거래는 다시 넣지 않는다(중복 기록 방지). */
export function post(book: Book, tx: Tx): Book {
  if (book.posted.includes(tx.id)) return book
  const entries = journalFor(tx, book)
  const next: Book = { ...book, posted: [...book.posted, tx.id], entries: [...book.entries, ...entries] }
  if (tx.kind === 'purchase') {
    next.stock += tx.qty
    next.purchasedQty += tx.qty
    next.stockValue += tx.qty * tx.unitCost
  }
  if (tx.kind === 'sale') {
    next.stock -= tx.qty
    next.soldQty += tx.qty
    next.stockValue -= entries[1].lines[0].amount
  }
  return next
}

export const replay = (txs: Tx[]) => txs.reduce(post, emptyBook)

// ── 잔액과 재무제표 ────────────────────────────────────
const signed = (l: Line) => (l.side === CATEGORIES[ACCOUNTS[l.account].category].normal ? l.amount : -l.amount)

export const balance = (book: Book, acc: AccountId) =>
  book.entries.flatMap((e) => e.lines).filter((l) => l.account === acc).reduce((s, l) => s + signed(l), 0)

export function summary(book: Book) {
  const b = Object.fromEntries(ACCOUNT_ORDER.map((a) => [a, balance(book, a)])) as Record<AccountId, number>
  const sum = (cat: Category) => ACCOUNT_ORDER.filter((a) => ACCOUNTS[a].category === cat).reduce((s, a) => s + b[a], 0)
  const revenue = sum('revenue')
  const expenses = sum('expense')
  const netIncome = revenue - expenses
  const capital = sum('equity')
  return {
    b, assets: sum('asset'), liabilities: sum('liability'), capital, revenue, expenses, netIncome,
    equity: capital + netIncome,
    grossProfit: b.sales - b.cogs,
  }
}
export type Summary = ReturnType<typeof summary>

/** 거래 한 건이 현금과 이익을 각각 얼마나 바꿨는지 */
export function cashProfitRows(book: Book, txs: Tx[]) {
  return txs.filter((t) => book.posted.includes(t.id)).map((tx) => {
    const lines = book.entries.filter((e) => e.txId === tx.id).flatMap((e) => e.lines)
    const cash = lines.filter((l) => l.account === 'cash').reduce((s, l) => s + signed(l), 0)
    const profit = lines.reduce((s, l) => {
      const cat = ACCOUNTS[l.account].category
      return cat === 'revenue' ? s + signed(l) : cat === 'expense' ? s - signed(l) : s
    }, 0)
    return { tx, cash, profit }
  })
}

// ── 예상(무엇이 늘고 줄까) ─────────────────────────────
export function effectsOf(entries: Entry[]): [AccountId, Dir][] {
  const net = new Map<AccountId, number>()
  for (const l of entries.flatMap((e) => e.lines)) net.set(l.account, (net.get(l.account) ?? 0) + signed(l))
  return [...net].filter(([, v]) => v !== 0).map(([a, v]) => [a, v > 0 ? 'up' : 'down'])
}
export const effectLabel = (fx: [AccountId, Dir][]) => fx.map(([a, d]) => `${ACCOUNTS[a].name} ${d === 'up' ? '↑' : '↓'}`).join(' · ')

export function predictOptions(tx: Tx, entries: Entry[]) {
  const options = [...tx.predictDistractors]
  const correct = Number(tx.id.replace(/\D/g, '')) % (options.length + 1)
  options.splice(correct, 0, effectsOf(entries))
  return { options, correct }
}

// ── 채점과 맞춤 힌트 ───────────────────────────────────
export type ErrorKind = 'incomplete' | 'account' | 'classification' | 'direction' | 'amount' | 'stock'
export type Feedback = { ok: true } | { ok: false; kind: ErrorKind; message: string }
export type Slot = { account?: AccountId; amount?: number }
export type Attempt = Record<Side, Slot>

const sideName = (s: Side) => (s === 'debit' ? '왼쪽 차변' : '오른쪽 대변')

export function accountGeneric(acc: AccountId) {
  const { name, category } = ACCOUNTS[acc]
  const cat = CATEGORIES[category].name
  return `${josa(name, '은/는')} ${josa(cat, '이에요/예요')}. 이 거래에서 ${josa(name, '이/가')} 정말 변했는지 거래 카드를 다시 읽어 보세요.`
}

export function directionHint(line: Line) {
  const { name, category } = ACCOUNTS[line.account]
  const cat = CATEGORIES[category].name
  const up = line.side === CATEGORIES[category].normal
  return `${josa(name, '은/는')} ${josa(cat, '이에요/예요')}. ${josa(cat, '이/가')} ${up ? '늘어난' : '줄어든'} 금액을 ${sideName(line.side)}에 놓아 보세요.`
}

export function checkAccounts(entry: Entry, chosen: AccountId[], hints: Partial<Record<AccountId, string>>): Feedback {
  const need = entry.lines.map((l) => l.account)
  const wrong = chosen.find((a) => !need.includes(a))
  if (wrong) return { ok: false, kind: 'account', message: hints[wrong] ?? accountGeneric(wrong) }
  if (chosen.length < need.length) return { ok: false, kind: 'incomplete', message: `이 기록에서 변하는 계정은 ${need.length}개예요. 하나 더 골라 보세요.` }
  return { ok: true }
}

export function amountHint(tx: Tx, entry: Entry, amount: number): string {
  const exp = entry.lines[0].amount
  if (tx.kind === 'sale') {
    const unit = entry.part === 1 ? exp / tx.qty : PRODUCT.unitCost
    if (entry.part === 1 && amount === tx.qty * tx.unitPrice)
      return `${tx.qty}개의 원가를 구할 때 판매가 ${comma(tx.unitPrice)}원과 매입가 ${comma(unit)}원 중 어느 금액을 곱할까요?`
    if (entry.part === 0 && amount === tx.qty * unit)
      return `판매 대금은 손님에게 받은 돈이에요. ${tx.qty}개 × 판매가 ${comma(tx.unitPrice)}원을 계산해 보세요.`
    if (amount === tx.unitPrice || amount === unit) return `${tx.qty}개를 팔았어요. 개당 금액에 수량을 곱해 보세요.`
  }
  if (tx.kind === 'purchase') {
    if (amount === tx.unitCost) return `${tx.qty}개를 샀어요. 개당 금액에 수량을 곱해 보세요.`
    if (amount === tx.qty * PRODUCT.unitPrice) return `들여올 때는 매입가 ${comma(tx.unitCost)}원으로 기록해요. 판매가가 아니에요.`
  }
  if (amount * 10 === exp || amount === exp * 10) return '0의 개수를 세어 보세요. 거래 카드의 금액과 자릿수가 같나요?'
  return ''
}

export function checkRecord(tx: Tx, entry: Entry, a: Attempt): Feedback {
  const d = entry.lines.find((l) => l.side === 'debit')!
  const c = entry.lines.find((l) => l.side === 'credit')!
  if (!a.debit.account || !a.credit.account || a.debit.amount == null || a.credit.amount == null)
    return { ok: false, kind: 'incomplete', message: '차변과 대변에 계정 카드와 금액 블록을 하나씩 모두 놓아 주세요.' }
  for (const s of ['debit', 'credit'] as Side[]) {
    const acc = a[s].account!
    if (acc !== d.account && acc !== c.account) return { ok: false, kind: 'account', message: accountGeneric(acc) }
  }
  if (a.debit.account !== d.account) return { ok: false, kind: 'direction', message: directionHint(d) }
  if (a.credit.account !== c.account) return { ok: false, kind: 'direction', message: directionHint(c) }
  const exp = d.amount
  const da = a.debit.amount, ca = a.credit.amount
  if (da === exp && ca === exp) return { ok: true }
  if (da === ca) {
    const h = amountHint(tx, entry, da)
    return { ok: false, kind: 'amount', message: `양쪽 금액은 같아요. 거래 카드의 금액을 다시 확인해 보세요.${h ? ' ' + h : ''}` }
  }
  const wrongSides = (['debit', 'credit'] as Side[]).filter((s) => a[s].amount !== exp)
  const where = wrongSides.length === 2 ? '양쪽' : wrongSides[0] === 'debit' ? '차변' : '대변'
  const h = amountHint(tx, entry, a[wrongSides[0]].amount!)
  return { ok: false, kind: 'amount', message: `차변과 대변 금액이 달라요. ${where} 금액을 거래 카드와 비교해 보세요.${h ? ' ' + h : ''}` }
}

/** 기록 단계에 놓을 금액 블록(정답 + 흔한 착각) */
export function amountChoices(tx: Tx, entry: Entry): number[] {
  const exp = entry.lines[0].amount
  let c: number[]
  if (tx.kind === 'purchase') c = [exp, tx.unitCost, tx.qty * PRODUCT.unitPrice]
  else if (tx.kind === 'sale') {
    const unit = exp / tx.qty
    c = entry.part === 0 ? [exp, tx.qty * PRODUCT.unitCost, tx.unitPrice] : [exp, tx.qty * tx.unitPrice, unit]
  } else c = [exp, exp / 10]
  return [...new Set(c.filter((n) => n > 0 && Number.isInteger(n)))].sort((x, y) => x - y)
}

// ── 새 상황에 적용 ─────────────────────────────────────
export type ApplyView = { prompt: string; kind: ErrorKind; options: { label: string; correct?: boolean; hint?: string }[] }

export function buildApply(tx: Tx, book: Book): ApplyView[] {
  return tx.apply.map((q: ApplyQ): ApplyView | null => {
    if (q.type === 'choice') return { ...q, kind: 'account' }
    if (q.type === 'classify') {
      const right = ACCOUNTS[q.account].category
      return {
        prompt: q.prompt,
        kind: 'classification',
        options: (Object.keys(CATEGORIES) as Category[]).map((cat) => ({
          label: CATEGORIES[cat].name,
          correct: cat === right,
          hint: q.hints[cat] ?? `${ACCOUNTS[q.account].name}의 성격을 다시 생각해 보세요.`,
        })),
      }
    }
    const item = PRODUCT.name
    if (q.type === 'saleCost') {
      const qty = Math.min(q.qty, book.stock)
      if (qty === 0) return null
      const unit = unitCostOf(book)
      const price = tx.kind === 'sale' ? tx.unitPrice : PRODUCT.unitPrice
      const opts = [
        { v: qty * unit, correct: true },
        { v: qty * price, hint: `${qty}개의 원가를 구할 때 판매가 ${comma(price)}원과 매입가 ${comma(unit)}원 중 어느 금액을 곱할까요?` },
        { v: unit, hint: `${qty}개가 선반을 떠나요. 개당 원가에 수량을 곱해 보세요.` },
      ].filter((o, i, arr) => arr.findIndex((x) => x.v === o.v) === i)
      return {
        kind: 'amount',
        prompt: `다음 날 손님이 ${item} ${qty}개를 사 갔어요. 판매 원가 기록(매출원가)의 금액은 얼마일까요?`,
        options: opts.sort((x, y) => x.v - y.v).map((o) => ({ label: won(o.v), correct: o.correct, hint: o.hint })),
      }
    }
    const ask = book.stock + q.extra
    const problem = stockProblem({ ...(tx as Tx & { kind: 'sale' }), qty: ask }, book)
    return {
      kind: 'stock',
      prompt: `손님이 ${item} ${ask}개를 한꺼번에 사겠다고 해요. 장부에 바로 판매로 기록할 수 있을까요?`,
      options: [
        { label: `${ask}개 판매로 바로 기록한다`, hint: `${problem ?? ''} 선반에 없는 상품은 판매로 기록할 수 없어요.`.trim() },
        { label: `선반에 남은 ${book.stock}개까지만 팔 수 있다고 안내한다`, correct: true },
      ],
    }
  }).filter((q): q is ApplyView => q !== null)
}
