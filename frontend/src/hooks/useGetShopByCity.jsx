import axios from 'axios'
import { useEffect } from 'react'
import { apiBase as serverUrl } from '../api';
import { useDispatch, useSelector } from 'react-redux'
import { setShopsInMyCity } from '../redux/userSlice'

function useGetShopByCity() {
    const dispatch = useDispatch()
    const { currentCity, userData } = useSelector(state => state.user)

    useEffect(() => {
        // Needs a known city AND a signed-in user (the API requires login)
        if (!currentCity || !userData?._id) return

        const fetchShops = async () => {
            try {
                const result = await axios.get(
                    `${serverUrl}/api/shop/get-by-city/${encodeURIComponent(currentCity)}`,
                    { withCredentials: true }
                )
                dispatch(setShopsInMyCity(result.data))
            } catch (error) {
                // 404 = no shops in this city: an empty list (not "still loading")
                if (error?.response?.status === 404) {
                    dispatch(setShopsInMyCity([]))
                } else {
                    console.log(error)
                }
            }
        }

        fetchShops()
    }, [currentCity, userData?._id, dispatch])
}

export default useGetShopByCity
