/** 2–8 Hangul syllables, English letters, or digits. Not digits only. */
export function nicknameIssue(raw: string): string | null {
  const name = raw.trim();
  if (!/^[0-9A-Za-z가-힣]{2,8}$/.test(name)) {
    return "닉네임은 2~8글자, 한글·영문·숫자만 쓸 수 있어요";
  }
  if (/^[0-9]+$/.test(name)) return "숫자만으로는 닉네임을 만들 수 없어요";
  return null;
}

export const VISIT_EMPTY = {
  friends: "아직 공개한 친구가 없어요",
  today: "오늘의 방이 아직 없어요",
  popular: "아직 인기 방이 없어요",
} as const;

export const VISIT_HINT = {
  friends: "초대로 이어진 친구의 방이에요",
  today: "오늘 만난 방이에요",
  popular: "좋아요를 많이 받은 방이에요",
} as const;

export const PHOTO_DAY_LIMIT = "오늘은 방 사진을 더 남길 수 없어요. 내일 다시 시도해 주세요";
export const PHOTO_FAIL = "방 사진을 남기지 못했어요";
export const PHOTO_EXPIRED = "방 사진이 만료되어 목록에서 내려갔어요. 사진을 다시 남기면 올라가요";
export const ROOM_EMPTY = "아직 꾸민 방이 없어요";
export const FIRST_HEART = "오늘 첫 하트예요! 발바닥 젤리 5개를 받았어요";
