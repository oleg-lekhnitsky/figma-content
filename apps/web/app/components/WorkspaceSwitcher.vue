<script setup lang="ts">
import { Plus, Xmark } from 'reicon-vue'

interface Workspace {
  id: string
  name: string
  slug: string
  role: string
  canDelete: boolean
  previewAssets: Array<{ id: string; title: string; previewUrl: string }>
}

interface WorkspaceContributor {
  id: string
  email: string | null
  figma_handle: string | null
  avatar_url: string | null
}

type WorkspaceRole = 'viewer' | 'contributor' | 'editor' | 'admin'

interface WorkspaceMember {
  id: string
  email: string | null
  figma_handle: string | null
  avatar_url: string | null
  role: WorkspaceRole
  is_active: boolean
  is_self: boolean
  last_login_at: string | null
  has_password: boolean
  must_change_password: boolean
}

interface WorkspaceInvitation {
  id: string
  email: string
  role: WorkspaceRole
  expires_at: string
  created_at: string
}

const workspaceRoles: WorkspaceRole[] = ['viewer', 'contributor', 'editor', 'admin']
const workspaceRoleDescriptions: Record<WorkspaceRole, string> = {
  viewer: 'View approved assets.',
  contributor: 'Upload and manage their own assets.',
  editor: 'Manage, approve, and organize all assets.',
  admin: 'Full access, including people and workspace settings.'
}
const workspaceRoleOptions = workspaceRoles.map(role => ({
  value: role,
  label: role.charAt(0).toUpperCase() + role.slice(1),
  description: workspaceRoleDescriptions[role],
  separated: role === 'admin'
}))
const memberRowRoleOptions = workspaceRoles.map(role => ({
  value: role,
  label: role.charAt(0).toUpperCase() + role.slice(1)
}))

const route = useRoute()
const router = useRouter()
const open = ref(route.query.workspaceSettings === '1')
const switchingId = ref('')
const managementBusy = ref(false)
const managementMessage = ref('')
const inviteEmail = ref('')
const inviteEmailInput = ref<{ focus: () => void } | null>(null)
const inviteRole = ref<WorkspaceRole>('viewer')
const inviteRoleMenuOpen = ref(false)
const inviteUrl = ref('')
const inviteId = ref('')
const inviteComposerOpen = ref(true)
const invitations = ref<WorkspaceInvitation[]>([])
const invitationsLoading = ref(false)
const deleteWorkspaceDialogOpen = ref(false)
const deleteWorkspaceBusy = ref(false)
const deleteWorkspaceError = ref('')
const createWorkspaceDialogOpen = ref(false)
const createWorkspaceBusy = ref(false)
const createWorkspaceError = ref('')
const newWorkspaceName = ref('')
const renameWorkspaceBusy = ref(false)
const renameWorkspaceMessage = ref('')
const workspaceName = ref('')
const members = ref<WorkspaceMember[]>([])
const membersLoading = ref(false)
const memberMenuOpen = ref('')
const memberRoleMenuOpen = ref('')
const membersMessage = ref('')
const memberFeedback = ref<Record<string, string>>({})
const memberFeedbackTimers = new Map<string, ReturnType<typeof setTimeout>>()
const { data, refresh } = await useFetch<{ data: { currentId: string; workspaces: Workspace[]; contributors: { items: WorkspaceContributor[]; total: number } } }>('/api/workspaces')
const workspaces = computed(() => data.value?.data.workspaces ?? [])
const currentId = computed(() => data.value?.data.currentId ?? '')
const current = computed(() => workspaces.value.find(workspace => workspace.id === currentId.value))
const contributors = computed(() => data.value?.data.contributors.items ?? [])
const remainingContributorCount = computed(() => Math.max(0, (data.value?.data.contributors.total ?? 0) - contributors.value.length))
const canRenameWorkspace = computed(() => {
  const name = workspaceName.value.trim()
  return Boolean(current.value && name && name !== current.value.name && !renameWorkspaceBusy.value)
})
const canInviteMember = computed(() => {
  const email = inviteEmail.value.trim()
  return !managementBusy.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
})
const measureInlineAction = (element: Element) => {
  const action = element as HTMLElement
  const width = Math.max(action.scrollWidth, action.getBoundingClientRect().width)
  action.parentElement?.style.setProperty('--workspace-inline-action-width', `${Math.ceil(width)}px`)
}
const clearInlineActionMeasure = (element: Element) => {
  element.parentElement?.style.removeProperty('--workspace-inline-action-width')
}
watch(current, workspace => { workspaceName.value = workspace?.name ?? '' }, { immediate: true })
watch(() => route.query.workspaceSettings, value => {
  if (value === '1') open.value = true
})

