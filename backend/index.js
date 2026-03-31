const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();

/**
 * ----------------------------------------------------
 * 1️⃣ Security & Optimization Middleware
 * ----------------------------------------------------
 */

app.use(helmet());
app.use(compression());

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

/**
 * Rate limiting
 */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api", limiter);

/**
 * ----------------------------------------------------
 * 2️⃣ Standard Middleware
 * ----------------------------------------------------
 */

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:3000",
  "https://mnr-at.com",
  "https://www.mnr-at.com",
  "https://mnr-ai-tester.onrender.com",
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

/**
 * ----------------------------------------------------
 * 3️⃣ Database Connection
 * ----------------------------------------------------
 */

db.dbconnect();

/**
 * ----------------------------------------------------
 * 4️⃣ Socket.IO Setup (Secure JWT Auth)
 * ----------------------------------------------------
 */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

/**
 * Store active socket mapping
 * userId → socketId
 */

global.io = io;
global.userSockets = {};

/**
 * ----------------------------------------------------
 * Socket Authentication Middleware
 * ----------------------------------------------------
 * Extract JWT from:
 * 1️⃣ socket.auth.token
 * 2️⃣ Authorization header
 */

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      console.log("Socket rejected: No token");
      return next(new Error("Socket authentication failed"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      console.log("Socket rejected: Invalid token payload");
      return next(new Error("Socket authentication failed"));
    }

    socket.userId = decoded.id.toString();

    next();
  } catch (error) {
    console.log("Socket rejected: Token verification failed");
    return next(new Error("Socket authentication failed"));
  }
});

/**
 * ----------------------------------------------------
 * Socket Connection Handler
 * ----------------------------------------------------
 */

io.on("connection", (socket) => {
  const userId = socket.userId;

  console.log(`Socket connected: ${socket.id} | User: ${userId}`);

  /**
   * Remove old socket mapping (if exists)
   */

  if (global.userSockets[userId]) {
    delete global.userSockets[userId];
  }

  /**
   * Register new socket mapping
   */

  global.userSockets[userId] = socket.id;

  /**
   * Cleanup mapping on disconnect
   */

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    if (global.userSockets[userId] === socket.id) {
      delete global.userSockets[userId];
    }
  });
});

/**
 * ----------------------------------------------------
 * 5️⃣ Routes
 * ----------------------------------------------------
 */

app.use("/api/auth", authRoutes);

/**
 * Health check endpoint
 */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
  });
});

/**
 * ----------------------------------------------------
 * 6️⃣ Error Handling
 * ----------------------------------------------------
 */

app.use(notFound);
app.use(errorHandler);

/**
 * ----------------------------------------------------
 * 7️⃣ Start Server
 * ----------------------------------------------------
 */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});

/**
 * ----------------------------------------------------
 * 8️⃣ Graceful Shutdown
 * ----------------------------------------------------
 */

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err.name, err.message);

  server.close(() => {
    process.exit(1);
  });
});