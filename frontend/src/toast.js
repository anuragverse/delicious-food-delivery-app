// Tiny toast bus: any module can call notify.error("...") / notify.success("...");
// <Toaster /> (mounted once in App) listens and renders them.
const listeners = new Set()
let nextId = 1

const emit = (type, message) => {
  if (!message) return
  const toast = { id: nextId++, type, message: String(message) }
  listeners.forEach((fn) => fn(toast))
}

export const notify = {
  success: (message) => emit("success", message),
  error: (message) => emit("error", message),
  info: (message) => emit("info", message)
}

export const subscribeToasts = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Best human-readable message from an axios error
export const errMsg = (error, fallback = "Something went wrong. Please try again.") => {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.code === "ERR_NETWORK" || (error && !error.response)) {
    return "Cannot reach the server. Check your connection and try again."
  }
  return fallback
}
