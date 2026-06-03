const CLIP_PLAY_INFO_PREFIX =
  "https://api.chzzk.naver.com/service/v1/play-info/clip/";

function normalizeClipMetadata(payload) {
  const content = payload?.content;
  if (Number(payload?.code) !== 200 || !content) return null;

  return {
    streamerName: String(content.ownerChannel?.channelName || "").trim(),
    title: String(content.contentTitle || "").trim(),
  };
}

async function fetchClipMetadata(clipId) {
  const response = await fetch(
    `${CLIP_PLAY_INFO_PREFIX}${encodeURIComponent(clipId)}`,
    {
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`CHZZK API 요청 실패: HTTP ${response.status}`);
  }

  return normalizeClipMetadata(await response.json());
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CHZZK_CAFE_NOW_GET_CLIP_METADATA") return;

  fetchClipMetadata(String(message.clipId || message.mediaId || ""))
    .then((metadata) => sendResponse({ metadata }))
    .catch(() => sendResponse({ metadata: null }));

  return true;
});
