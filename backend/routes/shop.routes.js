import express from "express"
import { createEditShop, getMyShop, getShopByCity, getShopCities } from "../controllers/shop.controllers.js"
import isAuth, { requireRole } from "../middlewares/isAuth.js"
import { upload } from "../middlewares/multer.js"

const shopRouter = express.Router()

shopRouter.post("/create-edit", isAuth, requireRole("owner"), upload.single("image"), createEditShop)
shopRouter.get("/get-my", isAuth, getMyShop)
shopRouter.get("/get-by-city/:city", isAuth, getShopByCity)
shopRouter.get("/cities", isAuth, getShopCities)

export default shopRouter
