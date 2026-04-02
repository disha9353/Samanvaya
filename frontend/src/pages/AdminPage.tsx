import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { http } from '../api/http'

const AUTO_REFRESH_MS = 15000

type Section =
  | 'overview'
  | 'users'
  | 'items'
  | 'campaigns'
  | 'waste'
  | 'transactions'
  | 'reports'
  | 'analytics'
  | 'settings'

const SECTION_IDS: Section[] = [
  'overview',
  'users',
  'items',
  'campaigns',
  'waste',
  'transactions',
  'reports',
  'analytics',
  'settings',
]

export default function AdminPage() {
  const { t } = useTranslation()
  const sections = useMemo(
    () => SECTION_IDS.map((id) => ({ id, label: t(`admin.section.${id}`) })),
    [t]
  )
  const [section, setSection] = useState<Section>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [waste, setWaste] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({
    default_signup_credits: 100,
    campaign_reward_credits: 10,
    penalty_credits: 5,
    platform_rules: '',
  })

  const [userQ, setUserQ] = useState('')
  const [itemStatus, setItemStatus] = useState('')
  const [campaignStatus, setCampaignStatus] = useState('')
  const [wasteStatus, setWasteStatus] = useState('')
  const [txnType, setTxnType] = useState('')
  const [reportStatus, setReportStatus] = useState('')

  async function loadOverview() {
    const res = await http.get('/api/admin/stats')
    setStats(res.data)
  }
  async function loadUsers() {
    const res = await http.get('/api/admin/users', { params: { q: userQ } })
    setUsers(res.data.users || [])
  }
  async function loadItems() {
    const res = await http.get('/api/admin/items', { params: { status: itemStatus || undefined } })
    setItems(res.data.items || [])
  }
  async function loadCampaigns() {
    const res = await http.get('/api/admin/campaigns', { params: { status: campaignStatus || undefined } })
    setCampaigns(res.data.campaigns || [])
  }
  async function loadWaste() {
    const res = await http.get('/api/admin/waste-requests', { params: { status: wasteStatus || undefined } })
    setWaste(res.data.requests || [])
  }
  async function loadTransactions() {
    const res = await http.get('/api/admin/transactions', { params: { type: txnType || undefined } })
    setTransactions(res.data.transactions || [])
  }
  async function loadReports() {
    const res = await http.get('/api/admin/reports', { params: { status: reportStatus || undefined } })
    setReports(res.data.reports || [])
  }
  async function loadSettings() {
    const res = await http.get('/api/admin/settings')
    setSettings(res.data)
  }

  async function refreshCurrent(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent)
    try {
      if (!silent) setLoading(true)
      setError(null)
      if (section === 'overview' || section === 'analytics') await loadOverview()
      if (section === 'users') await loadUsers()
      if (section === 'items') await loadItems()
      if (section === 'campaigns') await loadCampaigns()
      if (section === 'waste') await loadWaste()
      if (section === 'transactions') await loadTransactions()
      if (section === 'reports') await loadReports()
      if (section === 'settings') await loadSettings()
      setLastUpdatedAt(new Date())
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('admin.load_failed'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    refreshCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, userQ, itemStatus, campaignStatus, wasteStatus, txnType, reportStatus])

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshCurrent({ silent: true })
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, userQ, itemStatus, campaignStatus, wasteStatus, txnType, reportStatus])

  const metrics = stats?.metrics || {}
  const chartTx = useMemo(() => (stats?.charts?.transactionsPerDay || []).map((x: any) => ({ date: x._id, value: x.count })), [stats])
  const chartGrowth = useMemo(() => (stats?.charts?.userGrowth || []).map((x: any) => ({ date: x._id, value: x.count })), [stats])
  const chartWaste = useMemo(() => (stats?.charts?.wasteTrends || []).map((x: any) => ({ date: x._id, value: x.kg })), [stats])

  async function patchUser(id: string, payload: any) {
    await http.patch(`/api/admin/user/${id}`, payload)
    await loadUsers()
  }
  async function deleteItem(id: string) {
    await http.delete(`/api/admin/item/${id}`)
    await loadItems()
  }
  async function patchItem(id: string, payload: any) {
    await http.patch(`/api/admin/item/${id}`, payload)
    await loadItems()
  }
  async function patchCampaign(id: string, payload: any) {
    await http.patch(`/api/admin/campaign/${id}`, payload)
    await loadCampaigns()
  }
  async function deleteCampaign(id: string) {
    await http.delete(`/api/admin/campaign/${id}`)
    await loadCampaigns()
  }
  async function patchReport(id: string, payload: any) {
    await http.patch(`/api/admin/report/${id}`, payload)
    await loadReports()
  }
  async function saveSettings() {
    await http.patch('/api/admin/settings', settings)
    await loadSettings()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <aside className="rounded-2xl border border-white/10 bg-white/5 p-4 h-fit lg:sticky lg:top-24">
        <div className="text-white font-semibold mb-3">{t('admin.panel')}</div>
        <div className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full text-left rounded-xl px-3 py-2 text-sm transition ${
                section === s.id ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/20' : 'text-white/75 hover:bg-white/5'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[70vh]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">{sections.find((x) => x.id === section)?.label}</h1>
          <div className="flex items-center gap-2">
            {lastUpdatedAt && (
              <div className="text-[11px] text-white/60">
                {t('admin.auto_refresh', { time: lastUpdatedAt.toLocaleTimeString() })}
              </div>
            )}
            <button onClick={() => refreshCurrent()} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-black/30">
              {t('admin.refresh')}
            </button>
          </div>
        </div>
        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100">{error}</div>}
        {loading && <div className="mt-4 text-white/60 text-sm">{t('common.loading')}</div>}

        {section === 'overview' && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {[
                [t('admin.metric.total_users'), metrics.totalUsers],
                [t('admin.metric.active_users'), metrics.activeUsers],
                [t('admin.metric.total_items'), metrics.totalItems],
                [t('admin.metric.sold_exchanged'), metrics.soldOrExchangedItems],
                [t('admin.metric.active_campaigns'), metrics.activeCampaigns],
                [t('admin.metric.completed_campaigns'), metrics.completedCampaigns],
                [t('admin.metric.waste_kg'), metrics.totalWasteCollectedKg],
                [t('admin.metric.total_tx'), metrics.totalTransactions],
                [t('admin.metric.total_credits'), metrics.totalCreditsInSystem],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[11px] text-white/55">{k}</div>
                  <div className="text-lg text-emerald-200 font-semibold mt-1">{String(v ?? 0)}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-white font-semibold mb-3">{t('admin.recent_activities')}</div>
              <div className="space-y-2">
                {(stats?.recentActivities || []).slice(0, 10).map((a: any) => (
                  <div key={a._id} className="text-xs text-white/70 rounded-lg border border-white/10 px-3 py-2">
                    <span className="text-emerald-200">{a.action}</span> • {a.targetType || '-'} • {new Date(a.createdAt).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'users' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
                placeholder={t('admin.search_users_ph')}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              />
              <button onClick={loadUsers} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.search')}
              </button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u._id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-white/85">
                      {u.name} • {u.email} • {t('admin.user_role_prefix')}{' '}
                      <span className="text-emerald-200">{u.role}</span>
                    </div>
                    <div className="text-xs text-white/60">
                      {t('admin.user_credits_line', {
                        credits: u.credits,
                        items: u.itemsPosted,
                        campaigns: u.campaignsJoined,
                        eco: u.ecoScore || 0,
                      })}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => patchUser(u._id, { isBlocked: !u.isBlocked })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {u.isBlocked ? t('admin.unblock') : t('admin.block')}
                    </button>
                    <button onClick={() => patchUser(u._id, { resetCredits: true, credits: 100 })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.reset_credits')}
                    </button>
                    <button onClick={() => patchUser(u._id, { role: 'collector' })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.promote_collector')}
                    </button>
                    <button onClick={() => patchUser(u._id, { role: 'admin' })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.promote_admin')}
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div className="text-sm text-white/60">{t('admin.no_users')}</div>}
            </div>
          </div>
        )}

        {section === 'items' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <select value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <option value="">{t('admin.all_status')}</option>
                <option value="Available">{t('admin.item_available')}</option>
                <option value="Sold">{t('admin.item_sold')}</option>
                <option value="Exchanged">{t('admin.item_exchanged')}</option>
              </select>
              <button onClick={loadItems} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.apply')}
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it._id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-white/85">
                    {it.title} • {it.status} • {it.category || t('admin.general')}
                    {it.flagged ? ` • ${t('admin.flagged')}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => patchItem(it._id, { flagged: !it.flagged })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {it.flagged ? t('admin.unflag') : t('admin.flag')}
                    </button>
                    <button onClick={() => deleteItem(it._id)} className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                      {t('admin.delete')}
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="text-sm text-white/60">{t('admin.no_items')}</div>}
            </div>
          </div>
        )}

        {section === 'campaigns' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <select value={campaignStatus} onChange={(e) => setCampaignStatus(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <option value="">{t('admin.all_status')}</option>
                <option value="OPEN">{t('auto.open', `OPEN`)}</option>
                <option value="FULL">{t('auto.full', `FULL`)}</option>
                <option value="COMPLETED">{t('auto.completed', `COMPLETED`)}</option>
              </select>
              <button onClick={loadCampaigns} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.apply')}
              </button>
            </div>
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c._id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-white/85">
                    {c.title} • {c.status} • {t('admin.participants_count', { n: c.participants?.length || 0 })} • {t('admin.organizer_prefix')}{' '}
                    {c.organizer?.name || '-'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => patchCampaign(c._id, { forceClose: true })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.force_close')}
                    </button>
                    <button onClick={() => patchCampaign(c._id, { featured: !c.featured })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {c.featured ? t('admin.unfeature') : t('admin.feature')}
                    </button>
                    <button onClick={() => deleteCampaign(c._id)} className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                      {t('admin.remove')}
                    </button>
                  </div>
                </div>
              ))}
              {campaigns.length === 0 && <div className="text-sm text-white/60">{t('admin.no_campaigns')}</div>}
            </div>
          </div>
        )}

        {section === 'waste' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <select value={wasteStatus} onChange={(e) => setWasteStatus(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <option value="">{t('admin.all_status')}</option>
                <option value="pending">{t('waste.status.pending')}</option>
                <option value="accepted">{t('waste.status.accepted')}</option>
                <option value="completed">{t('waste.status.completed')}</option>
              </select>
              <button onClick={loadWaste} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.apply')}
              </button>
            </div>
            <div className="space-y-2">
              {waste.map((wreq) => (
                <div key={wreq._id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
                  {t(`waste.type.${wreq.wasteType}`, { defaultValue: wreq.wasteType })} • {wreq.quantity}{t('auto.kg', `kg •`)}{' '}
                  {t(`waste.status.${wreq.status}`, { defaultValue: wreq.status })} • {t('admin.collector_prefix')}{' '}
                  {wreq.collectorId?.name || '-'}
                  {wreq.delayed ? ` • ${t('admin.delayed')}` : ''}
                </div>
              ))}
              {waste.length === 0 && <div className="text-sm text-white/60">{t('admin.no_waste')}</div>}
            </div>
          </div>
        )}

        {section === 'transactions' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={txnType}
                onChange={(e) => setTxnType(e.target.value)}
                placeholder={t('admin.filter_type_ph')}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              />
              <button onClick={loadTransactions} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.apply')}
              </button>
            </div>
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div key={txn._id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
                  {t('admin.tx_row', {
                    type: txn.type,
                    credits: txn.credits,
                    buyer: txn.buyer?.name || '-',
                    seller: txn.seller?.name || '-',
                  })}
                </div>
              ))}
              {transactions.length === 0 && <div className="text-sm text-white/60">{t('admin.no_tx')}</div>}
            </div>
          </div>
        )}

        {section === 'reports' && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <option value="">{t('admin.all_status')}</option>
                <option value="open">{t('auto.open', `open`)}</option>
                <option value="reviewed">{t('auto.reviewed', `reviewed`)}</option>
                <option value="resolved">{t('auto.resolved', `resolved`)}</option>
                <option value="dismissed">{t('auto.dismissed', `dismissed`)}</option>
              </select>
              <button onClick={loadReports} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold">
                {t('admin.apply')}
              </button>
            </div>
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r._id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-white/85">
                    {t('admin.report_line', { targetType: r.targetType, reason: r.reason, status: r.status })}
                  </div>
                  <div className="text-xs text-white/60 mt-1">{r.description || t('admin.no_details')}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => patchReport(r._id, { status: 'reviewed' })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.mark_reviewed')}
                    </button>
                    <button onClick={() => patchReport(r._id, { status: 'resolved' })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.report_resolve')}
                    </button>
                    <button onClick={() => patchReport(r._id, { status: 'dismissed' })} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                      {t('admin.report_dismiss')}
                    </button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && <div className="text-sm text-white/60">{t('admin.no_reports')}</div>}
            </div>
          </div>
        )}

        {section === 'analytics' && (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-white/85 text-sm mb-2">{t('admin.chart_user_growth')}</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={t('admin.chart_legend_users')} stroke="#10b981" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-white/85 text-sm mb-2">{t('admin.chart_tx_per_day')}</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTx}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name={t('admin.chart_legend_tx')} fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 xl:col-span-2">
              <div className="text-white/85 text-sm mb-2">{t('admin.chart_waste_trend')}</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartWaste}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={t('admin.chart_legend_waste')} stroke="#f59e0b" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {section === 'settings' && (
          <div className="mt-5 max-w-2xl space-y-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('admin.settings_default_credits')}</label>
              <input
                type="number"
                value={settings.default_signup_credits}
                onChange={(e) => setSettings((s: any) => ({ ...s, default_signup_credits: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('admin.settings_campaign_reward')}</label>
              <input
                type="number"
                value={settings.campaign_reward_credits}
                onChange={(e) => setSettings((s: any) => ({ ...s, campaign_reward_credits: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('admin.settings_penalty')}</label>
              <input
                type="number"
                value={settings.penalty_credits}
                onChange={(e) => setSettings((s: any) => ({ ...s, penalty_credits: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('admin.settings_platform_rules')}</label>
              <textarea
                value={settings.platform_rules}
                onChange={(e) => setSettings((s: any) => ({ ...s, platform_rules: e.target.value }))}
                className="w-full min-h-[120px] rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              />
            </div>
            <button onClick={saveSettings} className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-semibold">
              {t('admin.save_settings')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

