import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import type { RootState } from '../store/types'
import { Leaf, Recycle, Zap, Droplet } from 'lucide-react'

const slides = [
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop', // Deep Ocean
  'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1920&h=1080&fit=crop', // River/Trees
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop', // Clean Beach
]

function HeroSlideshow() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${slides[current]})` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/40 via-primary-700/30 to-primary-900/90" />
    </div>
  )
}

function BentoItem({ image, stat, title, delay }: { image: string; stat: string; title: string; delay: number }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6 }}
      className="relative group overflow-hidden rounded-3xl glass-card"
    >
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary-900/90 via-primary-900/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-6 left-6 text-white z-10">
        <div className="text-3xl font-extrabold text-secondary-50 drop-shadow-lg">{stat}</div>
        <div className="text-base font-medium mt-1 text-[var(--text-primary)]">{title}</div>
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen text-[var(--text-primary)] selection:bg-primary-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <HeroSlideshow />
        
        {/* Wavy subtle overlay to add to the "ocean" aesthetic */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
           backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'wave\' x=\'0\' y=\'0\' width=\'120\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M0 10 Q 30 20 60 10 T 120 10\' fill=\'none\' stroke=\'%232EC4B6\' stroke-width=\'2\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23wave)\'/%3E%3C/svg%3E")',
           backgroundSize: '120px 20px',
           animation: 'wave 20s linear infinite'
        }} />

        <div className="relative z-10 text-center px-6 md:px-12 w-full max-w-5xl mt-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 border border-secondary-50/20"
          >
            <Droplet className="w-4 h-4 text-secondary-50" />
            <span className="text-sm font-medium tracking-wide text-secondary-50">{t('auto.introducing_samanvaya', `Introducing Samanvaya`)}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight drop-shadow-xl"
            style={{ 
              background: 'linear-gradient(to right, #F4F1DE, #90DBF4, #2EC4B6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 20px rgba(10, 37, 64, 0.5)'
            }}
          >
            {t('auto.samanvaya', `Samanvaya`)}
                                  <span className="block text-2xl md:text-4xl lg:text-5xl font-light tracking-wide mt-4 text-[var(--text-primary)] drop-shadow-lg" style={{ WebkitTextFillColor: '#F4F1DE' }}>
              {t('auto.the_waves_of_change', `The Waves of Change`)}
                                      </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-2xl text-[var(--text-primary)]/90 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
          >
            {t('auto.harmony_between_people_resourc', `Harmony between People, Resources, and Nature. Discover a marketplace built on sustainable community action.`)}
                                </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-5 justify-center"
          >
            {user ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/feed')}
                  className="px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-semibold shadow-glow transition-all"
                >
                  {t('auto.explore_marketplace', `Explore Marketplace`)}
                                                  </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/campaigns')}
                  className="px-8 py-4 glass text-white rounded-full font-semibold border border-black/5 dark:border-white/20 hover:bg-white/10 transition-all"
                >
                  {t('auto.join_a_campaign', `Join a Campaign`)}
                                                  </motion.button>
              </>
            ) : (
              <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/register"
                    className="flex justify-center px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-semibold shadow-glow transition-all"
                  >
                    {t('auto.get_started', `Get Started`)}
                                                            </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/login"
                    className="flex justify-center px-8 py-4 glass text-white rounded-full font-semibold border border-black/5 dark:border-white/20 hover:bg-white/10 transition-all"
                  >
                    {t('auto.sign_in', `Sign In`)}
                                                            </Link>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>

        {/* Decorative ambient gradient at bottom of hero */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-primary-900 to-transparent" />
      </section>

      {/* Philosophy / Features Section */}
      <section className="py-24 px-6 relative bg-primary-900 border-t border-primary-700/30">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
             <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">{t('auto.creating_harmony', `Creating Harmony`)}</h2>
             <p className="text-secondary-50 text-lg max-w-2xl mx-auto">{t('auto.by_connecting_individuals_with', `By connecting individuals with sustainable actions, together we form the waves that shape our world's future.`)}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-8 glass-card hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Recycle className="w-8 h-8 text-[var(--text-primary)]0" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">{t('auto.sustainable_barter', `Sustainable Barter`)}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{t('auto.exchange_pre_loved_items_inste', `Exchange pre-loved items instead of throwing them away. Minimize waste through a thriving decentralized economy.`)}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-8 glass-card hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary-50/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Leaf className="w-8 h-8 text-secondary-50" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">{t('auto.community_campaigns', `Community Campaigns`)}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{t('auto.join_eco_campaigns_beach_clean', `Join eco-campaigns, beach cleanups, and green drives to restore nature. Earn credits for your verified voluntary time.`)}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-8 glass-card hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">{t('auto.impact_tracking', `Impact Tracking`)}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{t('auto.watch_your_personal_ecological', `Watch your personal ecological impact grow through dynamic scores, QR verifications, and real-time environmental alerts.`)}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Inspiration Gallery */}
      <section className="py-24 px-6 relative bg-gradient-to-b from-primary-900 to-[#07192F]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6"
          >
            <div>
               <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-3">{t('auto.impact_in_action', `Impact in Action`)}</h2>
               <p className="text-[var(--text-secondary)] max-w-lg">{t('auto.observe_the_real_difference_ou', `Observe the real difference our community is making across the globe.`)}</p>
            </div>
            {user && (
              <button onClick={() => navigate('/reports')} className="px-6 py-3 rounded-xl border border-primary-500 text-[var(--text-primary)]0 hover:bg-primary-500 hover:text-white transition-colors">
                {t('auto.view_ocean_reports', `View Ocean Reports`)}
                                            </button>
            )}
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BentoItem
              image="https://images.unsplash.com/photo-1618477461853-cf6ed80f04df?w=800&q=80"
              stat="5,000+"
              title={t('auto.title_pounds_of_plastic_removed', `Pounds of plastic removed`)}
              delay={0}
            />
            <BentoItem
              image="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80"
              stat="20K"
              title={t('auto.title_items_upcycled_to_date', `Items upcycled to date`)}
              delay={0.1}
            />
            <BentoItem
              image="https://images.unsplash.com/photo-1544256718-3baf237f39d0?w=800&q=80"
              stat="1.2M"
              title={t('auto.title_volunteer_credits_distributed', `Volunteer credits distributed`)}
              delay={0.2}
            />
          </div>
        </div>
      </section>

    </div>
  )
}
