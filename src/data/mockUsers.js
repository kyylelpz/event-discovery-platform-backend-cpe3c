const BASE_MOCK_USERS = [
  {
    email: "janine-santos@eventcinity-demo.com",
    name: "Janine Santos",
    username: "janine-santos",
    location: "Laguna",
    bio: "Event enthusiast and community organizer shaping soft-launch cultural nights around the Philippines.",
    interests: ["Art & Culture", "Food & Drink", "Community"],
    avatar: "",
  },
  {
    email: "marco-reyes@eventcinity-demo.com",
    name: "Marco Reyes",
    username: "marco-reyes",
    location: "Pampanga",
    bio: "Building small but memorable outdoor and music gatherings from Pampanga to Bataan.",
    interests: ["Music", "Community", "Tech"],
    avatar: "",
  },
  {
    email: "lia-tan@eventcinity-demo.com",
    name: "Lia Tan",
    username: "lia-tan",
    location: "Metro Manila",
    bio: "Collecting founder meetups, museum nights, and low-noise social events in Metro Manila.",
    interests: ["Business", "Tech", "Art & Culture"],
    avatar: "",
  },
  {
    email: "ari-velasco@eventcinity-demo.com",
    name: "Ari Velasco",
    username: "ari-velasco",
    location: "Metro Manila",
    bio: "Usually found around museum nights, design talks, and small-format cultural programs.",
    interests: ["Art & Culture", "Community", "Education"],
    avatar: "",
  },
  {
    email: "ella-cruz@eventcinity-demo.com",
    name: "Ella Cruz",
    username: "ella-cruz",
    location: "Quezon",
    bio: "Tracks intimate food events and regional storytelling dinners across Southern Luzon.",
    interests: ["Food & Drink", "Community", "Travel"],
    avatar: "",
  },
  {
    email: "kai-villanueva@eventcinity-demo.com",
    name: "Kai Villanueva",
    username: "kai-villanueva",
    location: "Metro Manila",
    bio: "Moves between startup mixers, product nights, and founder-friendly networking events.",
    interests: ["Business", "Tech", "Community"],
    avatar: "",
  },
];

const GENERATED_USER_COUNT = 24;
const FIRST_NAMES = [
  "Alya",
  "Andrea",
  "Bea",
  "Carlo",
  "Cass",
  "Dana",
  "Eli",
  "Franco",
  "Gab",
  "Hana",
  "Ivy",
  "Jules",
  "Kara",
  "Lea",
  "Mia",
  "Nico",
  "Paolo",
  "Rafa",
  "Rina",
  "Sofia",
  "Theo",
  "Toni",
  "Trina",
  "Vince",
  "Yana",
  "Zia",
];
const LAST_NAMES = [
  "Garcia",
  "Ramos",
  "Mendoza",
  "Flores",
  "Villanueva",
  "Fernandez",
  "Lopez",
  "Castillo",
  "Rivera",
  "Aquino",
  "Torres",
  "Martinez",
  "Soriano",
  "Valdez",
  "Mercado",
  "Gomez",
  "Dizon",
  "Javier",
  "Velasco",
  "Miranda",
  "Salazar",
  "Ferrer",
  "Padilla",
  "Tamayo",
];
const LOCATIONS = [
  "Metro Manila",
  "Laguna",
  "Cebu",
  "Davao del Sur",
  "Pampanga",
  "Batangas",
  "Quezon",
  "Rizal",
  "Iloilo",
  "Bulacan",
  "Cavite",
  "Palawan",
];
const INTERESTS = [
  "Music",
  "Art & Culture",
  "Food & Drink",
  "Sports",
  "Tech",
  "Business",
  "Wellness",
  "Education",
  "Community",
  "Travel",
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

const pickUniqueInterests = (random) => {
  const selectedInterests = new Set();
  const targetCount = 2 + Math.floor(random() * 3);

  while (selectedInterests.size < targetCount) {
    selectedInterests.add(pickFromList(INTERESTS, random));
  }

  return [...selectedInterests];
};

const buildGeneratedMockUsers = () => {
  const reservedUsernames = new Set(
    BASE_MOCK_USERS.map((user) => normalizeUsername(user.username)).filter(Boolean),
  );
  const users = [];
  let seedIndex = 0;

  while (users.length < GENERATED_USER_COUNT) {
    const random = createSeededRandom((seedIndex + 1) * 97);
    const firstName = pickFromList(FIRST_NAMES, random);
    const lastName = pickFromList(LAST_NAMES, random);
    const username = normalizeUsername(`${firstName}-${lastName}-${seedIndex + 1}`);

    if (reservedUsernames.has(username)) {
      seedIndex += 1;
      continue;
    }

    const location = pickFromList(LOCATIONS, random);
    const interests = pickUniqueInterests(random);

    users.push({
      email: `${username}@eventcinity-demo.com`,
      name: `${firstName} ${lastName}`,
      username,
      location,
      bio: `${firstName} curates ${interests
        .map((interest) => interest.toLowerCase())
        .join(", ")} plans around ${location}.`,
      interests,
      avatar: "",
    });

    reservedUsernames.add(username);
    seedIndex += 1;
  }

  return users;
};

export const mockUsers = [...BASE_MOCK_USERS, ...buildGeneratedMockUsers()];
