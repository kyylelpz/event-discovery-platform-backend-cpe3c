import express from "express";
import mongoose from "mongoose";
import protect from "../middleware/protect.js";
import CreatedEvent from "../models/CreatedEvent.js";
import Event from "../models/Event.js";
import MockEvent from "../models/MockEvent.js";
import SavedEvent from "../models/SavedEvent.js";
import UserEventInteraction from "../models/UserEventInteraction.js";
import User from "../models/User.js";
import Venue from "../models/Venue.js";
import MockUser from "../models/MockUser.js";
import {
  getEventCatalogStatus,
  getStoredEvents,
  refreshEventCatalog,
} from "../services/eventSync.js";
import { cloudinary, upload } from "../utils/cloudinary.js";

const router = express.Router();

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCreatedEventsQuery = ({ location, userId } = {}) => {
  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (location && location !== "All Philippines") {
    const pattern = new RegExp(escapeRegex(location), "i");
    query.$or = [
      { province: location },
      { location: pattern },
      { address: pattern },
      { venue: pattern },
    ];
  }

  return query;
};

const buildEventIdentifierQuery = (eventId) => {
  const normalizedEventId = String(eventId || "").trim();

  if (!normalizedEventId) {
    return { eventId: "" };
  }

  return mongoose.isValidObjectId(normalizedEventId)
    ? {
        $or: [{ eventId: normalizedEventId }, { _id: normalizedEventId }],
      }
    : { eventId: normalizedEventId };
};

const buildMockEventsQuery = ({ location, hostUserId, hostUsername } = {}) => {
  const query = {};

  if (hostUserId) {
    query.hostUserId = hostUserId;
  }

  if (hostUsername) {
    query.hostUsername = String(hostUsername || "").trim().toLowerCase();
  }

  if (location && location !== "All Philippines") {
    const pattern = new RegExp(escapeRegex(location), "i");
    query.$or = [
      { province: location },
      { location: pattern },
      { address: pattern },
      { venue: pattern },
    ];
  }

  return query;
};

const normalizeVenueLookupValue = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const buildVenueLookup = (venues = []) => {
  const lookup = new Map();

  venues.forEach((venue) => {
    [
      venue.venue_name,
      venue.location,
      venue.google_maps_place_id,
      venue.google_maps_link,
    ]
      .map((value) => normalizeVenueLookupValue(value))
      .filter(Boolean)
      .forEach((key) => lookup.set(key, venue));
  });

  return lookup;
};

const getVenueMetadata = (venue) => ({
  venueRating: Number(venue?.rating || 0),
  venueReviewCount: Number(venue?.reviewCount || 0),
  venueGoogleMapsUrl: venue?.google_maps_link || "",
  venuePlaceId: venue?.google_maps_place_id || "",
  venueCoordinates:
    venue?.coordinates &&
    Number.isFinite(Number(venue.coordinates.lat)) &&
    Number.isFinite(Number(venue.coordinates.lng))
      ? {
          lat: Number(venue.coordinates.lat),
          lng: Number(venue.coordinates.lng),
        }
      : null,
});

const resolveVenueMetadata = (event, venueLookup) => {
  const candidates = [
    event?.venue,
    event?.location,
    event?.address,
    event?.venuePlaceId,
    event?.venueGoogleMapsUrl,
    event?.rawPayload?.venue?.name,
    event?.rawPayload?.formatted_address,
  ];

  for (const candidate of candidates) {
    const match = venueLookup.get(normalizeVenueLookupValue(candidate));

    if (match) {
      return getVenueMetadata(match);
    }
  }

  return {
    venueRating: Number(event?.venueRating || 0),
    venueReviewCount: Number(event?.venueReviewCount || 0),
    venueGoogleMapsUrl: event?.venueGoogleMapsUrl || "",
    venuePlaceId: event?.venuePlaceId || "",
    venueCoordinates: event?.venueCoordinates || null,
  };
};

