import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import { http } from '../api/http'
import { setAuth } from './authSlice'
import type { Campaign } from '../types/campaigns'

type CampaignsState = {
  list: Campaign[]
  byId: Record<string, Campaign | undefined>
  joinedIds: Record<string, true | undefined>
  status: 'idle' | 'loading' | 'failed'
  error?: string
}

const initialState: CampaignsState = {
  list: [],
  byId: {},
  joinedIds: {},
  status: 'idle',
}

export const fetchCampaigns = createAsyncThunk('campaigns/fetchCampaigns', async () => {
  const res = await http.get('/api/campaigns')
  const items = (res.data?.campaigns || res.data?.items || res.data) as Campaign[]
  return Array.isArray(items) ? items : []
})

export const fetchCampaignById = createAsyncThunk('campaigns/fetchCampaignById', async (id: string) => {
  const res = await http.get(`/api/campaigns/${id}`)
  const c = (res.data?.campaign || res.data) as Campaign
  return c
})

export const createCampaign = createAsyncThunk('campaigns/createCampaign', async (payload: any) => {
  const res = await http.post('/api/campaigns', payload)
  return (res.data?.campaign || res.data) as Campaign
})

export const joinCampaign = createAsyncThunk('campaigns/joinCampaign', async (payload: { campaignId: string }, thunkApi) => {
  const res = await http.post('/api/campaigns/join', payload)
  // backend might return {campaign} or just updated campaign
  const c = (res.data?.campaign || res.data) as Campaign

  // Refresh auth user so header/dashboard credits reflect earned volunteer reward immediately.
  const me = await http.get('/api/auth/me')
  const state = thunkApi.getState() as any
  const accessToken = state?.auth?.accessToken
  const refreshToken = state?.auth?.refreshToken
  if (me.data?.user && accessToken) {
    thunkApi.dispatch(setAuth({ user: me.data.user, accessToken, refreshToken: refreshToken || undefined }))
  }

  return { campaignId: payload.campaignId, campaign: c }
})

const campaignsSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    setJoinedLocal(state, action: PayloadAction<{ campaignId: string; joined: boolean }>) {
      if (action.payload.joined) state.joinedIds[action.payload.campaignId] = true
      else delete state.joinedIds[action.payload.campaignId]
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCampaigns.pending, (state) => {
        state.status = 'loading'
        state.error = undefined
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.status = 'idle'
        state.list = action.payload
        for (const c of action.payload) state.byId[c._id] = c
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })

    builder
      .addCase(fetchCampaignById.fulfilled, (state, action) => {
        state.byId[action.payload._id] = action.payload
      })
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.byId[action.payload._id] = action.payload
        state.list = [action.payload, ...state.list.filter((c) => c._id !== action.payload._id)]
      })
      .addCase(joinCampaign.fulfilled, (state, action) => {
        state.joinedIds[action.payload.campaignId] = true
        const c = action.payload.campaign
        if (c && c._id) {
          state.byId[c._id] = { ...(state.byId[c._id] || {}), ...c }
          state.list = state.list.map((x) => (x._id === c._id ? { ...x, ...c } : x))
        }
      })
  },
})

export const { setJoinedLocal } = campaignsSlice.actions
export default campaignsSlice.reducer

