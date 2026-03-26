import { useQuery } from '@tanstack/react-query'
import { dashboardApi, activitiesApi } from '../api'
import { TrendingUp, Users, UserCheck, Building2, Kanban, AlertCircle, DollarSign, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const STAGE_COLORS = {
  lead: '#94a3b8',
  qualified: '#60a5fa',
  proposal: '#f59e0b',
  negotiation: '#a78bfa',
  closed_won: '#34d399',
  closed_lost: '#f87171',
}

const STAGE_LABELS = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.getStats })
  const { data: reminders } = useQuery({ queryKey: ['reminders'], queryFn: activitiesApi.getReminders })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const stageData = (stats?.stageBreakdown || []).map(s => ({
    name: STAGE_LABELS[s.stage] || s.stage,
    value: Math.round(s.value),
    count: s.count,
    fill: STAGE_COLORS[s.stage] || '#94a3b8'
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back! Here's your sales overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserCheck} label="Active Leads" value={stats?.totalLeads || 0} sub={`+${stats?.newLeadsThisWeek || 0} this week`} color="yellow" />
        <StatCard icon={Users} label="Contacts" value={stats?.totalContacts || 0} color="blue" />
        <StatCard icon={Building2} label="Accounts" value={stats?.totalAccounts || 0} color="purple" />
        <StatCard icon={Kanban} label="Open Deals" value={stats?.openDeals || 0} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Pipeline Value" value={`$${(stats?.pipelineValue || 0).toLocaleString()}`} color="blue" />
        <StatCard icon={DollarSign} label="Revenue Won" value={`$${(stats?.wonValue || 0).toLocaleString()}`} color="green" />
        <StatCard icon={AlertCircle} label="Overdue Tasks" value={stats?.overdueActivities || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Chart */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Pipeline by Stage</h2>
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Value']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stageData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No deals yet — add your first deal in Pipeline</div>
          )}
        </div>

        {/* Top Deals */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Top Deals</h2>
          {stats?.topDeals?.length > 0 ? (
            <div className="space-y-3">
              {stats.topDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{deal.name}</p>
                    <p className="text-xs text-gray-500">{deal.account_name || '—'} · <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${STAGE_COLORS[deal.stage] ? '' : ''}`}>{STAGE_LABELS[deal.stage]}</span></p>
                  </div>
                  <p className="text-sm font-semibold text-green-600">${deal.value?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No deals yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          {stats?.recentActivity?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map(act => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{act.subject}</p>
                    <p className="text-xs text-gray-500">{act.deal_name || act.contact_name} · {new Date(act.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No recent activity</p>
          )}
        </div>

        {/* Reminders */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Reminders & Follow-ups</h2>
          {reminders?.overdue?.length > 0 || reminders?.upcoming?.length > 0 ? (
            <div className="space-y-2">
              {reminders?.overdue?.slice(0, 3).map(act => (
                <div key={act.id} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-lg">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">{act.subject}</p>
                    <p className="text-xs text-red-500">Overdue · {act.due_date}</p>
                  </div>
                </div>
              ))}
              {reminders?.upcoming?.slice(0, 3).map(act => (
                <div key={act.id} className="flex items-start gap-3 p-2.5 bg-yellow-50 rounded-lg">
                  <Star size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700">{act.subject}</p>
                    <p className="text-xs text-yellow-600">Due {act.due_date} · {act.deal_name}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No pending reminders</p>
          )}
        </div>
      </div>
    </div>
  )
}
