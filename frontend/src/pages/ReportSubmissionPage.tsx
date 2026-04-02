import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportSubmissionPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('plastic_dumping');
  const [description, setDescription] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  const handleCaptureGPS = () => {
    setIsLocating(true);
    setError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location', error);
          setError(t('auto.failed_to_capture_gps_please_e', 'Failed to capture GPS. Please enable location services.'));
          setIsLocating(false);
        }
      );
    } else {
      setError(t('auto.geolocation_is_not_supported_b', 'Geolocation is not supported by your browser.'));
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !latitude || !longitude || !category) {
      setError(t('auto.please_provide_an_image_video_', 'Please provide an image/video, category, and GPS location.'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('mainMedia', file); // Maps to backend expected field
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
      formData.append('category', category);
      formData.append('description', description);

      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/ocean-reports', { // Assuming backend proxy or server
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit report. Anti-Fraud validation rejected it.');
      }

      navigate('/dashboard'); 
    } catch (err: any) {
      setError(err.message || t('auto.an_error_occurred_during_submi', 'An error occurred during submission.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#022c22] to-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-emerald-500/20 p-8 sm:p-10 relative">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-teal-500 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-blue-600 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

        <div className="mb-10 text-center relative z-10">
          <div className="inline-block p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-teal-500/30 mb-4 text-emerald-400">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-cyan-300 tracking-tight">
            {t('auto.ocean_report', `Ocean Report`)}
                                </h1>
          <p className="text-teal-100/70 mt-3 text-sm font-medium">
            {t('auto.flag_ecological_hazards_protec', `Flag ecological hazards. Protect our marine futures.`)}
                                </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start space-x-3 text-red-200 text-sm font-medium animate-pulse">
             <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7 relative z-10">
          
          {/* Media Upload */}
          <div>
            <label className="block text-sm font-semibold text-teal-200/90 mb-3 ml-1">{t('auto.evidence_image_video', `Evidence (Image/Video)`)}</label>
            <div className="w-full flex items-center justify-center border-[2px] border-dashed border-emerald-400/40 rounded-2xl bg-black/20 hover:bg-black/40 hover:border-emerald-400 transition-all duration-300 group h-36 relative cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="text-center pointer-events-none p-4">
                {file ? (
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-8 text-emerald-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-emerald-300 font-bold truncate max-w-[200px]">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-teal-200/50 group-hover:text-emerald-300/80 transition-colors">
                    <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="font-medium">{t('auto.tap_to_securely_upload_file', `Tap to securely upload file`)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GPS Location */}
          <div>
            <label className="block text-sm font-semibold text-teal-200/90 mb-3 ml-1">{t('auto.live_coordinates', `Live Coordinates`)}</label>
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isLocating}
                className="w-full sm:flex-1 bg-blue-900/30 hover:bg-blue-800/40 text-cyan-50 border border-blue-500/30 py-3.5 rounded-2xl font-bold transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner flex items-center justify-center space-x-2"
              >
                {isLocating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>{t('auto.triangulating', `Triangulating...`)}</span>
                  </>
                ) : (
                  <>
                    <span>📍</span>
                    <span>{t('auto.fetch_location', `Fetch Location`)}</span>
                  </>
                )}
              </button>
              {(latitude && longitude) && (
                <div className="w-full sm:flex-1 flex flex-col justify-center text-xs text-emerald-300 bg-emerald-900/20 py-2.5 px-4 rounded-2xl border border-emerald-500/30 shadow-inner h-full">
                  <div className="flex justify-between font-mono">
                    <span className="text-teal-500/70">{t('auto.lat', `LAT`)}</span> <span>{latitude.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between font-mono mt-1">
                    <span className="text-teal-500/70">{t('auto.lng', `LNG`)}</span> <span>{longitude.toFixed(5)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-teal-200/90 mb-3 ml-1">{t('auto.incident_category', `Incident Category`)}</label>
            <div className="relative group">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/20 border border-emerald-500/20 text-emerald-50 placeholder-teal-600/50 rounded-2xl py-3.5 px-5 lg:text-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none transition duration-300 group-hover:border-emerald-500/40 font-medium tracking-wide"
              >
                <option className="bg-slate-900 text-emerald-100 py-2" value="plastic_dumping">{t('auto.plastic_dumping_debris', `Plastic Dumping / Debris`)}</option>
                <option className="bg-slate-900 text-emerald-100 py-2" value="oil_spill">{t('auto.toxic_leak_oil_spill', `Toxic Leak / Oil Spill`)}</option>
                <option className="bg-slate-900 text-emerald-100 py-2" value="dead_marine_life">{t('auto.deceased_marine_life', `Deceased Marine Life`)}</option>
                <option className="bg-slate-900 text-emerald-100 py-2" value="illegal_fishing">{t('auto.illegal_fishing_activity', `Illegal Fishing Activity`)}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-emerald-500 group-hover:text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-teal-200/90 mb-3 ml-1">{t('auto.context', `Context`)}</label>
            <textarea
              rows={3}
              placeholder={t('auto.placeholder_what_exactly_are_you_observing', `What exactly are you observing? Please be concise.`)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black/20 border border-emerald-500/20 text-emerald-50 placeholder-teal-600/50 rounded-2xl py-3.5 px-5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition duration-300 hover:border-emerald-500/40 resize-none font-medium"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white py-4 rounded-2xl font-black tracking-wide text-lg shadow-xl shadow-emerald-900/50 hover:shadow-emerald-500/30 transform hover:-translate-y-[2px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isSubmitting ? t('auto.transmitting_data', 'Transmitting Data...') : t('auto.broadcast_submission', 'Broadcast Submission')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