const closePanel = async () => {
  open.value = false
  if (route.query.workspaceSettings !== '1') return
  const query = { ...route.query }
  delete query.workspaceSettings
  await router.replace({ query })
}

const loadMembers = async () => {
  if (current.value?.role !== 'admin' || membersLoading.value) return
  membersLoading.value = true
  membersMessage.value = ''
  try {
    const result = await $fetch<{ data: { users: WorkspaceMember[] } }>('/api/admin/users')
    members.value = result.data.users
  } catch {
    membersMessage.value = 'Unable to load workspace members.'
  } finally {
    membersLoading.value = false
  }
}

const loadInvitations = async () => {
  if (current.value?.role !== 'admin' || invitationsLoading.value) return
  invitationsLoading.value = true
  try {
    const result = await $fetch<{ data: { invitations: WorkspaceInvitation[] } }>('/api/workspaces/invitations')
    invitations.value = result.data.invitations
  } catch {
    managementMessage.value = 'Unable to load active invitations.'
  } finally {
    invitationsLoading.value = false
  }
}

watch([open, currentId], ([isOpen]) => {
  if (isOpen && current.value?.role === 'admin') {
    void loadMembers()
    void loadInvitations()
  }
}, { immediate: true })
const workspaceMonogram = (name = 'Workspace') => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(word => word[0])
  .join('')
  .toLocaleUpperCase()
const contributorName = (contributor: WorkspaceContributor) => contributor.figma_handle ?? contributor.email ?? 'Contributor'
const contributorInitial = (contributor: WorkspaceContributor) => contributorName(contributor).trim().charAt(0).toLocaleUpperCase() || '?'
const relativeDayFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' })
const memberActivityLabel = (value: string | null) => {
  if (!value) return 'Never signed in'
  const activeAt = new Date(value)
  if (Number.isNaN(activeAt.getTime())) return 'Activity date unavailable'
  const today = new Date()
  const todayKey = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const activeDayKey = Date.UTC(activeAt.getFullYear(), activeAt.getMonth(), activeAt.getDate())
  const daysAgo = Math.max(0, Math.round((todayKey - activeDayKey) / 86_400_000))
  if (daysAgo === 0) return 'Active today'
  if (daysAgo === 1) return 'Active yesterday'
  if (daysAgo < 7) return `Active ${relativeDayFormatter.format(-daysAgo, 'day')}`
  return `Last active ${activeAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(activeAt.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' })
  })}`
}
const workspaceTriggerLabel = computed(() => {
  const workspaceName = current.value?.name ?? 'Content Library'
  if (!contributors.value.length) return `Current workspace: ${workspaceName}. Choose workspace.`
  const names = contributors.value.map(contributorName).join(', ')
  const remainder = remainingContributorCount.value ? `, and ${remainingContributorCount.value} more` : ''
  return `Current workspace: ${workspaceName}. Contributors: ${names}${remainder}. Choose workspace.`
})

const switchWorkspace = async (workspace: Pick<Workspace, 'id'>) => {
  if (workspace.id === currentId.value || switchingId.value) {
    open.value = false
    return
  }
  switchingId.value = workspace.id
  try {
    await $fetch('/api/workspaces/switch', { method: 'POST', body: { workspaceId: workspace.id } })
    window.location.assign('/library')
  } finally {
    switchingId.value = ''
  }
}

const createWorkspace = async () => {
  const name = newWorkspaceName.value.trim()
  if (!name) {
    createWorkspaceError.value = 'Enter a workspace name.'
    return
  }
  if (createWorkspaceBusy.value) return
  createWorkspaceBusy.value = true
  createWorkspaceError.value = ''
  try {
    const result = await $fetch<{ data: { workspace: Pick<Workspace, 'id'> } }>('/api/workspaces', {
      method: 'POST',
      body: { name }
    })
    newWorkspaceName.value = ''
    await refresh()
    createWorkspaceDialogOpen.value = false
    await switchWorkspace(result.data.workspace)
  } catch {
    createWorkspaceError.value = 'Unable to create this workspace.'
  } finally {
    createWorkspaceBusy.value = false
  }
}

