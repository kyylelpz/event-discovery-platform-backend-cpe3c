
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const userDB = mongoose.createConnection(process.env.MONGO_URI, {
    dbName: process.env.USER_DB_NAME || "Userplatform",
});
const eventDB = mongoose.createConnection(process.env.MONGO_URI_EVENT, {
    dbName: process.env.EVENT_DB_NAME || "Eventdata",
});

userDB.on('connected', () => {
    console.log("USER Database Connected Successfully:", userDB.name);
});
userDB.on('error', (err) => {
    console.error("USER Connection Error:", err);
});

eventDB.on('connected', () => {
    console.log("EVENT Database Connected Successfully:", eventDB.name);
});
eventDB.on('error', (err) => {
    console.error("VENT Connection Error:", err);
});

export { userDB, eventDB };
