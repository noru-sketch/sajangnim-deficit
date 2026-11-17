// 선택 문제의 도형 장면. done=정답 이후 상태(움직임으로 결과를 보여 준다)
import type { Vis } from './course.ts'
import { comma, man } from './ledger.ts'

const pct = (v: number, max: number) => `${(v / max) * 100}%`

export function Scene({ vis, done }: { vis: Vis; done: boolean }) {
  switch (vis.type) {
    case 'inflow':
      return (
        <div className="scene inflow" aria-label="들어온 돈과 함께 늘어난 것">
          <div className="pile">
            <span className="pile-name">가게 돈</span>
            <div className="blk cash drop">+{man(vis.amount)}</div>
          </div>
          <span className="link" aria-hidden>⇄</span>
          <div className="pile">
            <span className="pile-name">함께 늘어난 것</span>
            <div className={`blk ${done ? 'answer pop' : 'unknown'}`}>{done ? vis.answer : '?'}</div>
          </div>
        </div>
      )
    case 'swap': {
      const total = vis.cash
      return (
        <div className="scene swap" aria-label="현금과 상품 막대">
          <div className="bar-row"><span className="bar-name">사기 전</span><div className="bar"><div className="seg cash" style={{ width: '100%' }}>현금 {man(total)}</div></div></div>
          <div className="bar-row"><span className="bar-name">산 뒤</span>
            <div className="bar">
              <div className="seg cash" style={{ width: pct(total - vis.goods, total) }}>현금 {man(total - vis.goods)}</div>
              <div className="seg goods slide" style={{ width: pct(vis.goods, total) }}><span className="out">상품 {man(vis.goods)}</span></div>
            </div>
          </div>
          <p className="legend-line"><span className="key cash" />현금 {man(total - vis.goods)} + <span className="key goods" />상품 {man(vis.goods)}</p>
          {done && <div className="brace pop">⟵ 두 막대 길이가 같아요: {man(total)} ⟶</div>}
        </div>
      )
    }
    case 'coins':
      return (
        <div className="scene coins" aria-label="받은 돈에서 원가 떼어 내기">
          <div className="pile">
            <span className="pile-name">받은 돈 {comma(vis.received)}원</span>
            <div className="coin-row">
              <div className={`blk coin ${done ? 'gone' : ''}`}>{comma(vis.cost)}원</div>
              <div className={`blk coin ${done ? 'keep pop' : ''}`}>{comma(vis.received - vis.cost)}원{done && <small>남은 돈</small>}</div>
            </div>
          </div>
          <div className="pile bin">
            <span className="pile-name">떼어 낼 칸</span>
            <div className={`blk ${done ? 'cost pop' : 'unknown'}`}>{done ? <>{comma(vis.cost)}원<small>들어간 비용</small></> : '?'}</div>
          </div>
        </div>
      )
    case 'bars': {
      const { sales, cogs, rent = 0 } = vis
      const left = sales - cogs - rent
      return (
        <div className="scene bars" aria-label="판 금액에서 비용 떼어 내기">
          <div className="bar-row"><span className="bar-name">판 금액</span><div className="bar"><div className="seg sales" style={{ width: '100%' }}>{man(sales)}</div></div></div>
          <div className="bar-row"><span className="bar-name">빼기</span>
            <div className="bar">
              <div className="seg cut" style={{ width: pct(cogs, sales) }}>원가 {man(cogs)}</div>
              {rent > 0 && <div className="seg cut rent" style={{ width: pct(rent, sales) }}>사용료 {man(rent)}</div>}
              <div className={`seg left ${done ? 'pop' : 'unknown'}`} style={{ width: pct(left, sales) }}>{done ? `남음 ${man(left)}` : '?'}</div>
            </div>
          </div>
          <p className="legend-line"><span className="key cut" />원가 {man(cogs)}{rent > 0 && <> <span className="key rent" />사용료 {man(rent)}</>} <span className="key left" />남은 돈 {done ? man(left) : '?'}</p>
        </div>
      )
    }
    case 'tname':
      return (
        <div className="scene tbox" aria-label="T계정 이름">
          <div className="t-title">현금</div>
          <div className="t-top"><span>차변 <small>(왼쪽)</small></span><span>대변 <small>(오른쪽)</small></span></div>
          <div className="t-zones"><div className="zone static"><div className="blk cash">현금 +{man(vis.amount)}</div></div><div className="zone static" /></div>
        </div>
      )
    case 'tminus':
      return (
        <div className="scene tbox" aria-label="줄어든 현금 기록">
          {!done && <div className="blk cash minus float">현금 −{man(vis.minus)} ?</div>}
          <div className="t-title">현금</div>
          <div className="t-top"><span>차변 <small>(왼쪽)</small></span><span>대변 <small>(오른쪽)</small></span></div>
          <div className="t-zones">
            <div className="zone static"><div className="blk cash">+{man(vis.base)} <small>늘어난 것</small></div></div>
            <div className="zone static">{done && <div className="blk cash minus pop">−{man(vis.minus)} <small>줄어든 것</small></div>}</div>
          </div>
        </div>
      )
  }
}
