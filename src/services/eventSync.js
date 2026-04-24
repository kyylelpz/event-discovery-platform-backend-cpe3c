import { getJson } from "serpapi";
import Event from "../models/Event.js";
import EventSyncState from "../models/EventSyncState.js";

const DEFAULT_LOCATION = process.env.EVENTS_REFRESH_LOCATION || "Philippines";
const DEFAULT_QUERY =
  process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
const EVENTS_PER_PAGE = 10;
const PHILIPPINE_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const PHILIPPINE_TIME_ZONE = "Asia/Manila";
const EVENT_SYNC_STATE_KEY = "serpapi-google-events";
const DAILY_CREDIT_LIMIT = Math.max(
  1,
  Number(process.env.EVENTS_DAILY_CREDIT_LIMIT || 5),
);
const AUTO_REFRESH_ENABLED = process.env.EVENTS_AUTO_REFRESH_ENABLED !== "false";
const AUTO_REFRESH_ON_STARTUP =
  process.env.EVENTS_AUTO_REFRESH_ON_STARTUP !== "false";
const DEFAULT_SEARCH_FILTERS = String(
  process.env.EVENTS_REFRESH_FILTERS ||
    "date:today|date:tomorrow|date:week|date:next_week|date:month",
)
  .split("|")
  .map((value) => value.trim())
  .filter(Boolean);
const TARGET_IMAGE_WIDTH = Number(process.env.EVENTS_IMAGE_WIDTH || 1600);
const SOURCE_IMAGE_FETCH_TIMEOUT_MS = Number(
  process.env.EVENT_SOURCE_IMAGE_TIMEOUT_MS || 8000,
);
const SOURCE_IMAGE_FETCH_CONCURRENCY = Math.max(
  1,
  Number(process.env.EVENT_SOURCE_IMAGE_CONCURRENCY || 4),
);

const PROVINCES = [
  "Abra",
  "Agusan del Norte",
  "Agusan del Sur",
  "Aklan",
  "Albay",
  "Antique",
  "Apayao",
  "Aurora",
  "Basilan",
  "Bataan",
  "Batanes",
  "Batangas",
  "Benguet",
  "Biliran",
  "Bohol",
  "Bukidnon",
  "Bulacan",
  "Cagayan",
  "Camarines Norte",
  "Camarines Sur",
  "Camiguin",
  "Capiz",
  "Catanduanes",
  "Cavite",
  "Cebu",
  "Cotabato",
  "Davao de Oro",
  "Davao del Norte",
  "Davao del Sur",
  "Davao Occidental",
  "Davao Oriental",
  "Dinagat Islands",
  "Eastern Samar",
  "Guimaras",
  "Ifugao",
  "Ilocos Norte",
  "Ilocos Sur",
  "Iloilo",
  "Isabela",
  "Kalinga",
  "La Union",
  "Laguna",
  "Lanao del Norte",
  "Lanao del Sur",
  "Leyte",
  "Maguindanao del Norte",
  "Maguindanao del Sur",
  "Marinduque",
  "Masbate",
  "Misamis Occidental",
  "Misamis Oriental",
  "Mountain Province",
  "Negros Occidental",
  "Negros Oriental",
  "Northern Samar",
  "Nueva Ecija",
  "Nueva Vizcaya",
  "Occidental Mindoro",
  "Oriental Mindoro",
  "Palawan",
  "Pampanga",
  "Pangasinan",
  "Quezon",
  "Quirino",
  "Rizal",
  "Romblon",
  "Samar",
  "Sarangani",
  "Siquijor",
  "Sorsogon",
  "South Cotabato",
  "Southern Leyte",
  "Sultan Kudarat",
  "Sulu",
  "Surigao del Norte",
  "Surigao del Sur",
  "Tarlac",
  "Tawi-Tawi",
  "Zambales",
  "Zamboanga del Norte",
  "Zamboanga del Sur",
  "Zamboanga Sibugay",
];

const METRO_MANILA_KEYWORDS = [
  "metro manila",
  "manila",
  "makati",
  "taguig",
  "pasay",
  "pasig",
  "mandaluyong",
  "quezon city",
  "paranaque",
  "las pinas",
  "muntinlupa",
  "marikina",
  "san juan",
  "navotas",
  "malabon",
  "caloocan",
  "valenzuela",
  "pateros",
];

