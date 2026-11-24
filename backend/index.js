// Must be the first import so env vars are loaded before any other module reads them
import "dotenv/config"

import express from "express"
import http from "http"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import mongoose from "mongoose"
import { Server } from "socket.io"

import connectDb from "./config/db.js"
import authRouter from "./routes/auth.routes.js"
import userRouter from "./routes/user.routes.js"
import itemRouter from "./routes/item.routes.js"
import shopRouter from "./routes/shop.routes.js"
import orderRouter from "./routes/order.routes.js"
import { socketHandler } from "./socket.js"

// ---------------------------------------------------------------------------
// Fail fast on missing configuration (clear message instead of a mystery crash)
// ---------------------------------------------------------------------------
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Set it in backend/.env or your host's environment variables.")
  process.exit(1)
}

const optionalGroups = {
  Cloudinary: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
  Razorpay: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  "Google sign-in": ["FIREBASE_API_KEY"]
}

for (const [feature, keys] of Object.entries(optionalGroups)) {
  const missing = keys.filter((key) => !process.env[key])
  if (missing.length) {
    console.warn(`[config] ${feature} is not fully configured (missing ${missing.join(", ")}).`)
  }
}

if (!process.env.BREVO_API_KEY && !(process.env.EMAIL && process.env.PASS)) {
  console.warn("[config] Email is not configured: password-reset and delivery OTP emails will fail.")
}

// CLIENT_URL can hold several comma-separated origins, e.g.
// https://my-app.vercel.app,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean)

const corsOrigin = (origin, callback) => {
  // No Origin header = server-to-server / curl / health checks
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true)
  }
  return callback(null, false)
}

const app = express()
const server = http.createServer(app)

// Render / Vercel / most hosts sit behind a proxy: needed for correct client IPs (rate limiting)
app.set("trust proxy", 1)

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
})
app.set("io", io)

app.use(helmet())
// credentials:true is required because the frontend sends requests with `withCredentials`.
// Safe here: only the allow-listed origins above are echoed back, and login uses a
// header token, not cookies.
app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json({ limit: "100kb" }))

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please slow down." }
  })
)

// Health check (used by the hosting platform)
const health = (req, res) =>
  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  })
app.get("/", health)
app.get("/api/health", health)

app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/shop", shopRouter)
app.use("/api/item", itemRouter)
app.use("/api/order", orderRouter)

app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }))

// Central error handler (upload limits, bad JSON, anything unexpected)
app.use((error, req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Image is too large (max 5 MB)" })
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" })
  }

  const status = error?.status || error?.statusCode || 500

  if (status >= 500) {
    console.error("Unhandled error:", error)
  }

  return res.status(status).json({
    message: status >= 500 ? "Something went wrong. Please try again." : error.message
  })
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason)
})

socketHandler(io)
await connectDb()

const port = process.env.PORT || 5000
server.listen(port, () => {
  console.log(`Server started at ${port}`)
  console.log("Allowed origins:", allowedOrigins.join(", "))
})
