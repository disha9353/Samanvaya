import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Leaf, TrendingUp, Target, Award, Recycle, BarChart3 } from 'lucide-react'
import { http } from '../api/http'

interface EcoAnalysis {
  userStats: {
    ecoScore: number
    co2SavedKg: number
    wasteRecycledKg: number
    itemsReusedCount: number
    credits: number
  }
  recentActivities: Array<{
    type: string
    description: string
    date: string
  }>
  analysis: {
    currentLevel: string
    insights: string[]
    suggestions: Array<{
      action: string
      impact: string
      difficulty: string
      points: number
    }>
    nextMilestone: string
    weeklyGoal: string
  }
}

interface EcoAnalysisProps {
  isVisible: boolean
  onClose: () => void
}

const EcoAnalysis: React.FC<EcoAnalysisProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const [analysis, setAnalysis] = useState<EcoAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isVisible && !analysis) {
      fetchEcoAnalysis()
    }
  }, [isVisible, analysis])

  const fetchEcoAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await http.post('/ai/analyze-eco') as EcoAnalysis
      setAnalysis(response)
    } catch (err) {
      console.error('Eco analysis error:', err)
      setError('Failed to analyze your eco activities. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'text-green-500'
      case 'intermediate': return 'text-blue-500'
      case 'advanced': return 'text-purple-500'
      case 'expert': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isVisible) return null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-400 to-teal-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">{t('auto.eco_impact_analysis', `Eco Impact Analysis`)}</h2>
                <p className="text-green-100">{t('auto.your_environmental_journey_ins', `Your environmental journey insights`)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
              <span className="ml-3 text-gray-600">{t('auto.analyzing_your_eco_impact', `Analyzing your eco impact...`)}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <Leaf className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{analysis.userStats.ecoScore}</div>
                  <div className="text-sm text-gray-600">{t('auto.eco_score', `Eco Score`)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <Recycle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{analysis.userStats.wasteRecycledKg}{t('auto.kg', `kg`)}</div>
                  <div className="text-sm text-gray-600">{t('auto.waste_recycled', `Waste Recycled`)}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">{analysis.userStats.co2SavedKg}{t('auto.kg', `kg`)}</div>
                  <div className="text-sm text-gray-600">{t('auto.co_saved', `CO₂ Saved`)}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <Award className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-600">{analysis.userStats.itemsReusedCount}</div>
                  <div className="text-sm text-gray-600">{t('auto.items_reused', `Items Reused`)}</div>
                </div>
              </div>

              {/* Current Level */}
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-gray-700">{t('auto.current_level', `Current Level:`)}</span>
                  <span className={`font-bold capitalize ${getLevelColor(analysis.analysis.currentLevel)}`}>
                    {analysis.analysis.currentLevel}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>{t('auto.next_milestone', `Next Milestone:`)}</strong> {analysis.analysis.nextMilestone}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>{t('auto.weekly_goal', `Weekly Goal:`)}</strong> {analysis.analysis.weeklyGoal}
                </div>
              </div>

              {/* Insights */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  {t('auto.key_insights', `Key Insights`)}
                                                  </h3>
                <div className="space-y-2">
                  {analysis.analysis.insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {insight}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-green-600" />
                  {t('auto.improvement_suggestions', `Improvement Suggestions`)}
                                                  </h3>
                <div className="space-y-3">
                  {analysis.analysis.suggestions.map((suggestion, index) => (
                    <motion.div
                      key={index}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 mb-1">
                            {suggestion.action}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {suggestion.impact}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(suggestion.difficulty)}`}>
                              {suggestion.difficulty}
                            </span>
                            <span className="text-sm text-green-600 font-medium">
                              +{suggestion.points} {t('auto.points', `points`)}
                                                                      </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recent Activities */}
              {analysis.recentActivities.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-purple-600" />
                    {t('auto.recent_activities', `Recent Activities`)}
                                                        </h3>
                  <div className="space-y-2">
                    {analysis.recentActivities.map((activity, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1 text-sm text-gray-700">{activity.description}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default EcoAnalysis