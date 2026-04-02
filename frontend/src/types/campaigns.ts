export type CampaignStatus = 'OPEN' | 'FULL' | 'COMPLETED'

export type CampaignParticipant = {
  _id: string
  name?: string
  profilePic?: string
}

export type Campaign = {
  _id: string
  title: string
  description?: string
  category?: string
  location?: string
  coordinates?: { lat: number; lng: number }
  dateTime?: string
  maxParticipants?: number
  imageUrl?: string
  organizer?: { _id: string; name?: string; profilePic?: string } | string
  participants?: Array<CampaignParticipant | string>
  status?: CampaignStatus | string
  createdAt?: string

  // Hour-based credit system
  durationHours?: number
  creditsPerHour?: number
  totalCredits?: number

  // QR Attendance
  attendanceQrToken?: string
  attendedParticipants?: Array<CampaignParticipant | string>
  rewardedParticipants?: Array<CampaignParticipant | string>
}
