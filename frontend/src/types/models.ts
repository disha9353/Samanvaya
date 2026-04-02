export type UserRole = 'user' | 'collector' | 'admin'

export type User = {
  _id: string
  name: string
  email: string
  role: UserRole
  credits: number
  profilePic?: string
  ecoScore?: number
}

export type Item = {
  _id: string
  title: string
  description?: string
  images: string[]
  price: number
  seller: User | { _id: string; name: string; profilePic?: string; role?: string }
  status: 'Available' | 'Sold' | 'Exchanged'
  interestedUsers: string[]
  savedUsers: string[]
  likedUsers: string[]
  createdAt: string
  soldAt?: string
  buyer?: string
  category?: string
  location?: {
    type: string
    coordinates: [number, number] // [lng, lat]
  }
}

export type Notification = {
  _id: string
  userId: string
  type: string
  payload: any
  isRead: boolean
  createdAt: string
}

