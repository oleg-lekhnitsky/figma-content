<script setup lang="ts">
import { definePageMeta, navigateTo, useLazyFetch, useNuxtData, useRoute, useState } from '#imports'
import { $fetch } from 'ofetch'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

definePageMeta({ middleware: 'auth' })

type AdminSection = 'projects' | 'audit-log'

interface Project {
  id: string
  name: string
  slug: string
  archived_at: string | null
  created_at: string
  assetCount: number
}

interface AuditLog {
  id: string
  action: string
  target_type: string
  target_id: string | null
  created_at: string
  allowed_users: { email: string | null; figma_handle: string | null } | null
}

interface SessionResponse {
  data: { authenticated: boolean; user?: { role: string; workspace?: { name: string } | null } }
}

interface ProjectsResponse { data: { projects: Project[] } }
interface AuditResponse { data: { logs: AuditLog[]; total: number; page: number } }

const route = useRoute()
const routeSection = computed(() => {
  const value = Array.isArray(route.params.section) ? route.params.section[0] : route.params.section
  return value === 'audit-log' ? 'audit-log' : 'projects'
})
const activeSection = computed<AdminSection>(() => routeSection.value)
const initialSection = activeSection.value

if (!['projects', 'audit-log'].includes(String(route.params.section))) await navigateTo('/admin/projects', { replace: true })

const { data: session } = useNuxtData<SessionResponse>('auth-session')
const projectsCache = useState<ProjectsResponse | null>('admin-projects-cache', () => null)
const auditCache = useState<AuditResponse | null>('admin-audit-cache', () => null)
const projectsRequest = await useLazyFetch<ProjectsResponse>('/api/projects/manage', {
  server: false,
  immediate: initialSection === 'projects' && !projectsCache.value
})
const auditRequest = await useLazyFetch<AuditResponse>('/api/admin/audit-logs', {
  server: false,
  immediate: initialSection === 'audit-log' && !auditCache.value
})

watch(projectsRequest.data, (value) => {
  if (value) projectsCache.value = value
}, { immediate: true })
watch(auditRequest.data, (value) => {
  if (value) auditCache.value = value
}, { immediate: true })

const projectData = computed(() => projectsCache.value ?? projectsRequest.data.value)
const auditData = computed(() => auditCache.value ?? auditRequest.data.value)
const projectsStatus = projectsRequest.status
const auditStatus = auditRequest.status
const role = computed(() => session.value?.data.user?.role)
const panelVisible = ref(false)
let panelOpenFrame = 0

const loadProjects = async () => {
  await projectsRequest.execute()
  if (projectsRequest.data.value) projectsCache.value = projectsRequest.data.value
}
const refreshProjects = async () => {
  await projectsRequest.refresh()
  if (projectsRequest.data.value) projectsCache.value = projectsRequest.data.value
}
const loadAudit = async () => {
  await auditRequest.execute()
  if (auditRequest.data.value) auditCache.value = auditRequest.data.value
}

const ensureProjects = () => {
  if (!projectData.value && projectsStatus.value !== 'pending') void loadProjects()
}
const ensureAudit = () => {
  if (role.value === 'admin' && !auditData.value && auditStatus.value !== 'pending') void loadAudit()
}

watch(activeSection, section => {
  if (section === 'audit-log') {
    if (role.value && role.value !== 'admin') void navigateTo('/admin/projects', { replace: true })
    else ensureAudit()
  } else {
    ensureProjects()
  }
})

watch(role, (value) => {
  if (!value) return
  if (!['editor', 'admin'].includes(value)) {
    void navigateTo('/library')
    return
  }
  if (activeSection.value === 'audit-log' && value !== 'admin') void navigateTo('/admin/projects', { replace: true })
  else if (activeSection.value === 'audit-log') ensureAudit()
}, { immediate: true })

onMounted(() => {
  panelOpenFrame = requestAnimationFrame(() => { panelVisible.value = true })
  if (activeSection.value === 'projects') ensureAudit()
  else ensureProjects()
})
onBeforeUnmount(() => cancelAnimationFrame(panelOpenFrame))

const close = () => { panelVisible.value = false }
const finishClose = () => navigateTo('/library')

const projects = computed(() => projectData.value?.data.projects ?? [])
const activeProjectCount = computed(() => projects.value.filter(project => !project.archived_at).length)
const name = ref('')
const creating = ref(false)
const message = ref('')
const errorMessage = ref('')
const projectFeedback = reactive<Record<string, { text: string; error: boolean }>>({})
const statusMessage = computed(() => errorMessage.value || message.value)

const clearMessages = () => {
  message.value = ''
  errorMessage.value = ''
}

const createProject = async () => {
  clearMessages()
  creating.value = true
  try {
    await $fetch('/api/projects', { method: 'POST', body: { name: name.value } })
    name.value = ''
    await refreshProjects()
    message.value = 'Project and Smart Board created.'
  } catch {
    errorMessage.value = 'Unable to create this project. Try a different name.'
  } finally {
    creating.value = false
  }
}

