import React, { useEffect, useState } from 'react'
import scooter from "../assets/scooter.png"
import home from "../assets/home.png"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'

const deliveryBoyIcon = new L.Icon({
  iconUrl: scooter,
  iconSize: [40, 40],
  iconAnchor: [20, 40]
})

const customerIcon = new L.Icon({
  iconUrl: home,
  iconSize: [40, 40],
  iconAnchor: [20, 40]
})

function FitBounds({ routeCoordinates }) {
  const map = useMap()

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      map.fitBounds(routeCoordinates, { padding: [50, 50] })
    }
  }, [routeCoordinates, map])

  return null
}

function DeliveryBoyTracking({ data }) {
  const [routeCoordinates, setRouteCoordinates] = useState([])

  // A real position: a finite number pair that is not the (0, 0) placeholder
  // stored for partners who have not shared their location yet
  const toNum = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v))
  const isValidPoint = (lat, lon) =>
    Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)

  const deliveryBoyLat = toNum(data?.deliveryBoyLocation?.lat)
  const deliveryBoylon = toNum(data?.deliveryBoyLocation?.lon)
  const customerLat = toNum(data?.customerLocation?.lat)
  const customerlon = toNum(data?.customerLocation?.lon)

  const hasPartner = isValidPoint(deliveryBoyLat, deliveryBoylon)
  const hasCustomer = isValidPoint(customerLat, customerlon)

  const center = hasPartner ? [deliveryBoyLat, deliveryBoylon] : [customerLat, customerlon]

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        if (!hasPartner || !hasCustomer) return

        const url = `https://router.project-osrm.org/route/v1/driving/${deliveryBoylon},${deliveryBoyLat};${customerlon},${customerLat}?overview=full&geometries=geojson`

        const response = await fetch(url)
        const result = await response.json()

        if (result.routes && result.routes.length > 0) {
          const coords = result.routes[0].geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          )
          setRouteCoordinates(coords)
        }
      } catch (error) {
        console.log("ROUTE FETCH ERROR:", error)
      }
    }

    fetchRoute()
  }, [deliveryBoyLat, deliveryBoylon, customerLat, customerlon, hasPartner, hasCustomer])

  if (!hasCustomer) {
    return (
      <div className='w-full h-[400px] mt-3 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-gray-100'>
        <p className='text-gray-500'>Tracking data not available (this order has no delivery coordinates)</p>
      </div>
    )
  }

  return (
    <div className='relative w-full h-[400px] mt-3 rounded-xl overflow-hidden shadow-md'>
      {!hasPartner && (
        <div className='absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 text-gray-700 text-sm px-3 py-1.5 rounded-full shadow'>
          Waiting for the delivery partner&apos;s live location...
        </div>
      )}
      <MapContainer
        key={hasPartner ? "with-partner" : "no-partner"}
        className="w-full h-full"
        center={center}
        zoom={16}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasPartner && (
          <Marker position={[deliveryBoyLat, deliveryBoylon]} icon={deliveryBoyIcon}>
            <Popup>Delivery Boy</Popup>
          </Marker>
        )}

        <Marker position={[customerLat, customerlon]} icon={customerIcon}>
          <Popup>Customer Location</Popup>
        </Marker>

        {routeCoordinates.length > 0 && (
          <>
            <Polyline positions={routeCoordinates} color='blue' weight={5} />
            <FitBounds routeCoordinates={routeCoordinates} />
          </>
        )}
      </MapContainer>
    </div>
  )
}

export default DeliveryBoyTracking