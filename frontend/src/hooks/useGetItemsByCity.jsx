import axios from 'axios'
import { useEffect } from 'react'
import { apiBase as serverUrl } from '../api';
import { useDispatch, useSelector } from 'react-redux'
import { setItemsInMyCity } from '../redux/userSlice'

function useGetItemsByCity() {
    const dispatch = useDispatch()
    const { currentCity, userData } = useSelector(state => state.user)

    useEffect(() => {
        // Needs a known city AND a signed-in user (the API requires login)
        if (!currentCity || !userData?._id) return

        const fetchItems = async () => {
            try {
                const result = await axios.get(
                    `${serverUrl}/api/item/get-by-city/${encodeURIComponent(currentCity)}`,
                    { withCredentials: true }
                )
                dispatch(setItemsInMyCity(result.data))
            } catch (error) {
                if (error?.response?.status === 404) {
                    dispatch(setItemsInMyCity([]))
                } else {
                    console.log(error)
                }
            }
        }

        fetchItems()
    }, [currentCity, userData?._id, dispatch])
}

export default useGetItemsByCity
