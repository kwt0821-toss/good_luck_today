import type { UpdateNotes } from "../lib/updateNotes";
import "./UpdateNotesPopup.css";

type Props = {
  note: UpdateNotes;
  onDismiss: () => void;
};

export function UpdateNotesPopup({ note, onDismiss }: Props) {
  return (
    <div className="update-notes" role="presentation">
      <button type="button" className="update-notes-back" aria-label="닫기" onClick={onDismiss} />
      <div className="update-notes-card" role="dialog" aria-labelledby="update-notes-title">
        <h2 id="update-notes-title">{note.title}</h2>
        {note.image ? <img src={note.image} alt="" /> : null}
        <ul>
          {note.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button type="button" className="update-notes-go" onClick={onDismiss}>
          {note.cta}
        </button>
      </div>
    </div>
  );
}
