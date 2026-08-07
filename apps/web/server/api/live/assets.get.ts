import { createEventStream } from 'h3'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const organizationId = session.user.organization_id
  const db = useSupabaseAdmin()
  const stream = createEventStream(event)
  const notify = (payload: { eventType:string; new?:{organization_id?:string}; old?:{organization_id?:string} }) => {
      const changedOrganization = payload.new?.organization_id ?? payload.old?.organization_id
      if (changedOrganization !== organizationId) return
      void stream.push({ event:'assets-changed', data:JSON.stringify({ type:payload.eventType, at:Date.now() }) })
  }
  const channel = db.channel(`assets:${organizationId}:${session.id}`)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'assets', filter:`organization_id=eq.${organizationId}` }, notify)
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'assets', filter:`organization_id=eq.${organizationId}` }, notify)
    // Supabase does not support filters for DELETE events. Replica identity full
    // lets the server inspect the old row and discard events from other tenants.
    .on('postgres_changes', { event:'DELETE', schema:'public', table:'assets' }, notify)
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') void stream.push({ event:'ready', data:'{}' })
    })

  const heartbeat = setInterval(() => { void stream.push({ event:'heartbeat', data:String(Date.now()) }) }, 20_000)
  stream.onClosed(() => {
    clearInterval(heartbeat)
    void db.removeChannel(channel)
  })
  return stream.send()
})
