import { useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dealsApi, dealDetailApi, accountsApi, contactsApi, activitiesApi } from '../api'
import api from '../api'
import {
  ArrowLeft, Edit2, FileText, MessageSquare, Video, Clock, Plus, Trash2,
  ExternalLink, X, Save, ChevronDown, ChevronUp, Users, DollarSign, Calendar,
  CheckCircle2, Circle, Phone, Mail, CheckSquare
} from 'lucide-react'

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

const DOC_TYPES = ['rfp', 'proposal', 'sow', 'contract', 'presentation', 'nda', 'other']
const MEETING_TYPES = ['meeting', 'call', 'demo', 'review', 'negotiation']

const DOC_TYPE_COLORS = {
  rfp: 'bg-blue-100 text-blue-700', proposal: 'bg-green-100 text-green-700',
  sow: 'bg-purple-100 text-purple-700', contract: 'bg-red-100 text-red-700',
  presentation: 'bg-yellow-100 text-yellow-700', nda: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
}
const MEETING_TYPE_COLORS = {
  meeting: 'bg-blue-100 text-blue-700', call: 'bg-green-100 text-green-700',
  demo: 'bg-purple-100 text-purple-700', review: 'bg-orange-100 text-orange-700',
  negotiation: 'bg-red-100 text-red-700',
}

function StageBadge({ stage, stageConfig }) {
  const cfg = stageConfig[stage] || STAGE_COLORS[0]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.text} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label || stage}
    </span>
  )
}

