import crypto from "crypto"
import Razorpay from "razorpay"
import Order from "../models/order.model.js"
import Shop from "../models/shop.model.js"
import Item from "../models/item.model.js"
import User from "../models/user.model.js"
import { getIO } from "../socket.js"
import { sendDeliveryOtpMail } from "../utils/mail.js"
import { generateOtp, idOf, isObjectId } from "../utils/helpers.js"

const FREE_DELIVERY_ABOVE = 500
const DELIVERY_FEE = 40
const MAX_DISTINCT_ITEMS = 50
const MAX_QUANTITY_PER_ITEM = 50
const OTP_TTL_MS = 10 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const ORDER_STATUSES_OWNER_CAN_SET = ["pending", "preparing", "out of delivery"]

// Created lazily so the server can start (and run COD orders) without Razorpay keys
let razorpayClient = null
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Online payments are not configured")
    error.status = 503
    throw error
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  }

  return razorpayClient
}

const populateOrder = (query) =>
  query
    .populate("customer", "fullName email mobile socketId")
    .populate("shopOrders.shop", "name image")
    .populate("shopOrders.owner", "fullName email mobile socketId")

const notifyOwnersOfNewOrder = (order) => {
  const io = getIO()

  for (const shopOrder of order.shopOrders) {
    const ownerSocketId = shopOrder?.owner?.socketId

    if (ownerSocketId) {
      io.to(ownerSocketId).emit("newOrder", order)
    }
  }
}

// ---------------------------------------------------------------------------
// PLACE ORDER
// Prices, shop ownership and the delivery fee are ALL computed on the server
// from the database. The browser only tells us which items and how many.
// ---------------------------------------------------------------------------
export const placeOrder = async (req, res) => {
  try {
    const { paymentMethod, deliveryAddress, cartItems } = req.body || {}

    if (!["cod", "online"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Choose a valid payment method" })
    }

    const latitude = Number(deliveryAddress?.latitude)
    const longitude = Number(deliveryAddress?.longitude)

    if (
      typeof deliveryAddress?.text !== "string" ||
      !deliveryAddress.text.trim() ||
      deliveryAddress.text.length > 500 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return res.status(400).json({ message: "send complete deliveryAddress" })
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "cart is empty" })
    }

    if (cartItems.length > MAX_DISTINCT_ITEMS) {
      return res.status(400).json({ message: "Too many items in the cart" })
    }

    // Merge duplicates and validate ids / quantities
    const quantities = new Map()

    for (const entry of cartItems) {
      const quantity = Number(entry?.quantity)

      if (
        !isObjectId(entry?.id) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_QUANTITY_PER_ITEM
      ) {
        return res.status(400).json({ message: "Invalid item in the cart" })
      }

      quantities.set(entry.id, (quantities.get(entry.id) || 0) + quantity)
    }

    const dbItems = await Item.find({ _id: { $in: [...quantities.keys()] } })

    if (dbItems.length !== quantities.size) {
      return res.status(400).json({ message: "Some items in your cart are no longer available" })
    }

    const itemsByShop = new Map()

    for (const item of dbItems) {
      if (!item.shop) {
        return res.status(400).json({ message: `${item.name} is not available` })
      }

      const shopId = String(item.shop)
      if (!itemsByShop.has(shopId)) itemsByShop.set(shopId, [])
      itemsByShop.get(shopId).push(item)
    }

    const shops = await Shop.find({ _id: { $in: [...itemsByShop.keys()] } }).select("owner")
    const shopsById = new Map(shops.map((shop) => [String(shop._id), shop]))

    const shopOrders = []
    let subtotal = 0

    for (const [shopId, items] of itemsByShop) {
      const shop = shopsById.get(shopId)

      if (!shop || !shop.owner) {
        return res.status(400).json({ message: "A shop in your cart is no longer available" })
      }

      const orderItems = items.map((item) => ({
        id: String(item._id),
        name: item.name,
        price: item.price,
        image: item.image,
        shop: shop._id,
        quantity: quantities.get(String(item._id)),
        foodType: item.foodType
      }))

      const shopTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      subtotal += shopTotal

      shopOrders.push({
        shop: shop._id,
        owner: shop.owner,
        items: orderItems,
        totalAmount: shopTotal,
        status: "pending"
      })
    }

    const deliveryFee = subtotal > FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE
    const totalAmount = subtotal + deliveryFee

    // Create the Razorpay order first so a gateway failure leaves nothing behind
    let razorOrder = null

    if (paymentMethod === "online") {
      razorOrder = await getRazorpay().orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: `rcpt_${Date.now()}`
      })
    }

    const newOrder = await Order.create({
      customer: req.userId,
      paymentMethod,
      deliveryAddress: {
        text: deliveryAddress.text.trim(),
        latitude,
        longitude
      },
      totalAmount,
      shopOrders,
      payment: false, // only becomes true after the payment signature is verified
      razorpayOrderId: razorOrder?.id || ""
    })

    if (paymentMethod === "online") {
      return res.status(201).json({
        success: true,
        orderId: newOrder._id,
        razorOrder,
        key: process.env.RAZORPAY_KEY_ID
      })
    }

    const populatedOrder = await populateOrder(Order.findById(newOrder._id))
    notifyOwnersOfNewOrder(populatedOrder)

    return res.status(201).json(populatedOrder)
  } catch (error) {
    console.error("placeOrder error:", error)
    return res
      .status(error.status || 500)
      .json({ message: error.status ? error.message : "Could not place the order. Please try again." })
  }
}

