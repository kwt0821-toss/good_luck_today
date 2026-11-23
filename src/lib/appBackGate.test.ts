import assert from "node:assert/strict";

import { clearAppBackSuppress, isAppBackSuppressed, suppressAppBack } from "./appBackGate.ts";

clearAppBackSuppress();

suppressAppBack(1000, 0);
suppressAppBack(100, 500);
assert.equal(isAppBackSuppressed(900), true);
assert.equal(isAppBackSuppressed(1000), false);

clearAppBackSuppress();
suppressAppBack(100, 0);
suppressAppBack(5000, 50);
assert.equal(isAppBackSuppressed(1000), true);
assert.equal(isAppBackSuppressed(5050), false);

clearAppBackSuppress();
assert.equal(isAppBackSuppressed(0), false);
assert.equal(isAppBackSuppressed(10_000), false);

console.log("appBackGate.test.ts ok");
