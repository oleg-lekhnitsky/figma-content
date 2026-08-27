<script setup lang="ts">
import { definePageMeta, navigateTo, useFetch } from '#imports'
import { Xmark } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })

interface SessionResponse {
  data: { authenticated: boolean; user?: { role: string; workspace?: { name: string } | null } }
}

interface AuditLog {
  id: string
  action: string
  target_type: string
  target_id: string | null
  created_at: string
  allowed_users: { email: string | null; figma_handle: string | null } | null
}

interface AuditResponse { data: { logs: AuditLog[]; total: number; page: number } }

const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
if (session.value?.data?.user?.role !== 'admin') await navigateTo('/library')

const { data } = await useFetch<AuditResponse>('/api/admin/audit-logs')

const formatLabel = (value: string) => {
  const label = value.replaceAll('_', ' ').toLowerCase()
  return label.charAt(0).toUpperCase() + label.slice(1)
}
</script>

<template>
  <div class="audit-page">
    <main class="audit-panel">
      <header class="audit-toolbar">
        <nav aria-label="Administration">
          <NuxtLink to="/admin/projects">Projects</NuxtLink>
          <NuxtLink to="/admin/audit-log" aria-current="page">Audit log</NuxtLink>
        </nav>
        <NuxtLink class="audit-close" to="/library" aria-label="Close administration">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </NuxtLink>
      </header>

      <section class="audit-heading">
        <h1>Audit log</h1>
      </section>

      <ol v-if="data?.data.logs.length" class="audit-list">
        <li v-for="log in data.data.logs" :key="log.id">
          <strong class="audit-action">{{ formatLabel(log.action) }}</strong>
          <time :datetime="log.created_at">{{ new Date(log.created_at).toLocaleString() }}</time>
          <span class="audit-metadata">
            <span>{{ log.allowed_users?.figma_handle ?? log.allowed_users?.email ?? 'System' }}</span>
            <span>{{ formatLabel(log.target_type) }}</span>
          </span>
        </li>
      </ol>
      <p v-else class="audit-empty">No activity yet.</p>
    </main>
  </div>
</template>

<style scoped>
.audit-page {
  box-sizing: border-box;
  min-height: 100dvh;
  display: grid;
  justify-items: center;
  align-content: start;
  padding: var(--filter-overlay-margin);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-backdrop-background);
}

.audit-panel {
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

.audit-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: var(--filter-overlay-group-gap);
}

.audit-toolbar nav {
  width: 100%;
  display: flex;
  gap: var(--filter-option-gap);
  padding: var(--filter-option-gap);
  border-radius: var(--filter-pill-radius);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.audit-toolbar nav a,
.audit-close {
  min-height: var(--filter-action-height);
  display: grid;
  place-items: center;
  border-radius: var(--filter-pill-radius);
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-action-font-size);
  font-weight: 700;
  text-decoration: none;
}

.audit-toolbar nav a { min-width: 0; flex: 1 1 0; padding-inline: var(--filter-option-padding); }

.audit-toolbar nav a:is(:hover, :focus-visible),
.audit-toolbar nav a[aria-current='page'] {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

.audit-close {
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

.audit-close:is(:hover, :focus-visible) {
  background: var(--filter-overlay-control-hover-background);
}

.audit-close:active { scale: .96; }

.audit-toolbar a:focus-visible {
  outline: var(--filter-focus-width) solid currentColor;
  outline-offset: var(--filter-focus-width);
}

.audit-heading {
  display: block;
}

.audit-heading h1 { margin: 0; }
.audit-heading h1 { font-size: var(--filter-title-size); line-height: 1; }

.audit-list {
  min-height: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: calc(var(--space) / 2);
  overflow-y: auto;
  scrollbar-width: none;
  list-style: none;
}

.audit-list::-webkit-scrollbar { display: none; }

.audit-list li {
  box-sizing: border-box;
  height: max-content;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: calc(var(--filter-option-gap) / 2) var(--filter-action-gap);
  padding: calc(var(--space) / 1);
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  font-size: var(--filter-action-font-size);
}

.audit-list li > :is(time, span) {
  min-width: 0;
  color: var(--filter-overlay-muted-color);
}

.audit-action { min-width: 0; overflow: hidden; color: var(--filter-overlay-panel-color); font-weight: 700; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.audit-list time { color: var(--filter-overlay-caption-color) !important; font-size: var(--font-size-caption); font-weight: 400; white-space: nowrap; }

.audit-metadata {
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 0;
  overflow: hidden;
  color: var(--filter-overlay-muted-color) !important;
  font-size: var(--font-size-caption);
  font-weight: 400;
  line-height: 1.15;
  white-space: nowrap;
}

.audit-metadata > :not(:first-child)::before { content: '·'; margin-inline: calc(var(--filter-action-gap) / 2); }
.audit-metadata > span { flex: 0 0 auto; }
.audit-empty { margin: auto; color: var(--filter-overlay-muted-color); }

@media (max-width: 720px) {
  .audit-page { padding: 0; }
  .audit-panel {
    width: 100%;
    max-height: 100dvh;
    border-radius: 0;
    background: var(--filter-overlay-panel-background-mobile);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audit-close { transition: none; }
  .audit-close:active { scale: 1; }
}
</style>
