export const writeAuditLog = async (organizationId: string, actorId: string, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) => {
  const { error } = await useSupabaseAdmin().from('audit_logs').insert({ organization_id: organizationId, actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata })
  if (error) console.error('Unable to write audit log', error)
}
