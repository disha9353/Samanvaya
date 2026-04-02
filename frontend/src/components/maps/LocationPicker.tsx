import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type LatLng = { lat: number; lng: number }

export default function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng
  onChange: (v: LatLng) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    if (!containerRef.current) return
    if (mapRef.current) return

    const map = L.map(containerRef.current).setView([value.lat, value.lng], 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([value.lat, value.lng], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      }),
      draggable: true,
    }).addTo(map)

    marker.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng()
      onChange({ lat, lng })
    })

    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      marker.setLatLng([lat, lng])
      onChange({ lat, lng })
    })

    markerRef.current = marker

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
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    if (!mountedRef.current) return

    const map = mapRef.current
    const marker = markerRef.current

    marker.setLatLng([value.lat, value.lng])

    const applyView = () => {
      if (!mountedRef.current) return
      try {
        map.invalidateSize()
        map.setView([value.lat, value.lng], map.getZoom(), { animate: false })
      } catch {
        // ignore
      }
    }

    // In some render timings the panes aren't positioned yet; wait until Leaflet is ready.
    if ((map as any)._loaded) applyView()
    else map.whenReady(applyView)
  }, [value.lat, value.lng])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  )
}

