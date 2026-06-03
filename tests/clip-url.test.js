const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractMedia,
  extractClipId,
  getMediaKey,
  getMediaUrl,
  getClipUrl,
  getEmbedUrl,
} = require("../src/clip-url.js");

test("extracts the clip id from a normal clip URL", () => {
  assert.equal(
    extractClipId("https://chzzk.naver.com/clips/06B56r5cXb"),
    "06B56r5cXb",
  );
});

test("extracts the clip id from a URL with a query or fragment", () => {
  assert.equal(
    extractClipId("https://chzzk.naver.com/clips/06B56r5cXb?from=cafe#player"),
    "06B56r5cXb",
  );
});

test("extracts the clip id from an embed URL", () => {
  assert.equal(
    extractClipId("https://chzzk.naver.com/embed/clip/RMynBK4Xvs"),
    "RMynBK4Xvs",
  );
});

test("extracts the clip id from an encoded redirect URL", () => {
  assert.equal(
    extractClipId(
      "https://example.com/redirect?url=https%253A%252F%252Fchzzk.naver.com%252Fclips%252F06B56r5cXb",
    ),
    "06B56r5cXb",
  );
});

test("ignores non-clip Chzzk URLs", () => {
  assert.equal(extractClipId("https://chzzk.naver.com/live/06B56r5cXb"), null);
  assert.equal(extractMedia("https://chzzk.naver.com/video/13406171"), null);
  assert.equal(extractMedia("https://chzzk.naver.com/embed/video/13406171"), null);
  assert.equal(extractMedia("https://naver.me/FgEE97VN"), null);
});

test("creates clip media and embed URLs", () => {
  assert.equal(
    getClipUrl("06B56r5cXb"),
    "https://chzzk.naver.com/clips/06B56r5cXb",
  );
  assert.equal(
    getEmbedUrl("06B56r5cXb"),
    "https://chzzk.naver.com/embed/clip/06B56r5cXb?parent=cafe.naver.com&extension=ChzzkCafeNow&autoPlay=false&muted=false",
  );
});

test("creates generic clip media URLs", () => {
  const media = { type: "clip", id: "06B56r5cXb" };

  assert.equal(getMediaKey(media), "clip:06B56r5cXb");
  assert.equal(getMediaUrl(media), "https://chzzk.naver.com/clips/06B56r5cXb");
  assert.equal(
    getEmbedUrl(media),
    "https://chzzk.naver.com/embed/clip/06B56r5cXb?parent=cafe.naver.com&extension=ChzzkCafeNow&autoPlay=false&muted=false",
  );
});
