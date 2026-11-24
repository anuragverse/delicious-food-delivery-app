import axios from "axios"

// The backend authenticates with `Authorization: Bearer <token>` instead of cookies,
// so login keeps working when the frontend and backend live on different domains
// (e.g. Vercel + Render), including browsers that block third-party cookies.

const TOKEN_KEY = "delicious_token"

export const apiBase = (import.meta.env.VITE_SERVER_URL || "http://localhost:5000").replace(/\/+$/, "")

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const setToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage unavailable (private mode) - session will last until reload
  }
}

const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

const isApiUrl = (url = "") => url.startsWith(apiBase)

// Send the token to OUR backend only - never to third-party APIs (e.g. Geoapify)
axios.interceptors.request.use((config) => {
  const token = getToken()

  if (token && isApiUrl(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

axios.interceptors.response.use(
  (response) => {
    const url = response.config?.url || ""

    if (isApiUrl(url)) {
      if (url.endsWith("/api/auth/signout")) {
        clearToken()
      } else if (/\/api\/auth\/(signin|signup|google-auth)$/.test(url) && response.data?.token) {
        setToken(response.data.token)
        // keep the token out of the Redux user object
        const user = { ...response.data }
        delete user.token
        response.data = user
      }
    }

    return response
  },
  (error) => {
    const url = error.config?.url || ""

    // Expired / invalid session: forget the token (sign-in errors are handled by the page)
    if (error.response?.status === 401 && isApiUrl(url) && !url.includes("/api/auth/")) {
      clearToken()
    }

    return Promise.reject(error)
  }
)
