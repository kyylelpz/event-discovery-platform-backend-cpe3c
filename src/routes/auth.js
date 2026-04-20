import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
import protect from "../middleware/protect.js";

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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.provider = "google";
            if (!user.avatar) user.avatar = profile.photos[0].value;
            await user.save();
          }
        }

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email,
            provider: "google",
            avatar: profile.photos[0].value,
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
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, buildCookieOptions());
    res.redirect(
      process.env.AUTH_SUCCESS_REDIRECT_URL || `${process.env.CLIENT_URL}/dashboard`,
    );
  },
);

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "That email is already registered!" });
    }

    const defaultName = email.split("@")[0];
    const newUser = new User({
      email,
      password,
      name: defaultName,
      provider: "local",
    });

    await newUser.save();
    res.status(201).json({
      message: "Account created successfully!",
      user: {
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ message: "Server error while saving." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Account not found. Please sign up first!" });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, buildCookieOptions());
    res.status(200).json({
      message: "Login successful! Welcome back.",
      user: {
        email: user.email,
        name: user.name,
      },
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
  res.json({ user: req.user });
});

export default router;
