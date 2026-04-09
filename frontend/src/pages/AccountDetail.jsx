import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountsApi } from '../api'
import { ArrowLeft, Building2, Globe, Phone, MapPin, Users, Briefcase, TrendingUp, DollarSign, Mail } from 'lucide-react'

const STAGE_CONFIG = {
  lead:        { label: 'Lead',        color: 'bg-blue-100 text-blue-700' },
  qualified:   { label: 'Qualified',   color: 'bg-indigo-100 text-indigo-700' },
  proposal:    { label: 'Proposal',    color: 'bg-yellow-100 text-yellow-700' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  closed_won:  { label: 'Closed Won',  color: 'bg-green-100 text-green-700' },
}

export default function AccountDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: account, isLoading, isError } = useQuery({
    queryKey: ['account', id],
    queryFn: () => accountsApi.get(id),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading account...</div>
    </div>
  )

  if (isError || !account) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Account not found.</div>
    </div>
  )

  const deals = account.deals || []
  const contacts = account.contacts || []

  const pipelineValue = deals
    .filter(d => d.stage !== 'closed_won')
    .reduce((sum, d) => sum + parseFloat(d.value || 0), 0)

  const convertedValue = deals
    .filter(d => d.stage === 'closed_won')
    .reduce((sum, d) => sum + parseFloat(d.value || 0), 0)

  const totalValue = pipelineValue + convertedValue

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/accounts')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-100 text-green-600 flex items-center justify-center font-bold text-lg">
            {account.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <p className="text-sm text-gray-500">{account.industry || 'No industry set'}</p>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp size={14} /> Pipeline Value
          </div>
          <p className="text-2xl font-bold text-blue-600">${pipelineValue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{deals.filter(d => d.stage !== 'closed_won').length} active deals</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign size={14} /> Converted Revenue
          </div>
          <p className="text-2xl font-bold text-green-600">${convertedValue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{deals.filter(d => d.stage === 'closed_won').length} closed deals</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Briefcase size={14} /> Total Deal Value
          </div>
          <p className="text-2xl font-bold text-gray-800">${totalValue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{deals.length} total deals</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Account Details */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account Details</h2>
          <div className="space-y-3">
            {account.website && (
              <div className="flex items-start gap-2 text-sm">
                <Globe size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                  {account.website.replace(/https?:\/\//, '')}
                </a>
              </div>
            )}
            {account.phone && (
              <div className="flex items-start gap-2 text-sm">
                <Phone size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{account.phone}</span>
              </div>
            )}
            {account.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{account.address}</span>
              </div>
            )}
            {account.company_size && (
              <div className="flex items-start gap-2 text-sm">
                <Users size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{account.company_size} employees</span>
              </div>
            )}
            {account.industry && (
              <div className="flex items-start gap-2 text-sm">
                <Building2 size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{account.industry}</span>
              </div>
            )}
            {account.notes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{account.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Deals + Contacts */}
        <div className="col-span-2 space-y-6">
          {/* Deals */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Deals</h2>
              <span className="text-xs text-gray-400">{deals.length} total</span>
            </div>
            {deals.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No deals linked to this account.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Deal</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Stage</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Probability</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Close Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map(deal => {
                    const cfg = STAGE_CONFIG[deal.stage] || { label: deal.stage, color: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={deal.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm font-medium text-gray-800">{deal.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">${parseFloat(deal.value || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">{deal.probability ? deal.probability + '%' : '—'}</td>
                        <td className="px-5 py-3 text-sm text-right text-gray-500">
                          {deal.close_date ? new Date(deal.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Contacts */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contacts</h2>
              <span className="text-xs text-gray-400">{contacts.length} total</span>
            </div>
            {contacts.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No contacts linked to this account.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Designation</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(c.first_name || '?')[0]}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{c.first_name} {c.last_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.title || '—'}</td>
                      <td className="px-5 py-3">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                            <Mail size={12} /> {c.email}
                          </a>
                        ) : <span className="text-sm text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
