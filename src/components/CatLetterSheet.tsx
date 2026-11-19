import { contentId, fillCatLetter, type CatLetterCopy, type CatLetterFile } from "../lib/catLetters";
import type { CatLetterEntry } from "../lib/opsTypes";
import "./CatLetterSheet.css";

type PaperProps = {
  file: CatLetterFile;
  entry: CatLetterEntry;
  seasonName: string;
  onClose: () => void;
  onPet?: () => void;
};

export function CatLetterPaper({ file, entry, seasonName, onClose, onPet }: PaperProps) {
  const source = file.letters.find((item) => item.id === contentId(entry.id));
  if (!source) return null;
  const copy = fillCatLetter(source, file.nameFallback || "집사", seasonName);
  return (
    <div className="letter-sheet" role="presentation">
      <button type="button" className="letter-sheet-back" aria-label="닫기" onClick={onClose} />
      <article className="letter-paper" role="dialog" aria-labelledby="letter-paper-title">
        <p className="letter-paper-kicker">최애냥 편지</p>
        <h2 id="letter-paper-title">{copy.title}</h2>
        <p className="letter-paper-body">{copy.body}</p>
        <button type="button" className="letter-go" onClick={onClose}>
          닫기
        </button>
        {copy.pet && onPet ? (
          <button type="button" className="letter-go is-pet" onClick={onPet}>
            쓰다듬으러 가기
          </button>
        ) : null}
      </article>
    </div>
  );
}

type InboxProps = {
  file: CatLetterFile;
  inbox: CatLetterEntry[];
  readIds: readonly string[];
  seasonName: string;
  onOpen: (entry: CatLetterEntry) => void;
  onClose: () => void;
};

export function CatLetterInbox({ file, inbox, readIds, seasonName, onOpen, onClose }: InboxProps) {
  const rows = [...inbox].sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : -1));
  return (
    <div className="letter-sheet" role="presentation">
      <button type="button" className="letter-sheet-back" aria-label="닫기" onClick={onClose} />
      <div className="letter-inbox" role="dialog" aria-labelledby="letter-inbox-title">
        <h2 id="letter-inbox-title">편지함</h2>
        {rows.length === 0 ? (
          <p className="letter-empty">아직 편지가 없어요.</p>
        ) : (
          <ul>
            {rows.map((entry) => {
              const source = file.letters.find((item) => item.id === contentId(entry.id));
              const copy: CatLetterCopy | null = source
                ? fillCatLetter(source, file.nameFallback || "집사", seasonName)
                : null;
              const unread = !readIds.includes(entry.id);
              return (
                <li key={entry.id}>
                  <button type="button" onClick={() => onOpen(entry)}>
                    <span>{copy?.title ?? "편지"}</span>
                    {unread ? <i className="letter-unread" aria-label="안 읽음" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="letter-go" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
