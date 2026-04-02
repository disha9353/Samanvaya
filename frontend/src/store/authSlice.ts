import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { http, setAccessToken } from '../api/http'

export type EcoUser = {
  _id: string
  name: string
  email: string
  role: 'user' | 'collector' | 'admin'
  credits: number
  profilePic?: string
  ecoScore?: number
  isMFAEnabled?: boolean
  hasTotpSecret?: boolean
}

type AuthState = {
  user: EcoUser | null
  accessToken: string | null
  refreshToken: string | null
  status: 'idle' | 'loading' | 'failed'
  error?: string
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  status: 'idle',
}

export const register = createAsyncThunk(
  'auth/register',
  async (payload: { name: string; email: string; password: string; role?: 'user' | 'collector' }) => {
    const res = await http.post('/api/auth/register', payload)
    return res.data as { user: EcoUser; accessToken: string; refreshToken: string }
  }
)

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }) => {
    const res = await http.post('/api/auth/login', payload)
    // could return { status: 'OTP_REQUIRED', message: '...' } OR { status: 'SUCCESS', user, accessToken, refreshToken }
    return res.data as { status?: string; message?: string; user?: EcoUser; accessToken?: string; refreshToken?: string }
  }
)

export const refresh = createAsyncThunk('auth/refresh', async (payload: { refreshToken: string }) => {
  const res = await http.post('/api/auth/refresh', payload)
  return res.data as { user: EcoUser; accessToken: string }
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.status = 'idle'
      setAccessToken(null)
    },
    setAuth(state, action: PayloadAction<{ user: EcoUser; accessToken: string; refreshToken?: string }>) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      if (action.payload.refreshToken) state.refreshToken = action.payload.refreshToken
      setAccessToken(action.payload.accessToken)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.status = 'loading'
        state.error = undefined
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'idle'
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        setAccessToken(action.payload.accessToken)
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })

    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = undefined
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle'
        if (action.payload.status === 'SUCCESS' || !action.payload.status) {
          state.user = action.payload.user!
          state.accessToken = action.payload.accessToken!
          state.refreshToken = action.payload.refreshToken!
          setAccessToken(action.payload.accessToken!)
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })

    builder
      .addCase(refresh.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        setAccessToken(action.payload.accessToken)
      })
  },
})

export const { logout, setAuth } = authSlice.actions

export default authSlice.reducer

