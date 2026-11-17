// 코스 전체를 리듀서로 플레이: 오답·연속 클릭·재시작 후에도 장부가 정확한지 확인
import assert from 'node:assert/strict'
import { loadScenario } from './scenario.ts'
import { replay, summary } from './ledger.ts'
import { buildCourse } from './course.ts'
import { createArcade, initial, totalRounds, type Action, type State } from './arcade.ts'

function play(search: string, opts: { mistakes: boolean }) {
  const txs = loadScenario(search)
  const games = buildCourse(txs)
  const r = createArcade(games)
  let s: State = initial
  const go = (...as: Action[]) => { for (const a of as) s = r(s, a) }
  go({ type: 'start' }, { type: 'start' })
  let guard = 0
  while (s.screen !== 'end' && guard++ < 200) {
    if (s.screen === 'splash') { go({ type: 'begin' }, { type: 'begin' }); continue }
    const round = games[s.gi].rounds[s.ri]
    if (round.kind === 'choice') {
      const wrong = round.options.find((o) => o.id !== round.answer)!
      if (opts.mistakes) {
        go({ type: 'choose', id: wrong.id })
        assert.ok(s.clue && s.status === 'play', `clue for ${round.id}`)
        go({ type: 'choose', id: wrong.id }) // 같은 오답 반복은 무시
      }
      go({ type: 'choose', id: round.answer }, { type: 'choose', id: round.answer })
    } else {
      const entries = Object.entries(round.answer)
      if (opts.mistakes && round.targets.length > 1) {
        // 첫 블록을 틀린 칸에 놓아 단서를 받는다(블록이 둘 이상이면 나머지는 정답 칸)
        if (entries.length === 1) go({ type: 'place', block: entries[0][0], target: round.targets.find((t) => t.id !== entries[0][1])!.id })
        else entries.forEach(([b], i) => go({ type: 'place', block: b, target: entries[(i + 1) % entries.length][1] })) // 서로 바꿔 놓기
        assert.ok(s.clue && s.status === 'play', `clue for ${round.id}`)
      }
      for (const [b, t] of entries) go({ type: 'place', block: b, target: t })
    }
    assert.equal(s.status, 'correct', round.id)
    go({ type: 'next' }, { type: 'next' }) // 두 번 눌러도 한 문제만 넘어간다
  }
  assert.equal(s.screen, 'end')
  const book = replay(txs.filter((t) => s.posted.includes(t.id)))
  return { s, sum: summary(book), book, total: totalRounds(games) }
}

const clean = play('', { mistakes: false })
assert.equal(Object.values(clean.s.scores).filter((v) => v === 'first').length, clean.total)
assert.deepEqual(
  [clean.sum.b.cash, clean.sum.b.inventory, clean.sum.assets, clean.sum.liabilities, clean.sum.equity, clean.sum.netIncome, clean.book.stock],
  [1_490_000, 40_000, 1_530_000, 500_000, 1_030_000, 30_000, 40],
)
const messy = play('', { mistakes: true })
assert.equal(messy.s.posted.length, 5) // 거래 5건이 한 번씩만
assert.equal(messy.sum.b.cash, 1_490_000)
assert.ok(Object.values(messy.s.scores).filter((v) => v === 'retry').length >= messy.total - 2) // 칸이 하나뿐인 문제 2개는 틀릴 수 없음

const s40 = play('?sold=40', { mistakes: true }).sum
assert.deepEqual([s40.b.sales, s40.b.cogs, s40.b.inventory, s40.netIncome], [80_000, 40_000, 60_000, 10_000])

// 재시작하면 장부·진행이 비어 있다
const r = createArcade(buildCourse(loadScenario('')))
assert.deepEqual(r(messy.s, { type: 'restart' }), initial)
assert.throws(() => buildCourse(loadScenario('?sold=120'))) // 재고 초과는 코스 생성 전에 막힌다

console.log(`arcade check: ${clean.total} rounds, all assertions passed`)
