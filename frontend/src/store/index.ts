import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import invoiceReducer from './slices/invoiceSlice';
import gstReducer from './slices/gstSlice';
 
const store = configureStore({
  reducer: {
    auth: authReducer,
    invoice: invoiceReducer,
    gst: gstReducer
  }
});
 
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
 
export default store;