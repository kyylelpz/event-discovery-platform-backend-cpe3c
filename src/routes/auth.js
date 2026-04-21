import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
import protect from "../middleware/protect.js";
import {
  getDefaultName,
  getDefaultUsername,
  getSignupEmailError,
  normalizeEmail,
  serializeUser,
} from "../utils/userHelpers.js";
import {
  hashPassword,
  passwordNeedsMigration,
  verifyPassword,
} from "../utils/password.js";

dotenv.config();

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";

const buildCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

const attachAuthCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, buildCookieOptions());
};

const createUniqueUsername = async (email, excludeUserId = null) => {
  const baseUsername = getDefaultUsername(email) || `user-${Date.now()}`;
  let candidate = baseUsername;
  let suffix = 1;

  while (
    await User.findOne({
      username: candidate,
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
  ) {
    candidate = `${baseUsername}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = normalizeEmail(profile.emails?.[0]?.value);
        const avatar = profile.photos?.[0]?.value || "";
        let user = await User.findOne({ googleId: profile.id });

        if (!user && email) {
          user = await User.findOne({ email });
        }

        if (user) {
          user.googleId = profile.id;
          user.provider = "google";
          user.name = user.name || profile.displayName || getDefaultName(email);
          user.avatar = user.avatar || avatar;
          user.username = user.username || (await createUniqueUsername(email, user._id));
          await user.save();
        } else {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName || getDefaultName(email),
            username: await createUniqueUsername(email),
            email,
            provider: "google",
            avatar,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    attachAuthCookie(res, req.user._id);
    res.redirect(
      process.env.AUTH_SUCCESS_REDIRECT_URL || `${process.env.CLIENT_URL}/events`,
    );
  },
);

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const emailError = getSignupEmailError(email);

    if (emailError) {
      return res.status(400).json({ message: emailError });
    }

    if (!password.trim()) {
      return res.status(400).json({ message: "Password is required." });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "That email is already registered!" });
    }

    const newUser = new User({
      email,
      password: hashPassword(password),
      name: getDefaultName(email),
      username: await createUniqueUsername(email),
      provider: "local",
    });

    await newUser.save();
    attachAuthCookie(res, newUser._id);

    res.status(201).json({
      message: "Account created successfully!",
      user: serializeUser(newUser),
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ message: "Server error while saving." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Account not found. Please sign up first!" });
    }

    if (!user.password && user.provider === "google") {
      return res.status(400).json({
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const passwordMatches = verifyPassword(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    if (!user.username) {
      user.username = await createUniqueUsername(user.email, user._id);
    }

    if (passwordNeedsMigration(user.password)) {
      user.password = hashPassword(password);
    }

    await user.save();
    attachAuthCookie(res, user._id);

    res.status(200).json({
      message: "Login successful! Welcome back.",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Database Error during login:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

router.post("/logout", (req, res) => {
  const clearCookieOptions = buildCookieOptions();
  delete clearCookieOptions.maxAge;

  res.clearCookie("token", clearCookieOptions);
  res.json({ message: "Logged out successfully." });
});

router.get("/me", protect, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

export default router;
