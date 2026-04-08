const express = require('express')
const router = express.Router({ mergeParams: true })
const { v4: uuidv4 } = require('uuid')
const supabase = require('../lib/supabase')

async function addTimeline(deal_id, event_type, title, description, metadata, ref_id, ref_table) {
  try {
    await supabase.from('deal_timeline').insert({
      id: uuidv4(), deal_id, event_type, title,
      description: description || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ref_id: ref_id || null,
      ref_table: ref_table || null,
      created_at: new Date().toISOString()
    })
  } catch (e) { console.error('Timeline insert error:', e.message) }
}

// ── TIMELINE ───────────────────────────────────────────────────────────────
router.get('/timeline', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deal_timeline').select('*')
      .eq('deal_id', req.params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DOCUMENTS ───────────────────────────────────────────────────────────────
router.get('/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deal_documents').select('*')
      .eq('deal_id', req.params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/documents', async (req, res) => {
  try {
    const { type = 'other', title, url, file_name, notes, uploaded_by } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const id = uuidv4()
    const { data, error } = await supabase.from('deal_documents').insert({
      id, deal_id: req.params.id, type, title,
      url: url || null, file_name: file_name || null,
      notes: notes || null, uploaded_by: uploaded_by || null
    }).select().single()
    if (error) throw error
    await addTimeline(req.params.id, 'document', `Document added: ${title}`,
      `Type: ${type.toUpperCase()}${url ? ` — ${url}` : ''}`,
      { doc_type: type }, id, 'deal_documents')
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/documents/:docId', async (req, res) => {
  try {
    const { type, title, url, file_name, notes } = req.body
    const { data, error } = await supabase.from('deal_documents')
      .update({ type, title, url, file_name, notes, updated_at: new Date().toISOString() })
      .eq('id', req.params.docId).select().single()
    if (error) throw error
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/documents/:docId', async (req, res) => {
  try {
    const { error } = await supabase.from('deal_documents').delete().eq('id', req.params.docId)
    if (error) throw error
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── NOTES ────────────────────────────────────────────────────────────────────
router.get('/notes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deal_notes').select('*')
      .eq('deal_id', req.params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/notes', async (req, res) => {
  try {
    const { content, created_by } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'content required' })
    const id = uuidv4()
    const { data, error } = await supabase.from('deal_notes').insert({
      id, deal_id: req.params.id, content: content.trim(), created_by: created_by || null
    }).select().single()
    if (error) throw error
    await addTimeline(req.params.id, 'note', 'Note added',
      content.trim().slice(0, 300), null, id, 'deal_notes')
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/notes/:noteId', async (req, res) => {
  try {
    const { content } = req.body
    const { data, error } = await supabase.from('deal_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', req.params.noteId).select().single()
    if (error) throw error
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/notes/:noteId', async (req, res) => {
  try {
    const { error } = await supabase.from('deal_notes').delete().eq('id', req.params.noteId)
    if (error) throw error
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── MEETINGS ─────────────────────────────────────────────────────────────────
router.get('/meetings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deal_meetings').select('*')
      .eq('deal_id', req.params.id)
      .order('meeting_date', { ascending: false, nullsFirst: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/meetings', async (req, res) => {
  try {
    const { title, meeting_date, type = 'meeting', mom, recording_url, attendees, created_by } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const id = uuidv4()
    const { data, error } = await supabase.from('deal_meetings').insert({
      id, deal_id: req.params.id, title,
      meeting_date: meeting_date || null,
      type, mom: mom || null,
      recording_url: recording_url || null,
      attendees: attendees || null,
      created_by: created_by || null
    }).select().single()
    if (error) throw error
    const typeCap = type.charAt(0).toUpperCase() + type.slice(1)
    await addTimeline(req.params.id, 'meeting', `${typeCap}: ${title}`,
      mom ? mom.slice(0, 300) : (recording_url || null),
      { meeting_type: type, recording_url: recording_url || null }, id, 'deal_meetings')
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/meetings/:meetingId', async (req, res) => {
  try {
    const { title, meeting_date, type, mom, recording_url, attendees } = req.body
    const { data, error } = await supabase.from('deal_meetings')
      .update({ title, meeting_date, type, mom, recording_url, attendees, updated_at: new Date().toISOString() })
      .eq('id', req.params.meetingId).select().single()
    if (error) throw error
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/meetings/:meetingId', async (req, res) => {
  try {
    const { error } = await supabase.from('deal_meetings').delete().eq('id', req.params.meetingId)
    if (error) throw error
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
