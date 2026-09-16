import { configureStore } from "@reduxjs/toolkit";
import shopReducer from "./shopSlice";

/**
 * Single Redux store for VELUR e-commerce application.
 *
 * NOTE: (§7.4) One slice, because the basket, the wishlist and the drawer flags
 * are written by the same few interactions.
 */
export const store = configureStore({
  reducer: {
    shop: shopReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
