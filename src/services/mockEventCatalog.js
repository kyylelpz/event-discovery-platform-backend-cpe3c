import MockEvent from "../models/MockEvent.js";
import { mockEvents } from "../data/mockEvents.js";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let seedPromise = null;

const normalizeMockEventRecord = (event) => ({
  eventId: String(event.eventId || event.id || "").trim(),
  title: String(event.title || "").trim(),
  description: String(event.description || "").trim(),
  category: String(event.category || "Community").trim(),
  province: String(event.province || "").trim(),
  location: String(event.location || event.venue || "Philippines").trim(),
  venue: String(event.venue || "").trim(),
  address: String(event.address || "").trim(),
  startDate: String(event.startDate || event.date || "").trim(),
  timeLabel: String(event.timeLabel || event.time || "").trim(),
  imageUrl: String(event.imageUrl || event.image || "").trim(),
  eventUrl: String(event.eventUrl || event.url || "").trim(),
  organizer: String(event.organizer || event.host || "Eventcinity").trim(),
  createdBy: String(event.createdBy || "").trim().toLowerCase(),
  attendeeCount: Number(event.attendeeCount || 0),
  savedCount: Number(event.savedCount || 0),
  reactions: Number(event.reactions || 0),
  isFeatured: Boolean(event.isFeatured),
  source: "mock",
  rawPayload: event,
  lastSeededAt: new Date(),
});

export const syncMockEventCatalog = async ({ reason = "manual" } = {}) => {
  const normalizedEvents = mockEvents
    .map((event) => normalizeMockEventRecord(event))
    .filter((event) => event.eventId && event.title);

  if (normalizedEvents.length === 0) {
    return {
      reason,
      count: 0,
      seededAt: new Date().toISOString(),
    };
  }

  await MockEvent.bulkWrite(
    normalizedEvents.map((event) => ({
      updateOne: {
        filter: { eventId: event.eventId },
        update: {
          $set: event,
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  await MockEvent.deleteMany({
    source: "mock",
    eventId: {
      $nin: normalizedEvents.map((event) => event.eventId),
    },
  });

  const seededAt = new Date().toISOString();
  console.log(
    `[mockEventCatalog] Synced ${normalizedEvents.length} mock events (${reason})`,
  );

  return {
    reason,
    count: normalizedEvents.length,
    seededAt,
  };
};

export const ensureMockEventCatalogSeeded = async () => {
  const existingCount = await MockEvent.countDocuments();

  if (existingCount > 0) {
    return {
      count: existingCount,
      seeded: false,
    };
  }

  if (!seedPromise) {
    seedPromise = syncMockEventCatalog({ reason: "startup" }).finally(() => {
      seedPromise = null;
    });
  }

  return seedPromise;
};

export const getStoredMockEvents = async (location = "All Philippines") => {
  await ensureMockEventCatalogSeeded();

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

  return MockEvent.find(query).sort({ updatedAt: -1, title: 1 }).lean();
};

export const getMockEventCatalogStatus = async () => ({
  storedCount: await MockEvent.countDocuments(),
  configuredCount: mockEvents.length,
});
