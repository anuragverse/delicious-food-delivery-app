import { createSlice } from "@reduxjs/toolkit";

// The cart survives a page refresh (stored by redux/store.js)
const CART_KEY = "delicious_cart"

const loadCart = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]")
    if (!Array.isArray(raw)) return []
    return raw.filter((i) => i && i.id && Number(i.price) >= 0 && Number(i.quantity) > 0)
  } catch {
    return []
  }
}

const initialCart = loadCart()
const cartTotal = (items) => items.reduce((sum, i) => sum + i.price * i.quantity, 0)
export { CART_KEY }

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    authChecked: false,
    currentCity: null,
    currentState: null,
    currentAddress: null,
    shopInMyCity: null,
    itemsInMyCity: null,
    cartItems: initialCart,
    totalAmount: cartTotal(initialCart),
    myOrders: [],
    searchItems: null,
    socket: null,
    unreadOrderCount: 0
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload
      // signing out must not leave the previous person's cart behind
      if (!action.payload) {
        state.cartItems = []
        state.totalAmount = 0
      }
    },
    setAuthChecked: (state, action) => {
      state.authChecked = action.payload
    },
    setCurrentCity: (state, action) => {
      state.currentCity = action.payload
    },
    setCurrentState: (state, action) => {
      state.currentState = action.payload
    },
    setCurrentAddress: (state, action) => {
      state.currentAddress = action.payload
    },
    setShopsInMyCity: (state, action) => {
      state.shopInMyCity = action.payload
    },
    setItemsInMyCity: (state, action) => {
      state.itemsInMyCity = action.payload
    },
    setSocket: (state, action) => {
      state.socket = action.payload
    },

    addToCart: (state, action) => {
      const cartItem = action.payload
      const existingItem = state.cartItems.find(i => i.id == cartItem.id)

      if (existingItem) {
        existingItem.quantity += cartItem.quantity
      } else {
        state.cartItems.push(cartItem)
      }

      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },

    setTotalAmount: (state, action) => {
      state.totalAmount = action.payload
    },

    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload
      const item = state.cartItems.find(i => i.id == id)

      if (item) {
        item.quantity = quantity
      }

      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },

    clearCart: (state) => {
      state.cartItems = []
      state.totalAmount = 0
    },

    removeCartItem: (state, action) => {
      state.cartItems = state.cartItems.filter(i => i.id !== action.payload)
      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },

    setMyOrders: (state, action) => {
      state.myOrders = action.payload || []
    },

    addMyOrder: (state, action) => {
      const incoming = action.payload
      const exists = state.myOrders.find(order => order._id == incoming._id)

      if (!exists) {
        state.myOrders = [incoming, ...state.myOrders]
      }
    },

   addDeliveryAssignment: (state, action) => {
  const incoming = action.payload
  const exists = state.myOrders.find(order => order._id == incoming._id)

  if (!exists) {
    state.myOrders = [incoming, ...state.myOrders]
  }
},

    updateOrderStatus: (state, action) => {
      const { orderId, shopId, status, assignedDeliveryBoy, assignment } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)

      if (order && order.shopOrders) {
        const shopOrder = order.shopOrders.find(so => so.shop?._id == shopId || so.shop == shopId)
        if (shopOrder) {
          shopOrder.status = status
          if (assignedDeliveryBoy) {
            shopOrder.assignedDeliveryBoy = assignedDeliveryBoy
          }
          if (assignment) {
            shopOrder.assignment = assignment
          }
        }
      }
    },

    updateRealtimeOrderStatus: (state, action) => {
      const { orderId, shopId, status } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)

      if (order && order.shopOrders) {
        const shopOrder = order.shopOrders.find(so => so.shop?._id == shopId || so.shop == shopId)
        if (shopOrder) {
          shopOrder.status = status
        }
      }
    },

    setSearchItems: (state, action) => {
      state.searchItems = action.payload
    },

    incrementUnreadOrderCount: (state) => {
      state.unreadOrderCount += 1
    },

    resetUnreadOrderCount: (state) => {
      state.unreadOrderCount = 0
    }
  }
})

export const {
  setUserData,
  setAuthChecked,
  setCurrentAddress,
  setCurrentCity,
  setCurrentState,
  setShopsInMyCity,
  setItemsInMyCity,
  addToCart,
  updateQuantity,
  removeCartItem,
  clearCart,
  setMyOrders,
  addMyOrder,
  updateOrderStatus,
  setSearchItems,
  setTotalAmount,
  setSocket,
  updateRealtimeOrderStatus,
  incrementUnreadOrderCount,
  resetUnreadOrderCount,
  addDeliveryAssignment
} = userSlice.actions

export default userSlice.reducer