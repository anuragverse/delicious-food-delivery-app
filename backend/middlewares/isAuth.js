import User from "../models/user.model.js"
import { verifyToken } from "../utils/token.js"

// Authenticates with `Authorization: Bearer <jwt>`.
// A header token (instead of a cookie) works across different domains
// (e.g. Vercel frontend + Render backend) and is not exposed to CSRF.
const isAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || ""
    const [scheme, token] = header.split(" ")

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const decoded = verifyToken(token)
    req.userId = decoded.userId
    next()
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" })
  }
}

// Usage: router.post("/x", isAuth, requireRole("owner"), handler)
export const requireRole = (...roles) => async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("role")

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "You are not allowed to do this" })
    }

    req.userRole = user.role
    next()
  } catch (error) {
    return res.status(500).json({ message: "Authorization error" })
  }
}

export default isAuth
