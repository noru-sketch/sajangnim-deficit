import { useRef, type Dispatch, type PointerEvent } from 'react'
import type { Game, MoveRound, Round } from './course.ts'
import type { Action, State } from './arcade.ts'
import { Scene } from './Scenes.tsx'

export function Hud({ games, s }: { games: Game[]; s: State }) {
  const g = games[s.gi]
  const stars = Object.values(s.scores).filter((v) => v === 'first').length
  return (
    <div className="hud">
      <div className="hud-games" aria-label="게임 진행">
        {games.map((x, i) => <span key={x.no} className={i < s.gi ? 'done' : i === s.gi ? 'now' : ''}>{i < s.gi ? '✓' : x.no}</span>)}
      </div>
      <div className="hud-dots" aria-label={`게임 ${g.no}의 ${s.ri + 1}번째 문제 / ${g.rounds.length}`}>
        {g.rounds.map((r, i) => {
          const sc = s.scores[r.id]
          return <span key={r.id} className={sc ? 'done' : i === s.ri ? 'now' : ''}>{sc === 'first' ? '★' : sc ? '✓' : i === s.ri ? '●' : '○'}</span>
        })}
      </div>
      <div className="hud-score" aria-label={`한 번에 맞힌 문제 ${stars}개`}>★ {stars}</div>
    </div>
  )
}

export function RoundView({ round, s, dispatch }: { round: Round; s: State; dispatch: Dispatch<Action> }) {
  const done = s.status === 'correct'
  return (
    <section className="round">
      <p className="say">{round.say}</p>
      {round.kind === 'choice' && round.vis && <Scene vis={round.vis} done={done} />}
      <h2 className="ask">{round.ask}</h2>
      {round.kind === 'choice' ? (
        <div className={`options n${round.options.length}`}>
          {round.options.map((o) => {
            const isWrong = s.wrong.includes(o.id)
            const isRight = done && o.id === round.answer
            return (
              <button key={o.id} className={`opt ${isWrong ? 'wrong' : ''} ${isRight ? 'right' : ''}`} disabled={done || isWrong}
                aria-label={`${o.label}${o.sub ? ` ${o.sub}` : ''}${isWrong ? ' (틀림)' : ''}${isRight ? ' (정답)' : ''}`}
                onClick={() => dispatch({ type: 'choose', id: o.id })}>
                <span className="mark" aria-hidden>{isWrong ? '✗' : isRight ? '✓' : ''}</span>
                {o.label}{o.sub && <small>{o.sub}</small>}
              </button>
            )
          })}
        </div>
      ) : (
        <MoveBoard round={round} s={s} dispatch={dispatch} />
      )}
      <Feedback round={round} s={s} dispatch={dispatch} />
    </section>
  )
}

function Feedback({ round, s, dispatch }: { round: Round; s: State; dispatch: Dispatch<Action> }) {
  if (s.status === 'correct')
    return (
      <div className="fb good" role="status">
        <p className="fb-title"><span aria-hidden>✓</span> 정답!</p>
        <p className="fb-text">{round.result}</p>
        {round.term && <p className="term">🏷️ {round.term}</p>}
        {s.why && round.why && <p className="why-text">{round.why}</p>}
        <div className="fb-actions">
          {round.why && <button className="why-btn" aria-expanded={s.why} onClick={() => dispatch({ type: 'why' })}>{s.why ? '닫기' : '왜 그럴까?'}</button>}
          <button className="next pulse" onClick={() => dispatch({ type: 'next' })}>다음 ▶</button>
        </div>
      </div>
    )
  if (s.clue)
    return (
      <div className="fb bad" role="alert">
        <p className="fb-title"><span aria-hidden>✗</span> 다시 해 봐요</p>
        <p className="fb-text">💡 {s.clue}</p>
      </div>
    )
  return null
}

