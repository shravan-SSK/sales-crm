import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Users, UserCheck, Building2, Kanban,
  Activity, Mail, Settings, Search, Bell, Tag
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { activitiesApi, searchApi } from '../api'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/deals', icon: UserCheck, label: 'Deals' },
  { to: '/sources', icon: Tag, label: 'Sources' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/accounts', icon: Building2, label: 'Accounts' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/activities', icon: Activity, label: 'Activities' },
  { to: '/emails', icon: Mail, label: 'Email Inbox' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function STCLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      <polygon points="16,2 30,28 2,28" fill="url(#stcGrad)" />
      <polygon points="16,10 24,26 8,26" fill="white" fillOpacity="0.2" />
      <text x="16" y="25" textAnchor="middle" fill="white" fontSize="8" fontWeight="800"
        fontFamily="system-ui,sans-serif" letterSpacing="0.5">ST</text>
    </svg>
  )
}

export default function Layout() {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const navigate = useNavigate()

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: activitiesApi.getReminders,
    refetchInterval: 60000,
  })

  const overdueCount = reminders?.overdue?.length || 0

  const handleSearch = async (e) => {
    const q = e.target.value
    setSearch(q)
    if (q.length >= 2) {
      const results = await searchApi.search(q)
      setSearchResults(results)
    } else {
      setSearchResults(null)
    }
  }

  const totalResults = searchResults
    ? (searchResults.leads?.length + searchResults.contacts?.length + searchResults.accounts?.length + searchResults.deals?.length)
    : 0

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <STCLogo />
            <div>
              <span className="font-bold text-base leading-tight block">STC Sales Engine</span>
              <span className="text-xs text-gray-400 leading-tight">Seventh Triangle</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Activities' && overdueCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {overdueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          STC Sales Engine v1.0
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search deals, contacts, accounts..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchResults && totalResults > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {searchResults.leads?.map(l => (
                  <button key={l.id} onClick={() => { navigate('/deals'); setSearch(''); setSearchResults(null); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm border-b border-gray-100">
                    <UserCheck size={14} className="text-yellow-500 flex-shrink-0" />
                    <div><div className="font-medium">{l.first_name} {l.last_name}</div><div className="text-gray-500 text-xs">{l.email} · Deal</div></div>
                  </button>
                ))}
                {searchResults.contacts?.map(c => (
                  <button key={c.id} onClick={() => { navigate('/contacts'); setSearch(''); setSearchResults(null); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm border-b border-gray-100">
                    <Users size={14} className="text-blue-500 flex-shrink-0" />
                    <div><div className="font-medium">{c.first_name} {c.last_name}</div><div className="text-gray-500 text-xs">{c.email} · Contact</div></div>
                  </button>
                ))}
                {searchResults.accounts?.map(a => (
                   <button key={a.id} onClick={() => { navigate('/accounts'); setSearch(''); setSearchResults(null); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm border-b border-gray-100">
                    <Building2 size={14} className="text-green-500 flex-shrink-0" />
                    <div><div className="font-medium">{a.name}</div><div className="text-gray-500 text-xs">{a.industry} · Account</div></div>
                  </button>
                ))}
                {searchResults.deals?.map(d => (
                  <button key={d.id} onClick={() => { navigate('/pipeline'); setSearch(''); setSearchResults(null); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm">
                    <Kanban size={14} className="text-purple-500 flex-shrink-0" />
                    <div><div className="font-medium">{d.name}</div><div className="text-gray-500 text-xs">${d.value?.toLocaleString()} · {d.stage}</div></div>
                  </button>
                ))}
              </div>
            )}
            {search && totalResults === 0 && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>

          {overdueCount > 0 && (
            <button onClick={() => navigate('/activities')} className="relative p-2 text-gray-500 hover:text-gray-700">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{overdueCount}</span>
            </button>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