// ---------------------------------------------------------------------------
// VERIFY PAYMENT
// ---------------------------------------------------------------------------
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {}

    if (
      !isObjectId(orderId) ||
      typeof razorpayOrderId !== "string" ||
      typeof razorpayPaymentId !== "string" ||
      typeof razorpaySignature !== "string"
    ) {
      return res.status(400).json({ message: "Missing payment details" })
    }

    // The order must belong to the caller
    const order = await populateOrder(Order.findOne({ _id: orderId, customer: req.userId }))

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // ...be an online order...and be the very Razorpay order we created for it
    if (order.paymentMethod !== "online" || order.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ message: "Payment does not match this order" })
    }

    if (order.payment) {
      return res.status(200).json({ message: "Payment already verified", order })
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex")

    const expectedBuffer = Buffer.from(expected)
    const givenBuffer = Buffer.from(razorpaySignature)

    if (
      expectedBuffer.length !== givenBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, givenBuffer)
    ) {
      return res.status(400).json({ message: "Invalid payment signature" })
    }

    order.payment = true
    order.razorpayPaymentId = razorpayPaymentId
    await order.save()

    // Owners hear about online orders only once they are really paid
    notifyOwnersOfNewOrder(order)

    return res.status(200).json({
      message: "Payment verified successfully",
      order
    })
  } catch (error) {
    console.error("verifyPayment error:", error)
    return res.status(500).json({ message: "Could not verify the payment" })
  }
}

// ---------------------------------------------------------------------------
// LISTING
// ---------------------------------------------------------------------------
export const getMyOrders = async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    let filter

    if (user.role === "user") {
      filter = { customer: req.userId }
    } else if (user.role === "owner") {
      filter = { "shopOrders.owner": req.userId }
    } else if (user.role === "deliveryBoy") {
      filter = { "shopOrders.assignedDeliveryBoy": req.userId }
    } else {
      return res.status(200).json([])
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate("customer", "fullName email mobile socketId")
      .populate("shopOrders.shop", "name image")
      .populate("shopOrders.owner", "fullName email mobile socketId")
      .populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")
      .populate("shopOrders.assignment.availableDeliveryBoys", "fullName email mobile")

    // Never expose the delivery OTP to anyone in a listing
    const safeOrders = orders.map((order) => {
      const plain = order.toObject()
      plain.shopOrders.forEach((so) => {
        delete so.otp
        delete so.otpExpiresAt
        delete so.otpAttempts
      })
      return plain
    })

    return res.status(200).json(safeOrders)
  } catch (error) {
    console.error("getMyOrders error:", error)
    return res.status(500).json({ message: "Could not load orders" })
  }
}

