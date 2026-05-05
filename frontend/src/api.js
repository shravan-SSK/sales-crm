import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    ...(import.meta.env.VITE_API_KEY ? { 'X-API-Key': import.meta.env.VITE_API_KEY } : {}),
  }
})

export const leadsApi = {
  getAll: (params) => api.get('/leads', { params }).then(r => r.data),
  get: (id) => api.get(`/leads/${id}`).then(r => r.data),
  create: (data) => api.post('/leads', data).then(r => r.data),
  update: (id, data) => api.put(`/leads/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/leads/${id}`).then(r => r.data),
  convert: (id) => api.post(`/leads/${id}/convert`).then(r => r.data),
  requestScan: (id, linkedin_url) => api.post(`/leads/${id}/scan-request`, { linkedin_url }).then(r => r.data),
  saveLinkedInData: (id, data) => api.post(`/leads/${id}/linkedin-data`, data).then(r => r.data),
}

export const contactsApi = {
  getAll: (params) => api.get('/contacts', { params }).then(r => r.data),
  get: (id) => api.get(`/contacts/${id}`).then(r => r.data),
  create: (data) => api.post('/contacts', data).then(r => r.data),
  update: (id, data) => api.put(`/contacts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/contacts/${id}`).then(r => r.data),
  requestScan: (id, linkedin_url) => api.post(`/contacts/${id}/scan-request`, { linkedin_url }).then(r => r.data),
  saveLinkedInData: (id, data) => api.post(`/contacts/${id}/linkedin-data`, data).then(r => r.data),
  getPendingScans: () => api.get('/contacts/pending-linkedin-scans').then(r => r.data),
}

export const scanQueueApi = {
  getQueue: (status) => api.get('/scan-queue', { params: { status } }).then(r => r.data),
  markFailed: (type, id) => api.post(`/scan-queue/${type}/${id}/fail`).then(r => r.data),
}

export const accountsApi = {
  getAll: (params) => api.get('/accounts', { params }).then(r => r.data),
  get: (id) => api.get(`/accounts/${id}`).then(r => r.data),
  create: (data) => api.post('/accounts', data).then(r => r.data),
  update: (id, data) => api.put(`/accounts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/accounts/${id}`).then(r => r.data),
}

export const dealsApi = {
  getAll: (params) => api.get('/deals', { params }).then(r => r.data),
  getPipeline: () => api.get('/deals/pipeline').then(r => r.data),
  getForecast: (months) => api.get('/deals/forecast', { params: { months } }).then(r => r.data),
  get: (id) => api.get(`/deals/${id}`).then(r => r.data),
  create: (data) => api.post('/deals', data).then(r => r.data),
  update: (id, data) => api.put(`/deals/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/deals/${id}`).then(r => r.data),
  addStakeholder: (id, contact_id, role) => api.post(`/deals/${id}/stakeholders`, { contact_id, role }).then(r => r.data),
  removeStakeholder: (id, stakeholderId) => api.delete(`/deals/${id}/stakeholders/${stakeholderId}`).then(r => r.data),
}

export const dealDetailApi = {
  getTimeline:    (id) => api.get(`/deals/${id}/timeline`).then(r => r.data),
  getDocuments:   (id) => api.get(`/deals/${id}/documents`).then(r => r.data),
  addDocument:    (id, data) => api.post(`/deals/${id}/documents`, data).then(r => r.data),
  updateDocument: (id, docId, data) => api.put(`/deals/${id}/documents/${docId}`, data).then(r => r.data),
  deleteDocument: (id, docId) => api.delete(`/deals/${id}/documents/${docId}`).then(r => r.data),
  getNotes:       (id) => api.get(`/deals/${id}/notes`).then(r => r.data),
  addNote:        (id, data) => api.post(`/deals/${id}/notes`, data).then(r => r.data),
  updateNote:     (id, noteId, data) => api.put(`/deals/${id}/notes/${noteId}`, data).then(r => r.data),
  deleteNote:     (id, noteId) => api.delete(`/deals/${id}/notes/${noteId}`).then(r => r.data),
  getMeetings:    (id) => api.get(`/deals/${id}/meetings`).then(r => r.data),
  addMeeting:     (id, data) => api.post(`/deals/${id}/meetings`, data).then(r => r.data),
  updateMeeting:  (id, meetId, data) => api.put(`/deals/${id}/meetings/${meetId}`, data).then(r => r.data),
  deleteMeeting:  (id, meetId) => api.delete(`/deals/${id}/meetings/${meetId}`).then(r => r.data),
}

export const activitiesApi = {
  getAll: (params) => api.get('/activities', { params }).then(r => r.data),
  getReminders: () => api.get('/activities/reminders').then(r => r.data),
  create: (data) => api.post('/activities', data).then(r => r.data),
  update: (id, data) => api.put(`/activities/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/activities/${id}`).then(r => r.data),
}

export const gmailApi = {
  getStatus: () => api.get('/gmail/status').then(r => r.data),
  saveCredentials: (data) => api.post('/gmail/credentials', data).then(r => r.data),
  getAuthUrl: () => api.get('/gmail/auth').then(r => r.data),
  sync: (params) => api.post('/gmail/sync', params).then(r => r.data),
  disconnect: () => api.post('/gmail/disconnect').then(r => r.data),
  getThreads: () => api.get('/gmail/threads').then(r => r.data),
}

export const sourcesApi = {
  getAll: () => api.get('/sources').then(r => r.data),
  getStats: () => api.get('/sources/stats/overview').then(r => r.data),
  get: (id) => api.get(`/sources/${id}`).then(r => r.data),
  create: (data) => api.post('/sources', data).then(r => r.data),
  update: (id, data) => api.put(`/sources/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/sources/${id}`).then(r => r.data),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats').then(r => r.data),
}

export const searchApi = {
  search: (q) => api.get('/search', { params: { q } }).then(r => r.data),
}

export const importApi = {
  importLeads: (records) => api.post('/leads/bulk', { records }).then(r => r.data),
  importContacts: (records) => api.post('/bulk-import/contacts', { records }).then(r => r.data),
  importAccounts: (records) => api.post('/bulk-import/accounts', { records }).then(r => r.data),
  importSources: (records) => api.post('/bulk-import/sources', { records }).then(r => r.data),
  importPipeline: (records) => api.post('/bulk-import/pipeline', { records }).then(r => r.data),
}

export default api
