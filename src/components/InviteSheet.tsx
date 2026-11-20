import { useState } from "react";
import { menuAsset } from "../lib/menuConfig";
import {
  copyInviteCode,
  inviteDaysLeft,
  inviteErrorText,
  normalizeInviteCode,
  sendInvite,
  submitInviteCode,
} from "../lib/invite";
import type { InviteStatus } from "../lib/serverWallet";
import { nyNotify } from "../lib/nyangNotify";
import "./InviteSheet.css";

type Props = {
  status: InviteStatus;
  lifetimeDraws: number;
};

export function InviteSheet({ status, lifetimeDraws }: Props) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideEntry, setHideEntry] = useState(false);
  const [registered, setRegistered] = useState(false);
  const code = normalizeInviteCode(raw);
  const jelly = status.rules.jelly;
  const monthLimit = status.rules.monthLimit;
  const monthFull = status.monthCount >= monthLimit;
  const showEntry = status.canEnterCode && !hideEntry;
  const days = inviteDaysLeft(status.enterUntil);
  const progress = monthLimit > 0 ? Math.min(1, status.monthCount / monthLimit) : 0;

  const submit = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitInviteCode(code, lifetimeDraws);
      if (!result.ok) {
        setError(result.error);
        if (result.error === "not_new") setHideEntry(true);
        return;
      }
      setRegistered(true);
      setRaw("");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (sharing || monthFull || !status.code) return;
    setSharing(true);
    try {
      const outcome = await sendInvite(status.code, jelly);
      if (outcome === "copied") {
        nyNotify({ key: "invite-share", kind: "info", title: "초대 문구를 복사했어요" });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="invite-sheet">
      {registered ? (
          <div className="invite-entry is-ok">
            <span className="invite-check" aria-hidden="true">
              ✓
            </span>
            <h4>초대 코드를 등록했어요!</h4>
            <p>첫 카드를 뽑으면 나도 친구도 이 선물을 받아요</p>
            <div className="invite-pills">
              <span>
                <img src={menuAsset("icon-paw-mini-dark.svg")} alt="" />
                젤리 {jelly}
              </span>
              <span>
                <img src={menuAsset("icon-ticket.svg")} alt="" />
                확률업 뽑기권 1장
              </span>
            </div>
          </div>
      ) : showEntry ? (
          <div className={`invite-entry ${error ? "is-bad" : ""}`}>
            <div className="invite-entry-head">
              <h4>초대 코드가 있나요?</h4>
              <span className="invite-days">{days}일 남음</span>
            </div>
            <p>
              친구에게 받은 코드를 넣고 첫 카드를 뽑으면 나도 친구도 선물을 받아요.
              {"\n"}
              처음 시작하고 3일 동안만 넣을 수 있어요.
            </p>
            <div className="invite-code-row">
              <input
                id="invite-code"
                value={code}
                placeholder="6자리 코드"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={6}
                aria-invalid={error ? true : undefined}
                onChange={(event) => {
                  setRaw(event.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                id="invite-code-submit"
                disabled={code.length !== 6 || busy}
                onClick={() => void submit()}
              >
                {busy ? "확인 중…" : "입력"}
              </button>
            </div>
            {error ? <p className="invite-error">{inviteErrorText(error)}</p> : null}
          </div>
      ) : (
        <img className="invite-duo" src="/assets/invite/invite-duo.webp" alt="" />
      )}

      <div className="invite-mycode">
        <span>내 초대 코드</span>
        <b>{status.code}</b>
        <button
          type="button"
          onClick={() => {
            if (!status.code) return;
            void copyInviteCode(status.code).then(() => {
              nyNotify({ key: "invite-copy", kind: "info", title: "초대 코드를 복사했어요" });
            });
          }}
        >
          코드 복사
        </button>
      </div>

      <div className="invite-gifts">
        <GiftCard title="나" jelly={jelly} />
        <GiftCard title="초대받은 친구" jelly={jelly} />
      </div>

      <ol className="invite-steps">
        <li>
          <i>1</i>
          초대장 보내기
        </li>
        <li>
          <i>2</i>
          친구가 행운냥 처음 시작
        </li>
        <li>
          <i>3</i>
          친구가 첫 카드 뽑으면 둘 다 선물
        </li>
      </ol>

      <div className="invite-progress-head">
        <span>이번 달 초대한 친구</span>
        <b>
          {status.monthCount} / {monthLimit}명
        </b>
      </div>
      <div className="invite-bar" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <ul className="invite-friends">
        {status.friends.map((friend) => (
          <li key={friend.n}>
            <span>친구 {friend.n}</span>
            <b className={friend.status === "rewarded" ? "is-done" : ""}>
              {friend.status === "rewarded" ? "선물 받았어요" : "첫 카드를 기다리는 중"}
            </b>
          </li>
        ))}
      </ul>
      <p className="invite-note">
        행운냥을 처음 시작하는 친구만 받을 수 있어요 · 한 달에 {monthLimit}명까지 · 부정하게 참여하면
        받을 수 없어요 · 이 이벤트는 사전 고지 없이 중단될 수 있어요
      </p>
      <button
        type="button"
        id="invite-send"
        className="menu-sheet-cta invite-send"
        disabled={monthFull || sharing || !status.code}
        onClick={() => void share()}
      >
        {monthFull ? "이번 달 초대 선물은 다 받았어요" : "친구에게 초대장 보내기"}
      </button>
    </div>
  );
}

function GiftCard({ title, jelly }: { title: string; jelly: number }) {
  return (
    <div className="invite-gift">
      <span>{title}</span>
      <p>
        <img src={menuAsset("icon-paw-mini.svg")} alt="" />
        젤리 <b>{jelly}</b>
      </p>
      <p>
        <img src={menuAsset("icon-ticket.svg")} alt="" />
        확률업 뽑기권 <b>1</b>장
      </p>
    </div>
  );
}
