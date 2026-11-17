// 오락실 진행 상태(순수 리듀서). 반복 클릭·재시도는 상태 검사로 무시하고, 장부 반영은 거래 id 기준 1회만.
import type { Game, MoveRound } from './course.ts'

export type Screen = 'home' | 'splash' | 'round' | 'end' | 'records'
export type State = {
  screen: Screen
  back: 'home' | 'end'
  gi: number
  ri: number
  status: 'play' | 'correct'
  wrong: string[] // 이번 문제에서 틀린 선택(다시 못 고르게 표시)
  clue: string | null
  placed: Record<string, string> // 블록 → 놓은 칸
  selected: string | null
  tries: number
  scores: Record<string, 'first' | 'retry'>
  posted: string[]
  why: boolean
}

export type Action =
  | { type: 'start' }
  | { type: 'begin' }
  | { type: 'choose'; id: string }
  | { type: 'select'; block: string }
  | { type: 'place'; target: string; block?: string }
  | { type: 'unplace'; block: string }
  | { type: 'next' }
  | { type: 'why' }
  | { type: 'records' }
  | { type: 'closeRecords' }
  | { type: 'restart' }

const fresh = { status: 'play' as const, wrong: [], clue: null, placed: {}, selected: null, tries: 0, why: false }
export const initial: State = { screen: 'home', back: 'home', gi: 0, ri: 0, ...fresh, scores: {}, posted: [] }

export const totalRounds = (games: Game[]) => games.reduce((n, g) => n + g.rounds.length, 0)

export function createArcade(games: Game[]) {
  return function reduce(s: State, a: Action): State {
    switch (a.type) {
      case 'start':
        return s.screen === 'home' ? { ...initial, screen: 'splash' } : s
      case 'restart':
        return initial
      case 'records':
        return s.screen === 'home' || s.screen === 'end' ? { ...s, back: s.screen, screen: 'records' } : s
      case 'closeRecords':
        return s.screen === 'records' ? { ...s, screen: s.back } : s
      case 'begin':
        return s.screen === 'splash' ? { ...s, screen: 'round', ri: 0, ...fresh } : s
    }
    if (s.screen !== 'round') return s
    const round = games[s.gi].rounds[s.ri]
    const win = (st: State): State => ({
      ...st, status: 'correct', clue: null, selected: null,
      scores: { ...st.scores, [round.id]: st.tries === 0 ? 'first' : 'retry' },
      posted: round.posts && !st.posted.includes(round.posts) ? [...st.posted, round.posts] : st.posted,
    })

    switch (a.type) {
      case 'why':
        return { ...s, why: !s.why }
      case 'next':
        if (s.status !== 'correct') return s
        if (s.ri + 1 < games[s.gi].rounds.length) return { ...s, ri: s.ri + 1, ...fresh }
        if (s.gi + 1 < games.length) return { ...s, gi: s.gi + 1, ri: 0, screen: 'splash', ...fresh }
        return { ...s, screen: 'end', ...fresh }
      case 'choose': {
        if (round.kind !== 'choice' || s.status !== 'play' || s.wrong.includes(a.id)) return s
        if (a.id === round.answer) return win(s)
        const opt = round.options.find((o) => o.id === a.id)
        if (!opt) return s
        return { ...s, wrong: [...s.wrong, a.id], clue: opt.clue ?? '다시 골라 보세요.', tries: s.tries + 1 }
      }
      case 'select':
        if (round.kind !== 'move' || s.status !== 'play' || s.placed[a.block]) return s
        return { ...s, selected: s.selected === a.block ? null : a.block, clue: null }
      case 'unplace': {
        if (round.kind !== 'move' || s.status !== 'play') return s
        const placed = { ...s.placed }
        delete placed[a.block]
        return { ...s, placed }
      }
      case 'place': {
        if (round.kind !== 'move' || s.status !== 'play') return s
        const free = round.blocks.filter((b) => !s.placed[b.id])
        // 남은 블록이 하나뿐이면 칸만 눌러도 놓인다
        const block = a.block ?? s.selected ?? (free.length === 1 ? free[0].id : null)
        const target = round.targets.find((t) => t.id === a.target)
        if (!block || !target || !round.blocks.some((b) => b.id === block)) return s
        const placed = { ...s.placed }
        if (!target.multi) for (const [b, t] of Object.entries(placed)) if (t === target.id) delete placed[b]
        placed[block] = target.id
        return judge({ ...s, placed, selected: null, clue: null }, round, win)
      }
    }
    return s
  }
}

function judge(s: State, round: MoveRound, win: (s: State) => State): State {
  const need = Object.keys(round.answer).length
  if (Object.keys(s.placed).length < need) return s
  const wrong = Object.entries(s.placed).filter(([b, t]) => round.answer[b] !== t)
  if (!wrong.length) return win(s)
  const placed = Object.fromEntries(Object.entries(s.placed).filter(([b, t]) => round.answer[b] === t))
  const [b, t] = wrong[0]
  return { ...s, placed, clue: round.clue(b, t), tries: s.tries + 1, wrong: [...s.wrong, `${b}>${t}`] }
}
