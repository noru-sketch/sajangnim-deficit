// '내 가게 기록 보기': 게임 5에서 기록한 거래만 쌓인 장부. 한 번에 한 가지 표만 보여 준다.
import { useState } from 'react'
import { ACCOUNTS, ACCOUNT_ORDER, PRODUCT, type Tx } from './scenario.ts'
import { cashProfitRows, comma, josa, man, signedMan, summary, unitCostOf, type Book } from './ledger.ts'
import { EquationBar, TAccounts } from './Visuals.tsx'

const TABS = ['재무제표', '회계등식', 'T계정', '현금·이익'] as const
const WHY: Record<Tx['kind'], string> = {
  contribution: '넣은 돈 → 내 몫(자본)', borrow: '빌린 돈 → 갚을 돈(부채)', purchase: '현금이 상품으로 바뀜',
  rent: '이번 주 비용', sale: '판 금액 − 팔린 상품 원가',
}

export function Records({ book, txs, scales, onBack }: { book: Book; txs: Tx[]; scales: { eq: number; line: number }; onBack: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('재무제표')
  const [open, setOpen] = useState<'inv' | 'eq' | null>(null)
  const sum = summary(book)
  const accs = (cat: string) => ACCOUNT_ORDER.filter((a) => ACCOUNTS[a].category === cat && sum.b[a] !== 0)
  const row = (label: string, v: number, o: { minus?: boolean; total?: boolean; onClick?: () => void } = {}) => {
    const Tag = o.onClick ? 'button' : 'div'
    return (
      <Tag key={label} className={`st-row ${o.total ? 'total' : ''}`} onClick={o.onClick}>
        <span>{o.minus && <span className="minus">차감</span>}{label}{o.onClick && <u> ▸ 눌러 보기</u>}</span>
        <b>{o.minus ? '− ' : ''}{man(v)}</b>
      </Tag>
    )
  }
  return (
    <section className="records">
      <div className="records-head">
        <button className="back" onClick={onBack}>← 돌아가기</button>
        <h1>📒 내 가게 기록</h1>
      </div>
      {book.posted.length === 0 ? (
        <p className="empty-note">아직 기록이 없어요.<br />게임 5에서 거래를 한 줄씩 기록하면 여기에 쌓여요.</p>
      ) : (
        <>
          <p className="muted center">기록한 거래 {book.posted.length}/{txs.length}건</p>
          <div className="tabs" role="tablist">
            {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          </div>
          {tab === '재무제표' && (
            <div className="statements">
              <article className="statement">
                <h2>손익계산서 <small>이번 주에 번 돈</small></h2>
                {accs('revenue').map((a) => row(ACCOUNTS[a].name, sum.b[a]))}
                {accs('expense').map((a) => row(ACCOUNTS[a].name, sum.b[a], { minus: true }))}
                {row('순이익', sum.netIncome, { total: true })}
              </article>
              <article className="statement">
                <h2>재무상태표 <small>지금 가진 것과 그 출처</small></h2>
                <div className="st-group">자산 · 가진 것</div>
                {accs('asset').map((a) => row(ACCOUNTS[a].name, sum.b[a], a === 'inventory' ? { onClick: () => setOpen(open === 'inv' ? null : 'inv') } : {}))}
                {open === 'inv' && (
                  <div className="detail">
                    {book.purchasedQty}개를 들여와 {book.soldQty}개를 팔았어요. 선반에 남은 {josa(PRODUCT.name, '은/는')} {book.stock}개예요.
                    <br />{book.stock}개 × 매입가 {comma(unitCostOf(book))}원 = {man(sum.b.inventory)}
                  </div>
                )}
                {row('자산 합계', sum.assets, { total: true })}
                <div className="st-group">부채 · 갚을 돈</div>
                {accs('liability').map((a) => row(ACCOUNTS[a].name, sum.b[a]))}
                <div className="st-group">자본 · 내 몫</div>
                {row('자본', sum.equity, { onClick: () => setOpen(open === 'eq' ? null : 'eq') })}
                {open === 'eq' && <div className="detail">출자금(자본금) {man(sum.capital)} + 이번 주 손익 {signedMan(sum.netIncome)}</div>}
                {row('부채·자본 합계', sum.liabilities + sum.equity, { total: true })}
              </article>
            </div>
          )}
          {tab === '회계등식' && <EquationBar sum={sum} max={scales.eq} />}
          {tab === 'T계정' && <TAccounts book={book} txs={txs} lineMax={scales.line} focus={[]} />}
          {tab === '현금·이익' && (
            <div className="cash-profit">
              <p className="big-compare"><span>남은 현금 <b>{man(sum.b.cash)}</b></span><span>≠</span><span>번 돈 <b>{man(sum.netIncome)}</b></span></p>
              <table>
                <thead><tr><th>거래</th><th>현금</th><th>이익</th></tr></thead>
                <tbody>
                  {cashProfitRows(book, txs).map(({ tx, cash, profit }) => (
                    <tr key={tx.id}><td>{tx.no} {tx.title}<div className="muted small">{WHY[tx.kind]}</div></td><td>{signedMan(cash)}</td><td>{signedMan(profit)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
