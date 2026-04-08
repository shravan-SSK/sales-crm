import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dealsApi, accountsApi, contactsApi } from '../api'
import api from '../api'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'

// Color palette cycled for dynamic stages
const STAGE_COLORS = [
  { color: 'bg-gray-100', header: 'bg-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
  { color: 'bg-blue-50', header: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  { color: 'bg-yellow-50', header: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  { color: 'bg-orange-50', header: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  { color: 'bg-green-50', header: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  { color: 'bg-red-50', header: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  { color: 'bg-purple-50', header: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  { color: 'bg-pink-50', header: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500' },
]
const DEFAULT_STAGE_LABELS = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

function toSlug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }
function buildStageConfig(labels) {
  return labels.reduce((acc, name, i) => {
    acc[toSlug(name)] = { label: name, ...STAGE_COLORS[i % STAGE_COLORS.length] }
    return acc
  }, {})
}

function DealForm({ initial = {}, accounts = [], contacts = [], stages = [], stageConfig = {}, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    account_id: initial.account_id || '',
    contact_id: initial.contact_id || '',
    stage: initial.stage || (stages[0] || 'lead'),
    value: initial.value || '',
    probability: initial.probability || '',
    close_date: initial.close_date || '',
    notes: initial.notes || '',
  })
  const [newAccountName, setNewAccountName] = useState('')
  const [newContactFirst, setNewContactFirst] = useState('')
  const [newContactLast, setNewContactLast] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (form.account_id === '__new__') {
      delete payload.account_id
      payload.new_account_name = newAccountName
    }
    if (form.contact_id === '__new__') {
      delete payload.contact_id
      payload.new_contact_first_name = newContactFirst
      payload.new_contact_last_name = newContactLast
      payload.new_contact_email = newContactEmail
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="label">Deal Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Account</label>
          <select className="input" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">No Account</option>
            <option value="__new__">+ Create new accountâ¦</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {form.account_id === '__new__' && (
            <input className="input mt-1" placeholder="Company name" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} required />
          )}
        </div>
        <div>
          <label className="label">Primary Contact</label>
          <select className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
            <option value="">No Contact</option>
            <option value="__new__">+ Create new contactâ¦</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          {form.contact_id === '__new__' && (
            <div className="space-y-1 mt-1">
              <div className="grid grid-cols-2 gap-1">
                <input className="input" placeholder="First name" value={newContactFirst} onChange={e => setNewContactFirst(e.target.value)} required />
                <input className="input" placeholder="Last name" value={newContactLast} onChange={e => setNewContactLast(e.target.value)} />
              </div>
              <input className="input" placeholder="Email" type="email" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Stage</label>
          <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
            {stages.map(s => <option key={s} value={s}>{stageConfig[s]?.label || s}</option>)}
          </select>
        </div>
        <div><label className="label">Deal Value ($)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.value} onChange={e => set('value', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Probability (%)</label>
          <input className="input" type="number" min="0" max="100" value={form.probability} onChange={e => set('probability', e.target.value)} />
        </div>
        <div><label className="label">Expected Close Date</label>
          <input className="input" type="date" value={form.close_date} onChange={e => set('close_date', e.target.value)} />
        </div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Deal'}</button>
      </div>
    </form>
  )
}

export default function Deals() {
  const [showModal, setShowModal] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const stages = useMemo(() => {
    try { if (settingsData?.pipeline_stages) return JSON.parse(settingsData.pipeline_stages).map(toSlug) } catch {}
    return DEFAULT_STAGE_LABELS.map(toSlug)
  }, [settingsData])

  const stageConfig = useMemo(() => {
    try { if (settingsData?.pipeline_stages) return buildStageConfig(JSON.parse(settingsData.pipeline_stages)) } catch {}
    return buildStageConfig(DEFAULT_STAGE_LABELS)
  }, [settingsData])

  const { data: deals = [], isLoading } = useQuery({ queryKey: ['deals'], queryFn: dealsApi.getAll })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll() })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.getAll() })

  const createMut = useMutation({
    mutationFn: dealsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setShowModal(false)
    }
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => dealsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditingDeal(null)
    }
  })

  const deleteMut = useMutation({
    mutationFn: dealsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0)
  const closedWonDeals = deals.filter(d => d.stage === 'closed_won')
  const closedWonValue = closedWonDeals.reduce((sum, d) => sum + (d.value || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-gray-500">
            Total: <span className="font-semibold text-blue-600">${totalValue.toLocaleString()}</span>
            <span className="ml-4">Closed Won: <span className="font-semibold text-green-600">${closedWonValue.toLocaleString()}</span></span>
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}><Plus size={16} /> New Deal</button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading deals...</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No deals yet. Create one to get started.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Deal Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stage</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Probability</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Close Date</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map(deal => {
                const cfg = stageConfig[deal.stage] || STAGE_COLORS[0]
                return (
                  <tr
                    key={deal.id}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{deal.name}</td>
                    <td className="px-4 py-3 text-gray-600">{deal.account_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {deal.contact_id ? (
                        <>
                          {contacts.find(c => c.id === deal.contact_id)?.first_name} {contacts.find(c => c.id === deal.contact_id)?.last_name}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${cfg.header} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">${(deal.value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{deal.probability}%</td>
                    <td className="px-4 py-3 text-gray-600">{deal.close_date || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingDeal(deal) }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMut.mutate(deal.id) }}
                          className="text-red-600 hover:text-red-800 p-1"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Deal Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Deal" size="lg">
        <DealForm
          accounts={accounts} contacts={contacts} stages={stages} stageConfig={stageConfig}
          onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending}
        />
      </Modal>

      {/* Edit Deal Modal */}
      <Modal isOpen={!!editingDeal} onClose={() => setEditingDeal(null)} title="Edit Deal" size="lg">
        {editingDeal && <DealForm
          initial={editingDeal} accounts={accounts} contacts={contacts} stages={stages} stageConfig={stageConfig}
          onSubmit={data => updateMut.mutate({ id: editingDeal.id, data })}
          onCancel={() => setEditingDeal(null)} isLoading={updateMut.isPending}
        />}
      </Modal>
    </div>
  )
}
