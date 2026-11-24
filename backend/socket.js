import User from "./models/user.model.js"
import Order from "./models/order.model.js"
import { verifyToken } from "./utils/token.js"

let ioInstance = null

export const setIO = (io) => {
  ioInstance = io
}

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized")
  }
  return ioInstance
}

// Which customers are currently waiting for this delivery partner?
// Cached briefly so a location update every few seconds does not hit the DB each time.
const customerCache = new Map()
const CACHE_MS = 10 * 1000

const getWaitingCustomerIds = async (deliveryBoyId) => {
  const cached = customerCache.get(deliveryBoyId)

  if (cached && cached.expires > Date.now()) {
    return cached.ids
  }

  const orders = await Order.find({
    shopOrders: {
      $elemMatch: { assignedDeliveryBoy: deliveryBoyId, status: "out of delivery" }
    }
  }).select("customer")

  const ids = [...new Set(orders.map((order) => String(order.customer)))]
  customerCache.set(deliveryBoyId, { ids, expires: Date.now() + CACHE_MS })

  return ids
}

export const socketHandler = (io) => {
  setIO(io)

  // Every connection must present a valid JWT. The user id comes from the
  // token, never from anything the client claims in an event.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token

      if (!token) {
        return next(new Error("unauthorized"))
      }

      const { userId } = verifyToken(token)
      const user = await User.findById(userId).select("role")

      if (!user) {
        return next(new Error("unauthorized"))
      }

      socket.data.userId = String(user._id)
      socket.data.role = user.role
      next()
    } catch (error) {
      next(new Error("unauthorized"))
    }
  })

  io.on("connection", async (socket) => {
    const userId = socket.data.userId

    socket.join(`user:${userId}`)

    try {
      await User.findByIdAndUpdate(userId, {
        socketId: socket.id,
        isOnline: true
      })
    } catch (error) {
      console.error("socket connect error:", error.message)
    }

    socket.on("updateLocation", async ({ latitude, longitude } = {}) => {
      try {
        const lat = Number(latitude)
        const lon = Number(longitude)

        if (
          socket.data.role !== "deliveryBoy" ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        ) {
          return
        }

        await User.findByIdAndUpdate(userId, {
          location: { type: "Point", coordinates: [lon, lat] },
          isOnline: true,
          socketId: socket.id
        })

        // Only the customers waiting for this partner see the live location
        const customerIds = await getWaitingCustomerIds(userId)

        for (const customerId of customerIds) {
          io.to(`user:${customerId}`).emit("updateDeliveryLocation", {
            deliveryBoyId: userId,
            latitude: lat,
            longitude: lon
          })
        }
      } catch (error) {
        console.error("updateLocation error:", error.message)
      }
    })

    socket.on("disconnect", async () => {
      try {
        await User.findOneAndUpdate(
          { _id: userId, socketId: socket.id },
          { socketId: null, isOnline: false }
        )
      } catch (error) {
        console.error("socket disconnect error:", error.message)
      }
    })
  })
}
