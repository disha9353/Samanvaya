const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/FeedPage.tsx', 'utf8');

const bannerCTA = `        {/* Create Item CTA Banner */}
        <div className="mb-8 p-6 rounded-[2rem] glass-card relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border border-primary-500/20 group hover:border-primary-500/40 transition-colors shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-transparent to-accent/5 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
             <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg text-white transform group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-8 h-8" />
             </div>
             <div>
                <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{t('create_item')}</h3>
                <p className="text-[var(--text-secondary)] font-medium mt-1">{t('auto.have_something_to_share_post', 'Have something to share? Post it here for credits!')}</p>
             </div>
          </div>
          <motion.button
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={() => navigate('/items/new')}
             className="relative z-10 w-full md:w-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-bold shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
             <Plus className="w-5 h-5" />
             {t('create_item')}
          </motion.button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">`;

code = code.replace(/<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">/, bannerCTA);

fs.writeFileSync('frontend/src/pages/FeedPage.tsx', code, 'utf8');
console.log('Added CTA to FeedPage');
