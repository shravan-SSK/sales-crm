import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sourcesApi } from '../api'
import {
  Plus, Pencil, Trash2, BarChart2, Users, TrendingUp, CheckCircle,
  AlertCircle, Circle, Tag, Upload
} from 'lucide-react'
import Modal from '../components/Modal'
import BulkUploadModal from '../components/BulkUploadModal'

const PRESET_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#0a66c2', '#14b8a6',
]

function SourceForm({ initial = {}, onSubmit, onCancel, isLoading }) {
  const [name, setName] = useState(initial.name || '')
  const [color, setColor] = useState(initial.color || '#6366f1')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, color }) }} className="space-y-5">
      <div>
        <label className="label">Source Name *</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Cold Email, Partner Referral, Trade Show..."
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
              style={{ backgroundColor: c }}
              title={c}
            >
              {color === c && <CheckCircle size={14} className="text-white drop-shadow" />}
            </button>
          ))}
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-gray-200"
              title="Custom color"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            <Circle size={6} fill="white" />
            {name || 'Preview'}
          </span>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading || !name.trim()}>
          {isLoading ? 'Saving...' : initial.id ? 'Update Source' : 'Add Source'}
        </button>
      </div>
    </form>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function Sources() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources-stats'],
    queryFn: sourcesApi.getStats,
  })

  const createMut = useMutation({
    mutationFn: sourcesApi.create,
    onSuccess: () => { qc.invalidateQueries(['sources-stats']); qc.invalidateQueries(['sources']); setShowModal(false) }
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => sourcesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['sources-stats']); qc.invalidateQueries(['sources']); setEditing(null) }
  })
  const deleteMut = useMutation({
    mutationFn: sourcesApi.delete,
    onSuccess: () => { qc.invalidateQueries(['sources-stats']); qc.invalidateQueries(['sources']) },
    onError: (err) => alert(err.response?.data?.error || 'Delete failed')
  })

  const totalLeads = sources.reduce((s, x) => s + (x.stats?.total_leads || 0), 0)
  const totalConverted = sources.reduce((s, x) => s + (x.stats?.stage_closed_won || 0), 0)
  const topSource = [...sources].sort((a, b) => (b.stats?.total_leads || 0) - (a.stats?.total_leads || 0))[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Sources</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your lead sources and track their performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Source
          </button>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Leads" value={totalLeads} icon={Users} color="#6366f1" />
          <StatCard label="Converted" value={totalConverted} icon={TrendingUp} color="#10b981" />
          <StatCard label="Top Source" value={topSource?.name || '—'} icon={BarChart2} color="#f59e0b" />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Sources</h2>
          <span className="text-xs text-gray-500">{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading...</div>
        ) : sources.length === 0 ? (
          <div className="p-10 text-center">
            <Tag size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No sources yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your first lead source to get started.</p>
            <button className="btn-primary mt-4" onClick={() => setShowModal(true)}>
              <Plus size={14} className="inline mr-1" /> Add Source
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <div className="grid grid-cols-12 px-5 py-2.5 bg-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wide">
              <div className="col-span-3">Source</div>
              <div className="col-span-1 text-center">Total</div>
              <div className="col-span-1 text-center">Lead</div>
              <div className="col-span-1 text-center">Qualified</div>
              <div className="col-span-1 text-center">Proposal</div>
              <div className="col-span-1 text-center">Negotiation</div>
              <div className="col-span-2 text-center">Closed Won</div>
              <div className="col-span-2"></div>
            </div>
            {sources.map(source => {
              const s = source.stats || {}
              const rate = s.total_leads > 0 ? Math.round(((s.stage_closed_won || 0) / s.total_leads) * 100) : 0
              return (
                <div key={source.id} className="grid grid-cols-12 px-5 py-4 items-center hover:bg-gray-50 transition-colors">
                  <div className="col-span-3 flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{source.name}</p>
                      {source.is_active ? (
                        <span className="text-xs text-green-600 flex items-center gap-0.5"><Circle size={5} fill="currentColor" /> Active</span>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5"><Circle size={5} fill="currentColor" /> Inactive</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 text-center"><span className="text-lg font-bold text-gray-800">{s.total_leads || 0}</span></div>
                  <div className="col-span-1 text-center"><span className="text-sm text-blue-600 font-medium">{s.stage_lead || 0}</span></div>
                  <div className="col-span-1 text-center"><span className="text-sm text-indigo-600 font-medium">{s.stage_qualified || 0}</span></div>
                  <div className="col-span-1 text-center"><span className="text-sm text-yellow-600 font-medium">{s.stage_proposal || 0}</span></div>
                  <div className="col-span-1 text-center"><span className="text-sm text-orange-600 font-medium">{s.stage_negotiation || 0}</span></div>
                  <div className="col-span-2 text-center">
                    <div>
                      <span className="text-sm text-green-600 font-medium">{s.stage_closed_won || 0}</span>
                      {s.total_leads > 0 && (
                        <div className="mt-1">
                          <div className="h-1 bg-gray-100 rounded-full w-16 mx-auto">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: source.color }} />
                          </div>
                          <span className="text-xs text-gray-400">{rate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 flex items-center gap-1 justify-end">
                    <button onClick={() => setEditing(source)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete source "${source.name}"? This cannot be undone.`)) deleteMut.mutate(source.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {sources.some(s => (s.stats?.total_leads || 0) > 0) && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-indigo-500" /> Source Performance
          </h2>
          <div className="space-y-3">
            {[...sources]
              .filter(s => (s.stats?.total_leads || 0) > 0)
              .sort((a, b) => (b.stats?.total_leads || 0) - (a.stats?.total_leads || 0))
              .map(source => {
                const total = source.stats?.total_leads || 0
                const maxTotal = Math.max(...sources.map(s => s.stats?.total_leads || 0), 1)
                const pct = Math.round((total / maxTotal) * 100)
                const convRate = total > 0 ? Math.round(((source.stats?.converted || 0) / total) * 100) : 0
                return (
                  <div key={source.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                        <span className="text-sm font-medium text-gray-700">{source.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{total} lead{total !== 1 ? 's' : ''}</span>
                        <span className="font-semibold" style={{ color: source.color }}>{convRate}% converted</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: source.color }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {showImport && <BulkUploadModal type="sources" onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false) }} />}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Lead Source">
        <SourceForm onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending} />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Lead Source">
        {editing && (
          <SourceForm
            initial={editing}
            onSubmit={data => updateMut.mutate({ id: editing.id, data })}
            onCancel={() => setEditing(null)}
            isLoading={updateMut.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
