<script setup lang="ts">
import { Xmark } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })
interface Project { id: string; name: string; slug: string; archived_at: string | null; created_at: string; assetCount: number }
interface SessionResponse { data: { authenticated: boolean; user?: { role: string; workspace?: { name: string } | null } } }
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const role = session.value?.data.user?.role
if (!['editor', 'admin'].includes(role ?? '')) await navigateTo('/library')
const { data, refresh } = await useFetch<{ data: { projects: Project[] } }>('/api/projects/manage')
const projects = computed(() => data.value?.data.projects ?? [])
const name = ref('')
const creating = ref(false)
const message = ref('')
const errorMessage = ref('')
const projectFeedback = reactive<Record<string, { text: string; error: boolean }>>({})
const clearMessages = () => { message.value = ''; errorMessage.value = '' }
const createProject = async () => {
  clearMessages()
  creating.value = true
  try {
    await $fetch('/api/projects', { method: 'POST', body: { name: name.value } })
    name.value = ''; await refresh(); message.value = 'Project created. It is now available in the Figma plugin.'
  } catch { errorMessage.value = 'Unable to create this project. Try a different name.' }
  finally { creating.value = false }
}
const renameProject = async (project: Project, event: Event) => {
  clearMessages()
  projectFeedback[project.id] = { text: '', error: false }
  const input = event.target as HTMLInputElement
  const nextName = input.value.trim()
  if (!nextName || nextName === project.name) return
  const previousName = project.name
  project.name = nextName
  try { await $fetch(`/api/projects/${project.id}`, { method: 'PATCH', body: { name: nextName } }); projectFeedback[project.id] = { text: 'Saved', error: false } }
  catch { project.name = previousName; input.value = previousName; projectFeedback[project.id] = { text: 'Unable to rename. Try a different name.', error: true } }
}
const setArchived = async (project: Project) => {
  clearMessages()
  try { await $fetch(`/api/projects/${project.id}`, { method: 'PATCH', body: { archived: !project.archived_at } }); await refresh(); message.value = project.archived_at ? 'Project restored.' : 'Project archived.' }
  catch { errorMessage.value = 'Unable to update this project.' }
}
</script>

<template>
  <div class="projects-page">
    <main class="projects-panel">
      <header class="projects-toolbar">
        <nav aria-label="Administration">
          <NuxtLink to="/admin/projects" aria-current="page">Projects</NuxtLink>
          <NuxtLink v-if="role === 'admin'" to="/admin/audit-log">Audit log</NuxtLink>
        </nav>
        <NuxtLink class="projects-close" to="/library" aria-label="Close administration">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </NuxtLink>
      </header>

      <section class="projects-heading">
        <h1>Projects</h1>
        <span>{{projects.filter(project => !project.archived_at).length}} active</span>
      </section>

      <form class="create-project" @submit.prevent="createProject">
        <div class="create-project-controls">
          <input
            id="new-project-name" v-model="name" name="project-name" required maxlength="120" autocomplete="off"
            aria-label="Project name" placeholder="New project">
          <button type="submit" :disabled="creating">{{ creating ? 'Creating…' : 'Create project' }}</button>
        </div>
      </form>

      <div class="project-messages" :class="{ 'is-empty': !message && !errorMessage }">
        <p role="status" aria-live="polite">{{ message }}</p>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
      </div>

      <section class="project-list" aria-labelledby="projects-list-title">
        <h2 id="projects-list-title" class="sr-only">Projects</h2>
        <div class="project-scroll">
          <article
            v-for="project in projects" :key="project.id" class="project"
            :class="{ archived: project.archived_at }">
            <label class="project-name">
              <span class="sr-only">Project name</span>
              <input
                :value="project.name" maxlength="120" :aria-describedby="`project-feedback-${project.id}`"
                :aria-invalid="projectFeedback[project.id]?.error || undefined"
                @change="renameProject(project, $event)">
              <span
                :id="`project-feedback-${project.id}`" class="field-message"
                :class="{ error: projectFeedback[project.id]?.error }" role="status" aria-live="polite">{{
                  projectFeedback[project.id]?.text }}</span>
            </label>
            <span>{{ project.assetCount }} {{ project.assetCount === 1 ? 'asset' : 'assets' }}</span>
            <button type="button" @click="setArchived(project)">{{ project.archived_at ? 'Restore' : 'Archive'
              }}</button>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.projects-page {
  box-sizing: border-box;
  min-height: 100dvh;
  display: grid;
  justify-items: center;
  align-content: start;
  padding: var(--filter-overlay-margin);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-backdrop-background);
}

.projects-panel {
  box-sizing: border-box;
  width: min(100%, var(--filter-overlay-width));
  height: max-content;
  max-height: calc(100dvh - var(--filter-overlay-margin) * 2);
  min-height: 0;
  margin: 0;
  padding: var(--filter-overlay-padding);
  display: flex;
  flex-direction: column;
  gap: var(--filter-overlay-group-gap);
  overflow: hidden;
  border-radius: var(--filter-overlay-radius);
  background: var(--filter-overlay-panel-background);
}

