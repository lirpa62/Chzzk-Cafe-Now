const CLIP_PLAY_INFO_PREFIX =
  "https://api.chzzk.naver.com/service/v1/play-info/clip/";
const CAFE_TAB_MATCH_PATTERNS = [
  "https://cafe.naver.com/*",
  "https://*.cafe.naver.com/*",
];

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

async function showUpdateBannerOnTab(tabId, version) {
  if (!Number.isInteger(tabId) || !chrome.scripting?.executeScript) return false;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: showChzzkCafeNowUpdateBanner,
      args: [version],
    });
    return true;
  } catch {
    return false;
  }
}

async function showUpdateBannersOnCafeTabs() {
  const version = chrome.runtime.getManifest().version;
  const tabs = await chrome.tabs.query({ url: CAFE_TAB_MATCH_PATTERNS });

  for (const tab of tabs) {
    const tabId = Number(tab?.id);
    if (!Number.isInteger(tabId)) continue;
    await showUpdateBannerOnTab(tabId, version);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "update") return;
  showUpdateBannersOnCafeTabs().catch(() => undefined);
});

function showChzzkCafeNowUpdateBanner(version) {
  const bannerId = "chzzk-cafe-now-update-banner";
  if (document.getElementById(bannerId)) return;

  const banner = document.createElement("div");
  banner.id = bannerId;
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 54px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(0, 255, 163, 0.32);
    background: linear-gradient(135deg, #14181c 0%, #20272d 58%, #00ffa3 180%);
    color: #ffffff;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
    box-sizing: border-box;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    transform: translateY(-100%);
    transition: transform 420ms cubic-bezier(0.19, 1, 0.22, 1);
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    max-width: 960px;
    width: 100%;
  `;

  const message = document.createElement("span");
  message.textContent = `치즈 카페 나우 ${version} 버전으로 업데이트되었습니다. 안정적인 사용을 위해 새로고침해 주세요.`;
  message.style.cssText = `
    min-width: 0;
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.45;
    text-align: center;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.28);
  `;

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "새로고침";
  refreshButton.style.cssText = `
    flex: 0 0 auto;
    border: 1px solid rgba(0, 255, 163, 0.55);
    border-radius: 8px;
    background: #00ffa3;
    color: #14181c;
    padding: 7px 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  `;
  refreshButton.addEventListener("click", () => {
    banner.style.transform = "translateY(-100%)";
    window.setTimeout(() => location.reload(), 180);
  });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "업데이트 안내 닫기");
  closeButton.textContent = "×";
  closeButton.style.cssText = `
    flex: 0 0 auto;
    border: 0;
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    font: inherit;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
  `;
  closeButton.addEventListener("click", () => {
    banner.style.transform = "translateY(-100%)";
    window.setTimeout(() => banner.remove(), 420);
  });

  content.append(message, refreshButton, closeButton);
  banner.append(content);
  (document.body || document.documentElement).append(banner);
  window.setTimeout(() => {
    banner.style.transform = "translateY(0)";
  }, 80);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CHZZK_CAFE_NOW_GET_CLIP_METADATA") return;

  fetchClipMetadata(String(message.clipId || message.mediaId || ""))
    .then((metadata) => sendResponse({ metadata }))
    .catch(() => sendResponse({ metadata: null }));

  return true;
});
