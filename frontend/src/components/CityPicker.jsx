import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useDispatch } from 'react-redux'
import { apiBase as serverUrl } from '../api';
import { setCurrentCity } from '../redux/userSlice'
import { saveCity } from '../cityStorage'

// Lists the cities that have shops so the customer can always get to some food,
// even if location is blocked or the detected city name differs from the shop's.
function CityPicker({ title, onDone }) {
  const dispatch = useDispatch()
  const [cities, setCities] = useState(null)

  useEffect(() => {
    axios
      .get(`${serverUrl}/api/shop/cities`, { withCredentials: true })
      .then((result) => setCities(result.data))
      .catch(() => setCities([]))
  }, [])

  const choose = (city) => {
    saveCity(city)
    dispatch(setCurrentCity(city))
    if (onDone) onDone()
  }

  return (
    <div className='w-full bg-white rounded-2xl shadow px-6 py-5 flex flex-col gap-3'>
      <h2 className='text-lg font-semibold text-gray-800'>{title}</h2>

      {cities === null && <p className='text-gray-500 text-sm'>Loading cities...</p>}

      {cities && cities.length === 0 && (
        <p className='text-gray-500 text-sm'>No restaurants have been added yet. Please check back soon.</p>
      )}

      {cities && cities.length > 0 && (
        <div className='flex flex-wrap gap-3'>
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => choose(city)}
              className='px-5 py-2 rounded-full border border-gray-300 bg-white text-gray-700 font-medium transition hover:border-[#ff4d2d] hover:text-[#ff4d2d]'
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CityPicker