// ── TIMELINE TAB ────────────────────────────────────────────────────────────────
function TimelineTab({ dealId }) {
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['timeline', dealId],
    queryFn: () => dealDetailApi.getTimeline(dealId),
  })

  const icon = (type) => {
    if (type === 'deal_created') return '🎉'
    if (type === 'stage_change') return '→'
    if (type === 'note') return '📝'
    if (type === 'document') return '📄'
    if (type === 'meeting') return '🎥'
    return '•'
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-4 text-center">Loading timeline…</div>
  if (!timeline.length) return <div className="text-sm text-gray-400 py-4 text-center">No activity yet. Add notes, documents, or meetings to see them here.</div>

  return (
    <div className="space-y-3">
      {timeline.map(event => (
        <div key={event.id} className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">{icon(event.event_type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{event.title}</p>
            {event.description && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{event.description}</p>}
            <p className="text-xs text-gray-400 mt-1">{new Date(event.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── DOCUMENTS TAB ────────────────────────────────────────────────────────────
function DocumentsTab({ dealId }) {
  const qc = useQueryClient()
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['docs', dealId],
    queryFn: () => dealDetailApi.getDocuments(dealId),
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'other', url: '', notes: '' })
  const [selFile, setSelFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const addMutation = useMutation({
    mutationFn: (data) => dealDetailApi.addDocument(dealId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', dealId] })
      qc.invalidateQueries({ queryKey: ['timeline', dealId] })
      setShowForm(false)
      setForm({ title: '', type: 'other', url: '', notes: '' })
      setSelFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId) => dealDetailApi.deleteDocument(dealId, docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs', dealId] }) },
  })

  const handleSave = async () => {
    if (!form.title.trim()) return
    setUploading(true)
    try {
      let fileUrl = form.url.trim()
      let fileName = null
      let fileSize = null
      if (selFile) {
        const safeName = selFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = dealId + '/' + Date.now() + '-' + safeName
        const mtype = selFile.type || 'application/octet-stream'
        const sbUrl = 'https://ytndbkokmgaucesyemey.supabase.co'
        const sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bmRia29rbWdhdWNlc3llbWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjgyMjgsImV4cCI6MjA5MTA0NDIyOH0.l59LB9Q7yQK-tbR0R0UTGUfZicu-_X79sPZDhweoXSE'
        const resp = await fetch(sbUrl + '/storage/v1/object/deal-documents/' + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + sbKey, 'Content-Type': mtype },
          body: selFile,
        })
        if (!resp.ok) { const msg = await resp.text(); throw new Error(msg) }
        fileUrl = sbUrl + '/storage/v1/object/public/deal-documents/' + path
        fileName = selFile.name
        fileSize = selFile.size
      }
      await addMutation.mutateAsync({ ...form, url: fileUrl || null, file_name: fileName, file_size: fileSize })
    } catch (err) {
      alert('Could not save document: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const canPreview = (doc) => /\.(pdf|png|jpg|jpeg|gif|svg|webp)$/i.test(doc.file_name || doc.url || '')

  if (isLoading) return <div className="text-sm text-gray-400 py-4 text-center">Loading documents…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Document title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Upload File</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.zip" className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-gray-300 file:rounded-lg file:text-sm file:bg-white hover:file:bg-gray-50" onChange={e => setSelFile(e.target.files[0] || null)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Or paste a URL</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Optional notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setSelFile(null); setForm({ title: '', type: 'other', url: '', notes: '' }) }} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleSave} disabled={uploading || !form.title.trim()} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {uploading ? 'Saving…' : 'Save Document'}
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 && !showForm && (
        <div className="text-sm text-gray-400 py-6 text-center">No documents yet. Click “Add Document” to attach files or links.</div>
      )}

      <div className="space-y-2">
        {docs.map(doc => {
          const typeClass = DOC_TYPE_COLORS[doc.type] || DOC_TYPE_COLORS.other
          return (
            <div key={doc.id} className="flex items-start justify-between p-3 border border-gray-200 rounded-xl bg-white hover:bg-gray-50">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeClass}`}>{doc.type}</span>
                  </div>
                  {doc.file_name && <div className="text-xs text-gray-500 mt-0.5">{doc.file_name}{doc.file_size ? ' · ' + (doc.file_size / 1024).toFixed(1) + ' KB' : ''}</div>}
                  {doc.notes && <div className="text-xs text-gray-500 mt-1 italic">{doc.notes}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                {doc.url && canPreview(doc) && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200" title="Preview">
                    <ExternalLink className="w-3.5 h-3.5" /> Preview
                  </a>
                )}
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200" title="Download" download={doc.file_name || undefined}>
                    <ExternalLink className="w-3.5 h-3.5" /> Download
                  </a>
                )}
                <button onClick={() => { if (window.confirm('Delete this document?')) deleteMutation.mutate(doc.id) }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── NOTES TAB ────────────────────────────────────────────────────────────────
function NotesTab({ dealId }) {
  const qc = useQueryClient()
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', dealId],
    queryFn: () => dealDetailApi.getNotes(dealId),
  })
  const addMut = useMutation({
    mutationFn: (data) => dealDetailApi.addNote(dealId, data),
    onSuccess: () => { qc.invalidateQueries(['notes', dealId]); qc.invalidateQueries(['timeline', dealId]); setDraft('') }
  })
  const updateMut = useMutation({
    mutationFn: ({ noteId, data }) => dealDetailApi.updateNote(dealId, noteId, data),
    onSuccess: () => { qc.invalidateQueries(['notes', dealId]); setEditingId(null) }
  })
  const delMut = useMutation({
    mutationFn: (noteId) => dealDetailApi.deleteNote(dealId, noteId),
    onSuccess: () => { qc.invalidateQueries(['notes', dealId]); qc.invalidateQueries(['timeline', dealId]) }
  })

  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          className="input w-full"
          rows={3}
          placeholder="Write a note… (Cmd+Enter to save)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && draft.trim()) { addMut.mutate({ content: draft }); e.preventDefault() } }}
        />
        <div className="flex justify-end">
          <button className="btn-primary text-sm" disabled={!draft.trim() || addMut.isPending}
            onClick={() => addMut.mutate({ content: draft })}>{addMut.isPending ? 'Saving…' : 'Add Note'}</button>
        </div>
      </div>

      {isLoading ? <div className="text-sm text-gray-400 py-4 text-center">Loading…</div> :
        !notes.length ? <div className="text-sm text-gray-400 py-4 text-center">No notes yet.</div> :
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="group p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea className="input w-full" rows={3} value={editText} onChange={e => setEditText(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                    <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn-primary text-xs" onClick={() => updateMut.mutate({ noteId: note.id, data: { content: editText } })}>Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(note.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <button className="text-gray-400 hover:text-blue-600" onClick={() => { setEditingId(note.id); setEditText(note.content) }}><Edit2 size={14} /></button>
                    <button className="text-gray-400 hover:text-red-600" onClick={() => window.confirm('Delete note?') && delMut.mutate(note.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  )
}

// ── MEETINGS TAB ─────────────────────────────────────────────────────────────
function MeetingsTab({ dealId }) {
  const qc = useQueryClient()
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings', dealId],
    queryFn: () => dealDetailApi.getMeetings(dealId),
  })
  const addMut = useMutation({
    mutationFn: (data) => dealDetailApi.addMeeting(dealId, data),
    onSuccess: () => { qc.invalidateQueries(['meetings', dealId]); qc.invalidateQueries(['timeline', dealId]); setForm({ title: '', type: 'meeting', meeting_date: '', attendees: '', recording_url: '', mom: '' }); setShowForm(false) }
  })
  const delMut = useMutation({
    mutationFn: (meetId) => dealDetailApi.deleteMeeting(dealId, meetId),
    onSuccess: () => { qc.invalidateQueries(['meetings', dealId]); qc.invalidateQueries(['timeline', dealId]) }
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'meeting', meeting_date: '', attendees: '', recording_url: '', mom: '' })
  const [expandedId, setExpandedId] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> Log Meeting
        </button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Meeting title" />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {MEETING_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date & Time</label>
              <input className="input" type="datetime-local" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Attendees</label>
              <input className="input" value={form.attendees} onChange={e => set('attendees', e.target.value)} placeholder="John, Jane, ..." />
            </div>
          </div>
          <div>
            <label className="label">Recording URL</label>
            <input className="input" value={form.recording_url} onChange={e => set('recording_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="label">Minutes / Notes (MOM)</label>
            <textarea className="input" rows={3} value={form.mom} onChange={e => set('mom', e.target.value)} placeholder="Key discussion points, action items..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary text-sm" disabled={!form.title || addMut.isPending}
              onClick={() => addMut.mutate(form)}>{addMut.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-sm text-gray-400 py-4 text-center">Loading…</div> :
        !meetings.length ? <div className="text-sm text-gray-400 py-4 text-center">No meetings logged yet.</div> :
        <div className="space-y-2">
          {meetings.map(m => (
            <div key={m.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="group flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                <Video size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEETING_TYPE_COLORS[m.type] || MEETING_TYPE_COLORS.meeting}`}>{m.type}</span>
                    <span className="text-sm font-medium">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {m.meeting_date && <p className="text-xs text-gray-500">{new Date(m.meeting_date).toLocaleString()}</p>}
                    {m.attendees && <p className="text-xs text-gray-500">👥 {m.attendees}</p>}
                    {m.recording_url && (
                      <a href={m.recording_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink size={10} /> Recording
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                    onClick={e => { e.stopPropagation(); window.confirm('Delete meeting?') && delMut.mutate(m.id) }}>
                    <Trash2 size={14} />
                  </button>
                  {expandedId === m.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>
              {expandedId === m.id && m.mom && (
                <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">Meeting Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.mom}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  )
}

// ── ACTIVITIES TAB ────────────────────────────────────────────────────────────────────────────────
const ACT_ICONS = { call: Phone, email: Mail, meeting: Users, task: FileText, note: FileText }
const ACT_COLORS = {
  call: 'text-green-600 bg-green-50', email: 'text-blue-600 bg-blue-50',
  meeting: 'text-purple-600 bg-purple-50', task: 'text-yellow-600 bg-yellow-50',
  note: 'text-gray-600 bg-gray-100',
}

function ActivitiesTab({ dealId, contacts = [] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'task', subject: '', description: '', contact_id: '', due_date: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['deal-activities', dealId],
    queryFn: () => activitiesApi.getAll({ deal_id: dealId }),
  })

  const createMut = useMutation({
    mutationFn: (data) => activitiesApi.create({ ...data, deal_id: dealId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-activities', dealId] })
      qc.invalidateQueries({ queryKey: ['timeline', dealId] })
      qc.invalidateQueries({ queryKey: ['activities'] })
      setShowForm(false)
      setForm({ type: 'task', subject: '', description: '', contact_id: '', due_date: '' })
    }
  })

  const toggleMut = useMutation({
    mutationFn: (act) => activitiesApi.update(act.id, { completed: !act.completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-activities', dealId] })
  })

  const deleteMut = useMutation({
    mutationFn: (id) => activitiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-activities', dealId] })
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> Log Activity
        </button>
      </div>
      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="task">Task</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Subject *</label>
            <input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className="label">Contact</label>
            <select className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
              <option value="">No Contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary text-sm" disabled={!form.subject.trim() || createMut.isPending}
              onClick={() => createMut.mutate(form)}>
              {createMut.isPending ? 'Saving…' : 'Save Activity'}
            </button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">No activities yet. Log a call, email, task, or meeting.</div>
      ) : (
        <div className="space-y-2">
          {activities.map(act => {
            const Icon = ACT_ICONS[act.type] || FileText
            const colorClass = ACT_COLORS[act.type] || ACT_COLORS.note
            const isOverdue = !act.completed && act.due_date && new Date(act.due_date) < new Date()
            return (
              <div key={act.id} className={`flex items-start gap-3 p-3 border rounded-lg ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <button onClick={() => toggleMut.mutate(act)} className="mt-0.5 flex-shrink-0">
                  {act.completed
                    ? <CheckCircle2 size={18} className="text-green-500" />
                    : <Circle size={18} className="text-gray-300 hover:text-gray-400" />}
                </button>
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}><Icon size={13} /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${act.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{act.subject}</p>
                  {act.description && <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {act.contact_name && <span className="text-xs text-gray-500">{act.contact_name}</span>}
                    {act.due_date && <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{act.due_date}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>{act.type}</span>
                  </div>
                </div>
                <button onClick={() => window.confirm('Delete this activity?') && deleteMut.mutate(act.id)}
                  className="text-red-400 hover:text-red-600 p-1 text-xs flex-shrink-0">Del</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── CONTACTS TAB ─────────────────────────────────────────────────────────────
function ContactsTab({ dealId, deal, contacts = [] }) {
  const qc = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ contact_id: '', role: '' })

  const stakeholders = deal?.stakeholders || []

  // Build the primary contact entry if it exists and isn't already a stakeholder
  const primaryId = deal?.contact_id || null
  const primaryEntry = primaryId && contacts.find(c => c.id === primaryId)
  const primaryAlreadyStakeholder = stakeholders.some(s => s.id === primaryId)

  const addMut = useMutation({
    mutationFn: () => dealsApi.addStakeholder(dealId, addForm.contact_id, addForm.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal', dealId] })
      setShowAddForm(false)
      setAddForm({ contact_id: '', role: '' })
    },
  })

  const removeMut = useMutation({
    mutationFn: (stakeholderId) => dealsApi.removeStakeholder(dealId, stakeholderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', dealId] }),
  })

  // Contacts already shown (primary + stakeholders) — exclude from add dropdown
  const shownIds = new Set([
    ...(primaryEntry && !primaryAlreadyStakeholder ? [primaryId] : []),
    ...stakeholders.map(s => s.id),
  ])
  const availableContacts = contacts.filter(c => !shownIds.has(c.id))

  const totalShown = stakeholders.length + (primaryEntry && !primaryAlreadyStakeholder ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus size={14} /> Add Contact
        </button>
      </div>
      {showAddForm && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact *</label>
              <select className="input" value={addForm.contact_id}
                onChange={e => setAddForm(f => ({ ...f, contact_id: e.target.value }))}>
                <option value="">Select contact...</option>
                {availableContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Role</label>
              <input className="input" placeholder="e.g. Champion, Decision Maker..."
                value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary text-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button className="btn-primary text-sm" disabled={!addForm.contact_id || addMut.isPending}
              onClick={() => addMut.mutate()}>
              {addMut.isPending ? 'Adding...' : 'Add to Deal'}
            </button>
          </div>
        </div>
      )}
      {totalShown === 0 && !showAddForm && (
        <div className="text-sm text-gray-400 py-6 text-center">
          No contacts linked yet. Click "Add Contact" to link contacts to this deal.
        </div>
      )}
      <div className="space-y-2">
        {/* Primary contact row */}
        {primaryEntry && !primaryAlreadyStakeholder && (
          <div className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                {(primaryEntry.first_name?.[0] || '').toUpperCase()}{(primaryEntry.last_name?.[0] || '').toUpperCase()}
              </div>
              <div>
                <Link to={`/contacts/${primaryEntry.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                  {primaryEntry.first_name} {primaryEntry.last_name}
                </Link>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {primaryEntry.title && <p className="text-xs text-gray-500">{primaryEntry.title}</p>}
                  <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full font-medium">Primary Contact</span>
                  {primaryEntry.linkedin_scan_status === 'done' && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> LinkedIn</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Stakeholder rows */}
        {stakeholders.map(s => (
          <div key={s.stakeholder_id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                {(s.first_name?.[0] || '').toUpperCase()}{(s.last_name?.[0] || '').toUpperCase()}
              </div>
              <div>
                <Link to={`/contacts/${s.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                  {s.first_name} {s.last_name}
                </Link>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {s.title && <p className="text-xs text-gray-500">{s.title}</p>}
                  {s.role && <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">{s.role}</span>}
                  {s.linkedin_scan_status === 'done' && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> LinkedIn</span>
                  )}
                  {s.email && <a href={`mailto:${s.email}`} className="text-xs text-blue-600 hover:underline">{s.email}</a>}
                </div>
              </div>
            </div>
            <button
              onClick={() => { if (window.confirm('Remove this contact from the deal?')) removeMut.mutate(s.stakeholder_id) }}
              className="text-red-400 hover:text-red-600 p-1 ml-2 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN DEAL DETAIL PAGE ────────────────────────────────────────────────────
export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('timeline')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  const { data: deal, isLoading: dealLoading, error: dealError } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => dealsApi.get(id),
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll() })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.getAll() })

  const stages = useMemo(() => {
    try { if (settingsData?.pipeline_stages) return JSON.parse(settingsData.pipeline_stages).map(toSlug) } catch {}
    return DEFAULT_STAGE_LABELS.map(toSlug)
  }, [settingsData])

  const stageConfig = useMemo(() => {
    try { if (settingsData?.pipeline_stages) return buildStageConfig(JSON.parse(settingsData.pipeline_stages)) } catch {}
    return buildStageConfig(DEFAULT_STAGE_LABELS)
  }, [settingsData])

  const updateMut = useMutation({
    mutationFn: (data) => dealsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['deal', id]); qc.invalidateQueries(['pipeline']); setEditing(false) }
  })

  const startEdit = () => {
    setEditForm({
      name: deal.name || '',
      stage: deal.stage || '',
      value: deal.value || '',
      probability: deal.probability || '',
      close_date: deal.close_date || '',
      account_id: deal.account_id || '',
      contact_id: deal.contact_id || '',
      notes: deal.notes || '',
    })
    setEditing(true)
  }

  if (dealLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading deal…</div>
  if (dealError || !deal) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">Deal not found.</p>
      <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  )

  const isOverdue = deal.close_date && new Date(deal.close_date) < new Date() && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'

  const TABS = [
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'activities', label: 'Activities', icon: CheckSquare },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'meetings', label: 'Meetings', icon: Video },
  ]

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          {editing ? (
            <input
              className="input text-xl font-bold w-full max-w-md"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
          ) : (
            <h1 className="text-2xl font-bold">{deal.name}</h1>
          )}
          <div className="flex items-center gap-2 mt-1">
            <StageBadge stage={deal.stage} stageConfig={stageConfig} />
            {deal.account_name && <span className="text-sm text-gray-500">{deal.account_name}</span>}
          </div>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
            <button className="btn-primary flex items-center gap-1" disabled={updateMut.isPending} onClick={() => updateMut.mutate(editForm)}>
              <Save size={14} /> {updateMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button className="btn-secondary flex items-center gap-1" onClick={startEdit}><Edit2 size={14} /> Edit</button>
        )}
      </div>

      {/* Deal Info Card */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={11} /> Value</p>
          {editing ? (
            <input className="input text-sm mt-1" type="number" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} />
          ) : (
            <p className="text-lg font-bold text-green-600">${(deal.value || 0).toLocaleString()}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500">Probability</p>
          {editing ? (
            <input className="input text-sm mt-1" type="number" min="0" max="100" value={editForm.probability} onChange={e => setEditForm(f => ({ ...f, probability: e.target.value }))} />
          ) : (
            <p className="text-lg font-bold">{deal.probability || 0}%</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={11} /> Close Date</p>
          {editing ? (
            <input className="input text-sm mt-1" type="date" value={editForm.close_date} onChange={e => setEditForm(f => ({ ...f, close_date: e.target.value }))} />
          ) : (
            <p className={`text-sm font-medium mt-1 ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>{deal.close_date || '—'}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500">Stage</p>
          {editing ? (
            <select className="input text-sm mt-1" value={editForm.stage} onChange={e => setEditForm(f => ({ ...f, stage: e.target.value }))}>
              {stages.map(s => <option key={s} value={s}>{stageConfig[s]?.label || s}</option>)}
            </select>
          ) : (
            <div className="mt-1"><StageBadge stage={deal.stage} stageConfig={stageConfig} /></div>
          )}
        </div>
        {editing && (
          <>
            <div>
              <p className="text-xs text-gray-500">Account</p>
              <select className="input text-sm mt-1" value={editForm.account_id} onChange={e => setEditForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">No Account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500">Contact</p>
              <select className="input text-sm mt-1" value={editForm.contact_id} onChange={e => setEditForm(f => ({ ...f, contact_id: e.target.value }))}>
                <option value="">No Contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </>
        )}
        {!editing && (
          <>
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Users size={11} /> Account</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{deal.account_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Contact</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{deal.contact_name || '—'}</p>
            </div>
          </>
        )}
        {editing && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500">Notes</p>
            <textarea className="input text-sm mt-1 w-full" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        )}
        {!editing && deal.notes && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500">Notes</p>
            <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded p-2">{deal.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-48">
        {activeTab === 'timeline' && <TimelineTab dealId={id} />}
      {activeTab === 'activities' && <ActivitiesTab dealId={id} contacts={contacts} />}
        {activeTab === 'contacts' && <ContactsTab dealId={id} deal={deal} contacts={contacts} />}
        {activeTab === 'documents' && <DocumentsTab dealId={id} />}
        {activeTab === 'notes' && <NotesTab dealId={id} />}
        {activeTab === 'meetings' && <MeetingsTab dealId={id} />}
      </div>
    </div>
  )
}
