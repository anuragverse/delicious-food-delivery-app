import User from "../models/user.model.js"
import { sanitizeUser } from "../utils/helpers.js"

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(401).json({ message: "user is not found" })
        }
        return res.status(200).json(sanitizeUser(user))
    } catch (error) {
        console.error("getCurrentUser error:", error)
        return res.status(500).json({ message: "Could not load your profile" })
    }
}

export const updateUserLocation = async (req, res) => {
    try {
        const lat = Number(req.body?.lat)
        const lon = Number(req.body?.lon)

        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return res.status(400).json({ message: "Valid lat and lon are required" })
        }

        const user = await User.findByIdAndUpdate(req.userId, {
            location: {
                type: 'Point',
                coordinates: [lon, lat]
            }
        }, { new: true })

        if (!user) {
            return res.status(401).json({ message: "user is not found" })
        }

        return res.status(200).json({ message: 'location updated' })
    } catch (error) {
        console.error("updateUserLocation error:", error)
        return res.status(500).json({ message: "Could not update location" })
    }
}
