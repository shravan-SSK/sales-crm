import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi, accountsApi } from '../api'
import { ArrowLeft, Edit2, Save, X, Linkedin, Clock, CheckCircle, XCircle, Briefcase,
  GraduationCap, MapPin, Phone, Mail, Building2, ExternalLink, CheckCircle2, AlertTriangle,
} from 'lucide-react'

function LinkedInDataCard({ data }) {
  if (!data) return null
  return (
    <div className="space-y-4">
      {(data.photo_url || data.name || data.headline) && (
        <div className="flex items-start gap-3">
          {data.photo_url && (
            <img src={data.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border flex-shrink-0" />
          )}
          <div>
            {data.name && <p className="font-semibold text-gray-900 text-sm">{data.name}</p>}
            {data.headline && <p className="text-xs text-gray-600">{data.headline}</p>}
            {data.location && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> {data.location}
              </p>
            )}
          </div>
        </div>
      )}
      {data.about && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">About</p>
          <p className="text-xs text-gray-700 line-clamp-4">{data.about}</p>
        </div>
      )}
      {data.experience?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
            <Briefcase size={10} /> Experience
          </p>
          <div className="space-y-2">
            {data.experience.map((exp, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-gray-900">{exp.title}</p>
                <p className="text-gray-600">{exp.company}{exp.duration ? ` · ${exp.duration}` : ''}{exp.start_date ? ` · ${exp.start_date}${exp.end_date ? ' – ' + exp.end_date : ' – Present'}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.education?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
            <GraduationCap size={10} /> Education
          </p>
          <div className="space-y-1">
            {data.education.map((edu, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-gray-900">{edu.school}</p>
                {edu.degree && <p className="text-gray-600">{edu.degree}{edu.field ? ` · ${edu.field}` : ''}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.skills?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Skills</p>
          <div className="flex flex-wrap gap-1">
            {data.skills.slice(0, 15).map((skill, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {typeof skill === 'string' ? skill : skill.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.scraped_at && (
        <p className="text-xs text-gray-400">Last scanned {new Date(data.scraped_at).toLocaleDateString()}</p>
      )}
    </div>
  )
}

const ACT_COLORS = {
  call: 'text-green-600 bg-green-50',
  email: 'text-blue-600 bg-blue-50',
  meeting: 'text-purple-600 bg-purple-50',
  task: 'text-yellow-600 bg-yellow-50',
  note: 'text-gray-600 bg-gray-100',
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [linkedinUrlInput, setLinkedinUrlInput] = useState('')
  const [showLinkedinInput, setShowLinkedinInput] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.get(id),
    refetchInterval: (data) => data?.linkedin_scan_status === 'pending' ? 5000 : false,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  })

  const updateMut = useMutation({
    mutationFn: (data) => contactsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
  })

  const scanMut = useMutation({
    mutationFn: (url) => contactsApi.requestScan(id, url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] })
      setShowLinkedinInput(false)
    },
  })

  // Auto-trigger scan when contact page opens:
  // fires if linkedin_url is set and data is missing or older than 7 days
  useEffect(() => {
    if (!contact) return
    if (!contact.linkedin_url) return
    if (contact.linkedin_scan_status === 'pending') return
    const scrapedAt = contact.linkedin_data?.scraped_at
    const daysSince = scrapedAt
      ? (Date.now() - new Date(scrapedAt).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity
    if (!contact.linkedin_data || daysSince > 7) {
      scanMut.mutate(contact.linkedin_url)
    }
  }, [contact?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setEditForm({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      title: contact.title || '',
      account_id: contact.account_id || '',
      linkedin_url: contact.linkedin_url || '',
      notes: contact.notes || '',
    })
    setEditing(true)
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading contact...</div>
  if (!contact) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">Contact not found.</p>
      <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  )

  const scanStatus = contact.linkedin_scan_status
  const linkedinData = contact.linkedin_data
  const primaryDeals = contact.deals || []
  const stakeholderDeals = contact.stakeholder_deals || []
  const allDeals = [...primaryDeals, ...stakeholderDeals].filter(
    (d, i, arr) => arr.findIndex(x => x.id === d.id) === i
  )
  const jobChangeActivity = (contact.activities || []).find(a => a.subject?.startsWith('Job change detected'))

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          {editing ? (
            <div className="flex gap-2">
              <input className="input text-xl font-bold w-36" value={editForm.first_name}
                onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First" />
              <input className="input text-xl font-bold w-36" value={editForm.last_name}
                onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last" />
            </div>
          ) : (
            <h1 className="text-2xl font-bold">{contact.first_name} {contact.last_name}</h1>
          )}
          <p className="text-sm text-gray-500 mt-0.5">
            {contact.title || 'No title'}{contact.account_name ? ` · ${contact.account_name}` : ''}
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
            <button className="btn-primary flex items-center gap-1" disabled={updateMut.isPending}
              onClick={() => updateMut.mutate(editForm)}>
              <Save size={14} /> {updateMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button className="btn-secondary flex items-center gap-1" onClick={startEdit}><Edit2 size={14} /> Edit</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="md:col-span-1 space-y-4">
          {/* Contact Info card */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Contact Info</h3>
            {editing ? (
              <div className="space-y-3">
                <div><label className="label">Job Title</label>
                  <input className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><label className="label">Email</label>
                  <input className="input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Phone</label>
                  <input className="input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="label">Account</label>
                  <select className="input" value={editForm.account_id} onChange={e => setEditForm(f => ({ ...f, account_id: e.target.value }))}>
                    <option value="">No Account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select></div>
                <div><label className="label">LinkedIn URL</label>
                  <input className="input" value={editForm.linkedin_url} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))} /></div>
                <div><label className="label">Notes</label>
                  <textarea className="input" rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Mail size={14} /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Phone size={14} /> {contact.phone}
                  </a>
                )}
                {contact.account_name && (
                  <p className="flex items-center gap-2 text-gray-600"><Building2 size={14} /> {contact.account_name}</p>
                )}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Linkedin size={14} /> LinkedIn Profile
                  </a>
                )}
                {!contact.email && !contact.phone && !contact.account_name && !contact.linkedin_url && (
                  <p className="text-gray-400 text-xs">No contact info yet. Click Edit to add details.</p>
                )}
                {contact.notes && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-gray-700 text-sm">{contact.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LinkedIn Intel card */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Linkedin size={14} className="text-blue-600" /> LinkedIn Intel
              </h3>
              {scanStatus === 'pending' && (
                <span className="text-xs text-yellow-600 flex items-center gap-1">
                  <Clock size={11} className="animate-spin" /> Scanning...
                </span>
              )}
              {scanStatus === 'done' && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle size={11} /> Done
                </span>
              )}
              {scanStatus === 'failed' && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle size={11} /> Failed
                </span>
              )}
            </div>

            {linkedinData ? (
              <LinkedInDataCard data={linkedinData} />
            ) : (
              <p className="text-xs text-gray-400">
                {scanStatus === 'pending'
                  ? 'Scan in progress — refreshing automatically...'
                  : contact.linkedin_url
                    ? 'Queuing scan automatically...'
                    : 'Add a LinkedIn URL in Edit to enable scanning.'}
              </p>
            )}

            {!showLinkedinInput ? (
              <button
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={scanStatus === 'pending'}
                onClick={() => {
                  if (contact.linkedin_url) {
                    scanMut.mutate(contact.linkedin_url)
                  } else {
                    setLinkedinUrlInput('')
                    setShowLinkedinInput(true)
                  }
                }}
              >
                <Linkedin size={14} />
                {scanStatus === 'pending' ? 'Scanning...' : scanStatus === 'done' ? 'Re-scan LinkedIn' : 'Scan LinkedIn'}
              </button>
            ) : (
              <div className="space-y-2">
                <input className="input text-sm" placeholder="https://linkedin.com/in/..."
                  value={linkedinUrlInput} onChange={e => setLinkedinUrlInput(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs flex-1" onClick={() => setShowLinkedinInput(false)}>Cancel</button>
                  <button className="btn-primary text-xs flex-1"
                    disabled={!linkedinUrlInput.trim() || scanMut.isPending}
                    onClick={() => scanMut.mutate(linkedinUrlInput)}>
                    {scanMut.isPending ? 'Queuing...' : 'Start Scan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="md:col-span-2 space-y-5">

          {/* Job change alert banner */}
          {jobChangeActivity && (
            <div className="card p-3 border-l-4 border-orange-400 bg-orange-50 flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Job Change Detected</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  {jobChangeActivity.subject.replace('Job change detected: ', '')}
                </p>
                <p className="text-xs text-orange-500 mt-0.5">
                  Detected on {new Date(jobChangeActivity.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Linked Deals */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Linked Deals</h3>
            {allDeals.length === 0 ? (
              <p className="text-sm text-gray-400">No deals linked yet. Add this contact to a deal from the deal's Contacts tab.</p>
            ) : (
              <div className="space-y-2">
                {allDeals.map(deal => (
                  <Link key={deal.id} to={`/deals/${deal.id}`}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group">
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">{deal.name}</p>
                      <div className="flex items-center gap-2">
                        {deal.account_name && <p className="text-xs text-gray-500">{deal.account_name}</p>}
                        <span className="text-xs text-gray-400">· {deal.stage}</span>
                        {deal.role && <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">{deal.role}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {deal.value > 0 && (
                        <span className="text-sm font-semibold text-green-600">${Number(deal.value).toLocaleString()}</span>
                      )}
                      <ExternalLink size={13} className="text-gray-400 group-hover:text-blue-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activities */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activities</h3>
            {(!contact.activities || contact.activities.length === 0) ? (
              <p className="text-sm text-gray-400">No activities logged yet.</p>
            ) : (
              <div className="space-y-2">
                {contact.activities.map(act => {
                  const colorClass = ACT_COLORS[act.type] || ACT_COLORS.note
                  const isOverdue = !act.completed && act.due_date && new Date(act.due_date) < new Date()
                  const isJobChange = act.subject?.startsWith('Job change detected')
                  return (
                    <div key={act.id} className={`flex items-start gap-3 p-3 border rounded-lg ${
                      isJobChange ? 'border-orange-200 bg-orange-50' :
                      isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                    }`}>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${
                        isJobChange ? 'text-orange-600 bg-orange-100' : colorClass
                      }`}>
                        {isJobChange ? 'job change' : act.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${act.completed ? 'line-through text-gray-400' : isJobChange ? 'text-orange-800' : 'text-gray-800'}`}>
                          {act.subject}
                        </p>
                        {act.due_date && (
                          <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{act.due_date}</p>
                        )}
                        {act.created_at && isJobChange && (
                          <p className="text-xs text-orange-500">{new Date(act.created_at).toLocaleDateString()}</p>
                        )}
                      </div>
                      {act.completed && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
