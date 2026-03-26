import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dealsApi, accountsApi, contactsApi } from '../api'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, DollarSign, Calendar, Users, TrendingUp, BarChart2 } from 'lucide-react'
import Modal from '../components/Modal'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const STAGE_CONFIG = {
  lead:        { label: 'Lead',        color: 'bg-gray-100',   header: 'bg-gray-200',  text: 'text-gray-700',   dot: 'bg-gray-400' },
  qualified:   { label: 'Qualified',   color: 'bg-blue-50',    header: 'bg-blue-100',  text: 'text-blue-700',   dot: 'bg-blue-500' },
  proposal:    { label: 'Proposal',    color: 'bg-yellow-50',  header: 'bg-yellow-100',text: 'text-yellow-700', dot: 'bg-yellow-500' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-50',  header: 'bg-orange-100',text: 'text-orange-700', dot: 'bg-orange-500' },
  closed_won:  { label: 'Closed Won',  color: 'bg-green-50',   header: 'bg-green-100', text: 'text-green-700',  dot: 'bg-green-500' },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-50',     header: 'bg-red-100',   text: 'text-red-700',    dot: 'bg-red-500' },
}

function DealForm({ initial = {}, accounts = [], contacts = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    account_id: initial.account_id || '',
    contact_id: initial.contact_id || '',
    stage: initial.stage || 'lead',
    value: initial.value || '',
    probability: initial.probability || '',
    close_date: initial.close_date || '',
    notes: initial.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div><label className="label">Deal Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Account</label>
          <select className="input" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">No Account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><label className="label">Primary Contact</label>
          <select className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
            <option value="">No Contact</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Stage</label>
          <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
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

function DealCard({ deal, index, onClick }) {
  const cfg = STAGE_CONFIG[deal.stage] || STAGE_CONFIG.lead
  const isOverdue = deal.close_date && new Date(deal.close_date) < new Date() && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow mb-2 ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
        >
          <p className="text-sm font-medium mb-1 line-clamp-2">{deal.name}</p>
          {deal.account_name && <p className="text-xs text-gray-500 mb-2">{deal.account_name}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-semibold text-green-600">${(deal.value || 0).toLocaleString()}</span>
            <span className="text-xs text-gray-400">{deal.probability}%</span>
          </div>
          {deal.close_date && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              <Calendar size={10} />
              {deal.close_date}
            </div>
          )}
          {deal.stakeholders?.length > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
              <Users size={10} />
              {deal.stakeholders.length} stakeholder{deal.stakeholders.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

function StakeholderManager({ deal, contacts, onClose }) {
  const qc = useQueryClient()
  const addMut = useMutation({
    mutationFn: ({ contact_id, role }) => dealsApi.addStakeholder(deal.id, contact_id, role),
    onSuccess: () => qc.invalidateQueries(['pipeline'])
  })
  const removeMut = useMutation({
    mutationFn: (contact_id) => dealsApi.removeStakeholder(deal.id, contact_id),
    onSuccess: () => qc.invalidateQueries(['pipeline'])
  })

  const [selectedContact, setSelectedContact] = useState('')
  const [role, setRole] = useState('')
  const stakeholderIds = deal.stakeholders?.map(s => s.contact_id) || []
  const availableContacts = contacts.filter(c => !stakeholderIds.includes(c.id))

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-3">Current Stakeholders</h4>
        {deal.stakeholders?.length === 0 ? (
          <p className="text-sm text-gray-400">No stakeholders added yet</p>
        ) : (
          <div className="space-y-2">
            {deal.stakeholders?.map(s => (
              <div key={s.contact_id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-500">{s.email} {s.role ? `· ${s.role}` : ''}</p>
                </div>
                <button onClick={() => removeMut.mutate(s.contact_id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Add Stakeholder</h4>
        <div className="space-y-2">
          <select className="input" value={selectedContact} onChange={e => setSelectedContact(e.target.value)}>
            <option value="">Select contact...</option>
            {availableContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>)}
          </select>
          <input className="input" placeholder="Role (e.g. Decision Maker, Champion)" value={role} onChange={e => setRole(e.target.value)} />
          <button
            onClick={() => { if(selectedContact) { addMut.mutate({ contact_id: selectedContact, role }); setSelectedContact(''); setRole('') } }}
            disabled={!selectedContact || addMut.isPending}
            className="btn-primary w-full"
          >
            Add Stakeholder
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [view, setView] = useState('kanban') // kanban | forecast
  const [showModal, setShowModal] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [viewingDeal, setViewingDeal] = useState(null)
  const [stakeholderDeal, setStakeholderDeal] = useState(null)
  const qc = useQueryClient()

  const { data: pipeline = {}, isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: dealsApi.getPipeline,
  })

  const { data: forecast = [] } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => dealsApi.getForecast(6),
    enabled: view === 'forecast',
  })

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll() })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.getAll() })

  const createMut = useMutation({
    mutationFn: dealsApi.create,
    onSuccess: () => { qc.invalidateQueries(['pipeline']); qc.invalidateQueries(['dashboard']); setShowModal(false) }
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => dealsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['pipeline']); qc.invalidateQueries(['dashboard']); setEditingDeal(null) }
  })
  const deleteMut = useMutation({
    mutationFn: dealsApi.delete,
    onSuccess: () => { qc.invalidateQueries(['pipeline']); qc.invalidateQueries(['dashboard']) }
  })

  const onDragEnd = (result) => {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStage = destination.droppableId
    updateMut.mutate({ id: draggableId, data: { stage: newStage } })
  }

  const totalPipeline = STAGES.filter(s => s !== 'closed_lost').reduce((sum, s) => {
    return sum + (pipeline[s] || []).reduce((s2, d) => s2 + (d.value || 0), 0)
  }, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-gray-500">Total pipeline: <span className="font-semibold text-green-600">${totalPipeline.toLocaleString()}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Kanban
            </button>
            <button onClick={() => setView('forecast')} className={`px-3 py-1.5 text-sm ${view === 'forecast' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Forecast
            </button>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Deal
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="overflow-x-auto pb-4">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 min-w-max">
              {STAGES.map(stage => {
                const cfg = STAGE_CONFIG[stage]
                const stageDeals = pipeline[stage] || []
                const stageTotal = stageDeals.reduce((s, d) => s + (d.value || 0), 0)
                return (
                  <div key={stage} className="w-64 flex flex-col">
                    <div className={`rounded-t-lg px-3 py-2 ${cfg.header}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <span className="text-xs text-gray-500">{stageDeals.length}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">${stageTotal.toLocaleString()}</p>
                    </div>
                    <Droppable droppableId={stage}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-48 p-2 rounded-b-lg border border-t-0 border-gray-200 ${snapshot.isDraggingOver ? 'bg-blue-50' : cfg.color}`}
                        >
                          {stageDeals.map((deal, index) => (
                            <DealCard
                              key={deal.id}
                              deal={deal}
                              index={index}
                              onClick={() => setViewingDeal(deal)}
                            />
                          ))}
                          {provided.placeholder}
                          {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-xs text-gray-400 text-center py-4">Drop deals here</p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              Revenue Forecast (6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} />
                <Legend />
                <Area type="monotone" dataKey="committed" name="Committed" fill="#86efac" stroke="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="weighted" name="Weighted" fill="#93c5fd" stroke="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="pipeline" name="Pipeline" fill="#e9d5ff" stroke="#a855f7" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-blue-600" />
              Deals by Month
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="deal_count" name="Deals" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Deals</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pipeline</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Weighted</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Committed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecast.map(f => (
                  <tr key={f.month}>
                    <td className="px-4 py-3 font-medium">{f.label}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{f.deal_count}</td>
                    <td className="px-4 py-3 text-right text-purple-600">${Math.round(f.pipeline).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-blue-600">${Math.round(f.weighted).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-semibold">${Math.round(f.committed).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Deal" size="lg">
        <DealForm accounts={accounts} contacts={contacts} onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending} />
      </Modal>

      {/* Edit Deal Modal */}
      <Modal isOpen={!!editingDeal} onClose={() => setEditingDeal(null)} title="Edit Deal" size="lg">
        {editingDeal && <DealForm initial={editingDeal} accounts={accounts} contacts={contacts} onSubmit={data => updateMut.mutate({ id: editingDeal.id, data })} onCancel={() => setEditingDeal(null)} isLoading={updateMut.isPending} />}
      </Modal>

      {/* View Deal Modal */}
      <Modal isOpen={!!viewingDeal} onClose={() => setViewingDeal(null)} title={viewingDeal?.name || 'Deal Details'} size="lg">
        {viewingDeal && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-3">
                <p className="text-xs text-gray-500">Value</p>
                <p className="text-xl font-bold text-green-600">${(viewingDeal.value || 0).toLocaleString()}</p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-gray-500">Probability</p>
                <p className="text-xl font-bold">{viewingDeal.probability}%</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Stage:</span> <span className="font-medium">{STAGE_CONFIG[viewingDeal.stage]?.label}</span></div>
              <div><span className="text-gray-500">Account:</span> <span className="font-medium">{viewingDeal.account_name || '—'}</span></div>
              <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{viewingDeal.contact_name || '—'}</span></div>
              <div><span className="text-gray-500">Close Date:</span> <span className="font-medium">{viewingDeal.close_date || '—'}</span></div>
            </div>
            {viewingDeal.notes && <div><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-sm bg-gray-50 rounded p-3">{viewingDeal.notes}</p></div>}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Stakeholders</h4>
                <button onClick={() => { setStakeholderDeal(viewingDeal); setViewingDeal(null) }} className="text-sm text-blue-600 hover:underline">Manage</button>
              </div>
              {viewingDeal.stakeholders?.length === 0 ? (
                <p className="text-sm text-gray-400">No stakeholders yet</p>
              ) : viewingDeal.stakeholders?.map(s => (
                <div key={s.contact_id} className="flex items-center gap-2 py-1.5 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {s.first_name[0]}
                  </div>
                  <span>{s.first_name} {s.last_name}</span>
                  {s.role && <span className="text-gray-400">· {s.role}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3 border-t">
              <button onClick={() => { setEditingDeal(viewingDeal); setViewingDeal(null) }} className="btn-secondary flex-1">Edit Deal</button>
              <button onClick={() => { if(window.confirm('Delete deal?')) { deleteMut.mutate(viewingDeal.id); setViewingDeal(null) } }} className="btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stakeholders Modal */}
      <Modal isOpen={!!stakeholderDeal} onClose={() => setStakeholderDeal(null)} title="Manage Stakeholders">
        {stakeholderDeal && <StakeholderManager deal={stakeholderDeal} contacts={contacts} onClose={() => setStakeholderDeal(null)} />}
      </Modal>
    </div>
  )
}