const inviteMember = async () => {
  if (!inviteEmail.value.trim() || managementBusy.value) return
  managementBusy.value = true
  managementMessage.value = ''
  inviteUrl.value = ''
  try {
    const result = await $fetch<{ data: { invitation: WorkspaceInvitation; inviteUrl: string } }>('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: inviteEmail.value.trim(), role: inviteRole.value }
    })
    inviteEmail.value = ''
    inviteId.value = result.data.invitation.id
    inviteUrl.value = result.data.inviteUrl
    inviteComposerOpen.value = false
    managementMessage.value = 'Invitation created.'
    await loadInvitations()
  } catch {
    managementMessage.value = 'Unable to create this invitation.'
  } finally {
    managementBusy.value = false
  }
}

const copyInvite = async () => {
  if (!inviteUrl.value) return
  await navigator.clipboard.writeText(inviteUrl.value)
  managementMessage.value = 'Invitation link copied.'
}

const openInviteComposer = async () => {
  inviteComposerOpen.value = true
  managementMessage.value = ''
  await nextTick()
  inviteEmailInput.value?.focus()
}

const revokeInvitation = async (invitation: WorkspaceInvitation) => {
  managementMessage.value = ''
  try {
    await $fetch(`/api/workspaces/invitations/${invitation.id}`, { method: 'DELETE' })
    if (inviteId.value === invitation.id) {
      inviteId.value = ''
      inviteUrl.value = ''
    }
    await loadInvitations()
    managementMessage.value = `Invitation revoked for ${invitation.email}.`
  } catch {
    managementMessage.value = 'Unable to revoke this invitation.'
  }
}

const updateMember = async (member: WorkspaceMember, change: Partial<{ role: WorkspaceRole; isActive: boolean }>) => {
  membersMessage.value = ''
  try {
    const result = await $fetch<{ data: { user: { role: WorkspaceRole; is_active: boolean } } }>(`/api/admin/users/${member.id}`, { method: 'PATCH', body: change })
    member.role = result.data.user.role
    member.is_active = result.data.user.is_active
    await loadMembers()
    membersMessage.value = change.isActive === undefined
      ? `Role updated for ${member.email ?? member.figma_handle}.`
      : `Access ${change.isActive ? 'enabled' : 'disabled'} for ${member.email ?? member.figma_handle}.`
    return true
  } catch (error: unknown) {
    const failure = error as { statusMessage?: string; data?: { error?: { message?: string }; message?: string } }
    membersMessage.value = failure.data?.error?.message ?? failure.data?.message ?? failure.statusMessage ?? 'Unable to update this member.'
    return false
  }
}

const removeMember = async (member: WorkspaceMember) => {
  memberMenuOpen.value = ''
  const removed = await updateMember(member, { isActive: false })
  if (removed) membersMessage.value = `${member.email ?? member.figma_handle} removed from the workspace.`
}

const showMemberFeedback = (memberId: string, message: string) => {
  clearTimeout(memberFeedbackTimers.get(memberId))
  memberFeedback.value = { ...memberFeedback.value, [memberId]: message }
  memberFeedbackTimers.set(memberId, setTimeout(() => {
    const next = { ...memberFeedback.value }
    delete next[memberId]
    memberFeedback.value = next
    memberFeedbackTimers.delete(memberId)
  }, 4000))
}

const revokeMemberSessions = async (member: WorkspaceMember) => {
  memberMenuOpen.value = ''
  membersMessage.value = ''
  try {
    const result = await $fetch<{ data: { revoked: boolean; revokedCount: number } }>(`/api/admin/users/${member.id}/revoke-sessions`, { method: 'POST' })
    if (member.is_self) {
      window.location.assign('/login')
      return
    }
    const count = result.data.revokedCount
    showMemberFeedback(member.id, count ? `${count} active ${count === 1 ? 'session' : 'sessions'} revoked` : 'No active sessions')
  } catch (error: unknown) {
    const failure = error as { statusMessage?: string; data?: { error?: { message?: string }; message?: string } }
    showMemberFeedback(member.id, failure.data?.error?.message ?? failure.data?.message ?? failure.statusMessage ?? 'Unable to revoke sessions')
  }
}

