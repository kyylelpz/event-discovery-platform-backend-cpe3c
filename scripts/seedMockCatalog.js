import dotenv from "dotenv";
import { userDB, eventDB } from "../src/routes/db.js";
import MockUser from "../src/models/MockUser.js";
import MockEvent from "../src/models/MockEvent.js";
import UserEventInteraction from "../src/models/UserEventInteraction.js";

dotenv.config();

const CURRENT_DATE = new Date();
const END_OF_2026 = new Date("2026-12-31T23:59:59.999Z");
const MOCK_USER_TARGET = 400;
const MOCK_EVENT_TARGET = 800;
const LEGACY_USERS = [
  {
    name: "Janine Santos",
    username: "janine-santos",
    email: "janine.santos@eventcinity-demo.com",
    location: "Laguna",
    interests: ["Art & Culture", "Food & Drink", "Community"],
    bio: "Event enthusiast and community organizer shaping soft-launch cultural nights around the Philippines.",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Marco Reyes",
    username: "marco-reyes",
    email: "marco.reyes@eventcinity-demo.com",
    location: "Pampanga",
    interests: ["Music", "Community", "Tech"],
    bio: "Building small but memorable outdoor and music gatherings from Pampanga to Bataan.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Lia Tan",
    username: "lia-tan",
    email: "lia.tan@eventcinity-demo.com",
    location: "Metro Manila",
    interests: ["Business", "Tech", "Art & Culture"],
    bio: "Collecting founder meetups, museum nights, and low-noise social events in Metro Manila.",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=600&q=80",
  },
];
const FIRST_NAMES = [
  "Aira",
  "Alden",
  "Alya",
  "Angela",
  "Anton",
  "Bianca",
  "Brent",
  "Camille",
  "Carlo",
  "Chesca",
  "Daniel",
  "Daphne",
  "Elijah",
  "Ella",
  "Franco",
  "Gela",
  "Gian",
  "Hana",
  "Ivy",
  "Jace",
  "Janna",
  "Jules",
  "Kara",
  "Lara",
  "Lea",
  "Luis",
  "Mara",
  "Marco",
  "Mia",
  "Miguel",
  "Nadine",
  "Noah",
  "Paolo",
  "Rafa",
  "Rina",
  "Sam",
  "Sofia",
  "Theo",
  "Toni",
  "Yana",
  "Zia",
];
const LAST_NAMES = [
  "Aguilar",
  "Aquino",
  "Bautista",
  "Castillo",
  "Cruz",
  "David",
  "De Guzman",
  "Dela Cruz",
  "Diaz",
  "Domingo",
  "Fernandez",
  "Flores",
  "Francisco",
  "Garcia",
  "Gomez",
  "Gonzales",
  "Gutierrez",
  "Hernandez",
  "Ignacio",
  "Javier",
  "Lim",
  "Lopez",
  "Mendoza",
  "Mercado",
  "Morales",
  "Navarro",
  "Ocampo",
  "Padilla",
  "Perez",
  "Ramirez",
  "Ramos",
  "Reyes",
  "Rivera",
  "Rodriguez",
  "Salvador",
  "Sanchez",
  "Santos",
  "Soriano",
  "Tan",
  "Torres",
  "Valdez",
  "Velasco",
  "Villanueva",
];
const PROVINCES = [
  "Metro Manila",
  "Abra",
  "Agusan del Norte",
  "Agusan del Sur",
  "Aklan",
  "Albay",
  "Antique",
  "Aurora",
  "Batangas",
  "Benguet",
  "Bohol",
  "Bulacan",
  "Cagayan",
  "Camarines Sur",
  "Cavite",
  "Cebu",
  "Davao del Sur",
  "Iloilo",
  "Isabela",
  "Laguna",
  "Leyte",
  "Negros Occidental",
  "Nueva Ecija",
  "Palawan",
  "Pampanga",
  "Pangasinan",
  "Quezon",
  "Rizal",
  "Sorsogon",
  "Zambales",
];
const INTERESTS = [
  "Music",
  "Art & Culture",
  "Business",
  "Food & Drink",
  "Community",
  "Tech",
  "Sports",
  "Wellness",
  "Education",
];
const CATEGORY_CONFIG = [
  {
    category: "Music",
    prefixes: ["Sunset", "Neon", "After Hours", "Harbor", "Echo", "Stagefront"],
    topics: ["Concert", "Festival", "Indie Night", "Jazz Session", "Campus Tour", "Live Set"],
    venues: ["Arena", "Open Grounds", "Hall", "Waterfront Park", "Convention Lawn"],
    mapAnchors: ["Quezon City", "Pasay", "Makati", "Taguig", "Cebu City"],
    images: [
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1600&q=80",
    ],
  },
  {
    category: "Art & Culture",
    prefixes: ["Gallery", "Canvas", "Museum", "Heritage", "Lightbox", "Culture Club"],
    topics: ["Exhibition", "Night", "Talks", "Residency Showcase", "Film Circle", "Creative Fair"],
    venues: ["Museum", "Art Center", "Cultural Hall", "Heritage House", "Creative Hub"],
    mapAnchors: ["Manila", "Makati", "Baguio", "Iloilo City", "Vigan"],
    images: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1600&q=80",
    ],
  },
  {
    category: "Business",
    prefixes: ["Builders", "Founder", "Future", "Growth", "Launchpad", "Catalyst"],
    topics: ["Summit", "Mixer", "Forum", "Investor Day", "Leadership Session", "Startup Social"],
    venues: ["Convention Center", "Innovation Hub", "Hotel Ballroom", "Coworking Loft"],
    mapAnchors: ["Taguig", "Makati", "Pasig", "Clark", "Cebu IT Park"],
    images: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1543269664-76bc3997d9ea?auto=format&fit=crop&w=1600&q=80",
    ],
  },
  {
    category: "Food & Drink",
    prefixes: ["Slow Table", "Harvest", "Street Flavor", "Sip Society", "Weekend", "Local Plate"],
    topics: ["Supper Club", "Food Fair", "Tasting", "Market Feast", "Coffee Crawl", "Chef Series"],
    venues: ["Market Hall", "Open Park", "Garden Pavilion", "Warehouse Kitchen", "Rooftop Hall"],
    mapAnchors: ["Quezon", "Bacolod", "Cebu City", "Davao City", "Makati"],
    images: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80",
    ],
  },
  {
    category: "Community",
    prefixes: ["Barangay", "City", "Open Air", "Creative", "Neighborhood", "Weekend"],
    topics: ["Market Day", "Gathering", "Clean-Up", "Volunteer Day", "Family Fair", "Makers Meetup"],
    venues: ["Town Plaza", "Civic Center", "Open Park", "Activity Grounds", "Community Hall"],
    mapAnchors: ["Santa Rosa", "Baguio", "Cagayan de Oro", "Iloilo City", "Antipolo"],
    images: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1600&q=80",
    ],
  },
  {
    category: "Tech",
    prefixes: ["Code", "Product", "AI", "Digital", "Future Lab", "Build"],
    topics: ["Meetup", "Hack Night", "Expo", "Builder Camp", "Demo Day", "Workshop"],
    venues: ["Innovation Lab", "Tech Hub", "Campus Theater", "Convention Hall", "Startup Loft"],
    mapAnchors: ["Quezon City", "Taguig", "Makati", "Cebu City", "Davao City"],
    images: [
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
    ],
  },
];
const AVATARS = [
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80",
];

