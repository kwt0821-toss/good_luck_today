import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useBackHandler } from "../hooks/useBackHandler";
import { contentId, fillCatLetter, loadCatLetters, markCatLetterRead, type CatLetterFile } from "../lib/catLetters";
import { letterHasGift } from "../lib/mailboxParse";
import {
  claimMailboxEvery,
  claimMailboxOne,
  readMailboxSnap,
  refreshMailbox,
  remainLabel,
  subscribeMailbox,
  type MailboxSnap,
} from "../lib/mailbox";
import { menuAsset } from "../lib/menuConfig";
import { ncoinIcon } from "../lib/ncoinIcon";
import { nyNotify } from "../lib/nyangNotify";
import type { CatLetterEntry, OpsEconomy, OpsState } from "../lib/opsTypes";
import { roomAsset } from "../lib/roomCatalog";
import { loadRoomCats } from "../lib/roomCats";
import { seasonEvent } from "../lib/season";
import type { MailboxLetter, MailboxSource } from "../lib/serverWallet";
import { trustedKstDateKey } from "../lib/tossClock";
import { CatLetterPaper } from "./CatLetterSheet";
import "./MailboxSheet.css";

type Props = {
  ops: OpsState;
  economy: OpsEconomy;
  onOpsChange: (next: OpsState) => void;
  onOpenRoom?: () => void;
};

type CatRow = { entry: CatLetterEntry; title: string; at: number };

function senderName(source: MailboxSource): string {
  if (source === "operator") return "운영자";
  if (source === "invite") return "친구 초대";
  return "주간 미션";
}

function senderIcon(source: MailboxSource): string {
  if (source === "operator") return "/assets/mailbox/icon-operator.svg";
  if (source === "invite") return menuAsset("icon-invite.svg");
  return menuAsset("icon-weekly.svg");
}

function letterBody(letter: MailboxLetter): string {
  const body = letter.body.trim();
  if (body) return body;
  if (letter.source === "invite") return "친구가 첫 카드를 뽑아서 선물이 도착했어요.";
  if (letter.source === "weekly") return "주간 미션 선물이 도착했어요.";
  return "";
}

function hasGift(letter: MailboxLetter): boolean {
  return letterHasGift(letter);
}

function whenLabel(letter: MailboxLetter): string {
  if (letter.status === "claimed") return "받음";
  if (letter.status === "expired") return "기한 지남";
  return remainLabel(letter.remainDays);
}