const memberActions = (member: WorkspaceMember) => member.is_self
  ? [{ value: 'sessions', label: 'Sign out everywhere' }]
  : [{ value: 'remove', label: 'Remove from workspace' }, { value: 'sessions', label: 'Revoke sessions' }]

const handleMemberAction = (member: WorkspaceMember, action: string) => {
  if (action === 'remove') void removeMember(member)
  else if (action === 'sessions') void revokeMemberSessions(member)
}

onBeforeUnmount(() => memberFeedbackTimers.forEach(timer => clearTimeout(timer)))

const renameWorkspace = async () => {
  const name = workspaceName.value.trim()
  if (!current.value || !name || name === current.value.name || renameWorkspaceBusy.value) return
  renameWorkspaceBusy.value = true
  renameWorkspaceMessage.value = ''
  try {
    await $fetch(`/api/workspaces/${current.value.id}`, { method: 'PATCH', body: { name } })
    await refresh()
    renameWorkspaceMessage.value = 'Workspace renamed.'
  } catch {
    renameWorkspaceMessage.value = 'Unable to rename this workspace.'
  } finally {
    renameWorkspaceBusy.value = false
  }
}

const deleteWorkspace = async () => {
  if (!current.value?.canDelete || workspaces.value.length <= 1 || deleteWorkspaceBusy.value) return
  deleteWorkspaceBusy.value = true
  deleteWorkspaceError.value = ''
  try {
    await $fetch(`/api/workspaces/${current.value.id}`, { method: 'DELETE' })
    deleteWorkspaceDialogOpen.value = false
    window.location.assign('/library')
  } catch {
    deleteWorkspaceError.value = 'Unable to delete this workspace.'
  } finally {
    deleteWorkspaceBusy.value = false
  }
}
</script>

