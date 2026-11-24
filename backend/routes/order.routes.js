import express from "express"
import rateLimit from "express-rate-limit"
import isAuth, { requireRole } from "../middlewares/isAuth.js"
import {
  acceptOrder,
  getCurrentOrder,
  getDeliveryBoyAssignment,
  getMyOrders,
  getOrderById,
  getTodayDeliveries,
  placeOrder,
  sendDeliveryOtp,
  updateOrderStatus,
  verifyDeliveryOtp,
  verifyPayment
} from "../controllers/order.controllers.js"

const orderRouter = express.Router()

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please try again in a few minutes." }
})

orderRouter.post("/place-order", isAuth, requireRole("user"), placeOrder)
orderRouter.post("/verify-payment", isAuth, requireRole("user"), verifyPayment)
orderRouter.get("/my-orders", isAuth, getMyOrders)
orderRouter.get("/get-assignments", isAuth, requireRole("deliveryBoy"), getDeliveryBoyAssignment)
orderRouter.get("/get-current-order", isAuth, requireRole("deliveryBoy"), getCurrentOrder)
orderRouter.post("/send-delivery-otp", isAuth, requireRole("deliveryBoy"), otpLimiter, sendDeliveryOtp)
orderRouter.post("/verify-delivery-otp", isAuth, requireRole("deliveryBoy"), otpLimiter, verifyDeliveryOtp)
orderRouter.post("/update-status/:orderId/:shopId", isAuth, requireRole("owner"), updateOrderStatus)
orderRouter.get("/accept-order/:assignmentId", isAuth, requireRole("deliveryBoy"), acceptOrder)
orderRouter.get("/get-order-by-id/:orderId", isAuth, getOrderById)
orderRouter.get("/get-today-deliveries", isAuth, requireRole("deliveryBoy"), getTodayDeliveries)

export default orderRouter
