
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const userDB = mongoose.createConnection(process.env.MONGO_URI);
const eventDB = mongoose.createConnection(process.env.MONGO_URI_EVENT);

userDB.on('connected', () => {
    console.log("USER Database Connected Successfully");
});
userDB.on('error', (err) => {
    console.error("USER Connection Error:", err);
});

eventDB.on('connected', () => {
    console.log("EVENT Database Connected Successfully");
});
eventDB.on('error', (err) => {
    console.error("VENT Connection Error:", err);
});

export { userDB, eventDB };