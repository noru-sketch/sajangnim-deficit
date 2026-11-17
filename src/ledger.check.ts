// 계산 검산: `npm run check` (node가 TS를 직접 실행)
import assert from 'node:assert/strict'
import { loadScenario, type Tx } from './scenario.ts'
import { amountChoices, buildApply, checkRecord, journalFor, post, replay, summary, stockProblem, emptyBook } from './ledger.ts'

const base = loadScenario('')
const at = (txs: Tx[], n: number) => summary(replay(txs.slice(0, n)))

// 거래별 등식
assert.equal(at(base, 3).assets, 1_500_000) // ③ 매입 후 총자산 유지
assert.equal(at(base, 3).b.inventory, 100_000)
const r4 = at(base, 4)
assert.deepEqual([r4.assets, r4.liabilities + r4.equity, r4.capital, r4.equity, r4.netIncome], [1_470_000, 1_470_000, 1_000_000, 970_000, -30_000])

// 최종(60개)
const book = replay(base)
const f = summary(book)
assert.deepEqual(
  [f.b.cash, f.b.inventory, f.assets, f.liabilities, f.equity, f.netIncome, f.b.sales, f.b.cogs, f.grossProfit, book.stock],
  [1_490_000, 40_000, 1_530_000, 500_000, 1_030_000, 30_000, 120_000, 60_000, 60_000, 40],
)

// 판매 40개
const b40 = replay(loadScenario('?sold=40'))
const s40 = summary(b40)
assert.deepEqual([s40.b.sales, s40.b.cogs, s40.b.inventory, s40.netIncome, s40.b.cash, b40.stock], [80_000, 40_000, 60_000, 10_000, 1_450_000, 60])
assert.equal(s40.assets, s40.liabilities + s40.equity)

// 재고 초과 판매는 기록 전에 막는다
const over = loadScenario('?sold=120')
const before = replay(over.slice(0, 4))
assert.ok(stockProblem(over[4], before)?.includes('100개뿐'))
assert.throws(() => post(before, over[4]))

// 중복 기록 방지
assert.equal(post(book, base[0]), book)

// 채점: 방향·금액·같은 오답
const sale = base[4]
const [cashEntry, cogsEntry] = journalFor(sale, replay(base.slice(0, 4)))
const kind = (fb: ReturnType<typeof checkRecord>) => (fb.ok ? 'ok' : fb.kind)
assert.equal(kind(checkRecord(sale, cogsEntry, { debit: { account: 'cogs', amount: 60_000 }, credit: { account: 'inventory', amount: 60_000 } })), 'ok')
const same = checkRecord(sale, cogsEntry, { debit: { account: 'cogs', amount: 120_000 }, credit: { account: 'inventory', amount: 120_000 } })
assert.ok(!same.ok && same.message.startsWith('양쪽 금액은 같아요. 거래 카드의 금액을 다시 확인해 보세요.') && same.message.includes('판매가 2,000원과 매입가 1,000원'))
const dir = checkRecord(base[0], journalFor(base[0], emptyBook)[0], { debit: { account: 'capital', amount: 1_000_000 }, credit: { account: 'cash', amount: 1_000_000 } })
assert.ok(!dir.ok && dir.kind === 'direction' && dir.message === '현금은 자산이에요. 자산이 늘어난 금액을 왼쪽 차변에 놓아 보세요.')
assert.equal(kind(checkRecord(sale, cashEntry, { debit: { account: 'cash', amount: 120_000 }, credit: { account: 'sales', amount: 60_000 } })), 'amount')
assert.deepEqual(amountChoices(sale, cogsEntry), [1_000, 60_000, 120_000])

// 적용 문제는 장부 상태로 계산
const apply = buildApply(sale, book)
assert.ok(apply[0].prompt.includes('20개') && apply[0].options.find((o) => o.correct)?.label === '20,000원')
assert.ok(apply[1].prompt.includes('50개') && apply[1].options[1].label.includes('40개'))

console.log('ledger check: all assertions passed')
