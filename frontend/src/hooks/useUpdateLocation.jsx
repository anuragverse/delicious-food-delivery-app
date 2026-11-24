import axios from 'axios'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { apiBase as serverUrl } from '../api';

// Keeps the signed-in user's saved location fresh (used for delivery matching and tracking).
function useUpdateLocation() {
  const userId = useSelector((state) => state.user.userData?._id)

  useEffect(() => {
    if (!userId || !navigator.geolocation) return

    let lastSent = 0

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        // at most one update every 5 seconds
        if (Date.now() - lastSent < 5000) return
        lastSent = Date.now()

        try {
          await axios.post(
            `${serverUrl}/api/user/update-location`,
            { lat: pos.coords.latitude, lon: pos.coords.longitude },
            { withCredentials: true }
          )
        } catch {
          // location sync is best-effort
        }
      },
      () => {
        // permission denied / unavailable: nothing to do
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [userId])
}

export default useUpdateLocation
