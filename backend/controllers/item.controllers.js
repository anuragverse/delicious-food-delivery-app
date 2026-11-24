import Item from "../models/item.model.js";
import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { escapeRegex, isObjectId } from "../utils/helpers.js";

export const addItem = async (req, res) => {
    try {
        const { name, category, foodType, price } = req.body || {}

        if (!name || !category || !foodType || !price) {
            return res.status(400).json({ message: "All fields are required" })
        }

        if (!Number.isFinite(Number(price)) || Number(price) < 1) {
            return res.status(400).json({ message: "Price must be greater than 0" })
        }

        if (!req.file) {
            return res.status(400).json({ message: "Item image is required" })
        }

        const image = await uploadOnCloudinary(req.file.path)
        if (!image) {
            return res.status(502).json({ message: "Image upload failed. Please try again." })
        }

        const shop = await Shop.findOne({ owner: req.userId })
        if (!shop) {
            return res.status(400).json({ message: "Shop not found" })
        }

        const item = await Item.create({
            name,
            category,
            foodType,
            price: Number(price),
            image,
            shop: shop._id
        })

        shop.items.push(item._id)
        await shop.save()

        await shop.populate("owner")
        await shop.populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })

        return res.status(201).json(shop)

    } catch (error) {
        console.error("add item error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const editItem = async (req, res) => {
    try {
        const itemId = req.params.itemId
        const { name, category, foodType, price } = req.body || {}

        if (!isObjectId(itemId)) {
            return res.status(400).json({ message: "Invalid item id" })
        }

        if (!name || !category || !foodType || !price) {
            return res.status(400).json({ message: "All fields are required" })
        }

        if (!Number.isFinite(Number(price)) || Number(price) < 1) {
            return res.status(400).json({ message: "Price must be greater than 0" })
        }

        // Only the owner of the shop that sells this item may edit it
        const ownShop = await Shop.findOne({ owner: req.userId })
        if (!ownShop || !ownShop.items.some(i => String(i) === itemId)) {
            return res.status(403).json({ message: "You can only edit items of your own shop" })
        }

        let uploadedImage
        if (req.file) {
            uploadedImage = await uploadOnCloudinary(req.file.path)

            if (!uploadedImage) {
                return res.status(502).json({ message: "Image upload failed. Please try again." })
            }
        }

        const updateData = {
            name,
            category,
            foodType,
            price: Number(price)
        }

        if (uploadedImage) {
            updateData.image = uploadedImage
        }

        const item = await Item.findByIdAndUpdate(
            itemId,
            updateData,
            { new: true, runValidators: true }
        )

        if (!item) {
            return res.status(400).json({ message: "Item not found" })
        }

        const shop = await Shop.findOne({ owner: req.userId }).populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })

        return res.status(200).json(shop)

    } catch (error) {
        console.error("edit item error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const getItemById = async (req, res) => {
    try {
        const itemId = req.params.itemId

        if (!isObjectId(itemId)) {
            return res.status(400).json({ message: "Invalid item id" })
        }

        const item = await Item.findById(itemId)

        if (!item) {
            return res.status(400).json({ message: "Item not found" })
        }

        return res.status(200).json(item)
    } catch (error) {
        console.error("get item error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const deleteItem = async (req, res) => {
    try {
        const itemId = req.params.itemId

        if (!isObjectId(itemId)) {
            return res.status(400).json({ message: "Invalid item id" })
        }

        const shop = await Shop.findOne({ owner: req.userId })

        if (!shop) {
            return res.status(400).json({ message: "Shop not found" })
        }

        // Only the owner of the shop that sells this item may delete it
        if (!shop.items.some(i => String(i) === itemId)) {
            return res.status(403).json({ message: "You can only delete items of your own shop" })
        }

        const item = await Item.findByIdAndDelete(itemId)

        if (!item) {
            return res.status(400).json({ message: "Item not found" })
        }

        shop.items = shop.items.filter(i => String(i) !== String(item._id))
        await shop.save()

        await shop.populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })

        return res.status(200).json(shop)

    } catch (error) {
        console.error("delete item error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const getItemByCity = async (req, res) => {
    try {
        const { city } = req.params

        if (!city) {
            return res.status(400).json({ message: "City is required" })
        }

        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") }
        }).populate("items")

        if (shops.length === 0) {
            return res.status(404).json({ message: "No shops found" })
        }

        const shopIds = shops.map((shop) => shop._id)
        const items = await Item.find({ shop: { $in: shopIds } })

        return res.status(200).json(items)

    } catch (error) {
        console.error("get item by city error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const getItemsByShop = async (req, res) => {
    try {
        const { shopId } = req.params

        if (!isObjectId(shopId)) {
            return res.status(400).json({ message: "Invalid shop id" })
        }

        const shop = await Shop.findById(shopId).populate("items")

        if (!shop) {
            return res.status(400).json({ message: "Shop not found" })
        }

        return res.status(200).json({
            shop,
            items: shop.items
        })
    } catch (error) {
        console.error("get item by shop error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const searchItems = async (req, res) => {
    try {
        const { query, city } = req.query

        if (!query || !city) {
            return res.status(400).json({ message: "Query and city are required" })
        }

        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") }
        }).populate("items")

        if (shops.length === 0) {
            return res.status(404).json({ message: "No shops found" })
        }

        const shopIds = shops.map(s => s._id)

        const items = await Item.find({
            shop: { $in: shopIds },
            $or: [
                { name: { $regex: escapeRegex(query), $options: "i" } },
                { category: { $regex: escapeRegex(query), $options: "i" } }
            ]
        }).populate("shop", "name image")

        return res.status(200).json(items)

    } catch (error) {
        console.error("search item error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}

export const rating = async (req, res) => {
    try {
        const { itemId } = req.body || {}
        const rating = Number(req.body?.rating)

        if (!isObjectId(itemId) || !Number.isFinite(rating)) {
            return res.status(400).json({ message: "itemId and rating are required" })
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" })
        }

        const item = await Item.findById(itemId)
        if (!item) {
            return res.status(400).json({ message: "Item not found" })
        }

        const newCount = item.rating.count + 1
        const newAverage = (item.rating.average * item.rating.count + rating) / newCount

        item.rating.count = newCount
        item.rating.average = newAverage
        await item.save()

        return res.status(200).json({ rating: item.rating })

    } catch (error) {
        console.error("rating error:", error)
        return res.status(500).json({ message: "Something went wrong. Please try again." })
    }
}