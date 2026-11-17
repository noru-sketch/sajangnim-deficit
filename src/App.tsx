import { useEffect, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { ACCOUNTS, ACCOUNT_ORDER, loadScenario, type AccountId, type Side, type Tx } from './scenario';
import { checkRecord, emptyBook, josa, journalFor, man, post, replay, signedMan, summary, type Book, type Line } from './ledger';
import { useSound } from './media';

const labels: Record<AccountId, string> = { cash: '가게 돈', inventory: '남은 커피', loan: '갚을 돈', capital: '내가 넣은 돈', sales: '커피 팔고 얻은 수익', cogs: '커피 원가', rent: '자리값' };
const art: Record<AccountId, string> = { cash: 'cash', inventory: 'inventory', loan: 'loan', capital: 'capital', sales: 'sales', cogs: 'cash', rent: 'rent' };
const Icon = ({ name }: { name: string }) => <img className="mini-icon" src={`/media/obj-${name}.png`} alt="" />;
const sides: Side[] = ['debit', 'credit'];
const leftUp = (a: AccountId) => ['cash', 'inventory', 'rent', 'cogs'].includes(a);
const titles: Record<Tx['kind'], string> = { contribution: '내 돈으로 편의점 장사를 시작해요', borrow: '은행에서 돈을 빌려요', purchase: '커피를 선반에 채워요', rent: '가게 자리값을 내요', sale: '손님들에게 커피를 팔아요' };
const lessons: Record<Tx['kind'], string> = { contribution: '넣은 돈은 내 몫이에요. 번 돈은 아직 없어요.', borrow: '돈은 늘어도, 갚아야 하니 내 몫은 그대로예요.', purchase: '돈이 커피로 바뀌었어요. 가진 것의 합은 그대로예요.', rent: '자리값만큼 이번 주 남은 돈과 내 몫이 줄어요.', sale: '받은 돈에서 커피 원가을 빼야 남은 돈이에요.' };
function setup() {
  try {
    const n = new URLSearchParams(location.search).get('sold');
    if (n !== null && (!/^\d+$/.test(n) || !Number.isSafeInteger(Number(n)) || Number(n) <= 0)) throw new Error('판매 개수는 1 이상의 정수로 적어 주세요.');
    const txs = loadScenario(location.search); replay(txs); return { txs, error: '' };
  } catch (e) { return { txs: [] as Tx[], error: e instanceof Error ? e.message : '가게 설정을 확인해 주세요.' }; }
}
type Sound = ReturnType<typeof useSound>['play'];
// 생성한 누끼(투명 배경) 객체 이미지. 그림이 의미를 전하므로 alt는 비우고 옆 글자로 읽힌다.
function ObjectArt({ account }: { account: AccountId }) {
  return <img className="obj-art" src={`/media/obj-${art[account]}.png`} alt="" draggable={false} />;
}
function Shop({ stock, cash, children, success = false }: { stock: number; cash: number; children?: ReactNode; success?: boolean }) {
  return <div className={`shop-stage ${success ? 'settled' : ''}`} data-testid="shop-stage">
    <img className="stall" src="/media/stall.png" alt="작은 편의점 계산대" />
    <span className="shop-sign">모퉁이 편의점 <i>OPEN</i></span>
    <div className="shop-chips"><span>☕ 선반 {stock}개</span><span>💵 지금 {man(cash)}</span></div>
    <div className="shop-objects">{children}</div>
    {success && <span className="receipt-token" aria-hidden="true">✓ 기록에 쏙</span>}
  </div>;
}
type BoardProps = { title: ReactNode; lines: Line[]; total: number; scale: number; left: boolean; account?: AccountId; selected?: AccountId | null; slots?: Partial<Record<Side, AccountId>>; expected?: Line[]; active?: boolean; amount?: number; hot?: Side | null; burst?: { side: Side; key: number } | null; onPlace?: (a: AccountId, s: Side) => void };
function Board({ title, lines, total, scale, left, account, selected, slots, expected, active, amount, hot, burst, onPlace }: BoardProps) {
  // T 보드 전체가 놓는 곳: 드래그는 보드의 왼쪽/오른쪽 절반으로, 탭은 절반 아무 곳이나 눌러도 된다.
  return <article className={`t-board ${active && selected === account ? 'target' : ''}`} data-testid={account ? `board-${account}` : undefined} data-drop-account={active ? account : undefined}>
    <h3>{title}</h3><div className="t-columns">{sides.map((side, i) => {
      const sum = lines.filter(l => l.side === side).reduce((n, l) => n + l.amount, 0);
      const ready = account && slots?.[side] === account;
      const valid = active && selected === account && expected?.some(l => l.account === account && l.side === side);
      return <div className={`t-side ${hot === side ? 'hot' : ''} ${burst?.side === side ? 'thump' : ''}`} key={burst?.side === side ? `${side}-${burst.key}` : side} data-side={side} onClick={() => { if (account && active) onPlace?.(account, side); }}><small>{i === 0 ? '←' : '→'} {(i === 0) === left ? '늘어요' : '줄어요'}</small>
        <div className="bar-well" aria-hidden="true"><span style={{ height: `${Math.min(100, sum / scale * 100)}%` }} /></div>
        <strong className="side-amount">{man(sum)}</strong>
        {account && <button className={`drop ${valid ? 'valid' : ''} ${ready ? 'placed' : ''}`} disabled={!active} data-testid={expected?.some(l => l.account === account && l.side === side) ? `slot-${side}` : `slot-${account}-${side}`} aria-label={`${labels[account]} ${i === 0 ? '왼쪽' : '오른쪽'}, ${(i === 0) === left ? '늘어요' : '줄어요'}`}>{ready ? `✓ ${man(amount ?? 0)}` : '여기에 놓기'}</button>}
        {burst?.side === side && <span className="burst" aria-hidden="true">+{man(amount ?? 0)}</span>}
      </div>;
    })}</div><p className="board-total">지금 <b>{man(total)}</b></p>
  </article>;
}
const sideAt = (x: number, y: number): { account: AccountId; side: Side } | null => {
  const board = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-account]');
  const cols = board?.querySelector('.t-columns')?.getBoundingClientRect();
  return board && cols ? { account: board.dataset.dropAccount as AccountId, side: x < cols.left + cols.width / 2 ? 'debit' : 'credit' } : null;
};
// 카드가 T의 막대로 날아 들어가는 연출(장식). 움직임 줄이기 설정이면 생략.
function fly(a: AccountId, side: Side) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = document.querySelector<HTMLElement>(`[data-testid="account-${a}"]`);
  const to = document.querySelector<HTMLElement>(`[data-drop-account="${a}"] [data-side="${side}"] .bar-well`);
  if (!from || !to) return;
  const f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
  const c = from.cloneNode(true) as HTMLElement;
  Object.assign(c.style, { position: 'fixed', left: `${f.left}px`, top: `${f.top}px`, width: `${f.width}px`, margin: '0', zIndex: '90', pointerEvents: 'none' });
  c.classList.add('flying');
  document.body.appendChild(c);
  const dx = t.left + t.width / 2 - (f.left + f.width / 2), dy = t.top + t.height / 2 - (f.top + f.height / 2);
  c.animate([{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${dx * .5}px, ${dy * .5 - 60}px) scale(.8) rotate(-8deg)`, opacity: 1, offset: .55 }, { transform: `translate(${dx}px, ${dy}px) scale(.25) rotate(6deg)`, opacity: .2 }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished.then(() => c.remove(), () => c.remove());
}
function Categories({ book }: { book: Book }) {
  const s = summary(book), lines = book.entries.flatMap(e => e.lines);
  const groups: { id: string; title: ReactNode; accounts: AccountId[]; total: number; left: boolean }[] = [
    { id: 'assets', title: <><Icon name="cash" />가진 것<small className="account-name">(자산)</small></>, accounts: ['cash', 'inventory'], total: s.assets, left: true },
    { id: 'debt', title: <><Icon name="loan" />갚을 돈<small className="account-name">(부채)</small></>, accounts: ['loan'], total: s.liabilities, left: false },
    { id: 'equity', title: <><Icon name="capital" />내 몫<small className="account-name">(자본)</small></>, accounts: ['capital', 'sales', 'rent', 'cogs'], total: s.equity, left: false },
  ];
  const scale = Math.max(1000000, ...groups.flatMap(g => sides.map(side => lines.filter(l => g.accounts.includes(l.account) && l.side === side).reduce((n, l) => n + l.amount, 0))));
  return <section className="overview" aria-label="가게의 누적 기록"><div className="section-heading"><h2>가게에 남은 것</h2><span>기록이 차곡차곡</span></div><div className="category-grid">{groups.map(g => <div key={g.id} data-testid={`category-${g.id}`}><Board title={g.title} lines={lines.filter(l => g.accounts.includes(l.account))} total={g.total} left={g.left} scale={scale} /></div>)}</div><p className="equity-note">내 몫 = 넣은 돈 {man(s.capital)} + 번 만큼 {signedMan(s.netIncome)}</p><small className="bar-note">막대: 쌓인 기록 · 아래 숫자: 지금 남은 만큼</small></section>;
}
function Lesson({ tx, index, book, onPost, onNext, play }: { tx: Tx; index: number; book: Book; onPost: (b: Book) => void; onNext: () => void; play: Sound }) {
  const original = useRef(book).current;
  const [part, setPart] = useState(0), [done, setDone] = useState(false);
  const [selected, setSelected] = useState<AccountId | null>(null);
  const [slots, setSlots] = useState<Partial<Record<Side, AccountId>>>({});
  const [message, setMessage] = useState('');
  const [ghost, setGhost] = useState<{ a: AccountId; x: number; y: number; tilt: number } | null>(null);
  const [hot, setHot] = useState<{ account: AccountId; side: Side } | null>(null);
  const [burst, setBurst] = useState<{ account: AccountId; side: Side; key: number } | null>(null);
  const [party, setParty] = useState(0);
  const drag = useRef<{ id: number; a: AccountId; x: number; y: number; moved: boolean } | null>(null);
  const suppress = useRef(0), locked = useRef(false);
  const entries = journalFor(tx, original), entry = entries[part], last = part === entries.length - 1;
  const amount = entry.lines[0].amount, s = summary(book);
  // 놓는 즉시 막대가 움직이도록, 아직 장부에 넣지 않은 이번 거래의 줄(pending)을 보드에만 더해 보여 준다.
  const pending = done && last ? [] : [...entries.slice(0, part).flatMap(e => e.lines), ...entry.lines.filter(l => slots[l.side] === l.account)];
  const lines = [...book.entries.flatMap(e => e.lines), ...pending];
  const live = (a: AccountId) => lines.filter(l => l.account === a).reduce((n, l) => n + ((l.side === 'debit') === leftUp(a) ? l.amount : -l.amount), 0);
  const accounts = ACCOUNT_ORDER.filter(a => entries.some(e => e.lines.some(l => l.account === a)));
  const scale = Math.max(1000000, ...accounts.flatMap(a => sides.map(side => lines.filter(l => l.account === a && l.side === side).reduce((n, l) => n + l.amount, 0))));
  function select(a: AccountId) { if (done) return; setSelected(a); setMessage(''); play('tap'); }
  function place(a: AccountId | null, target: AccountId, side: Side) {
    if (locked.current || done) return;
    if (!a) { setMessage('먼저 가게 위의 물건을 골라요.'); return; }
    if (a !== target || !entry.lines.some(l => l.account === a && l.side === side)) { setMessage(`${labels[a]} · ${entry.lines.find(l => l.account === a)?.side === 'debit' ? '왼쪽' : '오른쪽'} 칸을 찾아요.`); play('retry'); return; }
    setSlots(old => ({ ...old, [side]: a })); setSelected(null); setMessage(''); play('correct');
    setBurst({ account: a, side, key: Date.now() }); fly(a, side);
  }
  function down(e: PE<HTMLButtonElement>, a: AccountId) {
    if (done || e.button !== 0 || !e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, a, x: e.clientX, y: e.clientY, moved: false };
    setSelected(a);
  }
  function move(e: PE<HTMLButtonElement>) {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
    if (d.moved) { setGhost({ a: d.a, x: e.clientX, y: e.clientY, tilt: Math.max(-12, Math.min(12, (e.clientX - d.x) / 12)) }); setHot(sideAt(e.clientX, e.clientY)); }
  }
  function end(e: PE<HTMLButtonElement>) {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      suppress.current = Date.now() + 450;
      const hit = sideAt(e.clientX, e.clientY);
      if (hit) place(d.a, hit.account, hit.side);
    }
    drag.current = null; setGhost(null); setHot(null); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function record() {
    if (locked.current) return;
    const result = checkRecord(tx, entry, { debit: { account: slots.debit, amount }, credit: { account: slots.credit, amount } });
    if (!result.ok) { setMessage('두 물건을 각각 알맞은 칸에 놓아요.'); play('retry'); return; }
    locked.current = true; if (last) onPost(post(original, tx)); setDone(true); setMessage(''); play('correct'); setParty(Date.now());
  }
  // 양쪽이 다 놓이면 버튼 없이 잠깐 뒤 자동 반영(판매는 두 기록이 끝났을 때 한 번만 장부에 들어간다).
  useEffect(() => {
    if (done || !slots.debit || !slots.credit) return;
    const id = setTimeout(record, 550);
    return () => clearTimeout(id);
  });
  useEffect(() => {
    if (!done || last) return;
    const id = setTimeout(() => { setPart(n => n + 1); setSlots({}); setSelected(null); setDone(false); locked.current = false; }, 1300);
    return () => clearTimeout(id);
  }, [done, last]);
  const description = tx.kind === 'purchase' ? `${tx.qty}개 × ${man(tx.unitCost)}` : tx.kind === 'sale' ? `${tx.qty}개 × ${man(tx.unitPrice)}` : `${tx.kind === 'contribution' ? '나 → 가게' : tx.kind === 'borrow' ? '은행 → 가게' : '가게 → 집주인'} · ${man(tx.amount)}`;
  return <div className="lesson-layout" onKeyDown={e => { if (e.key === 'Escape') { drag.current = null; setGhost(null); setSelected(null); setMessage(''); } }}><section className="workbench"><div className="story-heading"><p className="eyebrow">가게의 첫 주 · {index + 1} / 5</p><h1>{titles[tx.kind]}</h1><p className="story-detail">{description}</p></div>
    <Shop stock={book.stock} cash={s.b.cash} success={done && last}>{entry.lines.map(l => <button key={`${part}-${l.account}`} className={`object-card ${selected === l.account ? 'selected' : ''} ${slots[l.side] === l.account ? 'packed' : ''}`} data-testid={`account-${l.account}`} aria-pressed={selected === l.account} disabled={done} onPointerDown={e => down(e, l.account)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setGhost(null); setHot(null); }} onLostPointerCapture={() => { drag.current = null; setGhost(null); setHot(null); }} onClick={e => { if (e.detail && Date.now() < suppress.current) return; select(l.account); }}><ObjectArt account={l.account} /><span>{labels[l.account]}</span><strong>{man(l.amount)}</strong>{slots[l.side] === l.account && <em>✓ 준비</em>}</button>)}</Shop>
    <div className="instruction" aria-live="polite"><span className="instruction-icon">{done ? '✓' : '↘'}</span><div><h2>{done ? last ? '가게의 변화가 쌓였어요' : '받은 돈 준비 완료' : selected ? `${josa(labels[selected], '을/를')} 빛나는 칸에 놓아요` : '물건을 골라 같은 그림 칸에 놓아요'}</h2><p>{done ? last ? lessons[tx.kind] : '팔린 커피도 옮기면 두 기록이 함께 쌓여요.' : tx.kind === 'sale' ? `${part + 1}/2 · ${part === 0 ? '손님에게 받은 돈' : '선반을 떠난 커피값'}` : '끌어 놓기 · 또는 물건을 누르고 칸 누르기'}</p></div></div>
    <section className="account-grid" aria-label="이번 이야기의 그림별 기록">{accounts.map(a => <Board key={a} title={<><Icon name={art[a]} />{labels[a]}<small className="account-name">({ACCOUNTS[a].name})</small></>} account={a} lines={lines.filter(l => l.account === a)} total={live(a)} scale={scale} left={leftUp(a)} selected={selected} slots={slots} expected={entry.lines} active={!done && entry.lines.some(l => l.account === a)} amount={amount} hot={hot?.account === a ? hot.side : null} burst={burst?.account === a ? burst : null} onPlace={(a, side) => place(selected, a, side)} />)}</section>
    <div className="commit-area"><p className="feedback" role="status">{message || (done ? last ? `💵 ${signedMan(s.b.cash - summary(original).b.cash)} · 👤 ${signedMan(s.equity - summary(original).equity)}` : '좋아요! 이제 팔린 커피를 옮겨요.' : slots.debit || slots.credit ? '하나 더! 놓는 순간 바로 쌓여요.' : '물건을 놓는 순간 막대가 움직여요.')}</p>{done && last && <button className="primary" data-testid="next" onClick={() => { play('tap'); onNext(); }}>{index === 4 ? '이번 주 돌아보기 →' : '다음 이야기 →'}</button>}</div>
    <details className="help"><summary>처음이라면?</summary><p>물건을 누른 뒤 빛나는 칸을 눌러요. 키보드는 Tab으로 이동하고 Enter 또는 Space로 선택해요. Esc는 선택을 풀어요.</p><p>커피 원가와 자리값이 쌓이면 내 몫은 줄어요. 넣은 돈 기록은 그대로예요.</p></details>
  </section><aside><Categories book={book} /><div className="little-note"><span>🌿</span><p>돈은 어디서 왔을까요?<br />무엇으로 바뀌었을까요?</p></div></aside>{party > 0 && <div className="confetti" key={party} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}<b className="stamp">{last ? '✓ 기록 완료!' : '✓ 절반 완료!'}</b></div>}{ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y, transform: `translate(-50%, -65%) rotate(${ghost.tilt}deg)` }} aria-hidden="true"><ObjectArt account={ghost.a} /><b>{labels[ghost.a]}</b><span>{man(amount)}</span></div>}<button className="sr-only" onClick={() => setSelected(null)}>선택 해제</button></div>;
}
function Records({ book, onBack }: { book: Book; onBack: () => void }) {
  const s = summary(book);
  return <section className="paper records"><button onClick={onBack}>← 돌아가기</button><h1>자세한 기록</h1><p>자산 {man(s.assets)} · 부채 {man(s.liabilities)} · 자본 {man(s.equity)}</p><p>자본금 {man(s.capital)} + 순이익 {signedMan(s.netIncome)}</p><h2>거래별 분개</h2><table className="journal" data-testid="journal"><thead><tr><th>거래</th><th>차변 (왼쪽)</th><th>금액</th><th>대변 (오른쪽)</th><th>금액</th></tr></thead><tbody>{book.entries.map(e => { const d = e.lines.find(l => l.side === 'debit')!, c = e.lines.find(l => l.side === 'credit')!; return <tr key={`${e.txId}-${e.part}`}><td>{e.title}</td><td>{ACCOUNTS[d.account].name}</td><td>{man(d.amount)}</td><td>{ACCOUNTS[c.account].name}</td><td>{man(c.amount)}</td></tr>; })}</tbody></table><h2>계정별 잔액</h2>{ACCOUNT_ORDER.map(a => <p key={a}>{ACCOUNTS[a].name} · {man(s.b[a])}</p>)}</section>;
}
// 출처: 화면에 쓰인 생성물·도구를 빠짐없이 밝힌다(생성 스크립트 .runtime/baze 기준).
const CREDITS: { group: string; items: [string, string][] }[] = [
  { group: '이미지 (AI 생성)', items: [
    ['표지 알바 · 마지막 장면 사장님 · 계산대 · 물건 그림(돈, 커피, 은행, 저금통, 돈다발, 돗자리)', 'OpenAI gpt-image-2.6-sunburst · BAZE 게이트웨이'],
    ['결산 화면 병커피 사진', 'ByteDance Seedream 5 Pro (seedream-5-pro) · BAZE 게이트웨이'],
  ] },
  { group: '소리 (AI 생성)', items: [
    ['효과음(누르기 · 정답 · 다시)', 'ElevenLabs SFX (elevenlabs-sfx) · BAZE 게이트웨이'],
    ['배경음악', 'Google Lyria 3 (lyria-3-clip-preview) · BAZE 게이트웨이'],
  ] },
  { group: '학습 내용', items: [['편의점 첫 주 시나리오 · 회계 처리', 'AID 해커톤 「회계 플레이」 기획안 v0.2']] },
  { group: '개발', items: [
    ['화면 · 빌드', 'React, Vite (MIT 라이선스)'],
    ['코드 작성 지원', 'Claude Code (Anthropic), GPT Astra · BAZE 게이트웨이'],
  ] },
];
function Credits() {
  const [open, setOpen] = useState(false);
  return <>
    <button className="credits-btn" data-testid="credits" aria-expanded={open} aria-controls="credits-panel" onClick={() => setOpen(o => !o)}>{open ? '✕ 닫기' : 'ⓘ 출처'}</button>
    {open && <section id="credits-panel" className="credits-panel" role="dialog" aria-label="출처" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <h2>출처</h2>
      {CREDITS.map(c => <div key={c.group}><h3>{c.group}</h3><ul>{c.items.map(([what, from]) => <li key={what}><b>{what}</b><span>{from}</span></li>)}</ul></div>)}
      <p className="credits-note">AI로 생성한 이미지 · 소리는 학습용 시연 목적으로 사용했어요.</p>
    </section>}
  </>;
}
// 마지막 장면: 사장님이 장부로 알게 된 점을 하단 대사창으로 말한다(숫자는 모두 장부에서 계산).
function OwnerTalk({ book, onDone }: { book: Book; onDone: () => void }) {
  const s = summary(book), ni = s.netIncome;
  const bought = book.entries.flatMap(e => e.lines).filter(l => l.account === 'inventory' && l.side === 'debit').reduce((n, l) => n + l.amount, 0);
  const lines = [
    ni < 0 ? `알바 말이 맞았네… 이번 주는 ${man(-ni)} 적자야.` : `알바가 적자라길래 깜짝 놀랐는데… 장부를 적어 보니 ${man(ni)} 남았네!`,
    `가게 통장엔 ${man(s.b.cash)}이 있어. 하마터면 이걸 다 번 돈으로 착각할 뻔했지.`,
    `그 안엔 내가 넣은 ${man(s.capital)}이랑 은행에서 빌린 ${man(s.liabilities)}이 섞여 있었거든. 빌린 돈은 언젠가 갚아야 하고.`,
    `커피 사는 데 쓴 ${man(bought)}도 사라진 게 아니야. 아직 안 팔린 ${book.stock}개, ${man(s.b.inventory)}어치가 선반에 남아 있어.`,
    `커피 팔고 얻은 수익 ${man(s.revenue)}에서 커피 원가 ${man(s.b.cogs)}, 자리값 ${man(s.b.rent)}을 빼니 진짜 남은 건 ${man(ni)}.`,
    '거래를 하나씩 적어 두니 돈이 어디서 와서 무엇으로 바뀌었는지 한눈에 보여. 다음 주엔 원가랑 자리값부터 다시 따져 봐야겠어!',
  ];
  const [i, setI] = useState(0), [shown, setShown] = useState(0);
  const text = lines[i], typing = shown < text.length;
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(text.length); return; }
    setShown(0);
    const id = setInterval(() => setShown(n => { if (n >= text.length) { clearInterval(id); return n; } return n + 1; }), 32);
    return () => clearInterval(id);
  }, [text]);
  const advance = () => { if (typing) setShown(text.length); else if (i < lines.length - 1) setI(i + 1); else onDone(); };
  const last = i === lines.length - 1 && !typing;
  return <div className="owner-scene" data-testid="owner-scene">
    <img src="/media/owner.png" alt="장부를 든 사장님" />
    <button className="dialogue" data-testid="owner-next" onClick={advance} aria-label={`사장님: ${text}. ${last ? '대화 마치기' : '다음 대사'}`}>
      <span className="speaker">사장님</span>
      <span className="line" aria-hidden="true">{text.slice(0, shown)}</span>
      <span className="dialogue-hint" aria-hidden="true">{typing ? '' : last ? '대화 마치기 ✓' : `▼ ${i + 1}/${lines.length}`}</span>
    </button>
  </div>;
}
export default function App() {
  const [config, setConfig] = useState(setup), [page, setPage] = useState<'home' | 'lesson' | 'final' | 'records'>('home');
  const [book, setBook] = useState<Book>(emptyBook), [index, setIndex] = useState(0), [run, setRun] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [talked, setTalked] = useState(false);
  const sound = useSound(), s = summary(book);
  const [doors, setDoors] = useState(0); // '내 가게 열기' → 편의점 문이 양쪽으로 열리는 연출
  useEffect(() => { if (!doors) return; const id = setTimeout(() => setDoors(0), 1500); return () => clearTimeout(id); }, [doors]);
  function go(p: typeof page) { sound.play('tap'); setPage(p); window.scrollTo(0, 0); }
  function reset() { setBook(emptyBook); setIndex(0); setRun(n => n + 1); setAnswer(null); setTalked(false); go('home'); }
  return <div className="app"><header><a href="#" onClick={e => { e.preventDefault(); reset(); }}>사장님, 적자 나셨어요<span>작은 가게, 돈의 이야기</span></a><details className="sound"><summary>♫ 소리 설정</summary><div><button data-testid="sound-mute" aria-pressed={sound.muted} onClick={sound.toggle}>{sound.muted ? '소리 켜기' : '소리 끄기'}</button><label>음악 {sound.music}%<input data-testid="music-volume" aria-label="음악 음량" type="range" min="0" max="100" value={sound.music} onChange={e => sound.setMusic(Number(e.target.value))} /></label><label>효과음 {sound.effects}%<input data-testid="effects-volume" aria-label="효과음 음량" type="range" min="0" max="100" value={sound.effects} onChange={e => sound.setEffects(Number(e.target.value))} /></label></div></details></header><main>
    {config.error ? <section className="paper"><h1>가게 설정을 확인해 주세요</h1><p role="alert">{config.error}</p><button onClick={() => { const url = new URL(location.href); url.search = ''; history.replaceState(null, '', url); setConfig(setup()); reset(); }}>기본 설정으로 시작</button></section> : <>
      {page === 'home' && <section className="hero" data-testid="cover"><img className="hero-img" src="/media/clerk.png" alt="팔짱을 끼고 사장님을 바라보는 편의점 알바" /><div className="hero-title"><p className="eyebrow">어서 오세요, 오늘부터 사장님</p><h1>사장님,<br />적자 나셨어요</h1><p>작은 편의점에서 만나는 다섯 번의 변화.</p></div><div className="hero-cta"><button className="primary" data-testid="start" onClick={() => { setDoors(Date.now()); go('lesson'); }}>내 가게 열기 →</button><small>어려운 말 대신, 그림으로 하나씩.</small></div></section>}
      {page === 'lesson' && <Lesson key={`${run}-${index}`} tx={config.txs[index]} index={index} book={book} onPost={setBook} play={sound.play} onNext={() => { if (index === config.txs.length - 1) go('final'); else { setIndex(n => n + 1); window.scrollTo(0, 0); } }} />}
      {page === 'final' && <section className="paper finale"><p className="eyebrow">첫 주의 문을 닫으며</p><h1>이번 주, 얼마가 남았을까요?</h1><div className="formula"><p><Icon name="sales" />커피 팔고 얻은 수익(상품매출) − <Icon name="cash" />커피 원가 − <Icon name="rent" />자리값</p><p className="formula-nums" data-testid="formula-nums">{man(s.revenue)} − {man(s.b.cogs)} − {man(s.b.rent)} = {answer === null ? '?' : man(s.netIncome)}</p></div>{answer === null ? <div className="choices">{/* 정답(순이익)을 항상 첫 칸에 두지 않도록 현금을 먼저 보여 준다 */}{[s.b.cash, s.netIncome].map((n, i) => <button data-testid={`profit-option-${i}`} key={i} onClick={() => { setAnswer(i === 1 ? 0 : 1); sound.play(i === 1 ? 'correct' : 'retry'); }}>{man(n)}</button>)}</div> : <><p role="status">{answer === 0 ? '맞아요! 가게 돈과 번 돈은 달라요.' : '가게 돈에는 넣은 돈과 빌린 돈도 섞여 있어요.'}</p><div className="results"><div>💵 지금 가게 돈<strong data-testid="final-cash">{man(s.b.cash)}</strong></div><div>🌿 이번 주 남은 돈<strong data-testid="final-profit">{man(s.netIncome)}</strong></div></div><OwnerTalk book={book} onDone={() => setTalked(true)} />{talked && <><section className="lessons-learned" data-testid="lessons"><h2>장부를 쓰면 좋은 점</h2><ol><li><b>통장 잔액 ≠ 번 돈</b><span>가게 돈 {man(s.b.cash)} 중 이번 주에 번 돈은 {man(s.netIncome)}이에요.</span></li><li><b>돈의 출처가 보여요</b><span>내가 넣은 돈 {man(s.capital)} · 빌린 돈 {man(s.liabilities)}을 따로 알 수 있어요.</span></li><li><b>다음 판단을 할 수 있어요</b><span>남은 커피 {book.stock}개({man(book.stockValue)})와 원가·자리값을 보고 계획을 세워요.</span></li></ol><p className="stock-line" data-testid="final-stock">남은 {book.stock}개 · {man(book.stockValue)}</p></section><Categories book={book} /><button className="primary" data-testid="records" onClick={() => go('records')}>자세한 기록 보기</button><button data-testid="restart" onClick={reset}>다시 가게 열기</button></>}</>}</section>}
      {page === 'records' && <Records book={book} onBack={() => go('final')} />}
    </>}
  </main>{doors > 0 && <div className="doors" key={doors} aria-hidden="true"><div className="door left"><i /></div><div className="door right"><i /></div><span className="door-sign">OPEN · 어서 오세요</span></div>}<Credits /><footer>사장님, 적자 나셨어요 · 작은 기록으로 이해하는 돈의 흐름</footer></div>;
}
