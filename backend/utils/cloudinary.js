import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

const removeTempFile = (file) => {
  try {
    fs.unlinkSync(file)
  } catch (error) {
    // already removed - nothing to do
  }
}

const uploadOnCloudinary = async (file) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })

  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: "delicious",
      resource_type: "image"
    })
    return result.secure_url
  } catch (error) {
    console.error("Cloudinary upload failed:", error?.message || error)
    return undefined
  } finally {
    removeTempFile(file)
  }
}

export default uploadOnCloudinary