const buildInteractionCountMap = async () => {
  const rows = await UserEventInteraction.aggregate([
    {
      $group: {
        _id: "$eventId",
        attendeeCount: {
          $sum: {
            $cond: [{ $eq: ["$attending", true] }, 1, 0],
          },
        },
        savedCount: {
          $sum: {
            $cond: [{ $eq: ["$saved", true] }, 1, 0],
          },
        },
        reactions: {
          $sum: {
            $cond: [{ $eq: ["$hearted", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id || "").trim(),
      {
        attendeeCount: Number(row.attendeeCount || 0),
        savedCount: Number(row.savedCount || 0),
        reactions: Number(row.reactions || 0),
      },
    ]),
  );
};

const getInteractionCounters = (event, interactionCountMap) => {
  const keys = Array.from(
    new Set(
      [event?.eventId, event?.id, event?._id]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  const counters = keys.reduce(
    (summary, key) => {
      const match = interactionCountMap.get(key);

      if (!match) {
        return summary;
      }

      return {
        attendeeCount: summary.attendeeCount + Number(match.attendeeCount || 0),
        savedCount: summary.savedCount + Number(match.savedCount || 0),
        reactions: summary.reactions + Number(match.reactions || 0),
      };
    },
    {
      attendeeCount: 0,
      savedCount: 0,
      reactions: 0,
    },
  );

  return {
    attendeeCount: Number(
      counters.attendeeCount || event?.attendeeCount || 0,
    ),
    savedCount: Number(counters.savedCount || event?.savedCount || 0),
    reactions: Number(counters.reactions || event?.reactions || 0),
  };
};

const serializeCatalogEvent = (
  event,
  {
    venueMetadata = {},
    interactionCountMap = new Map(),
    source = "",
    ownerId = "",
    createdBy = "",
    creatorName = "",
    creatorAvatar = "",
  } = {},
) => {
  const counters = getInteractionCounters(event, interactionCountMap);

  return {
    id: String(event.eventId || event._id),
    eventId: event.eventId,
    title: event.title,
    description: event.description || "",
    category: event.category || "Community",
    province: event.province || "",
    location: event.location || event.venue || "Philippines",
    venue: event.venue || "",
    address: event.address || "",
    venueGoogleMapsUrl:
      event.venueGoogleMapsUrl || venueMetadata.venueGoogleMapsUrl || "",
    venuePlaceId: event.venuePlaceId || venueMetadata.venuePlaceId || "",
    venueRating: Number(event.venueRating || venueMetadata.venueRating || 0),
    venueReviewCount: Number(
      event.venueReviewCount || venueMetadata.venueReviewCount || 0,
    ),
    venueCoordinates: event.venueCoordinates || venueMetadata.venueCoordinates || null,
    startDate: event.startDate || "",
    date: event.startDate || "",
    timeLabel: event.timeLabel || "",
    time: event.timeLabel || "",
    imageUrl: event.imageUrl || "",
    eventUrl: event.eventUrl || "",
    organizer: event.organizer || creatorName || "Community Host",
    createdBy,
    creatorName,
    creatorAvatar,
    ownerId,
    attendeeCount: counters.attendeeCount,
    savedCount: counters.savedCount,
    reactions: counters.reactions,
    source,
    status: event.status || "published",
    rawPayload: event.rawPayload || null,
    updatedAt: event.updatedAt,
    createdAt: event.createdAt,
  };
};

const serializeCreatedEvent = (event, options = {}) =>
  serializeCatalogEvent(event, {
    source: "created",
    ownerId: String(event.userId || ""),
    createdBy: event.createdBy || "",
    creatorName: event.creatorName || "",
    creatorAvatar: event.creatorAvatar || "",
    ...options,
  });

const serializeMockEvent = (event, options = {}) =>
  serializeCatalogEvent(event, {
    source: "mock",
    ownerId: String(event.hostUserId || ""),
    createdBy: event.hostUsername || "",
    creatorName: event.hostName || "",
    creatorAvatar: event.hostAvatar || "",
    ...options,
  });

const serializeStoredEvent = (event, options = {}) => {
  const counters = getInteractionCounters(event, options.interactionCountMap);
  const venueMetadata = options.venueMetadata || {};

  return {
    ...event,
    id: String(event.eventId || event._id),
    attendeeCount: counters.attendeeCount,
    savedCount: counters.savedCount,
    reactions: counters.reactions,
    venueRating: Number(event.venueRating || venueMetadata.venueRating || 0),
    venueReviewCount: Number(
      event.venueReviewCount || venueMetadata.venueReviewCount || 0,
    ),
    venueGoogleMapsUrl:
      event.venueGoogleMapsUrl || venueMetadata.venueGoogleMapsUrl || "",
    venuePlaceId: event.venuePlaceId || venueMetadata.venuePlaceId || "",
    venueCoordinates: event.venueCoordinates || venueMetadata.venueCoordinates || null,
    source: event.source || "live",
  };
};

const loadCreatedEvents = async (query = {}) =>
  CreatedEvent.find(query).sort({ updatedAt: -1, title: 1 }).lean();

const loadMockEvents = async (query = {}) =>
  MockEvent.find(query).sort({ updatedAt: -1, title: 1 }).lean();

const buildMergedCatalog = async ({ location = "All Philippines" } = {}) => {
  const [events, createdEvents, mockEvents, venues, interactionCountMap] =
    await Promise.all([
      getStoredEvents(location),
      loadCreatedEvents(buildCreatedEventsQuery({ location })),
      loadMockEvents(buildMockEventsQuery({ location })),
      Venue.find({}).lean(),
      buildInteractionCountMap(),
    ]);

  const venueLookup = buildVenueLookup(venues);

  return [
    ...mockEvents.map((event) =>
      serializeMockEvent(event, {
        venueMetadata: resolveVenueMetadata(event, venueLookup),
        interactionCountMap,
      }),
    ),
    ...createdEvents.map((event) =>
      serializeCreatedEvent(event, {
        venueMetadata: resolveVenueMetadata(event, venueLookup),
        interactionCountMap,
      }),
    ),
    ...events.map((event) =>
      serializeStoredEvent(event, {
        venueMetadata: resolveVenueMetadata(event, venueLookup),
        interactionCountMap,
      }),
    ),
  ].sort((leftEvent, rightEvent) => {
    const leftTime = new Date(leftEvent.updatedAt || leftEvent.createdAt || 0).getTime();
    const rightTime = new Date(rightEvent.updatedAt || rightEvent.createdAt || 0).getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return String(leftEvent.title || "").localeCompare(String(rightEvent.title || ""));
  });
};

const buildSingleCatalogEvent = async (eventId) => {
  const normalizedEventId = String(eventId || "").trim();

  if (!normalizedEventId) {
    return null;
  }

  const [createdEvent, mockEvent, storedEvent, venues, interactionCountMap] =
    await Promise.all([
      CreatedEvent.findOne(buildEventIdentifierQuery(normalizedEventId)).lean(),
      MockEvent.findOne(buildEventIdentifierQuery(normalizedEventId)).lean(),
      Event.findOne({ eventId: normalizedEventId }).lean(),
      Venue.find({}).lean(),
      buildInteractionCountMap(),
    ]);

  const venueLookup = buildVenueLookup(venues);

  if (createdEvent) {
    return serializeCreatedEvent(createdEvent, {
      venueMetadata: resolveVenueMetadata(createdEvent, venueLookup),
      interactionCountMap,
    });
  }

  if (mockEvent) {
    return serializeMockEvent(mockEvent, {
      venueMetadata: resolveVenueMetadata(mockEvent, venueLookup),
      interactionCountMap,
    });
  }

  if (storedEvent) {
    return serializeStoredEvent(storedEvent, {
      venueMetadata: resolveVenueMetadata(storedEvent, venueLookup),
      interactionCountMap,
    });
  }

  return null;
};

router.get("/status", async (req, res) => {
  try {
    const status = await getEventCatalogStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const configuredToken = process.env.EVENTS_REFRESH_TOKEN;
    const providedToken = req.get("x-refresh-token");

    if (configuredToken && providedToken !== configuredToken) {
      return res.status(401).json({ success: false, message: "Unauthorized refresh request" });
    }

    const query = req.body?.query || process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
    const result = await refreshEventCatalog({ query, reason: "manual" });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const location = req.query.location || "All Philippines";
    const [mergedEvents, totalCount, totalCreatedCount, totalMockCount] = await Promise.all([
      buildMergedCatalog({ location }),
      Event.countDocuments(),
      CreatedEvent.countDocuments(),
      MockEvent.countDocuments(),
    ]);

    res.json({
      success: true,
      data: mergedEvents,
      count: mergedEvents.length,
      totalCount: totalCount + totalCreatedCount + totalMockCount,
      source: "database",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/created/me", protect, async (req, res) => {
  try {
    const [events, venues, interactionCountMap] = await Promise.all([
      loadCreatedEvents({ userId: req.user._id }),
      Venue.find({}).lean(),
      buildInteractionCountMap(),
    ]);
    const venueLookup = buildVenueLookup(venues);

    res.json({
      success: true,
      data: events.map((event) =>
        serializeCreatedEvent(event, {
          venueMetadata: resolveVenueMetadata(event, venueLookup),
          interactionCountMap,
        }),
      ),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/created/by/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const [user, mockUser, venues, interactionCountMap] = await Promise.all([
      User.findOne({ username }),
      MockUser.findOne({ username }),
      Venue.find({}).lean(),
      buildInteractionCountMap(),
    ]);

    if (!user && !mockUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const [createdEvents, mockEvents] = await Promise.all([
      user ? loadCreatedEvents({ userId: user._id }) : [],
      loadMockEvents(
        mockUser
          ? { hostUserId: mockUser._id }
          : buildMockEventsQuery({ hostUsername: username }),
      ),
    ]);
    const venueLookup = buildVenueLookup(venues);

    res.json({
      success: true,
      data: [
        ...createdEvents.map((event) =>
          serializeCreatedEvent(event, {
            venueMetadata: resolveVenueMetadata(event, venueLookup),
            interactionCountMap,
          }),
        ),
        ...mockEvents.map((event) =>
          serializeMockEvent(event, {
            venueMetadata: resolveVenueMetadata(event, venueLookup),
            interactionCountMap,
          }),
        ),
      ].sort((leftEvent, rightEvent) =>
        String(rightEvent.startDate || "").localeCompare(String(leftEvent.startDate || "")),
      ),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:eventId", async (req, res) => {
  try {
    const event = await buildSingleCatalogEvent(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/create", protect, upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";
    let cloudinaryId = "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_events" },
          (error, uploadResult) => {
            if (uploadResult) resolve(uploadResult);
            else reject(error);
          },
        );
        stream.end(req.file.buffer);
      });

      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    }

    const parsedVenueRating = Number(req.body.venueRating || 0);
    const parsedVenueReviewCount = Number(req.body.venueReviewCount || 0);
    const parsedVenueLat = Number(req.body.venueLatitude);
    const parsedVenueLng = Number(req.body.venueLongitude);
    const venueName = String(req.body.venue || req.body.location || "").trim();
    const venueLocation = String(
      req.body.location || req.body.address || req.body.venue || req.body.province || "",
    ).trim();
    const venueGoogleMapsUrl = String(
      req.body.googleMapsUrl || req.body.venueGoogleMapsUrl || "",
    ).trim();
    const venuePlaceId = String(req.body.venuePlaceId || "").trim();

    let storedVenue = null;

    if (venueName) {
      const venueQuery = venuePlaceId
        ? { google_maps_place_id: venuePlaceId }
        : { venue_name: venueName };

      storedVenue = await Venue.findOneAndUpdate(
        venueQuery,
        {
          $set: {
            venue_name: venueName,
            location: venueLocation,
            google_maps_link: venueGoogleMapsUrl,
            google_maps_place_id: venuePlaceId,
            rating: Number.isFinite(parsedVenueRating) ? parsedVenueRating : 0,
            reviewCount: Number.isFinite(parsedVenueReviewCount)
              ? parsedVenueReviewCount
              : 0,
            coordinates:
              Number.isFinite(parsedVenueLat) && Number.isFinite(parsedVenueLng)
                ? {
                    lat: parsedVenueLat,
                    lng: parsedVenueLng,
                  }
                : undefined,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
    }

    const generatedEventId = cloudinaryId || `created-${req.user._id}-${Date.now()}`;
    const newEvent = await CreatedEvent.create({
      userId: req.user._id,
      createdBy: req.user.username || "",
      creatorName: req.user.name || "",
      creatorAvatar: req.user.avatar || "",
      title: req.body.title,
      province: req.body.province || "",
      location:
        req.body.location || req.body.address || req.body.venue || req.body.province,
      venue: venueName,
      address: req.body.address || "",
      venueGoogleMapsUrl:
        venueGoogleMapsUrl || storedVenue?.google_maps_link || "",
      venuePlaceId: venuePlaceId || storedVenue?.google_maps_place_id || "",
      venueRating:
        Number.isFinite(parsedVenueRating) && parsedVenueRating > 0
          ? parsedVenueRating
          : Number(storedVenue?.rating || 0),
      venueReviewCount:
        Number.isFinite(parsedVenueReviewCount) && parsedVenueReviewCount > 0
          ? parsedVenueReviewCount
          : Number(storedVenue?.reviewCount || 0),
      venueCoordinates:
        Number.isFinite(parsedVenueLat) && Number.isFinite(parsedVenueLng)
          ? {
              lat: parsedVenueLat,
              lng: parsedVenueLng,
            }
          : storedVenue?.coordinates || null,
      startDate: req.body.date || req.body.startDate || "",
      timeLabel: req.body.time || req.body.timeLabel || "",
      category: req.body.category || "Community",
      description: req.body.description || "",
      eventUrl: req.body.eventUrl || "",
      imageUrl: imageUrl || req.body.imageUrl || "",
      eventId: generatedEventId,
      organizer: req.body.organizer || req.user.name || "Community Host",
      source: "created",
      status: "published",
      rawPayload: req.body,
    });

    const interactionCountMap = await buildInteractionCountMap();

    res.status(201).json({
      success: true,
      data: serializeCreatedEvent(newEvent.toObject(), {
        venueMetadata: getVenueMetadata(storedVenue),
        interactionCountMap,
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:eventId", protect, upload.single("image"), async (req, res) => {
  try {
    const existingEvent = await CreatedEvent.findOne({
      ...buildEventIdentifierQuery(req.params.eventId),
      userId: req.user._id,
    });

    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found." });
    }

    let imageUrl = existingEvent.imageUrl || "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_events" },
          (error, uploadResult) => {
            if (uploadResult) resolve(uploadResult);
            else reject(error);
          },
        );
        stream.end(req.file.buffer);
      });

      imageUrl = result.secure_url;
    }

    existingEvent.title = req.body.title || existingEvent.title;
    existingEvent.description = req.body.description || existingEvent.description;
    existingEvent.startDate = req.body.date || req.body.startDate || existingEvent.startDate;
    existingEvent.timeLabel = req.body.time || req.body.timeLabel || existingEvent.timeLabel;
    existingEvent.venue = req.body.venue || existingEvent.venue;
    existingEvent.location =
      req.body.location || req.body.venue || req.body.province || existingEvent.location;
    existingEvent.venueGoogleMapsUrl =
      req.body.googleMapsUrl || req.body.venueGoogleMapsUrl || existingEvent.venueGoogleMapsUrl;
    existingEvent.province = req.body.province || existingEvent.province;
    existingEvent.category = req.body.category || existingEvent.category;
    existingEvent.imageUrl = imageUrl || existingEvent.imageUrl;
    existingEvent.rawPayload = { ...(existingEvent.rawPayload || {}), ...req.body };

    await existingEvent.save();
    const interactionCountMap = await buildInteractionCountMap();

    res.json({
      success: true,
      data: serializeCreatedEvent(existingEvent.toObject(), {
        interactionCountMap,
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/save", protect, async (req, res) => {
  try {
    const { eventId, title, location, date, time, category, description, imageUrl, eventUrl } = req.body;
    const existing = await SavedEvent.findOne({
      userId: req.user._id,
      eventId,
    });

    if (existing) {
      return res.status(400).json({ message: "Event already saved" });
    }

    const saved = await SavedEvent.create({
      userId: req.user._id,
      eventId,
      title,
      location,
      date,
      time,
      category,
      description,
      imageUrl,
      eventUrl,
    });

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/saved", protect, async (req, res) => {
  try {
    const saved = await SavedEvent.find({ userId: req.user._id }).sort("-createdAt");
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/saved/:eventId", protect, async (req, res) => {
  try {
    await SavedEvent.findOneAndDelete({
      userId: req.user._id,
      eventId: req.params.eventId,
    });

    res.json({ success: true, message: "Event removed from saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