// ---------------------------------------------------------------------------
// OWNER: UPDATE STATUS
// ---------------------------------------------------------------------------
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, shopId } = req.params
    const { status } = req.body || {}

    if (!isObjectId(orderId) || !isObjectId(shopId)) {
      return res.status(400).json({ message: "Invalid order or shop" })
    }

    if (!ORDER_STATUSES_OWNER_CAN_SET.includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const order = await Order.findById(orderId)
      .populate("customer", "fullName email mobile socketId")
      .populate("shopOrders.shop", "name image")
      .populate("shopOrders.owner", "fullName email mobile socketId")
      .populate("shopOrders.assignment.availableDeliveryBoys", "fullName email mobile socketId")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    const shopOrder = order.shopOrders.find((so) => idOf(so.shop) === shopId)

    // Only the owner of THIS shop order may change it
    if (!shopOrder || idOf(shopOrder.owner) !== String(req.userId)) {
      return res.status(403).json({ message: "You cannot update this order" })
    }

    if (order.paymentMethod === "online" && !order.payment) {
      return res.status(400).json({ message: "This order is waiting for payment" })
    }

    if (shopOrder.status === "delivered") {
      return res.status(400).json({ message: "This order has already been delivered" })
    }

    if (shopOrder.status === "out of delivery" && status !== "out of delivery") {
      return res.status(400).json({ message: "This order is already out for delivery" })
    }

    if (shopOrder.status === "out of delivery" && status === "out of delivery") {
      return res.status(200).json({
        message: "Order status updated successfully",
        status,
        assignedDeliveryBoy: shopOrder.assignedDeliveryBoy || null,
        assignment: shopOrder.assignment || null
      })
    }

    shopOrder.status = status
    let assignmentPayload = null

    if (status === "out of delivery") {
      const deliveryBoys = await User.find({
        role: "deliveryBoy",
        isOnline: true
      }).select("_id fullName email mobile socketId location")

      shopOrder.assignment = {
        availableDeliveryBoys: deliveryBoys.map((boy) => boy._id),
        acceptedBy: null,
        acceptedAt: null
      }

      assignmentPayload = {
        assignmentId: `${order._id}_${idOf(shopOrder.shop)}`,
        orderId: order._id,
        shopId: idOf(shopOrder.shop),
        shopName: shopOrder.shop?.name || "Shop",
        deliveryAddress: order.deliveryAddress,
        items: shopOrder.items,
        subtotal: shopOrder.totalAmount
      }
    }

    order.markModified("shopOrders")
    await order.save()

    await order.populate({
      path: "shopOrders.assignment.availableDeliveryBoys",
      select: "fullName mobile socketId"
    })

    const io = getIO()

    if (order.customer?.socketId) {
      io.to(order.customer.socketId).emit("update-status", {
        orderId,
        shopId,
        status,
        userId: order.customer._id
      })
    }

    if (status === "out of delivery" && assignmentPayload) {
      const availableBoys = await User.find({
        _id: { $in: shopOrder.assignment.availableDeliveryBoys.map(idOf) }
      }).select("_id fullName socketId")

      for (const boy of availableBoys) {
        if (boy.socketId) {
          io.to(boy.socketId).emit("new-delivery-assignment", assignmentPayload)
        }
      }
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      status,
      assignedDeliveryBoy: shopOrder.assignedDeliveryBoy || null,
      assignment: shopOrder.assignment || null
    })
  } catch (error) {
    console.error("updateOrderStatus error:", error)
    return res.status(500).json({ message: "Could not update the order" })
  }
}

// ---------------------------------------------------------------------------
// DELIVERY PARTNER
// ---------------------------------------------------------------------------
export const getDeliveryBoyAssignment = async (req, res) => {
  try {
    const deliveryBoyId = String(req.userId)

    const orders = await Order.find({
      "shopOrders.status": "out of delivery",
      "shopOrders.assignment.availableDeliveryBoys": deliveryBoyId
    })
      .sort({ createdAt: -1 })
      .populate("shopOrders.shop", "name image")

    const assignments = []

    for (const order of orders) {
      for (const shopOrder of order.shopOrders) {
        const isAvailableToThisBoy =
          shopOrder.status === "out of delivery" &&
          Array.isArray(shopOrder.assignment?.availableDeliveryBoys) &&
          shopOrder.assignment.availableDeliveryBoys.some((boy) => idOf(boy) === deliveryBoyId)

        const alreadyAccepted = shopOrder.assignment?.acceptedBy || shopOrder.assignedDeliveryBoy

        if (isAvailableToThisBoy && !alreadyAccepted) {
          assignments.push({
            assignmentId: `${order._id}_${idOf(shopOrder.shop)}`,
            orderId: order._id,
            shopId: idOf(shopOrder.shop),
            shopName: shopOrder.shop?.name,
            deliveryAddress: order.deliveryAddress,
            items: shopOrder.items,
            subtotal: shopOrder.totalAmount
          })
        }
      }
    }

    return res.status(200).json(assignments)
  } catch (error) {
    console.error("getDeliveryBoyAssignment error:", error)
    return res.status(500).json({ message: "Could not load assignments" })
  }
}

