import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Fix Leaflet's default icon path issue in Vite environments securely
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Create custom icons representing the ecological severity or validation status
function customIcon(status: string) {
  return new L.DivIcon({
    html: `<div style="background: ${status === 'VALIDATED' ? 'linear-gradient(to bottom right, #10b981, #059669)' : 'linear-gradient(to bottom right, #f59e0b, #d97706)'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0px 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; transform: translateY(-5px);">
             <div style="background: white; width: 6px; height: 6px; border-radius: 50%; opacity: 0.8;"></div>
           </div>`,
    className: 'custom-leaflet-icon bg-transparent border-none',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10]
  });
}

function userLocationIcon() {
  return new L.DivIcon({
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);"></div>`,
    className: 'custom-leaflet-icon-user',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Automatically transition viewport
function MapUpdater({ center }: { center: [number, number] }) {
  const { t } = useTranslation();
  const map = useMap();
  useEffect(() => {
    if (map && center[0] !== 0) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export interface OceanReportMarker {
  _id: string;
  latitude: number;
  longitude: number;
  category: string;
  status: string;
  mainMediaUrl: string;
  voteCount: number;
  severityScore?: number;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const { t } = useTranslation();
  const map = useMap();
  useEffect(() => {
    if (!map || !(L as any).heatLayer) return;
    
    try {
      const heat = (L as any).heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 15,
        gradient: { 0.4: '#10b981', 0.65: '#f59e0b', 1: '#ef4444' }
      }).addTo(map);

      return () => {
        if (map && heat) map.removeLayer(heat);
      };
    } catch (e) {
      console.error('Leaflet Heatmap error:', e);
    }
  }, [map, points]);
  
  return null;
}

export default function OceanReportsMap({ reports, userLocation }: { reports: OceanReportMarker[], userLocation: {lat: number, lng: number} | null }) {
  const { t } = useTranslation();
  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : [0, 0];
  const parseCategory = (cat: string) => cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const [viewMode, setViewMode] = useState<'cluster' | 'heatmap'>('cluster');
  const heatPoints = reports.map(r => [r.latitude, r.longitude, (r.severityScore || 1) * 0.1] as [number, number, number]);

  return (
    <div className="w-full h-[350px] sm:h-[500px] rounded-[2rem] overflow-hidden border border-emerald-500/20 shadow-2xl relative z-10 mb-10 group">
      
      {/* Map Control Overlay */}
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl flex border border-emerald-500/30 shadow-xl">
        <button 
          onClick={() => setViewMode('cluster')}
          className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all ${viewMode === 'cluster' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-teal-50 hover:bg-white/10'}`}
        >
          {t('auto.pins', `PINS`)}
                          </button>
        <button 
          onClick={() => setViewMode('heatmap')}
          className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all ${viewMode === 'heatmap' ? 'bg-amber-500 text-slate-900 shadow-md' : 'text-teal-50 hover:bg-white/10'}`}
        >
          {t('auto.heatmap', `HEATMAP`)}
                          </button>
      </div>

      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation ? <MapUpdater center={[userLocation.lat, userLocation.lng]} /> : null}
        
        {viewMode === 'heatmap' ? <HeatmapLayer points={heatPoints} /> : null}

        {viewMode === 'cluster' ? reports.map((report) => (
          <Marker 
            key={report._id} 
            position={[report.latitude, report.longitude]}
            icon={customIcon(report.status)}
          >
            <Popup className="custom-popup border-none" closeButton={false}>
              <div className="w-52 bg-slate-900 rounded-xl overflow-hidden shadow-2xl relative">
                <img 
                  src={report.mainMediaUrl.startsWith('http') ? report.mainMediaUrl : `http://localhost:5000/${report.mainMediaUrl}`} 
                  alt={t('auto.alt_report_preview', `Report preview`)} 
                  className="w-full h-28 object-cover"
                />
                
                <div className={`absolute top-2 right-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${report.status === 'VALIDATED' ? 'bg-emerald-500 text-slate-900' : 'bg-amber-500 text-slate-900'}`}>
                  {report.status}
                </div>
                
                <div className="p-4">
                  <h3 className="font-bold text-teal-50 mb-1 leading-tight">{parseCategory(report.category)}</h3>
                  <div className="flex justify-between items-center text-xs mt-2">
                     <span className="text-teal-400 font-semibold">{report.voteCount} {t('auto.votes', `Votes`)}</span>
                     <a href={`#report-${report._id}`} className="text-emerald-400 font-bold hover:underline">{t('auto.details', `Details →`)}</a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )) : null}

        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon()}>
             <Popup>{t('auto.you_are_actively_tracking_from', `You are actively tracking from here.`)}</Popup>
          </Marker>
        ) : null}
      </MapContainer>
      
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
             background: transparent;
             border-radius: 0.75rem;
             padding: 0;
             overflow: hidden;
             box-shadow: none;
        }
        .custom-popup .leaflet-popup-tip {
             background: #0f172a;
        }
        .map-tiles {
            filter: contrast(1) saturate(1.5) brightness(0.9) invert(0.1) sepia(0.2) hue-rotate(180deg);
        }
      `}</style>
    </div>
  );
}