function stampOf(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

function giftBits(letter: MailboxLetter, long: boolean): string[] {
  const bits: string[] = [];
  if (letter.jelly > 0) bits.push(long ? `발바닥 젤리 ${letter.jelly}` : `젤리 ${letter.jelly}`);
  if (letter.nyang > 0) bits.push(`냥코인 ${letter.nyang}`);
  if (letter.tickets > 0) bits.push(`뽑기권 ${letter.tickets}장`);
  return bits;
}

function GiftIcons({ letter }: { letter: MailboxLetter }) {
  return (
    <span className="mb-gifts">
      {letter.jelly > 0 ? (
        <span>
          <img src={menuAsset("icon-paw-mini.svg")} alt="" />
          젤리 {letter.jelly}
        </span>
      ) : null}
      {letter.nyang > 0 ? (
        <span>
          <img src={ncoinIcon(14)} alt="" width={14} height={14} />
          냥코인 {letter.nyang}
        </span>
      ) : null}
      {letter.tickets > 0 ? (
        <span>
          <img src={menuAsset("icon-ticket.svg")} alt="" />
          뽑기권 {letter.tickets}장
        </span>
      ) : null}
    </span>
  );
}

export function MailboxSheet({ ops, economy, onOpsChange, onOpenRoom }: Props) {
  const [snap, setSnap] = useState<MailboxSnap>(readMailboxSnap);
  const [letters, setLetters] = useState<CatLetterFile | null>(null);
  const [catIcon, setCatIcon] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [catEntry, setCatEntry] = useState<CatLetterEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const today = snap.today || trustedKstDateKey();
  const seasonName = seasonEvent(economy)?.nameKo ?? "";

  useEffect(() => subscribeMailbox(setSnap), []);
  useEffect(() => {
    void refreshMailbox();
    void loadCatLetters().then(setLetters);
  }, []);
  useEffect(() => {
    const catId = ops.affection.catId;
    if (!catId) {
      setCatIcon("");
      return;
    }
    let alive = true;
    void loadRoomCats().then((cats) => {
      if (!alive) return;
      const cat = cats.find((item) => item.id === catId);
      setCatIcon(cat?.icon ? roomAsset(cat.icon) : "");
    });
    return () => {
      alive = false;
    };
  }, [ops.affection.catId]);

  useBackHandler(openId != null, () => setOpenId(null), 80);
  useBackHandler(catEntry != null, () => setCatEntry(null), 85);

  const catRows: CatRow[] = (ops.catLetters?.inbox ?? []).map((entry) => {
    const source = letters?.letters.find((item) => item.id === contentId(entry.id));
    const copy = source ? fillCatLetter(source, letters?.nameFallback || "집사", seasonName) : null;
    return {
      entry,
      title: copy?.title || "편지",
      at: stampOf(`${entry.receivedOn}T03:00:00Z`),
    };
  });
  const rows = [
    ...snap.items.map((letter) => ({ kind: "mail" as const, at: stampOf(letter.createdAt), letter })),
    ...catRows.map((row) => ({ kind: "cat" as const, at: row.at, row })),
  ].sort((a, b) => b.at - a.at);
  const giftable = snap.items.some(hasGift);
  const openLetter = snap.items.find((item) => item.id === openId) ?? null;

  const tell = (message: string) => {
    if (!message) return;
    nyNotify({ key: "mailbox-claim", kind: "info", title: message });
  };

  const claimOne = async (letterId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await claimMailboxOne(ops, letterId);
      if (result.state !== ops) onOpsChange(result.state);
      tell(result.message);
      if (result.message !== "서버가 필요할 때 받을 수 있어요" && result.message !== "다시 시도해 주세요" && result.message !== "지금은 받을 수 없어요") {
        setOpenId(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const claimAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await claimMailboxEvery(ops);
      if (result.state !== ops) onOpsChange(result.state);
      tell(result.message);
    } finally {
      setBusy(false);
    }
  };

  const openCat = (entry: CatLetterEntry) => {
    setOpenId(null);
    setCatEntry(entry);
    const next = markCatLetterRead(ops, entry.id);
    if (next !== ops) onOpsChange(next);
  };

  return (
    <div className="mb-sheet">
      {rows.length === 0 ? <p className="mb-empty">아직 도착한 편지가 없어요.</p> : null}
      <ul className="mb-list">
        {rows.map((row) => {
          if (row.kind === "cat") {
            const when = row.row.entry.receivedOn === today ? "오늘" : row.row.entry.receivedOn.slice(5).replace("-", ".");
            return (
              <li key={`cat-${row.row.entry.id}`}>
                <button type="button" className="mb-row" onClick={() => openCat(row.row.entry)}>
                  <img className="mb-avatar" src={catIcon || menuAsset("icon-weekly.svg")} alt="" />
                  <span className="mb-copy">
                    <span className="mb-from">최애냥</span>
                    <span className="mb-title">{row.row.title}</span>
                    <span className="mb-note">편지</span>
                  </span>
                  <span className="mb-when">{when}</span>
                </button>
              </li>
            );
          }
          const letter = row.letter;
          const pending = hasGift(letter);
          return (
            <li key={letter.id}>
              <button type="button" className={`mb-row${pending ? " is-pending" : ""}`} onClick={() => setOpenId(letter.id)}>
                {pending ? <i className="mb-dot" aria-label="받을 선물" /> : null}
                <img className="mb-avatar" src={senderIcon(letter.source)} alt="" />
                <span className="mb-copy">
                  <span className="mb-from">{senderName(letter.source)}</span>
                  <span className="mb-title">{letter.title || "선물"}</span>
                  <GiftIcons letter={letter} />
                </span>
                <span className="mb-when">{whenLabel(letter)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {giftable ? (
        <button type="button" className="menu-sheet-cta mb-all" disabled={busy} onClick={() => void claimAll()}>
          모두 받기
        </button>
      ) : null}
      <p className="mb-outside">창 밖을 누르면 닫혀요</p>
      {openLetter
        ? createPortal(
            <div className="mb-read">
              <button type="button" className="mb-read-dim" aria-label="닫기" onClick={() => setOpenId(null)} />
              <article className="mb-card" role="dialog" aria-labelledby="mb-card-title">
                <button type="button" className="mb-read-x" aria-label="닫기" onClick={() => setOpenId(null)}>
                  ×
                </button>
                <img
                  className="mb-hero"
                  src={openLetter.source === "operator" ? "/assets/mailbox/letter-cat.webp" : senderIcon(openLetter.source)}
                  alt=""
                />
                <p className="mb-card-from">{senderName(openLetter.source)}</p>
                <h2 id="mb-card-title">{openLetter.title || "선물"}</h2>
                {letterBody(openLetter) ? <p className="mb-card-body">{letterBody(openLetter)}</p> : null}
                <div className="mb-chips">
                  {giftBits(openLetter, true).map((bit) => (
                    <span key={bit} className="mb-chip">
                      {bit}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="mb-claim"
                  disabled={busy || !hasGift(openLetter)}
                  onClick={() => void claimOne(openLetter.id)}
                >
                  {openLetter.status === "expired" ? "기한이 지났어요" : openLetter.status === "claimed" || !hasGift(openLetter) ? "받았어요" : "받기"}
                </button>
              </article>
            </div>,
            document.body,
          )
        : null}
      {catEntry && letters ? (
        <div className="mb-cat-layer">
          <CatLetterPaper
            file={letters}
            entry={catEntry}
            seasonName={seasonName}
            onClose={() => setCatEntry(null)}
            onPet={
              onOpenRoom
                ? () => {
                    setCatEntry(null);
                    onOpenRoom();
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
