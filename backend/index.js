const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();


app.use(express.json());
app.use(cookieParser());
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:12737",
  "https://mnr-at.com",
  "mnr-at.com" ,
  "www.mnr-at.com"
];
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman, mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

require("dotenv").config();
const db = require("./config/db");
db.dbconnect();

const authRoutes = require("./routes/authRoutes");

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
