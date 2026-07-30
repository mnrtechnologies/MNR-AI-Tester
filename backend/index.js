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
// Resolve .env against THIS file, not the working directory. dotenv defaults
// to process.cwd(), so starting the server from the repo root (npm run server)
// would silently miss backend/.env and leave MONGODB_URL undefined.
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const dashboardRoute = require("./routes/dashboardRoute")
const projectRoute = require("./routes/projectRoutes")
const subsRoute = require("./routes/subscriptionRoutes")
const companyRoute = require("./routes/companyRoutes")
const creditRoute = require("./routes/creditRoutes")
const creditReconciler = require("./jobs/creditReconciler");
const allowanceResetJob = require("./jobs/allowanceResetJob");

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
  // Extra origins for a given deployment, comma-separated.
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

/**
 * Create React App silently falls back to 3001, 3002, … whenever its preferred
 * port is taken, which used to block every API call with an opaque CORS error.
 * Match localhost on any port so a shifting dev port is never the problem.
 * Loopback origins can only come from software already running on the user's
 * own machine, so this grants nothing a remote attacker could use.
 */
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl, server-to-server, same-origin
  if (allowedOrigins.includes(origin)) return true;
  return LOOPBACK.test(origin);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        // Say which origin was refused — the bare "Not allowed by CORS" gave
        // no clue what to add to the allowlist.
        callback(new Error(`Not allowed by CORS: ${origin}`));
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
 * Credit background jobs.
 *
 * creditReconciler is not optional bookkeeping: it is the only thing that
 * returns credits held for a run whose browser closed or whose Celery worker
 * died. Without it those credits are lost to the customer permanently.
 *
 * Set CREDIT_JOBS_ENABLED=false on every instance but one when running more
 * than one Node process against the same database — the jobs are safe to
 * overlap (all mutations are conditional) but there is no point paying for
 * the duplicate scans.
 */
creditReconciler.start();
allowanceResetJob.start();

/**
 * ----------------------------------------------------
 * 4️⃣ Socket.IO Setup (Secure JWT Auth)
 * ----------------------------------------------------
 */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Same rule as the HTTP layer — otherwise the app authenticates fine but
    // the realtime socket silently fails to connect on a fallback dev port.
    origin: (origin, callback) =>
      isAllowedOrigin(origin)
        ? callback(null, true)
        : callback(new Error(`Not allowed by CORS: ${origin}`)),
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

io.on("connection", async (socket) => {
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
   * Join a room for the user's company so credit changes reach everyone on
   * that plan. Credits are company-scoped: a run one teammate starts spends
   * the same balance everyone else is looking at, so a per-user push would
   * leave the others reading a stale number and over-committing.
   */
  try {
    const User = require("./models/User");
    const u = await User.findById(userId).select("companyId").lean();
    if (u?.companyId) {
      socket.companyId = String(u.companyId);
      socket.join(`company:${socket.companyId}`);
    }
  } catch (err) {
    // A socket that fails to join its room still works for everything else;
    // the client falls back to polling for its balance.
    console.error("Socket company room join failed:", err.message);
  }

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
app.use("/api/dashboard", dashboardRoute);
app.use("/api/company",companyRoute)
app.use("/api/subscription", subsRoute);
app.use("/api/credits", creditRoute);
app.use("/api/projects", projectRoute);

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