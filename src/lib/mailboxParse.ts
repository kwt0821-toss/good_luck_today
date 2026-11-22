/** Mailbox identity and gift-count rules shared by the wallet parser and the badges. */

export const MAIL_SOURCES = ["operator", "invite", "weekly", "cozy"] as const;

export type MailboxSourceName = (typeof MAIL_SOURCES)[number];

export type GiftableLetter = {
  status: string;
  jelly: number;
  nyang: number;
  tickets: number;
};

/** Integer ids from the server become strings. Anything else is dropped. */
export function mailboxLetterId(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return String(value);
  return null;
}

export function acceptedMailboxSource(value: unknown): value is MailboxSourceName {
  return typeof value === "string" && (MAIL_SOURCES as readonly string[]).includes(value);
}

/** Same letter the list and mailbox_claim both keep. Unknown sources are dropped. */
export function acceptMailboxIdentity(id: unknown, source: unknown): string | null {
  const letterId = mailboxLetterId(id);
  if (!letterId || !acceptedMailboxSource(source)) return null;
  return letterId;
}

/** Pending letter that still holds jelly, 냥코인, or a draw ticket. */
export function letterHasGift(letter: GiftableLetter): boolean {
  return letter.status === "pending" && (letter.jelly > 0 || letter.nyang > 0 || letter.tickets > 0);
}

export function countGiftableLetters(items: readonly GiftableLetter[]): number {
  let count = 0;
  for (const letter of items) {
    if (letterHasGift(letter)) count += 1;
  }
  return count;
}
