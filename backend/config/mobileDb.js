const mongoose = require("mongoose");
const mobileConnection = mongoose.createConnection(
  process.env.MOBILE_DB_URL || process.env.MONGODB_URL,
  { dbName: "mobile_testing" },
);
mobileConnection.on("connected", () =>
  console.log("✓ mobile_testing DB connected"),
);
mobileConnection.on("error", (err) =>
  console.error("⚠️ mobile_testing DB connection error:", err.message),
);
module.exports = mobileConnection;
