import express from "express";
import protect from "../middleware/protect.js";
import CreatedEvent from "../models/CreatedEvent.js";
import Event from "../models/Event.js";
import SavedEvent from "../models/SavedEvent.js";
import User from "../models/User.js";
import Venue from "../models/Venue.js";
import {
  ensureMockEventCatalogSeeded,
  getMockEventCatalogStatus,
  getStoredMockEvents,
} from "../services/mockEventCatalog.js";
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

const serializeCreatedEvent = (event, venueMetadata = {}) => ({
  id: event.eventId,
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
  organizer: event.organizer || event.creatorName || "Community Host",
  createdBy: event.createdBy || "",
  creatorName: event.creatorName || "",
  creatorAvatar: event.creatorAvatar || "",
  attendeeCount: Number(event.attendeeCount || 0),
  savedCount: Number(event.savedCount || 0),
  reactions: Number(event.reactions || 0),
  source: event.source || "website",
  status: event.status || "published",
  rawPayload: event.rawPayload || null,
  updatedAt: event.updatedAt,
  createdAt: event.createdAt,
});

const loadCreatedEvents = async (query = {}) =>
  CreatedEvent.find(query).sort({ updatedAt: -1, title: 1 }).lean();

router.get("/status", async (req, res) => {
  try {
    await ensureMockEventCatalogSeeded();
    const [status, mockStatus] = await Promise.all([
      getEventCatalogStatus(),
      getMockEventCatalogStatus(),
    ]);
    res.json({
      success: true,
      data: {
        ...status,
        mockEvents: mockStatus,
      },
    });
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

    const [events, createdEvents, mockEvents, totalCount, totalCreatedCount, venues] =
      await Promise.all([
        getStoredEvents(location),
        loadCreatedEvents(buildCreatedEventsQuery({ location })),
        getStoredMockEvents(location),
        Event.countDocuments(),
        CreatedEvent.countDocuments(),
        Venue.find({}).lean(),
      ]);
    const { storedCount: totalMockCount } = await getMockEventCatalogStatus();
    const venueLookup = buildVenueLookup(venues);
    const mergedEvents = [
      ...createdEvents.map((event) =>
        serializeCreatedEvent(event, resolveVenueMetadata(event, venueLookup)),
      ),
      ...mockEvents.map((event) => ({
        ...event,
        ...resolveVenueMetadata(event, venueLookup),
      })),
      ...events.map((event) => ({
        ...event,
        ...resolveVenueMetadata(event, venueLookup),
      })),
    ].sort((leftEvent, rightEvent) => {
      const leftTime = new Date(
        leftEvent.updatedAt || leftEvent.createdAt || 0,
      ).getTime();
      const rightTime = new Date(
        rightEvent.updatedAt || rightEvent.createdAt || 0,
      ).getTime();

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return String(leftEvent.title || "").localeCompare(
        String(rightEvent.title || ""),
      );
    });

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
    const [events, venues] = await Promise.all([
      loadCreatedEvents({ userId: req.user._id }),
      Venue.find({}).lean(),
    ]);
    const venueLookup = buildVenueLookup(venues);

    res.json({
      success: true,
      data: events.map((event) =>
        serializeCreatedEvent(event, resolveVenueMetadata(event, venueLookup)),
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

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const [events, venues] = await Promise.all([
      loadCreatedEvents({ userId: user._id }),
      Venue.find({}).lean(),
    ]);
    const venueLookup = buildVenueLookup(venues);

    res.json({
      success: true,
      data: events.map((event) =>
        serializeCreatedEvent(event, resolveVenueMetadata(event, venueLookup)),
      ),
    });
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

    const generatedEventId =
      cloudinaryId || `created-${req.user._id}-${Date.now()}`;
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
      source: "website",
      status: "published",
      rawPayload: req.body,
    });

    res.status(201).json({
      success: true,
      data: serializeCreatedEvent(newEvent.toObject(), getVenueMetadata(storedVenue)),
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
