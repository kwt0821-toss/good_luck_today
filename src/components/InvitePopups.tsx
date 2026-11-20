import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "../hooks/useBackHandler";
import { menuAsset } from "../lib/menuConfig";
import type { InviterGiftView } from "../lib/invite";
import "./InvitePopups.css";

type WelcomeProps = {
  jelly: number;
  onDraw: () => void;
  onClose: () => void;
};

export function InviteWelcome({ jelly, onDraw, onClose }: WelcomeProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useBackHandler(true, onClose, 70);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  return createPortal(
    <div className="invite-pop is-welcome">
      <button type="button" className="invite-pop-dim" aria-label="닫기" onClick={onClose} />
      <div className="invite-pop-card" role="dialog" aria-modal="true" aria-labelledby="invite-welcome-title">
        <button type="button" className="invite-pop-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
        <img src="/assets/invite/welcome-cat.webp" alt="" />
        <p className="invite-pop-eye">초대 선물</p>
        <h2 id="invite-welcome-title">친구가 행운냥에 초대했어요!</h2>
        <p>
          첫 카드를 뽑으면 초대 선물을 바로 받아요.
          {"\n"}
          초대해 준 친구에게도 같은 선물이 가요.
        </p>
        <div className="invite-pop-pills">
          <span>
            <img src={menuAsset("icon-paw-mini-dark.svg")} alt="" />
            젤리 {jelly}
          </span>
          <span>
            <img src={menuAsset("icon-ticket.svg")} alt="" />
            확률업 뽑기권 1장
          </span>
        </div>
        <button ref={buttonRef} type="button" className="invite-pop-go" onClick={onDraw}>
          첫 카드 뽑으러 가기
        </button>
        <small>행운냥을 처음 시작할 때 한 번만 받을 수 있어요</small>
      </div>
    </div>,
    document.body,
  );
}

type GiftProps = {
  gift: InviterGiftView;
  onClose: () => void;
};

export function InviterGiftPopup({ gift, onClose }: GiftProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useBackHandler(true, onClose, 70);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  return createPortal(
    <div className="invite-pop is-gift">
      <button type="button" className="invite-pop-dim" aria-label="닫기" onClick={onClose} />
      <div className="invite-pop-card" role="dialog" aria-modal="true" aria-labelledby="invite-gift-title">
        <button type="button" className="invite-pop-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
        <img src="/assets/invite/inviter-gift-cat.webp" alt="" />
        <p className="invite-pop-pill-green">친구 {gift.friends}명이 첫 카드를 뽑았어요</p>
        <h2 id="invite-gift-title">초대 선물이 도착했어요!</h2>
        <p>
          불러 줘서 고마워요!
          {"\n"}
          친구도 같은 선물을 받았어요.
        </p>
        <div className="invite-pop-pills">
          <span>
            <img src={menuAsset("icon-paw-mini-dark.svg")} alt="" />
            젤리 {gift.jelly}
          </span>
          {gift.tickets > 0 ? (
            <span>
              <img src={menuAsset("icon-ticket.svg")} alt="" />
              확률업 뽑기권 {gift.tickets}장
            </span>
          ) : null}
        </div>
        <small>
          이번 달 초대한 친구 {gift.monthCount} / {gift.monthLimit}명
        </small>
        <button ref={buttonRef} type="button" className="invite-pop-go" onClick={onClose}>
          선물 받기
        </button>
      </div>
    </div>,
    document.body,
  );
}