.projects-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: var(--filter-overlay-group-gap);
}

.projects-toolbar nav {
  width: 100%;
  display: flex;
  gap: var(--filter-option-gap);
  padding: var(--filter-option-gap);
  border-radius: var(--filter-pill-radius);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.projects-toolbar nav a,
.projects-close,
.create-project button,
.project button {
  min-height: var(--filter-action-height);
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--filter-pill-radius);
  font-size: var(--filter-action-font-size);
  font-weight: 700;
}

.projects-toolbar nav a {
  min-width: 0;
  flex: 1 1 0;
  padding-inline: var(--filter-option-padding);
  color: var(--filter-overlay-muted-color);
  text-decoration: none;
}

.projects-toolbar nav a:is(:hover, :focus-visible),
.projects-toolbar nav a[aria-current='page'] {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

.projects-close {
  position: fixed;
  z-index: 3;
  top: var(--filter-overlay-close-inset);
  right: var(--filter-overlay-close-inset);
  width: var(--filter-action-height);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
  transition-property: background-color, scale;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.projects-close:is(:hover, :focus-visible) {
  background: var(--filter-overlay-control-hover-background);
}

.projects-close:active,
.create-project button:active,
.project button:active {
  scale: .96;
}

.projects-panel :is(a, button, input):focus-visible {
  outline: var(--filter-focus-width) solid currentColor;
  outline-offset: var(--filter-focus-width);
}

.projects-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--filter-action-gap);
}

.projects-heading h1 {
  margin: 0;
}

.projects-heading>span {
  color: var(--filter-overlay-muted-color);
}

.projects-heading h1 {
  font-size: var(--filter-title-size);
  line-height: 1;
}

.projects-heading>span {
  font-size: var(--filter-action-font-size);
  font-weight: 700;
}

.create-project {
  display: grid;
  gap: var(--filter-option-gap);
}

.create-project-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--filter-option-gap);
  padding: var(--filter-option-gap);
  border-radius: var(--filter-pill-radius);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.create-project input {
  min-width: 0;
  min-height: var(--filter-action-height);
  padding-inline: var(--filter-action-padding);
  border: 0;
  border-radius: var(--filter-pill-radius);
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font: inherit;
  font-size: var(--filter-action-font-size);
  font-weight: 700;
}

.create-project input::placeholder {
  color: var(--filter-overlay-muted-color);
}

.create-project button {
  padding-inline: var(--filter-action-padding);
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  transition-property: opacity, scale;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.create-project button:disabled {
  cursor: wait;
  opacity: .55;
}

.project-messages {
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-action-font-size);
}

.project-messages.is-empty {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.project-messages p {
  margin: 0;
}

.project-messages .error-message {
  color: var(--color-danger);
}

.project-list {
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--filter-option-gap);
}

.project {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--filter-action-gap);

}

.project-scroll {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: calc(var(--space) / 2);
  overflow-y: auto;
  scrollbar-width: none;
}

.project-scroll::-webkit-scrollbar {
  display: none;
}

.project {
  box-sizing: border-box;
  height: max-content;
  min-height: 0;
  padding: calc(var(--space) / 2);
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  padding: calc(var(--space));
}

.project-name {
  min-width: 0;
  align-self: stretch;
  display: grid;
  align-items: center;
}

.project-name input,
.field-message {
  grid-area: 1 / 1;
}

.project-name input {
  box-sizing: border-box;
  width: 100%;
  min-height: calc(var(--filter-action-height) - .5rem);
  align-self: center;
  padding-inline: calc(var(--filter-option-padding) / 2);
  border: 0;
  border-radius: var(--filter-pill-radius);
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font: inherit;
  font-size: var(--filter-action-font-size);
  font-weight: 700;
}

.field-message {
  min-height: 1em;
  align-self: end;
  display: block;
  padding-inline: var(--filter-option-padding);
  pointer-events: none;
  color: var(--filter-overlay-muted-color);
  font-size: .75rem;
  font-weight: 700;
  line-height: 1;
}

.field-message.error {
  color: var(--color-danger);
}

.project>span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-action-font-size);
}

.project button {
  width: max-content;
  min-height: calc(var(--filter-action-height) - .5rem);
  justify-self: end;
  padding-inline: var(--filter-option-padding);
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  transition-property: background-color, scale;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.project button:is(:hover, :focus-visible) {
  background: var(--filter-overlay-control-hover-background);
}

.project.archived {
  opacity: .5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 720px) {
  .projects-page {
    padding: 0;
  }

  .projects-panel {
    width: 100%;
    max-height: 100dvh;
    border-radius: 0;
    background: var(--filter-overlay-panel-background-mobile);
  }

  .project {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .project-name {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {

  .projects-close,
  .create-project button,
  .project button {
    transition: none;
  }

  .projects-close:active,
  .create-project button:active,
  .project button:active {
    scale: 1;
  }
}
</style>
