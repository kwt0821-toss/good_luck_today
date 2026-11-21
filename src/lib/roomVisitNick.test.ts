import assert from "node:assert/strict";

import { FIRST_HEART, VISIT_EMPTY, nicknameIssue } from "./roomVisitNick.ts";

assert.equal(nicknameIssue("밤하늘"), null);
assert.equal(nicknameIssue("ab"), null);
assert.equal(nicknameIssue("냥2"), null);
assert.ok(nicknameIssue("a"));
assert.ok(nicknameIssue("123456"));
assert.ok(nicknameIssue("밤 하늘"));
assert.ok(nicknameIssue("밤하늘!"));
assert.ok(nicknameIssue("가나다라마바사아자"));
assert.equal(VISIT_EMPTY.friends, "아직 공개한 친구가 없어요");
assert.equal(VISIT_EMPTY.today, "오늘의 방이 아직 없어요");
assert.equal(VISIT_EMPTY.popular, "아직 인기 방이 없어요");
assert.equal(FIRST_HEART, "오늘 첫 하트예요! 발바닥 젤리 5개를 받았어요");
console.log("room visit nick ok");
