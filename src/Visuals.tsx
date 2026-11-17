// 공통 시각화: 회계등식 막대, T계정, 상품 선반, 이번 거래 저울, 금액 블록
import { useState } from 'react'
import { ACCOUNTS, ACCOUNT_ORDER, CATEGORIES, type AccountId } from './scenario.ts'
import { comma, man, signedMan, type Book, type Summary } from './ledger.ts'
import type { Tx } from './scenario.ts'

const pct = (v: number, max: number) => `${max > 0 ? (Math.max(0, v) / max) * 100 : 0}%`

type Seg = { key: string; name: string; v: number; delta: number; sub?: string; loss?: boolean; onClick?: () => void; open?: boolean }

function Bar({ label, segs, total, max }: { label: string; segs: Seg[]; total: number; max: number }) {
  return (
    <div className="eq-row">
      <div className="eq-label">{label}</div>
      <div className="eq-track" role="img" aria-label={`${label} ${man(total)}: ${segs.map((s) => `${s.name} ${man(s.v)}`).join(', ')}`}>
        {segs.filter((s) => s.v > 0).map((s) => {
          const Tag = s.onClick ? 'button' : 'div'
          return (
            <Tag key={s.key} className={`eq-seg c-${s.key} ${s.delta ? 'changed' : ''}`} style={{ width: pct(s.v, max) }}
              onClick={s.onClick} aria-expanded={s.onClick ? s.open : undefined} title={`${s.name} ${man(s.v)}`}>
              {s.v / max > 0.17 && <span className="seg-text">{s.name} {man(s.v)}{s.onClick ? ' ⓘ' : ''}</span>}
            </Tag>
          )
        })}
      </div>
      <div className="eq-total">{man(total)}</div>
      <div className="eq-legend">
        {segs.map((s) => (
          <button key={s.key} type="button" className={`legend ${s.onClick ? 'clickable' : ''}`} onClick={s.onClick} disabled={!s.onClick}>
            <i className={`sw c-${s.key}`} />
            {s.name} <b>{man(s.v)}</b>
            {s.sub && <em className={`sub ${s.loss ? 'loss' : 'gain'}`}>{s.sub}</em>}
            {s.delta !== 0 && <span className={`delta ${s.delta > 0 ? 'up' : 'down'}`}>{s.delta > 0 ? '▲' : '▼'} {man(Math.abs(s.delta))}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EquationBar({ sum, prev, max }: { sum: Summary; prev?: Summary; max: number }) {
  const [open, setOpen] = useState(false)
  const d = (now: number, before?: number) => (prev && before !== undefined ? now - before : 0)
  const accSeg = (cat: 'asset' | 'liability'): Seg[] =>
    ACCOUNT_ORDER.filter((a) => ACCOUNTS[a].category === cat && (sum.b[a] !== 0 || (prev && prev.b[a] !== 0)))
      .map((a) => ({ key: a, name: ACCOUNTS[a].name, v: sum.b[a], delta: d(sum.b[a], prev?.b[a]) }))
  const ni = sum.netIncome
  const equitySeg: Seg = {
    key: 'equity', name: '자본', v: sum.equity, delta: d(sum.equity, prev?.equity),
    loss: ni < 0,
    sub: ni < 0 ? `누적손실 ${man(-ni)}` : ni > 0 ? `누적이익 ${man(ni)}` : undefined,
    onClick: () => setOpen((o) => !o), open,
  }
  const right = [...accSeg('liability'), ...(sum.capital || sum.equity || prev?.equity ? [equitySeg] : [])]
  const left = accSeg('asset')
  return (
    <section className="equation" aria-label="회계등식">
      <h2>회계등식 <small>가게 전체 · 자산 = 부채 + 자본</small></h2>
      {left.length === 0 && right.length === 0 ? (
        <p className="muted">아직 장부에 기록된 거래가 없어요. 두 막대 모두 0원이에요.</p>
      ) : (
        <>
          <Bar label="자산" segs={left} total={sum.assets} max={max} />
          <div className="eq-equals">=</div>
          <Bar label="부채+자본" segs={right} total={sum.liabilities + sum.equity} max={max} />
          {open && (
            <div className="equity-pop" role="note">
              <b>자본 {man(sum.equity)}</b> = 출자금(자본금) {man(sum.capital)} + 이번 주 누적손익 {signedMan(ni)}
              <div className="muted">장부의 자본금 계정은 출자한 {man(sum.capital)}을 그대로 유지해요. {ni < 0 ? `손실 ${man(-ni)}만큼 자본 합계가 줄었어요.` : ni > 0 ? `이익 ${man(ni)}만큼 자본 합계가 늘었어요.` : '아직 손익이 없어요.'}</div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function TAccounts({ book, txs, lineMax, highlightTx, focus }: { book: Book; txs: Tx[]; lineMax: number; highlightTx?: string; focus: AccountId[] }) {
  const noOf = (id: string) => txs.find((t) => t.id === id)?.no ?? ''
  return (
    <section className="taccounts" aria-label="T계정">
      <h2>T계정 <small>왼쪽 차변 · 오른쪽 대변 · 거래가 누적돼요</small></h2>
      <div className="t-grid">
        {ACCOUNT_ORDER.map((acc) => {
          const { name, category } = ACCOUNTS[acc]
          const normal = CATEGORIES[category].normal
          const lines = book.entries.flatMap((e) => e.lines.filter((l) => l.account === acc).map((l) => ({ ...l, e })))
          const bal = lines.reduce((s, l) => s + (l.side === normal ? l.amount : -l.amount), 0)
          const col = (side: 'debit' | 'credit') => (
            <div className={`t-col ${side}`}>
              {lines.filter((l) => l.side === side).map((l, i) => (
                <div key={i} className={`t-entry ${highlightTx === l.e.txId ? 'hl' : ''}`}>
                  <div className={`t-bar c-${acc}`} style={{ width: pct(l.amount, lineMax) }} />
                  <div className="t-cap">
                    <span className="t-no">{noOf(l.e.txId)}</span> {comma(l.amount)}
                    <span className="t-dir">{l.side === normal ? '증가' : '감소'}</span>
                  </div>
                </div>
              ))}
            </div>
          )
          return (
            <article key={acc} className={`t-card ${lines.length ? '' : 'empty'} ${focus.includes(acc) ? 'focus' : ''}`}>
              <header><i className={`sw c-${acc}`} />{name}<span className={`cat cat-${category}`}>{CATEGORIES[category].name}</span></header>
              <div className="t-head"><span>차변</span><span>대변</span></div>
              <div className="t-body">{col('debit')}{col('credit')}</div>
              <footer>잔액 <b>{comma(bal)}원</b> <span className="muted">({normal === 'debit' ? '차변' : '대변'} 잔액)</span></footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}
