import { useState } from 'react'
import { http } from '../api/http'

interface BarterSuggestion {
  userItem: string
  marketplaceItem: string
  creditAdjustment: number
  reasoning: string
}

interface BarterSuggestionsResponse {
  userItems: any[]
  marketplaceItems: any[]
  suggestions: {
    suggestions: BarterSuggestion[]
    summary: string
  }
}

export const useBarterSuggestions = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSuggestions = async (): Promise<BarterSuggestionsResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await http.post('/ai/barter-suggestions')
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to get barter suggestions'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    getSuggestions,
    isLoading,
    error
  }
}