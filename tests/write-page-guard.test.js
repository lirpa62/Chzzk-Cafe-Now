const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// content.js는 브라우저 확장 IIFE라 require할 수 없다. 글쓰기·수정 화면 판정만
// 떼어내 검증한다 — 이 판정이 틀리면 에디터 본문이 사라지거나(오탐 실패),
// 읽기 화면에서 확장이 통째로 멈춘다(오탐).
const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "content.js"),
  "utf8",
);
const isWriteUrlSource = source.match(/function isWriteUrl\(url\) \{[\s\S]*?\n  \}/);
assert.ok(isWriteUrlSource, "content.js에서 isWriteUrl을 찾지 못했습니다");
const isWriteUrl = new Function(`${isWriteUrlSource[0]}; return isWriteUrl;`)();

test("blocks the write and modify editor screens", () => {
  for (const url of [
    "/ca-fe/cafes/31342874/articles/write",
    "/ca-fe/cafes/31342874/articles/8/modify",
    "/ca-fe/cafes/31342874/articles/12345/edit",
    "/ArticleWrite.nhn?clubid=123",
    "/ArticleUpdate.nhn?clubid=123&articleid=8",
    "https://cafe.naver.com/ca-fe/cafes/1/articles/8/modify",
  ]) {
    assert.equal(isWriteUrl(url), true, url);
  }
});

test("leaves reading screens alone", () => {
  for (const url of [
    "/ca-fe/cafes/31342874/articles/8",
    "/ca-fe/cafes/31342874/articles/8?art=abc",
    "/ArticleRead.nhn?clubid=123&articleid=8",
    "/ca-fe/cafes/31342874",
    "/f-e/cafes/1/articles/99",
    "/ca-fe/cafes/1/articles/writers",
  ]) {
    assert.equal(isWriteUrl(url), false, url);
  }
});
