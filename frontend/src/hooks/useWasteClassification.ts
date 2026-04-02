import { useState } from 'react'
import { http } from '../api/http'

interface WasteClassification {
  wasteType: string
  confidence: number
  disposalInstructions: string
  ecoImpact: string
  recyclingPotential: string
  pickupRecommendation: string
  imageUrl: string
  timestamp: string
}

interface WasteClassificationResponse {
  success: boolean
  classification: WasteClassification
  imageUrl: string
}

export const useWasteClassification = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const classifyWaste = async (imageFile: File): Promise<WasteClassificationResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const response = await http.post('/ai/classify-waste', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to classify waste'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    classifyWaste,
    isLoading,
    error
  }
}