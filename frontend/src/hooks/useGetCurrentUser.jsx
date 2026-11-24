import axios from 'axios'
import { useEffect } from 'react'
import { apiBase as serverUrl, getToken } from '../api';
import { useDispatch } from 'react-redux'
import { setAuthChecked, setUserData } from '../redux/userSlice'

// Restores the session on page load. `authChecked` stays false until we know whether the
// visitor is signed in, so a refresh on /my-orders does not bounce them to the sign-in page.
function useGetCurrentUser() {
  const dispatch = useDispatch()

  useEffect(() => {
    if (!getToken()) {
      dispatch(setAuthChecked(true))
      return
    }

    const fetchUser = async () => {
      try {
        const result = await axios.get(`${serverUrl}/api/user/current`, { withCredentials: true })
        dispatch(setUserData(result.data))
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.log("Could not restore the session:", error?.message)
        }
      } finally {
        dispatch(setAuthChecked(true))
      }
    }

    fetchUser()
  }, [dispatch])
}

export default useGetCurrentUser
