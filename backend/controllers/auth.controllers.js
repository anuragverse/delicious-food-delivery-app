import bcrypt from "bcryptjs"
import User from "../models/user.model.js"
import genToken from "../utils/token.js"
import { sendOtpMail } from "../utils/mail.js"
import {
  generateOtp,
  isValidEmail,
  isValidMobile,
  sanitizeUser
} from "../utils/helpers.js"

const ROLES = ["user", "owner", "deliveryBoy"]
const MAX_OTP_ATTEMPTS = 5

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : ""

// The token is returned in the JSON body; the frontend sends it back as
// `Authorization: Bearer <token>` (see frontend/src/api.js).
const sendSession = async (res, user, status = 200) => {
  const token = await genToken(user._id)
  return res.status(status).json({ ...sanitizeUser(user), token })
}

export const signUp = async (req, res) => {
  try {
    const { fullName, password, mobile, role } = req.body || {}
    const email = normalizeEmail(req.body?.email)

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ message: "Full name is required." })
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." })
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters." })
    }
    if (!isValidMobile(mobile)) {
      return res.status(400).json({ message: "mobile no must be at least 10 digits." })
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Choose a valid role." })
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "User Already exist." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      fullName: fullName.trim(),
      email,
      role,
      mobile: String(mobile).trim(),
      password: hashedPassword
    })

    return await sendSession(res, user, 201)
  } catch (error) {
    console.error("signUp error:", error)
    return res.status(500).json({ message: "Sign up failed. Please try again." })
  }
}

export const signIn = async (req, res) => {
  try {
    const { password } = req.body || {}
    const email = normalizeEmail(req.body?.email)

    if (!email || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required." })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: "User does not exist." })
    }

    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google sign-in." })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "incorrect Password" })
    }

    return await sendSession(res, user)
  } catch (error) {
    console.error("signIn error:", error)
    return res.status(500).json({ message: "Sign in failed. Please try again." })
  }
}

// Tokens live in the browser, which discards its copy on sign out.
export const signOut = async (req, res) => {
  return res.status(200).json({ message: "log out successfully" })
}

export const sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(400).json({ message: "User does not exist." })
    }

    const otp = generateOtp()
    user.resetOtp = otp
    user.otpExpires = Date.now() + 5 * 60 * 1000
    user.otpAttempts = 0
    user.isOtpVerified = false
    await user.save()

    try {
      await sendOtpMail(email, otp)
    } catch (mailError) {
      console.error("OTP email failed:", mailError.message)
      return res.status(502).json({ message: "Could not send the OTP email. Please try again later." })
    }

    return res.status(200).json({ message: "otp sent successfully" })
  } catch (error) {
    console.error("sendOtp error:", error)
    return res.status(500).json({ message: "Could not send OTP. Please try again." })
  }
}

export const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const otp = String(req.body?.otp ?? "")
    const user = await User.findOne({ email })

    if (!user || !user.resetOtp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "invalid/expired otp" })
    }

    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      user.resetOtp = undefined
      user.otpExpires = undefined
      await user.save()
      return res.status(429).json({ message: "Too many wrong attempts. Request a new OTP." })
    }

    if (user.resetOtp !== otp) {
      user.otpAttempts = (user.otpAttempts || 0) + 1
      await user.save()
      return res.status(400).json({ message: "invalid/expired otp" })
    }

    user.isOtpVerified = true
    user.resetOtp = undefined
    user.otpAttempts = 0
    // After verification the user has 10 minutes to choose a new password
    user.otpExpires = Date.now() + 10 * 60 * 1000
    await user.save()

    return res.status(200).json({ message: "otp verify successfully" })
  } catch (error) {
    console.error("verifyOtp error:", error)
    return res.status(500).json({ message: "Could not verify OTP. Please try again." })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const { newPassword } = req.body || {}
    const user = await User.findOne({ email })

    if (!user || !user.isOtpVerified || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "otp verification required" })
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters." })
    }

    user.password = await bcrypt.hash(newPassword, 10)
    user.isOtpVerified = false
    user.otpExpires = undefined
    await user.save()

    return res.status(200).json({ message: "password reset successfully" })
  } catch (error) {
    console.error("resetPassword error:", error)
    return res.status(500).json({ message: "Could not reset password. Please try again." })
  }
}

// Verifies a Firebase ID token with Google. The client's claimed email is NEVER
// trusted on its own: without this check anyone could log in as any user.
const verifyFirebaseIdToken = async (idToken) => {
  const apiKey = process.env.FIREBASE_API_KEY

  if (!apiKey) {
    throw new Error("FIREBASE_API_KEY is not configured on the server")
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  )

  if (!response.ok) return null

  const data = await response.json()
  const account = data?.users?.[0]

  if (!account?.email || !account.emailVerified) return null

  return {
    email: account.email.toLowerCase(),
    name: account.displayName || ""
  }
}

export const googleAuth = async (req, res) => {
  try {
    const { idToken, fullName, mobile, role } = req.body || {}

    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({ message: "Google sign-in token is missing." })
    }

    let verified
    try {
      verified = await verifyFirebaseIdToken(idToken)
    } catch (configError) {
      console.error("googleAuth config error:", configError.message)
      return res.status(500).json({ message: "Google sign-in is not available right now." })
    }

    if (!verified) {
      return res.status(401).json({ message: "Google sign-in could not be verified." })
    }

    let user = await User.findOne({ email: verified.email })

    if (!user) {
      if (!ROLES.includes(role) || !isValidMobile(mobile)) {
        return res
          .status(404)
          .json({ message: "No account found for this Google email. Please sign up first." })
      }

      user = await User.create({
        fullName: (fullName || verified.name || verified.email.split("@")[0]).trim(),
        email: verified.email,
        mobile: String(mobile).trim(),
        role
      })

      return await sendSession(res, user, 201)
    }

    return await sendSession(res, user)
  } catch (error) {
    console.error("googleAuth error:", error)
    return res.status(500).json({ message: "Google sign-in failed. Please try again." })
  }
}
