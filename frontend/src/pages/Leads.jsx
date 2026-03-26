import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { leadsApi, sourcesApi } from '../api'
import { Plus, Search, UserCheck, ChevronRight, Trash2, ArrowRight, Linkedin } from 'lucide-react'
import Modal from '../components/Modal'

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-green-100 text-green-700',
  unqualified: 'bg-gray-100 text-gray-600',
  converted: 'bg-purple-100 text-purple-700',
}

function LeadForm({ initial = {}, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || '',
    last_name: initial.last_name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    company: initial.company || '',
    title: initial.title || '',
    source: initial.source || '',
    status: initial.status || 'new',
    notes: initial.notes || '',
  })

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.getAll,
  })

  // Set default source to first active source when sources load (only if not already set)
  useEffect(() => {
    if (sources.length > 0 && !form.source) {
      const active = sources.filter(s => s.is_active)
      if (active.length > 0) setForm(f => ({ ...f, source: active[0].name }))
    }
  }, [sources])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const activeSources = sources.filter(s => s.is_active)

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
        <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
      </div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => set('company', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div>
          <label className="label">
            Source
            {activeSources.length === 0 && (
              <a href="/sources" className="ml-2 text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                Manage sources →
              </a>
            )}
          </label>
          {activeSources.length > 0 ? (
            <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
              {activeSources.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div className="input bg-gray-50 text-gray-400 text-sm cursor-not-allowed">
              No sources configured —{' '}
              <a href="/sources" className="text-blue-500 hover:underline">add some</a>
            </div>
          )}
        </div>
      </div>
      <div><label className="label">Status</label>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
        </select>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Lead'}</button>
      </div>
    </form>
  )
}

export default function Leads() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [importPrefill, setImportPrefill] = useState(null)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle bookmarklet imports via URL params: /leads?import=1&name=...&title=...&company=...&linkedin_url=...
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      const name = searchParams.get('name') || ''
      const nameParts = name.trim().split(' ')
      const prefill = {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        title: searchParams.get('title') || '',
        company: searchParams.get('company') || '',
        notes: searchParams.get('linkedin_url')
          ? `LinkedIn: ${searchParams.get('linkedin_url')}`
          : '',
        source: 'LinkedIn',
        status: 'new',
      }
      setImportPrefill(prefill)
      setShowModal(true)
      // Clean up URL params
      setSearchParams({})
    }
  }, [])

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => leadsApi.getAll({ search, status: statusFilter || undefined }),
  })

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.getAll,
  })

  const createMut = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']); setShowModal(false); setImportPrefill(null) }
  })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => leadsApi.update(id, data), onSuccess: () => { qc.invalidateQueries(['leads']); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: leadsApi.delete, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']) } })
  const convertMut = useMutation({ mutationFn: leadsApi.convert, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['contacts']); qc.invalidateQueries(['dashboard']) } })

  // Map source name → color for badges
  const sourceColorMap = Object.fromEntries(sources.map(s => [s.name.toLowerCase(), s.color]))
  const getSourceColor = (sourceName) => sourceColorMap[sourceName?.toLowerCase()] || '#6b7280'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-gray-500">{leads.length} leads total</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setImportPrefill(null); setShowModal(true) }}>
          <Plus size={16} /> Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="input pl-8" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <UserCheck size={32} className="mx-auto mb-2 text-gray-300" />
                No leads yet. Add your first lead or sync Gmail to auto-import.
              </td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {lead.first_name[0]}{lead.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-gray-500">{lead.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.company || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: getSourceColor(lead.source) }}
                  >
                    {lead.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {lead.status !== 'converted' && (
                      <button onClick={() => { if(window.confirm('Convert to contact?')) convertMut.mutate(lead.id) }}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convert to Contact">
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <button onClick={() => setEditing(lead)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => { if(window.confirm('Delete this lead?')) deleteMut.mutate(lead.id) }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setImportPrefill(null) }} title={importPrefill ? 'Import LinkedIn Lead' : 'Add New Lead'}>
        <LeadForm
          initial={importPrefill || {}}
          onSubmit={createMut.mutate}
          onCancel={() => { setShowModal(false); setImportPrefill(null) }}
          isLoading={createMut.isPending}
        />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Lead">
        {editing && <LeadForm initial={editing} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>
    </div>
  )
}
