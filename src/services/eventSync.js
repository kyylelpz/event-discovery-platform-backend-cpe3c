import { getJson } from "serpapi";
import Event from "../models/Event.js";

const DEFAULT_QUERY = process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = Number(process.env.EVENTS_REFRESH_INTERVAL_MS || DEFAULT_INTERVAL_MS);

const LUZON_PROVINCES = [
  "Metro Manila",
  "Batangas",
  "Cavite",
  "Laguna",
  "Rizal",
  "Bulacan",
  "Pampanga",
  "Bataan",
  "Nueva Ecija",
  "Tarlac",
  "Zambales",
  "Pangasinan",
  "La Union",
  "Benguet",
  "Quezon",
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
  { category: "Music", keywords: ["concert", "music", "festival", "gig", "live", "dj", "band", "jazz"] },
  { category: "Art & Culture", keywords: ["museum", "art", "gallery", "cultural", "culture", "exhibit", "theater"] },
  { category: "Business", keywords: ["conference", "summit", "networking", "expo", "business", "startup", "forum"] },
  { category: "Food & Drink", keywords: ["food", "drink", "dinner", "tasting", "culinary", "market", "coffee"] },
  { category: "Tech", keywords: ["tech", "developer", "software", "ai", "product", "hackathon", "web3"] },
];

const refreshState = {
  isRefreshing: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastQuery: DEFAULT_QUERY,
  lastResultCount: 0,
};

let refreshPromise = null;
let refreshTimer = null;

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
  asText(event.venue?.name || event.venue?.title || event.venue_name || event.location);

const getAddress = (event) => asText(event.address || event.location);

const getImageUrl = (event) =>
  asText(event.thumbnail || event.image || event.imageUrl || event.thumbnail_url);

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
  const text = [event.title, event.venue, event.address, event.location, event.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (METRO_MANILA_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return "Metro Manila";
  }

  const matchedProvince = LUZON_PROVINCES.find((province) =>
    text.includes(province.toLowerCase()),
  );

  return matchedProvince || "";
};

const normalizeSerpApiEvent = (rawEvent, query, index) => {
  const title = asText(rawEvent.title || rawEvent.name) || `Untitled Event ${index + 1}`;
  const venue = getVenue(rawEvent);
  const address = getAddress(rawEvent);
  const location = [venue, address].filter(Boolean).join(", ") || "Philippines";
  const description = asText(rawEvent.description || rawEvent.ticket_info || rawEvent.info);
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

const fetchSerpApiEvents = async (query = DEFAULT_QUERY) => {
  const results = await getJson({
    engine: "google_events",
    q: query,
    hl: "en",
    gl: "ph",
    api_key: process.env.SERPAPI_KEY,
  });

  return Array.isArray(results?.events_results) ? results.events_results : [];
};

export const refreshEventCatalog = async ({ query = DEFAULT_QUERY, reason = "manual" } = {}) => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshState.isRefreshing = true;
  refreshState.lastAttemptAt = new Date().toISOString();
  refreshState.lastQuery = query;

  refreshPromise = (async () => {
    const rawEvents = await fetchSerpApiEvents(query);
    const normalizedEvents = rawEvents
      .map((event, index) => normalizeSerpApiEvent(event, query, index))
      .filter((event) => event.title);

    await Event.deleteMany({ source: "serpapi" });

    if (normalizedEvents.length > 0) {
      await Event.insertMany(normalizedEvents, { ordered: false });
    }

    refreshState.lastSuccessAt = new Date().toISOString();
    refreshState.lastError = null;
    refreshState.lastResultCount = normalizedEvents.length;

    console.log(`[eventSync] Refreshed ${normalizedEvents.length} events from SerpAPI (${reason})`);

    return {
      query,
      reason,
      count: normalizedEvents.length,
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

export const ensureEventCatalog = async () => {
  const count = await Event.countDocuments();

  if (count === 0) {
    await refreshEventCatalog({ reason: "cache-miss" });
  }
};

export const getStoredEvents = async (location = "All Luzon") => {
  const query = {};

  if (location && location !== "All Luzon") {
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
  const nextRefreshAt = refreshState.lastSuccessAt
    ? new Date(new Date(refreshState.lastSuccessAt).getTime() + REFRESH_INTERVAL_MS).toISOString()
    : null;

  return {
    ...refreshState,
    storedCount,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    nextRefreshAt,
  };
};

export const startEventRefreshScheduler = () => {
  if (refreshTimer) {
    return;
  }

  refreshEventCatalog({ reason: "startup" }).catch((error) => {
    console.error("[eventSync] Initial refresh failed:", error.message);
  });

  refreshTimer = setInterval(() => {
    refreshEventCatalog({ reason: "interval" }).catch((error) => {
      console.error("[eventSync] Scheduled refresh failed:", error.message);
    });
  }, REFRESH_INTERVAL_MS);

  refreshTimer.unref?.();
};