const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const createSeededRandom = (seedSource) => {
  let seed = Number(seedSource || 1) >>> 0;

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const pickFromList = (items, random) =>
  items[Math.floor(random() * items.length) % items.length];

const pickUniqueValues = (items, count, random) => {
  const selectedValues = new Set();

  while (selectedValues.size < count) {
    selectedValues.add(pickFromList(items, random));
  }

  return [...selectedValues];
};

const createGoogleMapsUrl = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const formatDateKey = (value) => value.toISOString().slice(0, 10);

const formatTimeLabel = (hours, minutes) => {
  const normalizedHours = hours % 12 || 12;
  const meridiem = hours >= 12 ? "PM" : "AM";
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${meridiem}`;
};

const generateMockUsers = () => {
  const users = [...LEGACY_USERS];
  const reservedUsernames = new Set(users.map((user) => user.username));
  let seedIndex = 0;

  while (users.length < MOCK_USER_TARGET) {
    const random = createSeededRandom((seedIndex + 1) * 37);
    const firstName = pickFromList(FIRST_NAMES, random);
    const lastName = pickFromList(LAST_NAMES, random);
    const username = normalizeUsername(`${firstName}-${lastName}-${seedIndex + 1}`);

    if (!username || reservedUsernames.has(username)) {
      seedIndex += 1;
      continue;
    }

    const interests = pickUniqueValues(INTERESTS, 2 + Math.floor(random() * 2), random);
    users.push({
      name: `${firstName} ${lastName}`,
      username,
      email: `${username}@eventcinity-demo.com`,
      location: pickFromList(PROVINCES, random),
      bio: `${firstName} curates ${interests.map((interest) => interest.toLowerCase()).join(", ")} gatherings across the Philippines.`,
      interests,
      avatar: pickFromList(AVATARS, random),
    });
    reservedUsernames.add(username);
    seedIndex += 1;
  }

  return users;
};

const generateMockEvents = (mockUsers) => {
  const random = createSeededRandom(20260423);
  const events = [];
  const totalDaySpan = Math.max(
    1,
    Math.floor((END_OF_2026.getTime() - CURRENT_DATE.getTime()) / (1000 * 60 * 60 * 24)),
  );

  for (let index = 0; index < MOCK_EVENT_TARGET; index += 1) {
    const categoryConfig = CATEGORY_CONFIG[index % CATEGORY_CONFIG.length];
    const host = mockUsers[(index * 7 + Math.floor(random() * mockUsers.length)) % mockUsers.length];
    const prefix = pickFromList(categoryConfig.prefixes, random);
    const topic = pickFromList(categoryConfig.topics, random);
    const anchor = pickFromList(categoryConfig.mapAnchors, random);
    const province = pickFromList(PROVINCES, random);
    const venueType = pickFromList(categoryConfig.venues, random);
    const dayOffset = Math.floor((index / MOCK_EVENT_TARGET) * totalDaySpan + random() * 6);
    const eventDate = new Date(CURRENT_DATE);
    eventDate.setDate(CURRENT_DATE.getDate() + Math.min(dayOffset, totalDaySpan));
    const hours = 8 + Math.floor(random() * 12);
    const minutes = [0, 15, 30, 45][Math.floor(random() * 4)];
    const venue = `${prefix} ${venueType}`;
    const title = `${prefix} ${topic} ${eventDate.getFullYear()}`;
    const address = `${anchor}, ${province}, Philippines`;
    const mapQuery = `${venue}, ${address}`;
    const eventId = normalizeUsername(`${title}-${province}-${formatDateKey(eventDate)}`);

    events.push({
      eventId,
      hostUserId: host._id,
      hostUsername: host.username,
      hostName: host.name,
      hostAvatar: host.avatar || "",
      title,
      description: `${topic} designed for ${categoryConfig.category.toLowerCase()} fans with a clearer schedule, welcoming hosts, and a venue that is easy to find on Google Maps.`,
      category: categoryConfig.category,
      province,
      location: `${venue}, ${anchor}`,
      venue,
      address,
      venueGoogleMapsUrl: createGoogleMapsUrl(mapQuery),
      venuePlaceId: "",
      venueRating: Number((4 + random() * 0.9).toFixed(1)),
      venueReviewCount: 24 + Math.floor(random() * 800),
      venueCoordinates: null,
      startDate: formatDateKey(eventDate),
      timeLabel: formatTimeLabel(hours, minutes),
      imageUrl: pickFromList(categoryConfig.images, random),
      eventUrl: "",
      organizer: host.name,
      attendeeCount: 0,
      savedCount: 0,
      reactions: 0,
      source: "mock",
      status: "published",
      rawPayload: {
        generated: true,
        mapQuery,
      },
    });
  }

  return events;
};

const buildInteractionDocs = (mockUsers, mockEvents) => {
  const interactionDocs = [];
  const totalUsers = mockUsers.length;

  mockEvents.forEach((event, index) => {
    const random = createSeededRandom((index + 1) * 193);
    const desiredAttendeeCount = 12 + Math.floor(random() * 42);
    const attendeeIndexes = new Set();

    while (attendeeIndexes.size < desiredAttendeeCount) {
      attendeeIndexes.add(Math.floor(random() * totalUsers));
    }

    attendeeIndexes.forEach((attendeeIndex) => {
      const attendee = mockUsers[attendeeIndex];
      interactionDocs.push({
        userId: attendee._id,
        eventId: event.eventId,
        hearted: random() > 0.72,
        saved: random() > 0.64,
        attending: true,
        title: event.title,
        location: event.location,
        date: event.startDate,
        time: event.timeLabel,
        category: event.category,
        description: event.description,
        imageUrl: event.imageUrl,
        eventUrl: event.eventUrl,
        province: event.province,
        host: event.organizer,
      });
    });
  });

  return interactionDocs;
};

const syncMockUsers = async (mockUsers) => {
  await Promise.all(
    mockUsers.map((user) =>
      MockUser.findOneAndUpdate(
        { username: user.username },
        { $set: user },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  return MockUser.find({}).sort({ username: 1 });
};

const syncMockEvents = async (mockEvents) => {
  await Promise.all(
    mockEvents.map((event) =>
      MockEvent.findOneAndUpdate(
        { eventId: event.eventId },
        { $set: event },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  return MockEvent.find({}).sort({ startDate: 1, title: 1 });
};

const syncInteractions = async (interactionDocs) => {
  await Promise.all(
    interactionDocs.map((doc) =>
      UserEventInteraction.findOneAndUpdate(
        { userId: doc.userId, eventId: doc.eventId },
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
};

const updateMockEventCounters = async () => {
  const counters = await UserEventInteraction.aggregate([
    {
      $match: {
        eventId: { $in: await MockEvent.distinct("eventId") },
      },
    },
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

  await Promise.all(
    counters.map((counter) =>
      MockEvent.updateOne(
        { eventId: counter._id },
        {
          $set: {
            attendeeCount: Number(counter.attendeeCount || 0),
            savedCount: Number(counter.savedCount || 0),
            reactions: Number(counter.reactions || 0),
          },
        },
      ),
    ),
  );
};

const main = async () => {
  await Promise.all([userDB.asPromise(), eventDB.asPromise()]);

  const mockUsers = await syncMockUsers(generateMockUsers());
  const mockEvents = await syncMockEvents(generateMockEvents(mockUsers));
  await syncInteractions(buildInteractionDocs(mockUsers, mockEvents));
  await updateMockEventCounters();

  console.log(`Seeded ${mockUsers.length} mock users into mock_users.`);
  console.log(`Seeded ${mockEvents.length} mock events into mock_events.`);
};

main()
  .catch((error) => {
    console.error("Mock catalog seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([userDB.close(), eventDB.close()]);
  });