const CATEGORY_RULES = [
  {
    category: "Music",
    keywords: [
      "concert",
      "music",
      "festival",
      "gig",
      "live",
      "dj",
      "band",
      "jazz",
    ],
  },
  {
    category: "Art & Culture",
    keywords: [
      "museum",
      "art",
      "gallery",
      "cultural",
      "culture",
      "exhibit",
      "theater",
    ],
  },
  {
    category: "Business",
    keywords: [
      "conference",
      "summit",
      "networking",
      "expo",
      "business",
      "startup",
      "forum",
    ],
  },
  {
    category: "Food & Drink",
    keywords: [
      "food",
      "drink",
      "dinner",
      "tasting",
      "culinary",
      "market",
      "coffee",
    ],
  },
  {
    category: "Tech",
    keywords: [
      "tech",
      "developer",
      "software",
      "ai",
      "product",
      "hackathon",
      "web3",
    ],
  },
];

const refreshState = {
  isRefreshing: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastQuery: DEFAULT_QUERY,
  lastResultCount: 0,
  lastPageStarts: [],
  nextScheduledAt: null,
};

let refreshPromise = null;
const sourceImageCache = new Map();
let scheduledRefreshTimer = null;

const slugify = (value) =>
  String(value || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPhilippineDateKey = (date = new Date()) => {
  const shiftedDate = new Date(date.getTime() + PHILIPPINE_TIME_OFFSET_MS);
  const year = shiftedDate.getUTCFullYear();
  const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shiftedDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMillisecondsUntilNextPhilippineMidnight = (date = new Date()) => {
  const shiftedDate = new Date(date.getTime() + PHILIPPINE_TIME_OFFSET_MS);
  const nextMidnightShiftedMs = Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );

  return Math.max(1_000, nextMidnightShiftedMs - shiftedDate.getTime());
};

const getNextPhilippineMidnightDate = (date = new Date()) =>
  new Date(date.getTime() + getMillisecondsUntilNextPhilippineMidnight(date));

const getSearchPlanKey = ({ query, htichips = "" }) =>
  `${String(query || "").trim()}::${String(htichips || "").trim() || "all"}`;

const buildSearchPlans = (query = DEFAULT_QUERY) =>
  DEFAULT_SEARCH_FILTERS.slice(0, DAILY_CREDIT_LIMIT).map((htichips) => ({
    query,
    htichips,
    start: 0,
    key: getSearchPlanKey({ query, htichips }),
  }));

const getDailyRequestedResults = () => DAILY_CREDIT_LIMIT * EVENTS_PER_PAGE;

const ensureUniqueStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

const loadSyncState = async () =>
  EventSyncState.findOneAndUpdate(
    { key: EVENT_SYNC_STATE_KEY },
    {
      $setOnInsert: {
        key: EVENT_SYNC_STATE_KEY,
        budgetDate: getPhilippineDateKey(),
        creditsUsedToday: 0,
        attemptedSearchKeys: [],
        nextScheduledAt: getNextPhilippineMidnightDate(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

const normalizeSyncStateBudget = async (syncState) => {
  const todayKey = getPhilippineDateKey();

  if (syncState.budgetDate === todayKey) {
    return syncState;
  }

  syncState.budgetDate = todayKey;
  syncState.creditsUsedToday = 0;
  syncState.attemptedSearchKeys = [];
  syncState.nextScheduledAt = getNextPhilippineMidnightDate();
  await syncState.save();

  return syncState;
};

const asText = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

const getStartDate = (event) =>
  asText(
    event.date?.start_date ||
      event.start_date ||
      event.startDate ||
      event.date ||
      event.when,
  );

const getTimeLabel = (event) =>
  asText(event.date?.when || event.start_time || event.time || event.when);

const getVenue = (event) =>
  asText(
    event.venue?.name ||
      event.venue?.title ||
      event.venue_name ||
      event.location,
  );

const getAddress = (event) => asText(event.address || event.location);

const normalizeImageProtocol = (value) =>
  value.startsWith("//") ? `https:${value}` : value;

const dedupeValues = (values) => Array.from(new Set(values.filter(Boolean)));

const collectImageCandidates = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageCandidates(item));
  }

  if (typeof value === "string") {
    const imageUrl = value.trim();
    return imageUrl ? [normalizeImageProtocol(imageUrl)] : [];
  }

  if (typeof value === "object") {
    return [
      value.url,
      value.src,
      value.image,
      value.imageUrl,
      value.thumbnail,
      value.thumbnail_url,
      value.original,
      value.original?.url,
      value.large,
      value.large?.url,
      value.full,
      value.full?.url,
    ].flatMap((item) => collectImageCandidates(item));
  }

  return [];
};

const invalidEventImagePatterns = [
  /googleapis\.com\/maps/i,
  /maps\.google/i,
  /staticmap/i,
  /maps\.gstatic/i,
  /gstatic\.com\/map/i,
  /streetview/i,
  /encrypted-tbn/i,
  /placehold/i,
  /\.(?:css|js|json)(?:[?#]|$)/i,
  /parastorage\.com\/pages\/pages\/thunderbolt/i,
  /bundle\.min\.(?:js|css)/i,
];

const isUsableEventImage = (imageUrl) =>
  Boolean(imageUrl) &&
  !invalidEventImagePatterns.some((pattern) => pattern.test(imageUrl));

const isLikelyImageUrl = (imageUrl) => {
  if (!isUsableEventImage(imageUrl)) {
    return false;
  }

  if (/\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(imageUrl)) {
    return true;
  }

  if (
    /(?:[?&](?:url|image|img|src)=|\/_next\/image\b|\/images?\b|\/media\b|\/photo\b|\/poster\b|\/banner\b|\/hero\b)/i.test(
      imageUrl,
    )
  ) {
    return true;
  }

  return false;
};

const resolveAbsoluteUrl = (value, baseUrl = "") => {
  const normalizedValue = asText(value);

  if (!normalizedValue) {
    return "";
  }

  try {
    return new URL(normalizeImageProtocol(normalizedValue), baseUrl).toString();
  } catch {
    return normalizeImageProtocol(normalizedValue);
  }
};

const parseHtmlAttributes = (tag) => {
  const attributes = {};
  const attributePattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match = attributePattern.exec(tag);

  while (match) {
    const attributeName = String(match[1] || "").toLowerCase();
    const attributeValue = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[attributeName] = attributeValue;
    match = attributePattern.exec(tag);
  }

  return attributes;
};

const collectJsonImageCandidates = (value, baseUrl, bucket) => {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    const resolvedUrl = resolveAbsoluteUrl(value, baseUrl);

    if (resolvedUrl) {
      bucket.push(resolvedUrl);
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonImageCandidates(item, baseUrl, bucket));
    return;
  }

  if (typeof value === "object") {
    collectJsonImageCandidates(
      value.image || value.images || value.thumbnailUrl || value.thumbnail,
      baseUrl,
      bucket,
    );
  }
};

const extractSourceImageCandidates = (html, baseUrl) => {
  const candidates = [];
  const preferredMetaKeys = new Set([
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
    "image",
    "thumbnailurl",
  ]);

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  metaTags.forEach((tag) => {
    const attributes = parseHtmlAttributes(tag);
    const attributeKey = String(
      attributes.property || attributes.name || attributes.itemprop || "",
    ).toLowerCase();
    const content = resolveAbsoluteUrl(attributes.content || "", baseUrl);

    if (preferredMetaKeys.has(attributeKey) && content) {
      candidates.push(content);
    }
  });

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  linkTags.forEach((tag) => {
    const attributes = parseHtmlAttributes(tag);
    const rel = String(attributes.rel || "").toLowerCase();
    const href = resolveAbsoluteUrl(attributes.href || "", baseUrl);

    if ((rel.includes("image_src") || rel.includes("preload")) && href) {
      candidates.push(href);
    }
  });

  const scriptTags =
    html.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ) || [];

  scriptTags.forEach((tag) => {
    const contentMatch = tag.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    const scriptContent = String(contentMatch?.[1] || "").trim();

    if (!scriptContent) {
      return;
    }

    try {
      const parsedContent = JSON.parse(scriptContent);
      collectJsonImageCandidates(parsedContent, baseUrl, candidates);
    } catch {
      // Ignore invalid JSON-LD blocks and continue parsing the page.
    }
  });

  return dedupeValues(
    candidates
      .map((candidate) => optimizeImageUrl(candidate))
      .filter((candidate) => isLikelyImageUrl(candidate)),
  );
};

const fetchSourceImageCandidates = async (eventUrl) => {
  if (!eventUrl) {
    return [];
  }

  if (sourceImageCache.has(eventUrl)) {
    return sourceImageCache.get(eventUrl);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SOURCE_IMAGE_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(eventUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; EventcinityBot/1.0; +https://eventcinity.local)",
      },
    });

    if (!response.ok) {
      sourceImageCache.set(eventUrl, []);
      return [];
    }

    const contentType = String(response.headers.get("content-type") || "");

    if (!contentType.includes("text/html")) {
      sourceImageCache.set(eventUrl, []);
      return [];
    }

    const html = await response.text();
    const resolvedUrl = response.url || eventUrl;
    const candidates = extractSourceImageCandidates(html, resolvedUrl);

    sourceImageCache.set(eventUrl, candidates);
    return candidates;
  } catch (error) {
    sourceImageCache.set(eventUrl, []);
    console.warn(`[eventSync] Unable to scrape source images for ${eventUrl}:`, error.message);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

const updateNumericSearchParams = (searchParams, keys, nextValue) => {
  let updated = false;

  keys.forEach((key) => {
    if (searchParams.has(key)) {
      searchParams.set(key, String(nextValue));
      updated = true;
    }
  });

  return updated;
};

const optimizeCloudinaryImageUrl = (imageUrl, width = TARGET_IMAGE_WIDTH) => {
  if (!imageUrl.includes("/image/upload/")) {
    return imageUrl;
  }

  const [prefix, suffix] = imageUrl.split("/image/upload/");

  if (!suffix) {
    return imageUrl;
  }

  const firstSegment = suffix.split("/")[0];
  const alreadyHasTransforms = firstSegment && !/^v\d+$/i.test(firstSegment);

  if (alreadyHasTransforms) {
    return imageUrl;
  }

  return `${prefix}/image/upload/f_auto,q_auto:good,w_${width}/${suffix}`;
};

const optimizeGoogleHostedImageUrl = (imageUrl, width = TARGET_IMAGE_WIDTH) => {
  const targetHeight = Math.max(900, Math.round(width * 0.625));

  try {
    const url = new URL(imageUrl);
    const isGoogleHosted =
      /(googleusercontent\.com|ggpht\.com|googleapis\.com|gstatic\.com)$/i.test(
        url.hostname,
      );

    if (!isGoogleHosted) {
      return imageUrl;
    }

    const updatedWidth = updateNumericSearchParams(
      url.searchParams,
      ["w", "width", "sz", "s"],
      width,
    );
    const updatedHeight = updateNumericSearchParams(
      url.searchParams,
      ["h", "height"],
      targetHeight,
    );
    const updatedQuality = updateNumericSearchParams(
      url.searchParams,
      ["q", "quality"],
      90,
    );

    if (updatedWidth || updatedHeight || updatedQuality) {
      return url.toString();
    }
  } catch {
    return imageUrl;
  }

  if (/=([a-z0-9,_-]+)$/i.test(imageUrl)) {
    return imageUrl.replace(
      /=([a-z0-9,_-]+)$/i,
      `=w${width}-h${targetHeight}-p-k-no-nu`,
    );
  }

  return imageUrl;
};

const optimizeGenericImageUrl = (imageUrl, width = TARGET_IMAGE_WIDTH) => {
  const targetHeight = Math.max(900, Math.round(width * 0.625));

  try {
    const url = new URL(imageUrl);
    let updated = false;

    updated =
      updateNumericSearchParams(
        url.searchParams,
        ["w", "width", "maxwidth", "imwidth"],
        width,
      ) || updated;
    updated =
      updateNumericSearchParams(
        url.searchParams,
        ["h", "height", "maxheight"],
        targetHeight,
      ) || updated;
    updated =
      updateNumericSearchParams(url.searchParams, ["q", "quality"], 90) ||
      updated;

    return updated ? url.toString() : imageUrl;
  } catch {
    return imageUrl;
  }
};

const optimizeImageUrl = (imageUrl) => {
  if (!imageUrl || /^data:/i.test(imageUrl)) {
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl);

    if (url.hostname.includes("images.unsplash.com")) {
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "max");
      url.searchParams.set("fm", "jpg");
      url.searchParams.set("q", "90");
      url.searchParams.set("w", String(TARGET_IMAGE_WIDTH));
      return url.toString();
    }
  } catch {
    return imageUrl;
  }

  return optimizeGenericImageUrl(
    optimizeGoogleHostedImageUrl(optimizeCloudinaryImageUrl(imageUrl)),
  );
};