function MoveBoard({ round, s, dispatch }: { round: MoveRound; s: State; dispatch: Dispatch<Action> }) {
  const done = s.status === 'correct'
  const free = round.blocks.filter((b) => !s.placed[b.id])
  const pickTarget = !done && (s.selected !== null || free.length === 1)
  const groups = [...new Set(round.targets.map((t) => t.group).filter(Boolean))] as string[]
  const suppress = useRef(false)

  // PC: 블록을 끌어서 칸에 놓기. 끌지 않고 누르면 선택(모바일과 같은 방식)
  const drag = (block: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      suppress.current = false
      if (e.pointerType !== 'mouse' || e.button !== 0 || done) return
      e.preventDefault()
      const src = e.currentTarget, x0 = e.clientX, y0 = e.clientY
      let ghost: HTMLElement | null = null
      const at = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-target]') as HTMLElement | null
      const move = (ev: globalThis.PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
          ghost = src.cloneNode(true) as HTMLElement
          ghost.classList.add('ghost')
          document.body.appendChild(ghost)
        }
        ghost.style.left = `${ev.clientX}px`
        ghost.style.top = `${ev.clientY}px`
      }
      const up = (ev: globalThis.PointerEvent) => {
        removeEventListener('pointermove', move)
        removeEventListener('pointerup', up)
        if (!ghost) return
        ghost.remove()
        suppress.current = true
        const t = at(ev.clientX, ev.clientY)?.dataset.target
        if (t) dispatch({ type: 'place', target: t, block })
      }
      addEventListener('pointermove', move)
      addEventListener('pointerup', up)
    },
    onClick: () => {
      if (suppress.current) { suppress.current = false; return }
      dispatch({ type: 'select', block })
    },
  })

  const zone = (id: string) => {
    const t = round.targets.find((x) => x.id === id)!
    const inside = round.blocks.filter((b) => s.placed[b.id] === id)
    return (
      <div key={id} className={`zone ${pickTarget ? 'armed' : ''}`} data-target={id} role="button" tabIndex={done ? -1 : 0}
        aria-label={`${t.label}${t.sub ? ` ${t.sub}` : ''} 칸${inside.length ? `: ${inside.map((b) => b.label).join(', ')}` : ''}`}
        onClick={() => !done && dispatch({ type: 'place', target: id })}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !done && dispatch({ type: 'place', target: id })}>
        <span className="zone-label">{t.label}{t.sub && <small>{t.sub}</small>}</span>
        {t.helper && <span className="helper">⬇ {t.helper}</span>}
        {inside.map((b) => (
          <button key={b.id} className={`blk placed ${done ? 'pop' : ''}`} disabled={done}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'unplace', block: b.id }) }}>
            {done && b.after ? b.after : b.label}{!done && <small>{b.sub}</small>}
          </button>
        ))}
        {pickTarget && !inside.length && <span className="tap-here" aria-hidden>👆 여기</span>}
      </div>
    )
  }

  return (
    <div className="board">
      {!done && <p className="step-hint" aria-live="polite">{pickTarget ? '👇 놓을 칸을 눌러요' : '👇 아래에서 하나를 먼저 골라요'}</p>}
      {groups.length ? (
        <div className={`t-row n${groups.length}`}>
          {groups.map((g) => (
            <div key={g} className="tbox">
              <div className="t-title">{g}</div>
              <div className="t-zones">{round.targets.filter((t) => t.group === g).map((t) => zone(t.id))}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`zones n${round.targets.length}`}>{round.targets.map((t) => zone(t.id))}</div>
      )}
      {done && round.tally && <div className="tally pop">{round.tally.map((x) => <span key={x}>{x}</span>)}</div>}
      {!done && free.length > 0 && (
        <div className="tray" aria-label="블록">
          {free.map((b) => (
            <button key={b.id} {...drag(b.id)} aria-pressed={s.selected === b.id}
              className={`blk big ${s.selected === b.id ? 'lifted' : ''} ${!pickTarget ? 'pulse' : ''}`}>
              {b.label}{b.sub && <small>{b.sub}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