export const acceptOrder = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const deliveryBoyId = String(req.userId)

    const [orderId, shopId] = String(assignmentId || "").split("_")

    if (!isObjectId(orderId) || !isObjectId(shopId)) {
      return res.status(400).json({ message: "Invalid assignmentId format" })
    }

    // One atomic update: succeeds only if this partner was offered the order and
    // nobody else has taken it. Prevents two partners accepting at the same time.
    const result = await Order.updateOne(
      {
        _id: orderId,
        shopOrders: {
          $elemMatch: {
            shop: shopId,
            status: "out of delivery",
            assignedDeliveryBoy: null,
            "assignment.availableDeliveryBoys": deliveryBoyId
          }
        }
      },
      {
        $set: {
          "shopOrders.$.assignedDeliveryBoy": deliveryBoyId,
          "shopOrders.$.assignment.acceptedBy": deliveryBoyId,
          "shopOrders.$.assignment.acceptedAt": new Date()
        }
      }
    )

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: "This order is no longer available" })
    }

    const updatedOrder = await Order.findById(orderId)
      .populate("customer", "fullName email mobile socketId")
      .populate("shopOrders.shop", "name image")
      .populate("shopOrders.owner", "fullName email mobile socketId")
      .populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")

    const updatedShopOrder = updatedOrder.shopOrders.find((so) => idOf(so.shop) === shopId)

    const io = getIO()
    const payload = {
      orderId,
      shopId,
      assignedDeliveryBoy: updatedShopOrder.assignedDeliveryBoy
    }

    if (updatedShopOrder?.owner?.socketId) {
      io.to(updatedShopOrder.owner.socketId).emit("delivery-boy-assigned", payload)
    }

    if (updatedOrder.customer?.socketId) {
      io.to(updatedOrder.customer.socketId).emit("delivery-boy-assigned", payload)
    }

    return res.status(200).json({
      message: "Order accepted successfully",
      order: updatedOrder,
      shopOrder: updatedShopOrder
    })
  } catch (error) {
    console.error("acceptOrder error:", error)
    return res.status(500).json({ message: "Could not accept the order" })
  }
}

export const getCurrentOrder = async (req, res) => {
  try {
    const deliveryBoyId = String(req.userId)

    const orders = await Order.find({
      "shopOrders.assignedDeliveryBoy": deliveryBoyId,
      "shopOrders.status": "out of delivery"
    })
      .sort({ updatedAt: -1 })
      .populate("customer", "fullName email mobile")
      .populate("shopOrders.shop", "name image")
      .populate("shopOrders.owner", "fullName email mobile")
      .populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")

    for (const order of orders) {
      const found = order.shopOrders.find(
        (so) => so.assignedDeliveryBoy && idOf(so.assignedDeliveryBoy) === deliveryBoyId && so.status === "out of delivery"
      )

      if (found) {
        const shopOrder = found.toObject()
        delete shopOrder.otp
        delete shopOrder.otpExpiresAt
        delete shopOrder.otpAttempts

        return res.status(200).json({
          _id: order._id,
          customer: order.customer,
          deliveryAddress: order.deliveryAddress,
          shopOrder
        })
      }
    }

    return res.status(200).json(null)
  } catch (error) {
    console.error("getCurrentOrder error:", error)
    return res.status(500).json({ message: "Could not load the current order" })
  }
}

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params

    if (!isObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id" })
    }

    const order = await Order.findById(orderId)
      .populate("customer", "fullName email mobile")
      .populate("shopOrders.shop", "name image")
      .populate("shopOrders.owner", "fullName email mobile")
      // `location` is the partner's last known position: the tracking map starts from it
      .populate("shopOrders.assignedDeliveryBoy", "fullName email mobile location")

    if (!order) {
      return res.status(400).json({ message: "order not found" })
    }

    // Only the customer, the shop owners and the assigned partner can see an order
    const userId = String(req.userId)
    const allowed =
      idOf(order.customer) === userId ||
      order.shopOrders.some(
        (so) => idOf(so.owner) === userId || (so.assignedDeliveryBoy && idOf(so.assignedDeliveryBoy) === userId)
      )

    if (!allowed) {
      return res.status(403).json({ message: "You cannot view this order" })
    }

    const plain = order.toObject()
    plain.shopOrders.forEach((so) => {
      delete so.otp
      delete so.otpExpiresAt
      delete so.otpAttempts

      // The partner's position is shared only while the order is out for delivery
      if (so.status !== "out of delivery" && so.assignedDeliveryBoy) {
        delete so.assignedDeliveryBoy.location
      }
    })

    return res.status(200).json(plain)
  } catch (error) {
    console.error("getOrderById error:", error)
    return res.status(500).json({ message: "Could not load the order" })
  }
}

