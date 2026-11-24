import fs from "fs"
import os from "os"
import path from "path"
import crypto from "crypto"
import multer from "multer"

// Uploads are only a temporary stop before Cloudinary, so use the OS temp dir.
const uploadDir = path.join(os.tmpdir(), "delicious-uploads")
fs.mkdirSync(uploadDir, { recursive: true })

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Random name: no collisions between users, no user-controlled paths
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 8)
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`)
  }
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const error = new Error("Only image files (jpg, png, webp, gif, avif) are allowed")
      error.status = 400
      return cb(error)
    }
    cb(null, true)
  }
})
