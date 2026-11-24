import express from "express"
import rateLimit from "express-rate-limit"
import { googleAuth, resetPassword, sendOtp, signIn, signOut, signUp, verifyOtp } from "../controllers/auth.controllers.js"

const authRouter = express.Router()

// Slow down password guessing and OTP abuse (per client IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." }
})

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please try again in a few minutes." }
})

authRouter.post("/signup", loginLimiter, signUp)
authRouter.post("/signin", loginLimiter, signIn)
authRouter.get("/signout", signOut)
authRouter.post("/send-otp", otpLimiter, sendOtp)
authRouter.post("/verify-otp", otpLimiter, verifyOtp)
authRouter.post("/reset-password", otpLimiter, resetPassword)
authRouter.post("/google-auth", loginLimiter, googleAuth)

export default authRouter