const getImageCandidateScore = (imageUrl) => {
  let score = 0;
  const widthHints = Array.from(
    imageUrl.matchAll(/(?:[?&](?:w|width|sz|s)=|=w|=s)(\d{2,4})/gi),
  ).map((match) => Number(match[1]));

  if (widthHints.length > 0) {
    score += Math.max(...widthHints) / 400;
  }

  if (/original|full|maxres|hero|banner/i.test(imageUrl)) {
    score += 5;
  }

  if (/thumbnail|thumb|small|icon/i.test(imageUrl)) {
    score -= 5;
  }

  try {
    const url = new URL(imageUrl);

    if (url.hostname.includes("images.unsplash.com")) {
      score += 6;
    }

    if (url.hostname.includes("cloudinary.com")) {
      score += 5;
    }

    if (
      /(googleusercontent\.com|ggpht\.com|googleapis\.com)$/i.test(url.hostname)
    ) {
      score += 4;
    }

    if (
      url.hostname.includes("encrypted-tbn") ||
      url.hostname.includes("gstatic.com")
    ) {
      score -= 4;
    }
  } catch {
    return score;
  }

  return score;
};

const chooseBestImageUrl = (candidates, sourcePreferredUrls = []) => {
  const normalizedCandidates = dedupeValues(candidates);
  const sourcePreferredSet = new Set(sourcePreferredUrls);

  if (!normalizedCandidates.length) {
    return "";
  }

  return normalizedCandidates.sort((left, right) => {
    const leftScore =
      getImageCandidateScore(left) + (sourcePreferredSet.has(left) ? 8 : 0);
    const rightScore =
      getImageCandidateScore(right) + (sourcePreferredSet.has(right) ? 8 : 0);

    return rightScore - leftScore;
  })[0];
};

