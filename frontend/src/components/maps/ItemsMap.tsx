import { useTranslation } from 'react-i18next';
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

// Fix Leaflet marker icons not showing by default
import 'leaflet/dist/leaflet.css';

// Using local CDNs/Paths for icons because vite bundler might mangle leaflet paths
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Item {
  _id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  location?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

interface ItemsMapProps {
  items: Item[];
  center?: [number, number];
  zoom?: number;
}

export const ItemsMap: React.FC<ItemsMapProps> = ({
  items,
  center = [20.5937, 78.9629], // Default India
  zoom = 4
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Filter items that have valid GeoJSON location
  const mappableItems = items.filter(
    (item) => {
      const coords = item.location?.coordinates
      const valid = Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number' &&
        coords[0] !== 0 &&
        coords[1] !== 0
      if (!valid) console.log('[ItemsMap Debug] Skipping item (no valid coords):', item.title, coords)
      return valid
    }
  );

  console.log('[ItemsMap Debug] Rendering markers for', mappableItems.length, 'of', items.length, 'items');

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: '100%', width: '100%', minHeight: '500px', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappableItems.map((item) => {
          // GeoJSON is [lng, lat], Leaflet wants [lat, lng]
          const position: [number, number] = [
            item.location!.coordinates[1],
            item.location!.coordinates[0],
          ];

          return (
            <Marker key={item._id} position={position}>
              <Popup className="item-popup">
                <style>
                  {`
                    .item-popup .leaflet-popup-content-wrapper { padding: 0; overflow: hidden; border-radius: 12px; }
                    .item-popup .leaflet-popup-content { margin: 0; width: 220px !important; }
                  `}
                </style>
                <div className="flex flex-col bg-white">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-emerald-50 flex items-center justify-center">
                      <span className="text-emerald-300 text-2xl">🌱</span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 text-sm truncate">
                      {item.title}
                    </h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] uppercase font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                      <span className="text-sm font-bold text-gray-700">
                        {item.price} 🪙
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/items/${item._id}`)}
                      className="mt-3 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      {t('auto.view_details', `View Details`)}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
