(function initializeChzzkCafeNow() {
  const api = globalThis.ChzzkCafeNow;
  if (!api) return;

  const OGLINK_SELECTOR = "div.se-component.se-oglink";
  const OGLINK_THUMBNAIL_SELECTOR = ".se-oglink-thumbnail";
  const OGLINK_TITLE_SELECTOR = ".se-oglink-title";
  const CANDIDATE_SELECTOR = "a[href], [data-url], [data-link-url], [data-href]";
  const TEXT_COMPONENT_SELECTOR = "div.se-component.se-text";
  const TEXT_PARAGRAPH_SELECTOR = ".se-text-paragraph";
  const STANDALONE_PLAYER_SELECTOR = "[data-chzzk-cafe-now-standalone]";
  const CHZZK_ICON_URL = "https://chzzk.naver.com/favicon.ico";

  const OBSERVED_ATTRIBUTES = ["href", "data-url", "data-link-url", "data-href"];

  let scanQueued = false;
  const pendingRoots = new Set();
  const metadataRequests = new Map();
  const metadataCache = new Map();
  const oglinkStates = new WeakMap();

  function getCandidateValues(element) {
    const values = OBSERVED_ATTRIBUTES.map((attribute) =>
      element.getAttribute(attribute),
    );

    if (element instanceof HTMLAnchorElement) {
      values.push(element.href);
    }

    return values.filter(Boolean);
  }

  function getCandidateMedia(element) {
    for (const value of getCandidateValues(element)) {
      const media = api.extractMedia(value);
      if (media) {
        return {
          media,
          mediaKey: api.getMediaKey(media),
          mediaUrl: getMediaUrl(element, media),
        };
      }
    }

    return null;
  }

  function getMediaUrl(element, media) {
    for (const value of getCandidateValues(element)) {
      if (!api.isSameMedia(api.extractMedia(value), media)) continue;

      try {
        const url = new URL(value);
        if (url.hostname === "chzzk.naver.com") return url.href;
      } catch {
        // Use the canonical media URL for encoded redirect URLs.
      }
    }

    return api.getMediaUrl(media);
  }

  function normalizeVisibleText(value) {
    return String(value || "")
      .replace(/\u200b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createPlayer(media) {
    const mediaKey = api.getMediaKey(media);
    const wrapper = document.createElement("div");
    wrapper.className = "chzzk-cafe-now-player";
    wrapper.dataset.chzzkCafeNowPlayer = mediaKey;
    wrapper.dataset.chzzkCafeNowMediaType = media.type;
    wrapper.dataset.chzzkCafeNowMediaId = media.id;

    const frameWrap = document.createElement("div");
    frameWrap.className = "chzzk-cafe-now-player__frame-wrap";

    const frame = document.createElement("iframe");
    frame.className = "chzzk-cafe-now-player__frame";
    frame.src = api.getEmbedUrl(media);
    frame.title = "CHZZK Player";
    frame.frameBorder = "0";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; web-share";
    frame.allowFullscreen = true;

    frameWrap.append(frame);
    wrapper.append(frameWrap);

    return wrapper;
  }

  function findOglinkThumbnail(oglink) {
    const thumbnail = oglink.querySelector(OGLINK_THUMBNAIL_SELECTOR);
    if (thumbnail) return thumbnail;

    return [...oglink.querySelectorAll("img")].find(
      (image) => !image.closest(".se-oglink-info"),
    );
  }

  function replaceOrInsertOglinkPlayer(oglink, media, thumbnail) {
    if (oglink.querySelector("[data-chzzk-cafe-now-player]")) return;

    const player = createPlayer(media);
    if (thumbnail) {
      thumbnail.replaceWith(player);
      return;
    }

    const info = oglink.querySelector(".se-oglink-info");
    if (info) {
      info.before(player);
      return;
    }

    const container = oglink.querySelector(
      ".se-module-oglink, .se-oglink-container, .se-section-oglink",
    );
    if (container) container.prepend(player);
  }

  function getStandaloneClip(component) {
    const links = [...component.querySelectorAll(CANDIDATE_SELECTOR)]
      .filter((element) => !element.closest(STANDALONE_PLAYER_SELECTOR))
      .map((element) => ({
        element,
        candidate: getCandidateMedia(element),
      }))
      .filter(({ candidate }) => candidate);
    if (links.length !== 1) return null;

    const { element, candidate } = links[0];

    const paragraph = element.closest(".se-text-paragraph") || element.parentElement;
    const visibleText = normalizeVisibleText(
      paragraph?.innerText || paragraph?.textContent,
    );
    const linkText = normalizeVisibleText(element.textContent);
    const canonicalText = normalizeVisibleText(api.getMediaUrl(candidate.media));
    const mediaUrlText = normalizeVisibleText(candidate.mediaUrl);
    if (
      visibleText !== linkText &&
      visibleText !== canonicalText &&
      visibleText !== mediaUrlText
    ) {
      return null;
    }

    const componentText = normalizeVisibleText(
      component.innerText || component.textContent,
    );

    return {
      media: candidate.media,
      mediaKey: candidate.mediaKey,
      mediaUrl: candidate.mediaUrl,
      target: componentText === visibleText ? component : paragraph || component,
    };
  }

  function removeStandaloneClipComponents(mediaKey) {
    document
      .querySelectorAll(`[data-chzzk-cafe-now-standalone="${mediaKey}"]`)
      .forEach((component) => component.remove());

    document.querySelectorAll(TEXT_COMPONENT_SELECTOR).forEach((component) => {
      if (getStandaloneClip(component)?.mediaKey === mediaKey) component.remove();
    });

    document.querySelectorAll(TEXT_PARAGRAPH_SELECTOR).forEach((paragraph) => {
      if (getStandaloneClip(paragraph)?.mediaKey === mediaKey) paragraph.remove();
    });
  }

  function hasOglinkForMedia(mediaKey) {
    return [...document.querySelectorAll(OGLINK_SELECTOR)].some((oglink) =>
      !oglink.closest(STANDALONE_PLAYER_SELECTOR) &&
      [...oglink.querySelectorAll(CANDIDATE_SELECTOR)].some(
        (candidate) => getCandidateMedia(candidate)?.mediaKey === mediaKey,
      ),
    );
  }

  function updateStandaloneTitle(card, mediaInfo) {
    const title = card.querySelector(OGLINK_TITLE_SELECTOR);
    if (!title) return;

    renderOglinkTitle(
      title,
      mediaInfo.mediaUrl,
      metadataCache.get(mediaInfo.mediaKey) || null,
    );

    if (card.dataset.chzzkCafeNowMetadataRequested === "true") return;
    card.dataset.chzzkCafeNowMetadataRequested = "true";

    requestMediaMetadata(mediaInfo.media).then((metadata) => {
      if (!metadata || !card.isConnected) return;

      metadataCache.set(mediaInfo.mediaKey, metadata);

      const currentTitle = card.querySelector(OGLINK_TITLE_SELECTOR);
      if (currentTitle) {
        renderOglinkTitle(currentTitle, mediaInfo.mediaUrl, metadata);
      }
    });
  }

  function createComponentId() {
    if (globalThis.crypto?.randomUUID) {
      return `SE-${globalThis.crypto.randomUUID()}`;
    }

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2);
    return `SE-${timestamp}-${random}`;
  }

  function createModuleData(componentId, mediaUrl) {
    return JSON.stringify({
      type: "v2_oglink",
      id: componentId,
      data: {
        link: mediaUrl,
        isVideo: "false",
      },
    });
  }

  function createStandalonePlayer(mediaInfo) {
    const componentId = createComponentId();
    const moduleData = createModuleData(componentId, mediaInfo.mediaUrl);

    const component = document.createElement("div");
    component.className =
      "se-component se-oglink se-l-large_image __se-component chzzk-cafe-now-standalone";
    component.id = componentId;
    component.dataset.chzzkCafeNowStandalone = mediaInfo.mediaKey;

    const content = document.createElement("div");
    content.className = "se-component-content";

    const section = document.createElement("div");
    section.className =
      "se-section se-section-oglink se-l-large_image se-section-align-";

    const module = document.createElement("div");
    module.className = "se-module se-module-oglink";

    const info = document.createElement("a");
    info.href = mediaInfo.mediaUrl;
    info.className = "se-oglink-info __se_link";
    info.target = "_blank";
    info.dataset.linktype = "oglink";
    info.dataset.linkdata = JSON.stringify({
      id: componentId,
      link: mediaInfo.mediaUrl,
    });

    const infoContainer = document.createElement("div");
    infoContainer.className = "se-oglink-info-container";

    const title = document.createElement("strong");
    title.className = "se-oglink-title";
    title.textContent = `${mediaInfo.mediaUrl} - CHZZK`;

    const script = document.createElement("script");
    script.type = "text/data";
    script.className = "__se_module_data";
    script.dataset.module = moduleData;
    script.dataset.moduleV2 = moduleData;

    infoContainer.append(title);
    info.append(infoContainer);
    module.append(createPlayer(mediaInfo.media), info);
    section.append(module);
    content.append(section);
    component.append(content, script);
    updateStandaloneTitle(component, mediaInfo);

    return component;
  }

  function replaceStandaloneClipComponent(component) {
    if (!component.isConnected) return;
    if (component.closest(STANDALONE_PLAYER_SELECTOR)) return;

    const mediaInfo = getStandaloneClip(component);
    if (!mediaInfo) return;

    if (hasOglinkForMedia(mediaInfo.mediaKey)) {
      mediaInfo.target.remove();
      return;
    }

    mediaInfo.target.replaceWith(createStandalonePlayer(mediaInfo));
  }

  function findStandaloneClipContainers(root) {
    const containers = new Set();

    if (root instanceof Element) {
      if (root.closest(STANDALONE_PLAYER_SELECTOR)) return containers;

      const closestTextComponent = root.closest(TEXT_COMPONENT_SELECTOR);
      const closestParagraph = root.closest(TEXT_PARAGRAPH_SELECTOR);
      if (closestTextComponent) containers.add(closestTextComponent);
      if (closestParagraph) containers.add(closestParagraph);
    }

    root.querySelectorAll(TEXT_COMPONENT_SELECTOR).forEach((component) => {
      containers.add(component);
    });

    root.querySelectorAll(TEXT_PARAGRAPH_SELECTOR).forEach((paragraph) => {
      containers.add(paragraph);
    });

    return containers;
  }

  function getFallbackTitle(title) {
    if (title.dataset.chzzkCafeNowFallbackTitle) {
      return title.dataset.chzzkCafeNowFallbackTitle;
    }

    const fallbackTitle = (title.textContent || "")
      .replace(/\s*-\s*CHZZK\s*$/i, "")
      .trim();

    title.dataset.chzzkCafeNowFallbackTitle = fallbackTitle;
    return fallbackTitle;
  }

  function renderOglinkTitle(title, clipUrl, metadata) {
    const fallbackTitle = getFallbackTitle(title);
    const streamerName = metadata?.streamerName || "";
    const clipTitle = metadata?.title || fallbackTitle;
    const label = streamerName ? `${streamerName} - ${clipTitle}` : clipTitle;
    const renderKey = `${label}\n${clipUrl}`;
    if (title.dataset.chzzkCafeNowTitle === renderKey) return;

    const icon = document.createElement("img");
    icon.className = "chzzk-cafe-now-title__icon";
    icon.src = CHZZK_ICON_URL;
    icon.alt = "";

    const text = document.createElement("span");
    text.className = "chzzk-cafe-now-title__text";
    text.textContent = label;

    const url = document.createElement("span");
    url.className = "chzzk-cafe-now-title__url";
    url.textContent = ` (${clipUrl})`;

    title.classList.add("chzzk-cafe-now-title");
    title.dataset.chzzkCafeNowTitle = renderKey;
    title.replaceChildren(icon, text, url);
  }

  function requestMediaMetadata(media) {
    const mediaKey = api.getMediaKey(media);
    if (!metadataRequests.has(mediaKey)) {
      const request = new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "CHZZK_CAFE_NOW_GET_CLIP_METADATA",
            mediaType: media.type,
            mediaId: media.id,
            clipId: media.type === "clip" ? media.id : "",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }

            resolve(response?.metadata || null);
          },
        );
      });

      metadataRequests.set(mediaKey, request);
    }

    return metadataRequests.get(mediaKey);
  }

  function updateOglinkTitle(oglink, state) {
    const title = oglink.querySelector(OGLINK_TITLE_SELECTOR);
    if (!title) return;

    renderOglinkTitle(
      title,
      state.mediaUrl,
      metadataCache.get(state.mediaKey) || null,
    );
    if (state.metadataRequested) return;

    state.metadataRequested = true;
    requestMediaMetadata(state.media).then((metadata) => {
      if (!metadata || !oglink.isConnected) return;

      metadataCache.set(state.mediaKey, metadata);

      const currentTitle = oglink.querySelector(OGLINK_TITLE_SELECTOR);
      if (currentTitle) renderOglinkTitle(currentTitle, state.mediaUrl, metadata);
    });
  }

  function replaceOglinkThumbnail(oglink) {
    if (!oglink.isConnected) return;
    if (oglink.dataset.chzzkCafeNowStandalone) return;

    const thumbnail = findOglinkThumbnail(oglink);
    for (const candidate of oglink.querySelectorAll(CANDIDATE_SELECTOR)) {
      const mediaInfo = getCandidateMedia(candidate);
      if (!mediaInfo) continue;

      let state = oglinkStates.get(oglink);
      if (!state || state.mediaKey !== mediaInfo.mediaKey) {
        state = {
          media: mediaInfo.media,
          mediaKey: mediaInfo.mediaKey,
          mediaUrl: mediaInfo.mediaUrl,
          metadataRequested: false,
        };
        oglinkStates.set(oglink, state);
      }

      oglink
        .querySelectorAll(".se-oglink-summary, .se-oglink-url")
        .forEach((element) => element.remove());

      oglink.classList.add("chzzk-cafe-now-oglink");
      removeStandaloneClipComponents(mediaInfo.mediaKey);
      updateOglinkTitle(oglink, state);

      replaceOrInsertOglinkPlayer(oglink, mediaInfo.media, thumbnail);

      return;
    }
  }

  function scan(root) {
    if (!(root instanceof Document || root instanceof Element)) return;

    if (root instanceof Element) {
      const closestOglink = root.closest(OGLINK_SELECTOR);
      if (closestOglink) replaceOglinkThumbnail(closestOglink);
    }

    root.querySelectorAll(OGLINK_SELECTOR).forEach(replaceOglinkThumbnail);

    findStandaloneClipContainers(root).forEach(replaceStandaloneClipComponent);
  }

  function flushScans() {
    scanQueued = false;
    const roots = [...pendingRoots];
    pendingRoots.clear();

    if (roots.includes(document)) {
      scan(document);
      return;
    }

    roots.forEach(scan);
  }

  function queueScan(root) {
    pendingRoots.add(root);
    if (scanQueued) return;

    scanQueued = true;
    queueMicrotask(flushScans);
  }

  function onMutations(mutations) {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        queueScan(mutation.target);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) queueScan(node);
      });
    });
  }

  function start() {
    queueScan(document);

    const observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
      childList: true,
      subtree: true,
    });

    // Dense early retries so the player swaps in quickly once the SPA fills
    // the post body. The MutationObserver above handles most cases; these are
    // a safety net for mutations it might miss during the initial render burst.
    [50, 150, 400, 800, 1500, 3000].forEach((delay) => {
      setTimeout(() => {
        if (document.documentElement) queueScan(document);
      }, delay);
    });
  }

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
