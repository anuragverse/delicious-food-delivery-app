import crypto from "crypto"
import mongoose from "mongoose"

export const isObjectId = (value) =>
  typeof value === "string" && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value)

// Works for both populated documents and raw ObjectIds
export const idOf = (value) => String(value?._id ?? value)

// Escape user input before using it inside a RegExp (prevents regex injection / ReDoS)
export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// 4-digit OTP from a cryptographically secure source
export const generateOtp = () => String(crypto.randomInt(1000, 10000))

export const isValidEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export const isValidMobile = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return false
  const digits = String(value).replace(/\D/g, "")
  return digits.length >= 10 && digits.length <= 15
}

// Never send password hashes / OTP fields to the browser
export const sanitizeUser = (user) => {
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user }
  delete obj.password
  delete obj.resetOtp
  delete obj.otpExpires
  delete obj.isOtpVerified
  delete obj.otpAttempts
  delete obj.__v
  return obj
}
