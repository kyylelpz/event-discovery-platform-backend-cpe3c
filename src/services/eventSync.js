import { getJson } from "serpapi";
import Event from "../models/Event.js";

const DEFAULT_LOCATION = process.env.EVENTS_REFRESH_LOCATION || "Philippines";
const DEFAULT_QUERY = process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
const FALLBACK_QUERY = process.env.EVENTS_FALLBACK_QUERY || "Concerts in the Philippines";
const EVENTS_PER_PAGE = 10;
const MAX_RESULTS = Number(process.env.EVENTS_REFRESH_MAX_RESULTS || 200);
const MAX_PAGES = Math.max(1, Math.ceil(MAX_RESULTS / EVENTS_PER_PAGE));

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
  lastPageStarts: [],
};

let refreshPromise = null;

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

  const matchedProvince = PROVINCES.find((province) =>
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

    const pageEvents = Array.isArray(results?.events_results) ? results.events_results : [];

    pageStarts.push(start);
    allEvents.push(...pageEvents);

    // Stop when SerpAPI has no more pages or returns a partial final page.
    if (pageEvents.length < EVENTS_PER_PAGE || allEvents.length >= MAX_RESULTS) {
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
  const queriesToTry = Array.from(new Set([query, FALLBACK_QUERY].filter(Boolean)));

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

export const refreshEventCatalog = async ({ query = DEFAULT_QUERY, reason = "manual" } = {}) => {
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

    await Event.deleteMany({ source: "serpapi" });

    if (dedupedEvents.length > 0) {
      await Event.insertMany(dedupedEvents, { ordered: false });
    }

    refreshState.lastSuccessAt = new Date().toISOString();
    refreshState.lastError = null;
    refreshState.lastResultCount = dedupedEvents.length;
    refreshState.lastPageStarts = pageStarts;
    refreshState.lastQuery = resolvedQuery;

    console.log(
      `[eventSync] Seeded ${dedupedEvents.length} events from SerpAPI (${reason}) using query "${resolvedQuery}"`,
    );

    return {
      query: resolvedQuery,
      attemptedQueries,
      reason,
      requestedCount: MAX_RESULTS,
      fetchedCount: rawEvents.length,
      count: dedupedEvents.length,
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
