import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { activitiesApi, dealsApi, contactsApi } from '../api'
import { Plus, CheckCircle2, Circle, Calendar, AlertCircle, Clock, Phone, Mail, FileText, Users } from 'lucide-react'
import Modal from '../components/Modal'

const TYPE_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: FileText,
  note: FileText,
  stage_change: CheckCircle2,
}

const TYPE_COLORS = {
  call: 'text-green-600 bg-green-50',
  email: 'text-blue-600 bg-blue-50',
  meeting: 'text-purple-600 bg-purple-50',
  task: 'text-yellow-600 bg-yellow-50',
  note: 'text-gray-600 bg-gray-100',
  stage_change: 'text-indigo-600 bg-indigo-50',
}

function ActivityForm({ initial = {}, deals = [], contacts = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    type: initial.type || 'task',
    subject: initial.subject || '',
    description: initial.description || '',
    deal_id: initial.deal_id || '',
    contact_id: initial.contact_id || '',
    due_date: initial.due_date || '',
    completed: initial.completed || false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Type *</label>
          <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="task">Task</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="note">Note</option>
          </select>
        </div>
        <div><label className="label">Due Date</label>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>
      <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} required /></div>
      <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Related Deal</label>
          <select className="input" value={form.deal_id} onChange={e => set('deal_id', e.target.value)}>
            <option value="">No Deal</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label className="label">Contact</label>
          <select className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
            <option value="">No Contact</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.completed} onChange={e => set('completed', e.target.checked)} className="rounded" />
        Mark as completed
      </label>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Activity'}</button>
      </div>
    </form>
  )
}

export default function Activities() {
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const qc = useQueryClient()

  const params = filter === 'overdue' ? { overdue: 'true' } : filter === 'upcoming' ? { upcoming: 'true' } : filter !== 'all' ? { type: filter } : {}
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', filter],
    queryFn: () => activitiesApi.getAll(params),
  })
  const { data: reminders } = useQuery({ queryKey: ['reminders'], queryFn: activitiesApi.getReminders })
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => dealsApi.getAll() })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.getAll() })

  const createMut = useMutation({ mutationFn: activitiesApi.create, onSuccess: () => { qc.invalidateQueries(['activities']); qc.invalidateQueries(['reminders']); qc.invalidateQueries(['dashboard']); setShowModal(false) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => activitiesApi.update(id, data), onSuccess: () => { qc.invalidateQueries(['activities']); qc.invalidateQueries(['reminders']); qc.invalidateQueries(['dashboard']); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: activitiesApi.delete, onSuccess: () => { qc.invalidateQueries(['activities']); qc.invalidateQueries(['reminders']) } })

  const toggleComplete = (act) => updateMut.mutate({ id: act.id, data: { completed: !act.completed } })

  const overdueCount = reminders?.overdue?.length || 0
  const staleDeals = reminders?.staleDeals || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          {overdueCount > 0 && (
            <p className="text-sm text-red-500 flex items-center gap-1 mt-0.5">
              <AlertCircle size={14} /> {overdueCount} overdue
            </p>
          )}
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}><Plus size={16} /> Log Activity</button>
      </div>

      {/* Stale Deals Warning */}
      {staleDeals.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 flex items-center gap-2 mb-2">
            <Clock size={14} /> {staleDeals.length} deal{staleDeals.length !== 1 ? 's' : ''} with no activity in 14+ days
          </h3>
          <div className="space-y-1">
            {staleDeals.slice(0, 3).map(d => (
              <p key={d.id} className="text-xs text-yellow-700">{d.name} — {d.days_since_activity ? `${Math.round(d.days_since_activity)} days` : 'No activity'} since last activity</p>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[['all','All'],['overdue','Overdue'],['upcoming','Upcoming'],['task','Tasks'],['call','Calls'],['email','Emails'],['meeting','Meetings']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${filter === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {l}
            {v === 'overdue' && overdueCount > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1 py-0.5 rounded-full">{overdueCount}</span>}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
            No activities found.
          </div>
        ) : activities.map(act => {
          const Icon = TYPE_ICONS[act.type] || FileText
          const colorClass = TYPE_COLORS[act.type] || TYPE_COLORS.note
          const isOverdue = !act.completed && act.due_date && new Date(act.due_date) < new Date()
          return (
            <div key={act.id} className={`card p-4 flex items-start gap-4 ${isOverdue ? 'border-red-200' : ''}`}>
              <button onClick={() => toggleComplete(act)} className="mt-0.5 flex-shrink-0">
                {act.completed ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-gray-300 hover:text-gray-400" />}
              </button>
              <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${act.completed ? 'line-through text-gray-400' : ''}`}>{act.subject}</p>
                {act.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{act.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {act.deal_name && <span className="text-xs text-blue-600">{act.deal_name}</span>}
                  {act.contact_name && <span className="text-xs text-gray-500">{act.contact_name}</span>}
                  {act.due_date && (
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      <Calendar size={10} /> {act.due_date}
                    </span>
                  )}
                  <span className={`badge ${colorClass} text-xs`}>{act.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(act)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded text-xs">Edit</button>
                <button onClick={() => { if(window.confirm('Delete?')) deleteMut.mutate(act.id) }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded text-xs">Del</button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Log Activity" size="lg">
        <ActivityForm deals={deals} contacts={contacts} onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending} />
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Activity" size="lg">
        {editing && <ActivityForm initial={editing} deals={deals} contacts={contacts} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>
    </div>
  )
}
