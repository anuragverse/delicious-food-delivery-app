import React, { useEffect, useState } from 'react'
import { subscribeToasts } from '../toast'

const STYLES = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-gray-800"
}

function Toaster() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 4000)
    })
  }, [])

  return (
    <div
      className='fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 w-[92%] max-w-sm pointer-events-none'
      role='status'
      aria-live='polite'
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${STYLES[t.type] || STYLES.info} text-white text-sm px-4 py-3 rounded-xl shadow-lg pointer-events-auto`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

export default Toaster
