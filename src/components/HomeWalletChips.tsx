import { useEffect, useRef, useState } from "react";

import { shouldReduceMenuMotion } from "../lib/menuSettings";
import { NCOIN_ICON } from "../lib/ncoinIcon";
import { getWalletSnapshot, serverWalletActiveNow, subscribeWalletView } from "../lib/serverWallet";
import "./HomeWalletChips.css";

const PAW_ICON = "/assets/menu/icon-paw-coin.svg";

type HomeWalletChipsProps = {
  pawBalance: number;
  nyangCoinBalance: number;
  /** Tutorial (or a replay) is on screen. Chips stay visible but do not open anything. */
  locked?: boolean;
};

function formatCount(value: number | null): string {
  if (value == null) return "–";
  return value.toLocaleString("ko-KR");
}

function usePop(value: number | null, reduce: boolean) {
  const prev = useRef<number | null>(null);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (value == null) return;
    const before = prev.current;
    prev.current = value;
    if (before == null || before === value || reduce) return;
    setPop(true);
    const timer = window.setTimeout(() => setPop(false), 300);
    return () => window.clearTimeout(timer);
  }, [value, reduce]);
  return pop;
}

export function HomeWalletChips({
  pawBalance,
  nyangCoinBalance,
  locked = false,
}: HomeWalletChipsProps) {
  const [reduce, setReduce] = useState(() => shouldReduceMenuMotion());
  const [serverNyang, setServerNyang] = useState<number | null>(() =>
    serverWalletActiveNow() ? (getWalletSnapshot()?.balance ?? null) : null,
  );
  const serverOn = serverWalletActiveNow();

  useEffect(() => {
    const sync = () => setReduce(shouldReduceMenuMotion());
    sync();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!serverWalletActiveNow()) {
      setServerNyang(null);
      return;
    }
    setServerNyang(getWalletSnapshot()?.balance ?? null);
    return subscribeWalletView((view) => setServerNyang(view.balance));
  }, [serverOn]);

  const nyang = serverOn ? serverNyang : nyangCoinBalance;
  const paw: number | null = pawBalance;
  const nyangPop = usePop(nyang, reduce);
  const pawPop = usePop(paw, reduce);

  const openRewards = () => {
    if (locked) return;
    window.dispatchEvent(new CustomEvent("lucky-open-rewards"));
  };
  const openPoints = () => {
    if (locked) return;
    window.dispatchEvent(new CustomEvent("lucky-open-menu-points"));
  };

  return (
    <div className="home-wallet-row">
      <button
        type="button"
        id="home-chip-nyang"
        className="home-wallet-chip"
        aria-label={`냥코인 ${formatCount(nyang)}개, 보상함 열기`}
        aria-disabled={locked}
        disabled={locked}
        onClick={openRewards}
      >
        <img src={NCOIN_ICON.md} alt="" width={20} height={20} />
        <b className={nyangPop ? "is-pop" : ""}>{formatCount(nyang)}</b>
      </button>
      <button
        type="button"
        id="home-chip-paw"
        className="home-wallet-chip"
        aria-label={`발바닥 젤리 ${formatCount(paw)}개, 보상 받기로 이동`}
        aria-disabled={locked}
        disabled={locked}
        onClick={openPoints}
      >
        <img src={PAW_ICON} alt="" width={20} height={20} />
        <b className={pawPop ? "is-pop" : ""}>{formatCount(paw)}</b>
      </button>
    </div>
  );
}