const getImageUrl = (event) => {
  const candidates = Array.from(
    new Set(
      [
        ...collectImageCandidates(event.image),
        ...collectImageCandidates(event.imageUrl),
        ...collectImageCandidates(event.images),
        ...collectImageCandidates(event.thumbnail_url),
        ...collectImageCandidates(event.thumbnail),
        ...collectImageCandidates(event.logo),
        ...collectImageCandidates(event.rawPayload?.image),
        ...collectImageCandidates(event.rawPayload?.images),
        ...collectImageCandidates(event.rawPayload?.thumbnail),
        ...collectImageCandidates(event.rawPayload?.thumbnail_url),
        ...collectImageCandidates(event.rawPayload?.original),
        ...collectImageCandidates(event.rawPayload?.large),
        ...collectImageCandidates(event.rawPayload?.full),
        ...collectImageCandidates(event.rawPayload?.photos),
      ]
        .filter(Boolean)
        .map((candidate) => optimizeImageUrl(candidate)),
    ),
  );

  const usableCandidates = candidates.filter((candidate) =>
    isUsableEventImage(candidate),
  );

  if (usableCandidates.length > 0) {
    return chooseBestImageUrl(usableCandidates);
  }

  if (!candidates.length) {
    return "";
  }

  return chooseBestImageUrl(candidates);
};

