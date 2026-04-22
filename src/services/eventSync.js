import { getJson } from "serpapi";
import Event from "../models/Event.js";

const DEFAULT_LOCATION = process.env.EVENTS_REFRESH_LOCATION || "Philippines";
const DEFAULT_QUERY =
  process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
const FALLBACK_QUERY =
  process.env.EVENTS_FALLBACK_QUERY || "Concerts in the Philippines";
const EVENTS_PER_PAGE = 10;
const MAX_RESULTS = Number(process.env.EVENTS_REFRESH_MAX_RESULTS || 200);
const MAX_PAGES = Math.max(1, Math.ceil(MAX_RESULTS / EVENTS_PER_PAGE));
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
};

let refreshPromise = null;
const sourceImageCache = new Map();

const slugify = (value) =>
  String(value || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const allEvents = [];
  const pageStarts = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const start = pageIndex * EVENTS_PER_PAGE;

    const results = await getJson({
      engine: "google_events",
      q: query,
      location: DEFAULT_LOCATION,
      hl: "en",
      gl: "ph",
      start,
      api_key: process.env.SERPAPI_KEY,
    });

    const pageEvents = Array.isArray(results?.events_results)
      ? results.events_results
      : [];

    pageStarts.push(start);
    allEvents.push(...pageEvents);

    // Stop when SerpAPI has no more pages or returns a partial final page.
    if (
      pageEvents.length < EVENTS_PER_PAGE ||
      allEvents.length >= MAX_RESULTS
    ) {
      break;
    }
  }

  return {
    events: allEvents.slice(0, MAX_RESULTS),
    pageStarts,
  };
};

const fetchSerpApiEvents = async (query = DEFAULT_QUERY) => {
  const attemptedQueries = [];
  const queriesToTry = Array.from(
    new Set([query, FALLBACK_QUERY].filter(Boolean)),
  );

  for (const queryToTry of queriesToTry) {
    attemptedQueries.push(queryToTry);
    const result = await fetchSerpApiEventsForQuery(queryToTry);

    if (result.events.length > 0) {
      return {
        ...result,
        resolvedQuery: queryToTry,
        attemptedQueries,
      };
    }
  }

  return {
    events: [],
    pageStarts: [],
    resolvedQuery: query,
    attemptedQueries,
  };
};

export const refreshEventCatalog = async ({
  query = DEFAULT_QUERY,
  reason = "manual",
} = {}) => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshState.isRefreshing = true;
  refreshState.lastAttemptAt = new Date().toISOString();
  refreshState.lastQuery = query;

  refreshPromise = (async () => {
    const {
      events: rawEvents,
      pageStarts,
      resolvedQuery,
      attemptedQueries,
    } = await fetchSerpApiEvents(query);
    const normalizedEvents = rawEvents
      .map((event, index) => normalizeSerpApiEvent(event, resolvedQuery, index))
      .filter((event) => event.title);
    const dedupedEvents = Array.from(
      new Map(normalizedEvents.map((event) => [event.eventId, event])).values(),
    );
    const enrichedEvents = await mapWithConcurrency(
      dedupedEvents,
      SOURCE_IMAGE_FETCH_CONCURRENCY,
      enrichEventWithSourceImages,
    );

    await Event.deleteMany({ source: "serpapi" });

    if (enrichedEvents.length > 0) {
      await Event.insertMany(enrichedEvents, { ordered: false });
    }

    refreshState.lastSuccessAt = new Date().toISOString();
    refreshState.lastError = null;
    refreshState.lastResultCount = enrichedEvents.length;
    refreshState.lastPageStarts = pageStarts;
    refreshState.lastQuery = resolvedQuery;

    console.log(
      `[eventSync] Seeded ${enrichedEvents.length} events from SerpAPI (${reason}) using query "${resolvedQuery}"`,
    );

    return {
      query: resolvedQuery,
      attemptedQueries,
      reason,
      requestedCount: MAX_RESULTS,
      fetchedCount: rawEvents.length,
      count: enrichedEvents.length,
      pageStarts,
      refreshedAt: refreshState.lastSuccessAt,
    };
  })()
    .catch((error) => {
      refreshState.lastError = error.message;
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
  const storedCount = await Event.countDocuments();

  return {
    ...refreshState,
    storedCount,
    maxResults: MAX_RESULTS,
    fetchMode: "manual-only",
    autoRefreshOnDeploy: false,
    location: DEFAULT_LOCATION,
  };
};
