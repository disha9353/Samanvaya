import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { LatLng } from './LocationPicker'

type WasteLocation = {
  id: string
  location: LatLng
  wasteType: string
  quantity: number
  status: string
  userName: string
}

type Props = {
  wasteLocations: WasteLocation[]
  currentLocation?: LatLng
}

export default function CollectorNavigationMap({ wasteLocations, currentLocation }: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map())
  const currentLocationMarkerRef = useRef<LeafletMarker | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    if (!containerRef.current) return
    if (mapRef.current) return

    // Center on current location or first waste location
    const center = currentLocation || (wasteLocations.length > 0 ? wasteLocations[0].location : { lat: 28.6139, lng: 77.209 })
    
    const map = L.map(containerRef.current).setView([center.lat, center.lng], 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Add current location marker if available
    if (currentLocation) {
      const currentMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      })
        .addTo(map)
        .bindPopup('Your current location')

      currentLocationMarkerRef.current = currentMarker
    }

    // Leaflet needs a real layout pass; in React dev-mode this can be timing-sensitive.
    const raf = requestAnimationFrame(() => {
      try {
        map.invalidateSize()
      } catch {
        // ignore
      }
    })

    return () => {
      mountedRef.current = false
      cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.remove()
        currentLocationMarkerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    if (!mountedRef.current) return

    const map = mapRef.current
    const existing = markersRef.current

    // Remove markers for waste locations that no longer exist
    const incomingIds = new Set(wasteLocations.map((w) => w.id))
    for (const [id, marker] of existing.entries()) {
      if (!incomingIds.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    // Add or update markers for waste locations
    wasteLocations.forEach((waste) => {
      const key = waste.id
      const latlng: [number, number] = [waste.location.lat, waste.location.lng]
      
      const marker = existing.get(key)
      if (marker) {
        marker.setLatLng(latlng)
        marker.setPopupContent(`
          <div>
            <strong>${waste.wasteType}</strong><br/>
            ${waste.quantity} kg<br/>
            Customer: ${waste.userName}<br/>
            Status: ${waste.status}
          </div>
        `)
      } else {
        const newMarker = L.marker(latlng, {
          icon: L.icon({
            iconUrl: waste.status === 'accepted' 
              ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png'
              : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          }),
        })
          .addTo(map)
          .bindPopup(`
            <div>
              <strong>${waste.wasteType}</strong><br/>
              ${waste.quantity} kg<br/>
              Customer: ${waste.userName}<br/>
              Status: ${waste.status}
            </div>
          `)

        existing.set(key, newMarker)
      }
    })

    // Fit map to show all markers
    if (wasteLocations.length > 0) {
      const bounds = L.latLngBounds(wasteLocations.map(w => [w.location.lat, w.location.lng]))
      if (currentLocation) {
        bounds.extend([currentLocation.lat, currentLocation.lng])
      }
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [wasteLocations])

  useEffect(() => {
    if (!mapRef.current || !currentLocation) return
    if (!mountedRef.current) return

    const map = mapRef.current

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng])
    } else {
      // Create current location marker if it doesn't exist
      const currentMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      })
        .addTo(map)
        .bindPopup('Your current location')

      currentLocationMarkerRef.current = currentMarker
    }
  }, [currentLocation])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
      <div ref={containerRef} className="h-80 w-full" />
    </div>
  )
}