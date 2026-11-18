import type { PhotoFrame } from "../lib/roomPhoto";

type RoomPhotoSheetProps = {
  frames: PhotoFrame[];
  frameId: string;
  previewUrl: string;
  busy: boolean;
  onFrame: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
};

export function RoomPhotoSheet({
  frames,
  frameId,
  previewUrl,
  busy,
  onFrame,
  onClose,
  onSave,
  onShare,
}: RoomPhotoSheetProps) {
  return (
    <div className="lucky-modal lucky-photo-modal">
      <button type="button" className="lucky-modal-back" aria-label="닫기" onClick={onClose} />
      <div className="lucky-modal-card lucky-photo-card" role="dialog" aria-label="테두리를 골라 주세요">
        <h3>테두리를 골라 주세요</h3>
        <div className="lucky-photo-frames" role="listbox" aria-label="테두리">
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              role="option"
              aria-selected={frame.id === frameId}
              className={frame.id === frameId ? "is-on" : ""}
              onClick={() => onFrame(frame.id)}
            >
              <img src={frame.src} alt="" />
              <span>{frame.nameKo}</span>
            </button>
          ))}
        </div>
        <div className="lucky-photo-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="방 사진 카드" />
          ) : (
            <p>{busy ? "사진을 준비하고 있어요" : "사진을 만들지 못했어요"}</p>
          )}
        </div>
        <div className="lucky-modal-actions">
          <button type="button" onClick={onSave} disabled={busy || !previewUrl}>
            사진 저장
          </button>
          <button type="button" className="is-amber" onClick={onShare} disabled={busy || !previewUrl}>
            친구에게 자랑하기
          </button>
        </div>
      </div>
    </div>
  );
}