<template>
  <div class="workspace-switcher">
    <button
      class="workspace-avatar-trigger" type="button"
      :aria-label="workspaceTriggerLabel"
      :aria-expanded="open" @click="open = true">
      <span class="workspace-avatar" aria-hidden="true">{{ workspaceMonogram(current?.name ?? 'Content Library') }}</span>
      <span
        v-for="(contributor, index) in contributors" :key="contributor.id" class="workspace-contributor"
        :style="{ zIndex: contributors.length - index }" :title="contributorName(contributor)" aria-hidden="true">
        <img v-if="contributor.avatar_url" :src="contributor.avatar_url" alt="">
        <span v-else>{{ contributorInitial(contributor) }}</span>
      </span>
      <span v-if="remainingContributorCount" class="workspace-more" aria-hidden="true">+{{ remainingContributorCount }}</span>
    </button>

    <SelectionPanel :visible="open" label="Choose workspace" wide overlay raised @close="closePanel">
      <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded workspace-panel">
        <button class="filter-sheet-handle" type="button" aria-label="Close workspaces" @click="closePanel"><span aria-hidden="true" /></button>
        <div class="filter-sheet-content">
          <section class="filter-option-group">
            <h2 class="filter-overlay-title">Your workspaces</h2>
            <div class="workspace-option-list panel-choice-list">
              <button
                v-for="workspace in workspaces" :key="workspace.id" type="button"
                :aria-pressed="workspace.id === currentId" :disabled="Boolean(switchingId)"
                @click="switchWorkspace(workspace)">
                <span class="workspace-preview" :class="`has-${Math.min(workspace.previewAssets.length, 4)}`" aria-hidden="true">
                  <img v-for="asset in workspace.previewAssets.slice(0, 4)" :key="asset.id" :src="asset.previewUrl" alt="">
                  <span v-if="!workspace.previewAssets.length">{{ workspaceMonogram(workspace.name) }}</span>
                </span>
                <span class="workspace-option-copy"><strong>{{ workspace.name }}</strong><small>{{ workspace.role }}</small></span>
              </button>
              <button class="workspace-create-card" type="button" @click="createWorkspaceDialogOpen = true">
                <span class="workspace-preview workspace-create-preview" aria-hidden="true"><Plus :size="72" /></span>
                <span class="workspace-option-copy"><strong>New workspace</strong></span>
              </button>
            </div>
          </section>

          <section v-if="current?.role === 'admin'" class="filter-option-group workspace-rename-section">
            <h2 class="filter-overlay-title">Rename {{ current.name }} workspace</h2>
            <form class="workspace-name-form" @submit.prevent="renameWorkspace">
              <label>
                <span class="sr-only">Workspace name</span>
                <input v-model="workspaceName" class="panel-field" required maxlength="120" placeholder="Workspace name">
              </label>
              <Transition
                name="workspace-inline-action"
                @enter="measureInlineAction"
                @before-leave="measureInlineAction"
                @after-leave="clearInlineActionMeasure"
              >
                <button v-if="canRenameWorkspace || renameWorkspaceBusy" class="panel-primary-action workspace-inline-action" type="submit" :disabled="renameWorkspaceBusy">
                  {{ renameWorkspaceBusy ? 'Saving…' : 'Save' }}
                </button>
              </Transition>
            </form>
            <p v-if="renameWorkspaceMessage" class="workspace-management-message" role="status" aria-live="polite">{{ renameWorkspaceMessage }}</p>
          </section>

          <section v-if="current?.role === 'admin'" class="filter-option-group workspace-management-section">
            <h2 class="filter-overlay-title">Invite to {{ current?.name ?? 'this' }} workspace</h2>
            <div class="workspace-management-grid">
              <form v-if="inviteComposerOpen" class="workspace-setting-card" @submit.prevent="inviteMember">
                <AppRolePicker
                  :model-value="inviteRole"
                  :options="workspaceRoleOptions"
                  :open="inviteRoleMenuOpen"
                  aria-label="Invitation role"
                  @update:model-value="inviteRole = $event as WorkspaceRole"
                  @update:open="inviteRoleMenuOpen = $event"
                />
                <AppInlineActionField
                  ref="inviteEmailInput"
                  v-model="inviteEmail"
                  action-label="Invite"
                  busy-label="Inviting…"
                  :show-action="canInviteMember || Boolean(managementBusy && inviteEmail.trim())"
                  :busy="managementBusy"
                />
              </form>
              <button v-else class="panel-secondary-action workspace-invite-another" type="button" @click="openInviteComposer">Invite another person</button>
            </div>
            <div v-if="invitationsLoading || invitations.length" class="workspace-invitations">
              <h3>Active invitations</h3>
              <p v-if="invitationsLoading && !invitations.length" class="workspace-management-message">Loading invitations…</p>
              <article v-for="invitation in invitations" :key="invitation.id" class="workspace-invitation-card">
                <div class="workspace-invitation-copy">
                  <strong>{{ invitation.email }}</strong>
                  <span>{{ invitation.role }} · Expires {{ new Date(invitation.expires_at).toLocaleDateString() }}</span>
                </div>
                <div class="workspace-invitation-actions">
                  <button v-if="inviteId === invitation.id && inviteUrl" class="panel-secondary-action" type="button" @click="copyInvite">Copy link</button>
                  <button class="panel-secondary-action" type="button" @click="revokeInvitation(invitation)">Revoke</button>
                </div>
              </article>
            </div>
            <p v-if="managementMessage" class="workspace-management-message" role="status" aria-live="polite">{{ managementMessage }}</p>
          </section>

          <section v-if="current?.role === 'admin'" class="filter-option-group workspace-members-section">
            <h2 class="filter-overlay-title">People in {{ current.name }} workspace</h2>
            <p v-if="membersLoading && !members.length" class="workspace-management-message">Loading people…</p>
            <p v-if="membersMessage" class="workspace-management-message" role="status" aria-live="polite">{{ membersMessage }}</p>
            <div v-if="members.length" class="workspace-member-list">
              <AppPersonRow
                v-for="member in members"
                :key="member.id"
                :name="member.email ?? member.figma_handle ?? 'Workspace member'"
                :avatar-url="member.avatar_url"
                :fallback="contributorInitial(member)"
                :meta="memberActivityLabel(member.last_login_at)"
                :meta-title="member.last_login_at ? new Date(member.last_login_at).toLocaleString() : ''"
                :badge="member.is_self ? 'You' : ''"
                :feedback="memberFeedback[member.id]"
                :role="member.role.charAt(0).toUpperCase() + member.role.slice(1)"
                :role-options="memberRowRoleOptions"
                :actions="memberActions(member)"
                :role-open="memberRoleMenuOpen === member.id"
                :actions-open="memberMenuOpen === member.id"
                @update:role-open="memberRoleMenuOpen = $event ? member.id : ''"
                @update:actions-open="memberMenuOpen = $event ? member.id : ''"
                @select-role="updateMember(member, { role: $event as WorkspaceRole })"
                @select-action="handleMemberAction(member, $event)"
              />
            </div>
          </section>

          <section v-if="current?.canDelete" class="filter-option-group workspace-delete-section">
            <h2 class="filter-overlay-title">Delete {{ current.name }} workspace</h2>
            <p>This permanently removes the workspace, its assets, boards, members, and public links.</p>
            <button class="panel-secondary-action workspace-delete-action" type="button" :disabled="workspaces.length <= 1" @click="deleteWorkspaceDialogOpen = true">
              Delete workspace
            </button>
            <p v-if="workspaces.length <= 1" class="workspace-management-message">Create another workspace before deleting this one.</p>
          </section>
        </div>
      </div>
      <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close workspaces" aria-expanded="true" @click="closePanel">
        <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
    </SelectionPanel>
    <AppDialog
      v-model:open="createWorkspaceDialogOpen"
      title="New workspace"
      description="Create a separate library for another team or project."
      :confirm-label="createWorkspaceBusy ? 'Creating workspace…' : 'Create workspace'"
      :busy="createWorkspaceBusy"
      :error="createWorkspaceError"
      @confirm="createWorkspace"
      @close="createWorkspaceError = ''"
    >
      <label>
        <span class="sr-only">Workspace name</span>
        <input v-model="newWorkspaceName" class="panel-field" maxlength="120" placeholder="Workspace name" @keydown.enter.prevent="createWorkspace">
      </label>
    </AppDialog>
    <AppDialog
      v-model:open="deleteWorkspaceDialogOpen"
      :title="`Delete “${current?.name ?? 'workspace'}”?`"
      description="This permanently deletes the workspace, all of its assets and boards, member access, and public links. This action cannot be undone."
      :confirm-label="deleteWorkspaceBusy ? 'Deleting workspace…' : 'Delete workspace'"
      :busy="deleteWorkspaceBusy"
      :error="deleteWorkspaceError"
      @confirm="deleteWorkspace"
      @close="deleteWorkspaceError = ''"
    />
  </div>
