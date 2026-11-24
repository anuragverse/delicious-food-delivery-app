// A city the user picked by hand is remembered and wins over the detected one.
const KEY = "delicious_city"

export const getSavedCity = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveCity = (city) => {
  try {
    localStorage.setItem(KEY, city)
  } catch {
    // storage unavailable - the choice lasts until reload
  }
}

export const clearSavedCity = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
