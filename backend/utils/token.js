import jwt from "jsonwebtoken"

const genToken = async (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" })
}

export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET)

export default genToken