</template>

<style scoped>
.workspace-switcher { min-width: 0; }

.workspace-avatar-trigger {
  width: max-content;
  min-width: var(--identity-avatar-size, 36px);
  min-height: var(--identity-avatar-size, 36px);
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  color: var(--color-fg);
  background: transparent;
}

.workspace-avatar,
.workspace-contributor,
.workspace-more {
  position: relative;
  box-sizing: border-box;
  width: var(--identity-avatar-size, 36px);
  height: var(--identity-avatar-size, 36px);
  display: grid;
  place-items: center;
  flex: 0 0 var(--identity-avatar-size, 36px);
  padding: 0;
  border: 0;
  outline: 2px solid var(--color-bg);
  border-radius: calc(var(--radius) * .85);
  color: var(--color-bg);
  background: var(--color-fg);
  font: inherit;
  line-height: 1;
}

.workspace-avatar { z-index: 7; }

.workspace-contributor,
.workspace-more {
  z-index: 1;
  margin-left: calc(var(--space)  / -3);
  color: var(--color-fg);
  background: var(--color-surface);
  white-space: nowrap;
}

.workspace-contributor {
  overflow: hidden;
  border-radius: 50%;
}

.workspace-contributor img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

@media (max-width: 520px) {
  .workspace-contributor,
  .workspace-more {
    display: none
  }
}

.workspace-panel { min-width: min(30rem, calc(100vw - var(--space) * 2)); }
.workspace-option-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workspace-option-list > button {
  min-height: 0;
  align-content: start;
  align-items: stretch;
  gap: 0;
  padding: var(--filter-option-gap);
}