// ---------------------------------------------------------------------------
// DELIVERY OTP
// The OTP is emailed to the CUSTOMER. It is never returned to the delivery
// partner, so a delivery can only be completed by someone who met the customer.
// ---------------------------------------------------------------------------
const findAssignedShopOrder = async (orderId, shopId, deliveryBoyId) => {
  if (!isObjectId(orderId) || !isObjectId(shopId)) {
    return { error: { status: 400, message: "Invalid order or shop" } }
  }

  const order = await Order.findById(orderId).populate("customer", "fullName email mobile socketId")

  if (!order) {
    return { error: { status: 404, message: "Order not found" } }
  }

  const shopOrder = order.shopOrders.find((so) => idOf(so.shop) === shopId)

  if (!shopOrder) {
    return { error: { status: 404, message: "Shop order not found" } }
  }

  if (!shopOrder.assignedDeliveryBoy || idOf(shopOrder.assignedDeliveryBoy) !== String(deliveryBoyId)) {
    return { error: { status: 403, message: "This delivery is not assigned to you" } }
  }

  if (shopOrder.status !== "out of delivery") {
    return { error: { status: 400, message: "This order is not out for delivery" } }
  }

  return { order, shopOrder }
}

export const sendDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopId } = req.body || {}
    const { order, shopOrder, error } = await findAssignedShopOrder(orderId, shopId, req.userId)

    if (error) {
      return res.status(error.status).json({ message: error.message })
    }

    const otp = generateOtp()

    try {
      await sendDeliveryOtpMail(order.customer, otp)
    } catch (mailError) {
      console.error("Delivery OTP email failed:", mailError.message)
      return res.status(502).json({ message: "Could not send the OTP to the customer. Please try again." })
    }

    shopOrder.otp = Number(otp)
    shopOrder.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)
    shopOrder.otpAttempts = 0
    order.markModified("shopOrders")
    await order.save()

    return res.status(200).json({ message: "OTP sent to the customer's email" })
  } catch (error) {
    console.error("sendDeliveryOtp error:", error)
    return res.status(500).json({ message: "Could not send the OTP" })
  }
}

export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopId, otp } = req.body || {}
    const { order, shopOrder, error } = await findAssignedShopOrder(orderId, shopId, req.userId)

    if (error) {
      return res.status(error.status).json({ message: error.message })
    }

    if (!shopOrder.otp || !shopOrder.otpExpiresAt || shopOrder.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired. Send a new OTP." })
    }

    if ((shopOrder.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      shopOrder.otp = null
      shopOrder.otpExpiresAt = null
      order.markModified("shopOrders")
      await order.save()
      return res.status(429).json({ message: "Too many wrong attempts. Send a new OTP." })
    }

    if (String(shopOrder.otp) !== String(otp ?? "").trim()) {
      shopOrder.otpAttempts = (shopOrder.otpAttempts || 0) + 1
      order.markModified("shopOrders")
      await order.save()
      return res.status(400).json({ message: "Invalid OTP" })
    }

    shopOrder.status = "delivered"
    shopOrder.otp = null
    shopOrder.otpExpiresAt = null
    shopOrder.otpAttempts = 0
    shopOrder.deliveredAt = new Date()
    order.markModified("shopOrders")
    await order.save()

    if (order.customer?.socketId) {
      getIO().to(order.customer.socketId).emit("update-status", {
        orderId: order._id,
        shopId,
        status: "delivered",
        userId: order.customer._id
      })
    }

    return res.status(200).json({ message: "Order delivered successfully" })
  } catch (error) {
    console.error("verifyDeliveryOtp error:", error)
    return res.status(500).json({ message: "Could not verify the OTP" })
  }
}

export const getTodayDeliveries = async (req, res) => {
  try {
    const deliveryBoyId = String(req.userId)
    const startsOfDay = new Date()
    startsOfDay.setHours(0, 0, 0, 0)

    const orders = await Order.find({
      "shopOrders.assignedDeliveryBoy": deliveryBoyId,
      "shopOrders.status": "delivered",
      "shopOrders.deliveredAt": { $gte: startsOfDay }
    }).lean()

    const stats = {}

    for (const order of orders) {
      for (const shopOrder of order.shopOrders) {
        if (
          String(shopOrder.assignedDeliveryBoy) === deliveryBoyId &&
          shopOrder.status === "delivered" &&
          shopOrder.deliveredAt &&
          shopOrder.deliveredAt >= startsOfDay
        ) {
          const hour = new Date(shopOrder.deliveredAt).getHours()
          stats[hour] = (stats[hour] || 0) + 1
        }
      }
    }

    const formattedStats = Object.keys(stats)
      .map((hour) => ({ hour: parseInt(hour), count: stats[hour] }))
      .sort((a, b) => a.hour - b.hour)

    return res.status(200).json(formattedStats)
  } catch (error) {
    console.error("getTodayDeliveries error:", error)
    return res.status(500).json({ message: "Could not load today's deliveries" })
  }
}