const shouldScrapeSourceImages = (event) => {
  if (!event?.eventUrl) {
    return false;
  }

  if (!event.imageUrl) {
    return true;
  }

  return getImageCandidateScore(event.imageUrl) < 6;
};

const enrichEventWithSourceImages = async (event) => {
  if (!shouldScrapeSourceImages(event)) {
    return event;
  }

  const scrapedImageCandidates = await fetchSourceImageCandidates(event.eventUrl);

  if (!scrapedImageCandidates.length) {
    return event;
  }

  const nextImageUrl = chooseBestImageUrl(
    [event.imageUrl, ...scrapedImageCandidates].filter(Boolean),
    scrapedImageCandidates,
  );

  return {
    ...event,
    imageUrl: nextImageUrl || event.imageUrl,
    rawPayload: {
      ...(event.rawPayload || {}),
      sourceImageCandidates: scrapedImageCandidates.slice(0, 6),
    },
  };
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  );

  return results;
};

const inferCategory = (event) => {
  const text = [event.title, event.description, event.venue, event.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const match = CATEGORY_RULES.find(({ keywords }) =>
    keywords.some((keyword) => text.includes(keyword)),
  );

  return match?.category || "Community";
};

const detectProvince = (event) => {
  const text = [
    event.title,
    event.venue,
    event.address,
    event.location,
    event.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (METRO_MANILA_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return "Metro Manila";
  }

  const matchedProvince = PROVINCES.find((province) =>
    text.includes(province.toLowerCase()),
  );

  return matchedProvince || "";
};

const normalizeSerpApiEvent = (rawEvent, query, index) => {
  const title =
    asText(rawEvent.title || rawEvent.name) || `Untitled Event ${index + 1}`;
  const venue = getVenue(rawEvent);
  const address = getAddress(rawEvent);
  const location = [venue, address].filter(Boolean).join(", ") || "Philippines";
  const description = asText(
    rawEvent.description || rawEvent.ticket_info || rawEvent.info,
  );
  const startDate = getStartDate(rawEvent);
  const timeLabel = getTimeLabel(rawEvent);
  const eventUrl = asText(rawEvent.link || rawEvent.event_link || rawEvent.url);
  const eventId =
    asText(rawEvent.event_id || rawEvent.id) ||
    slugify(`${title}-${startDate}-${location}-${eventUrl || index}`);

  const normalizedEvent = {
    eventId,
    title,
    description,
    venue,
    address,
    location,
    startDate,
    timeLabel,
    imageUrl: getImageUrl(rawEvent),
    eventUrl,
    organizer: asText(rawEvent.organizer || rawEvent.host),
    source: "serpapi",
    sourceQuery: query,
    rawPayload: rawEvent,
    lastSyncedAt: new Date(),
  };

  normalizedEvent.province = detectProvince(normalizedEvent);
  normalizedEvent.category = inferCategory(normalizedEvent);

  return normalizedEvent;
};

const fetchSerpApiEventsForQuery = async (query) => {
  const results = await getJson({
    engine: "google_events",
    q: query.query,
    location: DEFAULT_LOCATION,
    hl: "en",
    gl: "ph",
    start: query.start ?? 0,
    htichips: query.htichips || undefined,
    no_cache: false,
    api_key: process.env.SERPAPI_KEY,
  });

  const pageEvents = Array.isArray(results?.events_results)
    ? results.events_results
    : [];

  return {
    events: pageEvents.slice(0, EVENTS_PER_PAGE),
    pageStarts: [query.start ?? 0],
    searchPlan: {
      query: query.query,
      htichips: query.htichips || "",
      start: query.start ?? 0,
      count: pageEvents.length,
    },
  };
};

export const refreshEventCatalog = async ({
  query = DEFAULT_QUERY,
  reason = "manual",
} = {}) => {
  if (!process.env.SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY is required to refresh the event catalog.");
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshState.isRefreshing = true;
  refreshState.lastAttemptAt = new Date().toISOString();
  refreshState.lastQuery = query;

  refreshPromise = (async () => {
    const syncState = await normalizeSyncStateBudget(await loadSyncState());
    const searchPlans = buildSearchPlans(query);
    const availableCredits = Math.max(
      0,
      DAILY_CREDIT_LIMIT - Number(syncState.creditsUsedToday || 0),
    );
    const attemptedSearchKeys = new Set(syncState.attemptedSearchKeys || []);
    const plansToRun = searchPlans
      .filter((searchPlan) => !attemptedSearchKeys.has(searchPlan.key))
      .slice(0, availableCredits);

    if (plansToRun.length === 0) {
      refreshState.lastError = null;
      refreshState.lastResultCount = 0;
      refreshState.lastPageStarts = [];
      refreshState.lastQuery = query;
      refreshState.nextScheduledAt =
        syncState.nextScheduledAt?.toISOString?.() ||
        getNextPhilippineMidnightDate().toISOString();

      return {
        query,
        reason,
        attemptedQueries: [],
        requestedCount: getDailyRequestedResults(),
        fetchedCount: 0,
        count: 0,
        insertedCount: 0,
        updatedCount: 0,
        pageStarts: [],
        searchPlans: [],
        refreshedAt: syncState.lastSuccessAt?.toISOString?.() || null,
        skipped: true,
        skipReason:
          availableCredits <= 0
            ? "Daily SerpAPI credit budget already reached."
            : "All planned searches already ran for today.",
        budgetDate: syncState.budgetDate,
        creditsUsedToday: syncState.creditsUsedToday,
        dailyCreditLimit: DAILY_CREDIT_LIMIT,
      };
    }

    const rawEvents = [];
    const pageStarts = [];
    const executedSearchPlans = [];
    const attemptedQueries = [];

    for (const searchPlan of plansToRun) {
      syncState.creditsUsedToday = Math.min(
        DAILY_CREDIT_LIMIT,
        Number(syncState.creditsUsedToday || 0) + 1,
      );
      syncState.attemptedSearchKeys = ensureUniqueStrings([
        ...(syncState.attemptedSearchKeys || []),
        searchPlan.key,
      ]);
      syncState.lastAttemptAt = new Date();
      await syncState.save();

      const result = await fetchSerpApiEventsForQuery(searchPlan);
      rawEvents.push(...result.events);
      pageStarts.push(...result.pageStarts);
      executedSearchPlans.push(result.searchPlan);
      attemptedQueries.push(searchPlan.query);
    }

    const normalizedEvents = rawEvents
      .map((event, index) => normalizeSerpApiEvent(event, query, index))
      .filter((event) => event.title);
    const dedupedEvents = Array.from(
      new Map(normalizedEvents.map((event) => [event.eventId, event])).values(),
    );
    const enrichedEvents = await mapWithConcurrency(
      dedupedEvents,
      SOURCE_IMAGE_FETCH_CONCURRENCY,
      enrichEventWithSourceImages,
    );

    const existingEventIds = new Set(
      (
        await Event.find({
          eventId: { $in: enrichedEvents.map((event) => event.eventId) },
        })
          .select("eventId")
          .lean()
      ).map((event) => String(event.eventId || "").trim()),
    );

    if (enrichedEvents.length > 0) {
      await Event.bulkWrite(
        enrichedEvents.map((event) => ({
          updateOne: {
            filter: { eventId: event.eventId },
            update: {
              $set: event,
              $currentDate: {
                updatedAt: true,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    const insertedCount = enrichedEvents.filter(
      (event) => !existingEventIds.has(event.eventId),
    ).length;
    const updatedCount = enrichedEvents.length - insertedCount;
    const refreshedAt = new Date();

    syncState.lastSuccessAt = refreshedAt;
    syncState.lastError = null;
    syncState.lastQuery = query;
    syncState.lastResultCount = enrichedEvents.length;
    syncState.lastFetchedCount = rawEvents.length;
    syncState.lastInsertedCount = insertedCount;
    syncState.lastUpdatedCount = updatedCount;
    syncState.lastPageStarts = pageStarts;
    syncState.lastSearchPlans = executedSearchPlans;
    syncState.nextScheduledAt = getNextPhilippineMidnightDate();
    await syncState.save();

    refreshState.lastSuccessAt = refreshedAt.toISOString();
    refreshState.lastError = null;
    refreshState.lastResultCount = enrichedEvents.length;
    refreshState.lastPageStarts = pageStarts;
    refreshState.lastQuery = query;
    refreshState.nextScheduledAt = syncState.nextScheduledAt.toISOString();

    console.log(
      `[eventSync] Synced ${enrichedEvents.length} SerpAPI events (${reason}) using ${executedSearchPlans.length} search plan(s)`,
    );

    return {
      query,
      attemptedQueries,
      reason,
      requestedCount: getDailyRequestedResults(),
      fetchedCount: rawEvents.length,
      count: enrichedEvents.length,
      insertedCount,
      updatedCount,
      pageStarts,
      searchPlans: executedSearchPlans,
      refreshedAt: refreshedAt.toISOString(),
      skipped: false,
      budgetDate: syncState.budgetDate,
      creditsUsedToday: syncState.creditsUsedToday,
      dailyCreditLimit: DAILY_CREDIT_LIMIT,
    };
  })()
    .catch((error) => {
      refreshState.lastError = error.message;
      EventSyncState.findOneAndUpdate(
        { key: EVENT_SYNC_STATE_KEY },
        {
          $set: {
            lastError: error.message,
            nextScheduledAt: getNextPhilippineMidnightDate(),
          },
        },
      ).catch(() => {});
      console.error("[eventSync] Refresh failed:", error);
      throw error;
    })
    .finally(() => {
      refreshState.isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
};

export const getStoredEvents = async (location = "All Philippines") => {
  const query = {};

  if (location && location !== "All Philippines") {
    const pattern = new RegExp(escapeRegex(location), "i");
    query.$or = [
      { province: location },
      { location: pattern },
      { address: pattern },
      { venue: pattern },
    ];
  }

  return Event.find(query).sort({ updatedAt: -1, title: 1 }).lean();
};

export const getEventCatalogStatus = async () => {
  const syncState = await normalizeSyncStateBudget(await loadSyncState());
  const storedCount = await Event.countDocuments();

  return {
    ...refreshState,
    storedCount,
    maxResults: getDailyRequestedResults(),
    fetchMode: AUTO_REFRESH_ENABLED ? "startup-and-daily" : "manual-only",
    autoRefreshOnDeploy: AUTO_REFRESH_ENABLED && AUTO_REFRESH_ON_STARTUP,
    dailyCreditLimit: DAILY_CREDIT_LIMIT,
    creditsUsedToday: Number(syncState.creditsUsedToday || 0),
    budgetDate: syncState.budgetDate,
    attemptedSearchCount: Array.isArray(syncState.attemptedSearchKeys)
      ? syncState.attemptedSearchKeys.length
      : 0,
    lastSuccessAt: syncState.lastSuccessAt?.toISOString?.() || refreshState.lastSuccessAt,
    lastAttemptAt: syncState.lastAttemptAt?.toISOString?.() || refreshState.lastAttemptAt,
    lastError: syncState.lastError || refreshState.lastError,
    lastQuery: syncState.lastQuery || refreshState.lastQuery,
    lastResultCount: Number(syncState.lastResultCount || refreshState.lastResultCount || 0),
    lastFetchedCount: Number(syncState.lastFetchedCount || 0),
    lastInsertedCount: Number(syncState.lastInsertedCount || 0),
    lastUpdatedCount: Number(syncState.lastUpdatedCount || 0),
    lastPageStarts: Array.isArray(syncState.lastPageStarts)
      ? syncState.lastPageStarts
      : refreshState.lastPageStarts,
    lastSearchPlans: Array.isArray(syncState.lastSearchPlans)
      ? syncState.lastSearchPlans
      : [],
    nextScheduledAt:
      syncState.nextScheduledAt?.toISOString?.() ||
      refreshState.nextScheduledAt ||
      getNextPhilippineMidnightDate().toISOString(),
    timeZone: PHILIPPINE_TIME_ZONE,
    location: DEFAULT_LOCATION,
  };
};

const scheduleNextAutomaticRefresh = async () => {
  if (!AUTO_REFRESH_ENABLED) {
    refreshState.nextScheduledAt = null;
    return;
  }

  const nextScheduledAt = getNextPhilippineMidnightDate();
  refreshState.nextScheduledAt = nextScheduledAt.toISOString();

  await EventSyncState.findOneAndUpdate(
    { key: EVENT_SYNC_STATE_KEY },
    {
      $setOnInsert: {
        key: EVENT_SYNC_STATE_KEY,
        budgetDate: getPhilippineDateKey(),
      },
      $set: {
        nextScheduledAt,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  if (scheduledRefreshTimer) {
    clearTimeout(scheduledRefreshTimer);
  }

  scheduledRefreshTimer = setTimeout(async () => {
    try {
      await refreshEventCatalog({ reason: "daily-midnight" });
    } catch (error) {
      console.error("[eventSync] Scheduled refresh failed:", error);
    } finally {
      await scheduleNextAutomaticRefresh();
    }
  }, getMillisecondsUntilNextPhilippineMidnight());

  if (typeof scheduledRefreshTimer.unref === "function") {
    scheduledRefreshTimer.unref();
  }
};

export const scheduleAutomaticEventCatalogRefresh = async () => {
  await scheduleNextAutomaticRefresh();

  return {
    enabled: AUTO_REFRESH_ENABLED,
    nextScheduledAt: refreshState.nextScheduledAt,
    dailyCreditLimit: DAILY_CREDIT_LIMIT,
    filters: DEFAULT_SEARCH_FILTERS.slice(0, DAILY_CREDIT_LIMIT),
  };
};

export const triggerStartupEventCatalogRefresh = async () => {
  if (!AUTO_REFRESH_ENABLED || !AUTO_REFRESH_ON_STARTUP) {
    return {
      skipped: true,
      reason: "startup-disabled",
    };
  }

  return refreshEventCatalog({ reason: "startup" });
};
