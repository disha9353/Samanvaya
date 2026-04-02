import { configureStore, combineReducers } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import campaignsReducer from './campaignsSlice'
import { persistReducer, persistStore } from 'redux-persist'
import { setAccessToken } from '../api/http'

// redux-persist's storage module is CommonJS; under ESM/Vite we need to grab the `.default`.
import storageImport from 'redux-persist/lib/storage'

const rootReducer = combineReducers({
  auth: authReducer,
  campaigns: campaignsReducer,
})

const storage = (storageImport as any)?.default || (storageImport as any)

const persistConfig = {
  key: 'ecobarternplus',
  storage,
  whitelist: ['auth', 'campaigns'],
}

const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export const persistor = persistStore(store)
export { store }

// Keep axios Authorization header in sync with persisted auth.
store.subscribe(() => {
  const token = store.getState().auth?.accessToken
  if (token) setAccessToken(token)
})

// On page load, eagerly set the token from persisted state before
// redux-persist finishes rehydrating, so the very first API request is authorized.
try {
  const raw = localStorage.getItem('persist:ecobarternplus')
  if (raw) {
    const persisted = JSON.parse(raw)
    const auth = JSON.parse(persisted.auth || '{}')
    if (auth?.accessToken) setAccessToken(auth.accessToken)
  }
} catch { /* ignore parse errors */ }

