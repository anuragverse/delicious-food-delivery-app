import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { escapeRegex } from "../utils/helpers.js";

export const createEditShop = async (req, res) => {
    try {
        const { name, city, state, address } = req.body || {}

        if (![name, city, state, address].every(v => typeof v === "string" && v.trim())) {
            return res.status(400).json({ message: "name, city, state and address are required" })
        }

        let uploadedImage

        if (req.file) {
            uploadedImage = await uploadOnCloudinary(req.file.path)

            if (!uploadedImage) {
                return res.status(502).json({ message: "Image upload failed. Please try again." })
            }
        }

        let shop = await Shop.findOne({ owner: req.userId })

        if (!shop) {
            if (!uploadedImage) {
                return res.status(400).json({ message: "Shop image is required" })
            }

            shop = await Shop.create({
                name: name.trim(),
                city: city.trim(),
                state: state.trim(),
                address: address.trim(),
                image: uploadedImage,
                owner: req.userId
            })
        } else {
            const updateData = {
                name: name.trim(),
                city: city.trim(),
                state: state.trim(),
                address: address.trim()
            }

            if (uploadedImage) {
                updateData.image = uploadedImage
            }

            shop = await Shop.findByIdAndUpdate(
                shop._id,
                updateData,
                { new: true }
            )
        }

        await shop.populate("owner items")
        return res.status(201).json(shop)
    } catch (error) {
        console.error("createEditShop error:", error)
        return res.status(500).json({ message: "Could not save the shop" })
    }
}

export const getMyShop = async (req, res) => {
    try {
        const shop = await Shop.findOne({ owner: req.userId })
            .populate("owner", "-password -resetOtp -otpExpires -otpAttempts -isOtpVerified")
            .populate({
                path: "items",
                options: { sort: { updatedAt: -1 } }
            })

        if (!shop) {
            return res.status(404).json({ message: "Shop not found" })
        }

        return res.status(200).json(shop)
    } catch (error) {
        console.error("getMyShop error:", error)
        return res.status(500).json({ message: "Could not load your shop" })
    }
}

export const getShopByCity = async (req, res) => {
    try {
        const { city } = req.params

        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") }
        }).populate("items")

        if (shops.length === 0) {
            return res.status(404).json({ message: "No shops found in this city" })
        }

        return res.status(200).json(shops)
    } catch (error) {
        console.error("getShopByCity error:", error)
        return res.status(500).json({ message: "Could not load shops" })
    }
}

// Cities that currently have at least one shop (used by the city picker on the home page)
export const getShopCities = async (req, res) => {
    try {
        const cities = await Shop.distinct("city")

        const unique = [...new Set(
            cities
                .filter((city) => typeof city === "string")
                .map((city) => city.trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b))

        return res.status(200).json(unique)
    } catch (error) {
        console.error("getShopCities error:", error)
        return res.status(500).json({ message: "Could not load cities" })
    }
}