const renameProject = async (project: Project, event: Event) => {
  clearMessages()
  projectFeedback[project.id] = { text: '', error: false }
  const input = event.target as HTMLInputElement
  const nextName = input.value.trim()
  if (!nextName || nextName === project.name) return
  const previousName = project.name
  project.name = nextName
  try {
    await $fetch(`/api/projects/${project.id}`, { method: 'PATCH', body: { name: nextName } })
    projectFeedback[project.id] = { text: 'Saved', error: false }
    message.value = `“${nextName}” renamed.`
  } catch {
    project.name = previousName
    input.value = previousName
    projectFeedback[project.id] = { text: 'Unable to rename. Try a different name.', error: true }
    errorMessage.value = 'Unable to rename this project. Try a different name.'
  }
}

const setArchived = async (project: Project) => {
  clearMessages()
  try {
    await $fetch(`/api/projects/${project.id}`, { method: 'PATCH', body: { archived: !project.archived_at } })
    await refreshProjects()
    message.value = project.archived_at ? 'Project restored.' : 'Project archived.'
  } catch {
    errorMessage.value = 'Unable to update this project.'
  }
}

const formatLabel = (value: string) => {
  const label = value.replaceAll('_', ' ').toLowerCase()
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const auditMeta = (log: AuditLog) => {
  const actor = log.allowed_users?.figma_handle ?? log.allowed_users?.email ?? 'System'
  return `${actor} · ${formatLabel(log.target_type)} · ${new Date(log.created_at).toLocaleString()}`
}
</script>

<template>
  <div class="admin-page">
    <AppAdminPanel
      :active="activeSection"
      :visible="panelVisible"
      :show-audit-log="role === 'admin'"
      :label="activeSection === 'projects' ? 'Projects administration' : 'Audit log administration'"
      @close="close"
      @after-leave="finishClose"
    >
      <template v-if="activeSection === 'projects'">
        <section class="filter-option-group projects-heading" aria-labelledby="projects-title">
          <div class="projects-title-row">
            <h1 id="projects-title" class="filter-overlay-title">Projects</h1>
            <span>{{ activeProjectCount }} active</span>
          </div>
          <form @submit.prevent="createProject">
            <AppInlineActionField
              v-model="name"
              label="Project name"
              placeholder="New project"
              action-label="Create"
              busy-label="Creating…"
              input-type="text"
              autocomplete="off"
              :max-length="120"
              :show-action="Boolean(name.trim()) || creating"
              :busy="creating"
              :disabled="creating"
            />
          </form>
        </section>

        <section class="filter-option-group" aria-labelledby="projects-list-title">
          <h2 id="projects-list-title" class="sr-only">Projects</h2>
          <p v-if="projectsStatus === 'pending' && !projects.length" class="board-type-summary">Loading projects…</p>
          <div v-else class="project-list">
            <AppPanelRow
              v-for="project in projects"
              :key="project.id"
              class="project-row"
              :class="{ 'is-archived': project.archived_at }"
              :title="project.name"
            >
              <div class="project-row-copy">
                <label>
                  <span class="sr-only">Project name</span>
                  <input
                    class="project-name-field"
                    :value="project.name"
                    maxlength="120"
                    :aria-describedby="`project-feedback-${project.id}`"
                    :aria-invalid="projectFeedback[project.id]?.error || undefined"
                    @change="renameProject(project, $event)"
                  >
                </label>
                <span>{{ project.assetCount }} {{ project.assetCount === 1 ? 'asset' : 'assets' }}</span>
                <small :id="`project-feedback-${project.id}`" class="project-feedback" :class="{ error: projectFeedback[project.id]?.error }" role="status" aria-live="polite">{{ projectFeedback[project.id]?.text }}</small>
              </div>
              <template #actions>
                <button class="panel-secondary-action" type="button" @click="setArchived(project)">{{ project.archived_at ? 'Restore' : 'Archive' }}</button>
              </template>
            </AppPanelRow>
          </div>
        </section>

        <AppStatusToast :message="statusMessage" :error="Boolean(errorMessage)" />
      </template>

      <section v-else class="filter-option-group" aria-labelledby="audit-title">
        <h1 id="audit-title" class="filter-overlay-title">Audit log</h1>
        <p v-if="auditStatus === 'pending' && !auditData" class="board-type-summary">Loading activity…</p>
        <ol v-else-if="auditData?.data.logs.length" class="audit-list">
          <AppPanelRow
            v-for="log in auditData.data.logs"
            :key="log.id"
            as="li"
            :title="formatLabel(log.action)"
            :meta="auditMeta(log)"
          />
        </ol>
        <p v-else class="board-type-summary">No activity yet.</p>
      </section>
    </AppAdminPanel>
  </div>
</template>

<style scoped>
.admin-page { min-height: 100vh; }

.projects-title-row,
.project-row-copy {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--filter-action-gap);
}

.projects-title-row > span,
.project-row-copy > span {
  flex: 0 0 auto;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-action-font-size);
  font-weight: 500;
}

.project-list,
.audit-list {
  display: grid;
  gap: var(--filter-option-gap);
}

.audit-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.project-row { transition: opacity 150ms ease-out; }
.project-row.is-archived { opacity: .5; }
.project-row-copy > label { min-width: 0; flex: 1 1 auto; }

.project-name-field {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  border-bottom: var(--filter-hairline) solid transparent;
  outline: 0;
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font-size: var(--filter-action-font-size);
  font-weight: 500;
}

.project-name-field:focus-visible { border-bottom-color: currentColor; }

.project-feedback {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 520px) {
  .project-row-copy { flex-wrap: wrap; }
  .project-row-copy > label { flex-basis: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .project-row { transition: none; }
}
</style>
