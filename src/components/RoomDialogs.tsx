import { roomAsset } from "../lib/roomCatalog";
import type { DexCard } from "../lib/dexTypes";
import { EXCHANGE_RATES } from "../lib/roomStore";
import type { RoomItem } from "../lib/roomTypes";

type ConfirmProps = {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RoomConfirm({ title, body, cancel, confirm, danger, onCancel, onConfirm }: ConfirmProps) {
  return (
    <div className="lucky-modal">
      <button type="button" className="lucky-modal-back" aria-label="닫기" onClick={onCancel} />
      <div className="lucky-modal-card" role="dialog" aria-label={title}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="lucky-modal-actions">
          <button type="button" onClick={onCancel}>
            {cancel}
          </button>
          <button type="button" className={danger ? "is-danger" : "is-amber"} onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomBuySheet({
  item,
  points,
  onClose,
  onBuy,
}: {
  item: RoomItem;
  points: number;
  onClose: () => void;
  onBuy: () => void;
}) {
  const enough = points >= item.price;
  return (
    <div className="lucky-modal">
      <button type="button" className="lucky-modal-back" aria-label="닫기" onClick={onClose} />
      <div className="lucky-modal-card" role="dialog" aria-label={`${item.nameKo} 구매`}>
        <div className="lucky-buy-preview">
          {item.tileImage ? <img src={roomAsset(item.tileImage)} alt="" /> : null}
        </div>
        <h3>{item.nameKo}</h3>
        <p className="lucky-buy-price">
          <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
          {item.price.toLocaleString("en-US")}
        </p>
        {enough ? (
          <>
            <p>발바닥 포인트로 이 아이템을 살까요?</p>
            <div className="lucky-modal-actions">
              <button type="button" onClick={onClose}>
                닫기
              </button>
              <button type="button" className="is-amber" onClick={onBuy}>
                구매
              </button>
            </div>
          </>
        ) : (
          <>
            <p>발바닥 포인트가 모자라요. 중복 카드를 바꿔 모아 보세요.</p>
            <div className="lucky-modal-actions">
              <button type="button" className="is-amber" onClick={onClose}>
                확인
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function rateFor(card: DexCard) {
  if (card.type === "legend") return EXCHANGE_RATES.legend;
  if (card.type === "special" || card.type === "character") return EXCHANGE_RATES.special;
  if ((card.stars ?? 0) >= 4) return EXCHANGE_RATES.rare;
  return EXCHANGE_RATES.common;
}

export function RoomExchangeSheet({
  cards,
  onClose,
  onConfirm,
}: {
  cards: { card: DexCard; extra: number; pick: number }[];
  onClose: () => void;
  onConfirm: (picks: Record<string, number>) => void;
}) {
  const total = cards.reduce((sum, row) => sum + row.pick * rateFor(row.card), 0);
  return (
    <div className="lucky-modal">
      <button type="button" className="lucky-modal-back" aria-label="닫기" onClick={onClose} />
      <div className="lucky-modal-card is-sheet" role="dialog" aria-label="중복 카드 바꾸기">
        <h3>중복 카드 바꾸기</h3>
        <p>도감에 한 장은 남기고, 나머지를 발바닥 포인트로 바꿔요.</p>
        <ul className="lucky-exchange-list">
          {cards.length === 0 ? <li>바꿀 중복 카드가 아직 없어요.</li> : null}
          {cards.map((row) => (
            <li key={row.card.id}>
              <img src={`/assets/dex/${row.card.thumb}`} alt="" />
              <span>
                {row.card.breed?.en ?? row.card.name?.ko}
                <small>×{row.extra} 가능</small>
              </span>
              <em>+{rateFor(row.card)}</em>
            </li>
          ))}
        </ul>
        <p className="lucky-exchange-total">받을 포인트 {total.toLocaleString("en-US")}</p>
        <div className="lucky-modal-actions">
          <button type="button" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="is-amber"
            disabled={total <= 0}
            onClick={() => {
              const picks: Record<string, number> = {};
              for (const row of cards) picks[row.card.id] = row.pick;
              onConfirm(picks);
            }}
          >
            발바닥 {total.toLocaleString("en-US")}개로 바꾸기
          </button>
        </div>
      </div>
    </div>
  );
}
