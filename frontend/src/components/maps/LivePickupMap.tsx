import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Marker as LeafletMarker, type CircleMarker as LeafletCircleMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { LatLng } from './LocationPicker'

type CollectorLocation = {
  collectorId: string
  lat: number
  lng: number
}

type Props = {
  pickupLocation: LatLng
  collectors: CollectorLocation[]
  assignedCollectorId?: string // If specified, only show this collector
  showPickupMarker?: boolean // Whether to show the pickup location marker
}

export default function LivePickupMap({ 
  pickupLocation, 
  collectors, 
  assignedCollectorId,
  showPickupMarker = true
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pickupMarkerRef = useRef<LeafletMarker | null>(null)
  const collectorMarkersRef = useRef<Map<string, LeafletCircleMarker>>(new Map())
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    if (!containerRef.current) return
    if (mapRef.current) return

    const map = L.map(containerRef.current).setView([pickupLocation.lat, pickupLocation.lng], 14)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    if (showPickupMarker) {
      const pickupMarker = L.marker([pickupLocation.lat, pickupLocation.lng], {
        icon: L.icon({
          iconUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      })
        .addTo(map)
        .bindPopup('Pickup location')

      pickupMarkerRef.current = pickupMarker
    }

    // Leaflet needs a real layout pass; in React dev-mode (double effects) this can be timing-sensitive.
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
      pickupMarkerRef.current = null
      collectorMarkersRef.current.forEach((m) => m.remove())
      collectorMarkersRef.current.clear()
    }
  }, [pickupLocation.lat, pickupLocation.lng])

  useEffect(() => {
    if (!mapRef.current || !pickupMarkerRef.current) return
    if (!mountedRef.current) return
    if (!containerRef.current) return

    const map = mapRef.current
    pickupMarkerRef.current.setLatLng([pickupLocation.lat, pickupLocation.lng])

    const applyView = () => {
      if (!mountedRef.current) return
      try {
        map.invalidateSize()
        map.setView([pickupLocation.lat, pickupLocation.lng], map.getZoom(), { animate: false })
      } catch {
        // ignore
      }
    }

    // In some render timings the panes aren't positioned yet; wait until Leaflet is ready.
    if ((map as any)._loaded) applyView()
    else map.whenReady(applyView)
  }, [pickupLocation.lat, pickupLocation.lng])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    const existing = collectorMarkersRef.current

    // Filter collectors based on assignedCollectorId if specified
    const filteredCollectors = assignedCollectorId 
      ? collectors.filter(c => c.collectorId === assignedCollectorId)
      : collectors

    const incomingIds = new Set(filteredCollectors.map((c) => c.collectorId))
    for (const [id, marker] of existing.entries()) {
      if (!incomingIds.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    filteredCollectors.forEach((c) => {
      const key = String(c.collectorId)
      const latlng: [number, number] = [c.lat, c.lng]
      const marker = existing.get(key)
      if (marker) {
        marker.setLatLng(latlng)
      } else {
        const m = L.circleMarker(latlng, {
          radius: 7,
          color: '#34d399',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup('Collector')
        existing.set(key, m)
      }
    })
  }, [collectors, assignedCollectorId])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  )
}

