import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export const http = axios.create({
  baseURL,
})

const initialToken = localStorage.getItem('token')
if (initialToken) {
  http.defaults.headers.common.Authorization = `Bearer ${initialToken}`
}

http.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('i18nextLng') || ''
    const lng = raw.split('-')[0].toLowerCase()
    if (lng && ['en', 'hi', 'kn'].includes(lng)) {
      config.headers = config.headers ?? {}
      ;(config.headers as Record<string, string>)['X-Language'] = lng
      config.headers['Accept-Language'] = lng
    }
  } catch {
    /* ignore */
  }
  return config
})

export function setAccessToken(token: string | null) {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`
    localStorage.setItem('token', token)
  } else {
    delete http.defaults.headers.common.Authorization
    localStorage.removeItem('token')
  }
}

