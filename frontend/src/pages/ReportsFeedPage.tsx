import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, MapPin, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { http } from '../api/http'; 
import { io } from 'socket.io-client';
import type { RootState } from '../store/types';
import OceanReportsMap from '../components/maps/OceanReportsMap';

interface OceanReport {
  _id: string;
  mainMediaUrl: string;
  category: string;
  voteCount: number;
  latitude: number;
  longitude: number;
  distanceInMeters: number;
  status: string;
  createdAt: string;
  hasVoted?: boolean;
  anonymousId?: string;
}

export default function ReportsFeedPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<OceanReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const navigate = useNavigate();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);

  // Real-Time Socket Listener
  useEffect(() => {
    if (!accessToken) return;
    const socket = io('http://localhost:5000', {
      auth: { token: accessToken }
    });

    socket.on('report:vote_update', (data: { reportId: string, voteCount: number, status: string, severityScore: number }) => {
       setReports(prev => prev.map(r => r._id === data.reportId ? { 
         ...r, 
         voteCount: data.voteCount, 
         status: data.status,
         severityScore: data.severityScore 
       } : r));
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          fetchReports(lat, lng);
        },
        (err) => {
          console.error(err);
          setError(t('auto.location_access_denied', 'Location access denied. Unable to find nearby reports.'));
          setLoading(false);
        }
      );
    } else {
      setError(t('auto.geolocation_is_not_supported_b', 'Geolocation is not supported by your browser.'));
      setLoading(false);
    }
  }, []);

  const fetchReports = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      setError(null);
      // Fetch 50km radius
      const res = await http.get(`/api/ocean-reports/nearby?latitude=${lat}&longitude=${lng}&radius=50000`);
      setReports(res.data.reports || []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message || t('auto.failed_to_load_reports', 'Failed to load reports');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (id: string) => {
    if (!userLocation) { setError(t('auto.need_live_location_to_cast_veri', 'Need live location to cast verified votes.')); return; }
    try {
      const res = await http.post(`/api/ocean-reports/${id}/vote`, { 
        latitude: userLocation.lat, 
        longitude: userLocation.lng 
      });
      if (res.data.success) {
        setReports(prev => prev.map(r => r._id === id ? { ...r, voteCount: res.data.voteCount, hasVoted: true } : r));
      }
    } catch(err: any) {
      setError(err?.response?.data?.message || t('auto.error_occurred_while_voting', 'Error occurred while voting'));
    }
  };

  const parseCategory = (cat: string) => {
    return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#022c22] to-[#0f172a] p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-sm">
              {t('auto.ocean_reports_feed', `Ocean Reports Feed`)}
                                      </h1>
            <p className="text-teal-100/70 mt-2 font-medium">
              {t('auto.verified_ecological_hazards_wi', `Verified ecological hazards within your 50km radius.`)}
                                      </p>
          </div>
          <button 
            onClick={() => navigate('/reports/new')}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-6 py-3 text-white font-bold tracking-wide shadow-lg shadow-emerald-500/20 transform hover:-translate-y-0.5 transition flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {t('auto.submit_new_report', `Submit New Report`)}
                                </button>
        </div>

        {/* Dynamic Clustered OpenStreetMap */}
        {userLocation && <OceanReportsMap reports={reports} userLocation={userLocation} />}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3">
             <Info className="text-red-400" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-96 rounded-[2rem] bg-white/5 animate-pulse border border-white/5"></div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-emerald-500/10 backdrop-blur-sm">
            <span className="text-5xl mb-4 block">🌊</span>
            <h3 className="text-2xl font-bold text-emerald-400 mb-2">{t('auto.no_reports_found', `No Reports Found`)}</h3>
            <p className="text-teal-100/60">{t('auto.your_oceanic_sector_is_current', `Your oceanic sector is currently clear of reported hazards!`)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reports.map((report, idx) => (
              <motion.div 
                key={report._id}
                id={`report-${report._id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 backdrop-blur-xl border border-emerald-500/20 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col group hover:border-emerald-400/40 transition-colors"
              >
                {/* Media Section */}
                <div className="relative h-56 overflow-hidden bg-black/50">
                  {report.mainMediaUrl ? (
                    <img 
                      src={report.mainMediaUrl.startsWith('http') ? report.mainMediaUrl : `http://localhost:5000/${report.mainMediaUrl}`} 
                      alt={t('auto.alt_hazard', `Hazard`)} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-teal-200/40">{t('auto.no_media_available', `No media available`)}</div>
                  )}
                  <div className="absolute top-4 left-4 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 font-semibold text-xs tracking-wider text-emerald-300 capitalize flex items-center gap-1.5 shadow-xl">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {parseCategory(report.category)}
                  </div>
                  {/* Status Badge */}
                  <div className={`absolute top-4 right-4 rounded-full backdrop-blur-md border px-3 py-1 font-bold text-xs tracking-wider shadow-xl ${report.status === 'VALIDATED' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-amber-500/20 border-amber-400 text-amber-300'}`}>
                    {report.status}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  {/* Location Data */}
                  <div className="flex items-center gap-3 text-teal-100/70 mb-5 font-medium text-sm">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>{report.distanceInMeters >= 1000 ? `${(report.distanceInMeters / 1000).toFixed(1)} km away` : `${report.distanceInMeters}m away`}</span>
                    {report.anonymousId && (
                       <>
                         <span className="text-teal-500/50">•</span>
                         <span className="text-emerald-400/80 uppercase text-[11px] tracking-wider border border-emerald-500/20 px-2 py-0.5 rounded-full bg-emerald-500/5">{t('auto.by', `By`)} {report.anonymousId}</span>
                       </>
                    )}
                  </div>

                  {/* OSM Bounding Box Map Preview */}
                  <div className="w-full h-32 rounded-xl overflow-hidden border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity mb-6 shadow-inner pointer-events-none">
                     <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight={0}
                        marginWidth={0}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${report.longitude - 0.005},${report.latitude - 0.005},${report.longitude + 0.005},${report.latitude + 0.005}&layer=mapnik&marker=${report.latitude},${report.longitude}`}
                      ></iframe>
                  </div>

                  {/* Action Segment */}
                  <div className="mt-auto grid grid-cols-2 gap-4 items-center pt-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
                        <ThumbsUp className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-xl text-teal-50">{report.voteCount}</span>
                      <span className="text-xs text-teal-200/50 uppercase tracking-widest font-semibold ml-1 mt-1">{t('auto.votes', `Votes`)}</span>
                    </div>

                    <button 
                      onClick={() => handleVote(report._id)}
                      disabled={report.hasVoted || report.distanceInMeters > 1000}
                      className={`rounded-xl py-3 text-sm font-bold tracking-wide transition-all shadow-lg focus:outline-none ${
                        report.hasVoted 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                          : report.distanceInMeters > 1000 
                            ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30 cursor-not-allowed opacity-60' 
                            : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 active:scale-95'
                      }`}
                      title={report.hasVoted ? t('auto.already_verified', 'You have already verified this.') : report.distanceInMeters > 1000 ? t('auto.too_far_to_verify', 'You are too far from this hazardous zone to verify.') : ''}
                    >
                      {report.hasVoted ? t('auto.confirmed', '✔ Confirmed') : report.distanceInMeters > 1000 ? t('auto.out_of_range', 'Out of Range') : t('auto.confirm_issue', 'Confirm Issue')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
