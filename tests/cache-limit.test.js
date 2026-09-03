const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// content.js는 브라우저 확장 IIFE라 require할 수 없다. 캐시 상한 로직만 떼어내
// 검증한다 — 카페는 SPA라 글을 옮겨 다녀도 스크립트가 다시 로드되지 않으므로,
// 이 상한이 없으면 캐시가 무한히 늘어난다.
const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "content.js"),
  "utf8",
);
const limitSource = source.match(/const CACHE_LIMIT = \d+;/);
const setterSource = source.match(
  /function setWithLimit\(cache, key, value\) \{[\s\S]*?\n  \}/,
);
assert.ok(limitSource, "content.js에서 CACHE_LIMIT을 찾지 못했습니다");
assert.ok(setterSource, "content.js에서 setWithLimit을 찾지 못했습니다");

const { setWithLimit, CACHE_LIMIT } = new Function(
  `${limitSource[0]}
   ${setterSource[0]}
   return { setWithLimit, CACHE_LIMIT };`,
)();

test("keeps the cache bounded no matter how many articles are visited", () => {
  const cache = new Map();
  for (let i = 0; i < CACHE_LIMIT * 5; i += 1) {
    setWithLimit(cache, `clip:${i}`, { title: `클립 ${i}` });
  }

  assert.equal(cache.size, CACHE_LIMIT);
  // 가장 최근 항목은 남고, 가장 오래된 항목은 밀려난다.
  assert.ok(cache.has(`clip:${CACHE_LIMIT * 5 - 1}`));
  assert.ok(!cache.has("clip:0"));
});

test("refreshing an existing key does not grow the cache", () => {
  const cache = new Map();
  setWithLimit(cache, "clip:a", 1);
  setWithLimit(cache, "clip:b", 2);
  setWithLimit(cache, "clip:a", 3);

  assert.equal(cache.size, 2);
  assert.equal(cache.get("clip:a"), 3);
  // 다시 쓴 키는 최신으로 취급되어 'clip:b'보다 뒤에 온다.
  assert.deepEqual([...cache.keys()], ["clip:b", "clip:a"]);
});
