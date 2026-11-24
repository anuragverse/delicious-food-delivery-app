import { configureStore } from "@reduxjs/toolkit";
import userSlice, { CART_KEY } from "./userSlice"
import ownerSlice from "./ownerSlice"
import mapSlice from "./mapSlice"
export const store=configureStore({
    reducer:{
        user:userSlice,
        owner:ownerSlice,
        map:mapSlice
    },
    // The socket instance lives in the store, so skip the serializable check for it
    middleware:(getDefaultMiddleware)=>getDefaultMiddleware({serializableCheck:false})
})

// Persist the cart whenever it changes
let lastCart = store.getState().user.cartItems
store.subscribe(()=>{
    const cart = store.getState().user.cartItems
    if (cart === lastCart) return
    lastCart = cart
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
        // storage unavailable - the cart just will not survive a refresh
    }
})
