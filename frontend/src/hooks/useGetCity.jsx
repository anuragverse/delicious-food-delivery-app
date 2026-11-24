import axios from 'axios'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setCurrentAddress, setCurrentCity, setCurrentState } from '../redux/userSlice'
import { setAddress, setLocation } from '../redux/mapSlice'
import { getSavedCity } from '../cityStorage'

function useGetCity() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)
    const apiKey = import.meta.env.VITE_GEOAPIKEY

    useEffect(() => {
        // A city chosen by hand (city picker) always wins over the detected one
        const savedCity = getSavedCity()
        if (savedCity) {
            dispatch(setCurrentCity(savedCity))
        }

        if (!navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude
                const longitude = position.coords.longitude
                dispatch(setLocation({ lat: latitude, lon: longitude }))

                if (!apiKey) {
                    console.warn("VITE_GEOAPIKEY is missing, so your city cannot be detected. Choose it from the city picker.")
                    return
                }

                try {
                    const result = await axios.get(
                        `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&format=json&apiKey=${apiKey}`
                    )

                    const place = result?.data?.results?.[0]
                    if (!place) return

                    const detectedCity =
                        place.city || place.town || place.village || place.suburb || place.county || place.state_district

                    if (!savedCity && detectedCity) {
                        dispatch(setCurrentCity(detectedCity))
                    }

                    dispatch(setCurrentState(place.state))
                    dispatch(setCurrentAddress(place.address_line2 || place.address_line1))
                    dispatch(setAddress(place.address_line2))
                } catch (error) {
                    console.warn("Could not look up your city:", error?.message)
                }
            },
            (error) => {
                console.warn("Location unavailable:", error.message)
            }
        )
    }, [userData, dispatch, apiKey])
}

export default useGetCity
