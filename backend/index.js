const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet"); // Security headers
const compression = require("compression"); // Gzip compression
const morgan = require("morgan"); // Request logging
const rateLimit = require("express-rate-limit"); // Prevent Brute Force
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();

// --- 1. Security & Optimization Middleware ---

// Set security HTTP headers (XSS, Clickjacking, etc.)
app.use(helmet()); 

// Compress all responses for better performance
app.use(compression()); 

// Logging for development (standard format)
// Check the environment
if (process.env.NODE_ENV === "production") {
  // 'combined' is the standard Apache-style logging for production
  app.use(morgan("combined")); 
} else {
  // 'dev' is concise and color-coded for your terminal
  app.use(morgan("dev"));
}

// Rate Limiting: Limit requests from same IP (e.g., 100 requests per 15 mins)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: "Too many requests from this IP, please try again later."
});
app.use("/api", limiter);

// --- 2. Standard Middleware ---

app.use(express.json({ limit: "10kb" })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:3000",
  "https://mnr-at.com",
  "https://www.mnr-at.com",
  "https://mnr-ai-tester.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --- 3. Database Connection ---
db.dbconnect();

// --- 4. Routes ---
app.use("/api/auth", authRoutes);

// Health Check (Vital for Load Balancers/Docker)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});

// --- 5. Error Handling (MUST BE LAST) ---

// Handle 404
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// --- 6. Graceful Shutdown ---
// Prevents database corruption and abruptly cutting off users
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});