.workspace-preview {
  width: 100%;
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 2px;
  overflow: hidden;
  border-radius: calc(var(--panel-choice-radius) - var(--filter-option-gap));
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.workspace-preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
.workspace-preview.has-1 img { grid-column: 1 / -1; grid-row: 1 / -1; }
.workspace-preview.has-2 img { grid-row: 1 / -1; }
.workspace-preview.has-3 img:first-child { grid-row: 1 / -1; }
.workspace-preview > span {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  display: grid;
  place-items: center;
  font-size: clamp(1.5rem, 4vw, 3rem);
  font-weight: 500;
}

.workspace-create-preview {
  place-items: center;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.workspace-create-preview svg {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  width: clamp(3.5rem, 8vw, 5rem);
  height: clamp(3.5rem, 8vw, 5rem);
  fill: none;
  stroke: currentColor;
}

.workspace-management-grid { display: grid; gap: var(--space); }
.workspace-name-form {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  align-items: center;
  gap: 0;
  transition:
    grid-template-columns var(--filter-action-transition-duration) var(--filter-overlay-enter-easing),
    column-gap var(--filter-action-transition-duration) var(--filter-overlay-enter-easing);
}
.workspace-name-form:has(.workspace-inline-action) {
  grid-template-columns: minmax(0, 1fr) var(--workspace-inline-action-width, 0px);
  column-gap: var(--filter-action-gap);
}
.workspace-name-form:has(.workspace-inline-action-enter-from),
.workspace-name-form:has(.workspace-inline-action-leave-to) {
  grid-template-columns: minmax(0, 1fr) 0;
  column-gap: 0;
}
.workspace-name-form > label { min-width: 0; }
.workspace-inline-action.panel-primary-action {
  justify-self: end;
  width: max-content;
  min-width: max-content;
  white-space: nowrap;
}

.workspace-inline-action.panel-primary-action:is(.workspace-inline-action-enter-active, .workspace-inline-action-leave-active) {
  transition:
    opacity var(--filter-action-transition-duration) var(--filter-overlay-enter-easing),
    translate var(--filter-action-transition-duration) var(--filter-overlay-enter-easing);
}
.workspace-inline-action.panel-primary-action:is(.workspace-inline-action-enter-from, .workspace-inline-action-leave-to) {
  opacity: 0;
  translate: var(--filter-action-transition-distance) 0;
}

.workspace-setting-card {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space);
  padding: 0;
  color: var(--filter-overlay-panel-color);
  background: transparent;
}

.workspace-management-message { margin: 0; color: var(--filter-overlay-muted-color); font-size: var(--font-size-caption); letter-spacing: var(--letter-spacing-caption); }

.workspace-invitations { display: grid; gap: var(--filter-option-gap); }
.workspace-invitations h3 {
  margin: 0;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-caption-size);
  font-weight: 700;
}
.workspace-invitation-card {
  min-width: 0;
  display: grid;
  align-items: center;
  gap: var(--filter-action-gap);
  padding: var(--filter-action-gap);
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}
.workspace-invitation-card { grid-template-columns: minmax(0, 1fr) auto; }
.workspace-invitation-copy {
  min-width: 0;
  display: grid;
  gap: var(--filter-option-gap);
  padding: calc(var(--filter-option-padding) / 2);
}
.workspace-invitation-copy strong {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  font-size: var(--filter-action-font-size);
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-invitation-copy span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1.2;
  text-transform: capitalize;
}
.workspace-invitation-actions {
  display: flex;
  align-items: center;
  gap: var(--filter-action-gap);
}
.workspace-invitation-actions .panel-secondary-action {
  width: auto;
  min-height: calc(var(--filter-action-height) - .5rem);
  padding-inline: var(--filter-option-padding);
}

.workspace-member-list { display: grid; gap: var(--filter-option-gap); }

.workspace-delete-section > p {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
  line-height: 1.25;
  padding: 0 calc(var(--filter-option-padding) / 2) ;
}
.workspace-delete-action { justify-self: start; width: auto; }

.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

.workspace-option-copy {
  box-sizing: border-box;
  min-width: 0;
  min-height: 2.875rem;
  display: grid;
  align-content: start;
  justify-items: center;
  gap: calc(var(--filter-option-gap)/2);
  padding: var(--filter-action-gap) var(--filter-option-gap);
  padding-bottom: 0;
  text-align: center;
}
.workspace-option-copy strong { max-width: 100%; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.workspace-option-copy small {
  flex: 0 0 auto;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1.1;
  text-transform: capitalize;
}

@media (max-width: 520px) {
  .workspace-panel { min-width: 0; }
  .workspace-invitation-card { grid-template-columns: minmax(0, 1fr); }
  .workspace-invitation-actions { justify-content: stretch; }
  .workspace-invitation-actions .panel-secondary-action { flex: 1 1 0; }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-name-form,
  .workspace-inline-action-enter-active,
  .workspace-inline-action-leave-active { transition: none; }
}
</style>
