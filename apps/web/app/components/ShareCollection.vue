<script setup lang="ts">
const props = defineProps<{ currentSearch?: string }>()

interface Option { id: string; name: string }
interface Collection { id: string; slug: string; title: string; mode: 'dynamic' | 'static'; expires_at: string | null; created_at: string; updated_at: string }
interface ListResponse { data: { collections: Collection[] } }
interface OptionsResponse<T extends string> { data: Record<T, Option[]> }
interface CreateResponse { data: { collection: Collection & { itemCount: number | null } } }

const dialog = ref<HTMLDialogElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const mode = ref<'dynamic' | 'static'>('dynamic')
const range = ref<'all' | 'day' | 'month' | 'custom'>('month')
const dateFrom = ref('')
const dateTo = ref('')
const projectId = ref('')
const tagId = ref('')
const expiry = ref('')
const projects = ref<Option[]>([])
const tags = ref<Option[]>([])
const collections = ref<Collection[]>([])
const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

const collectionUrl = (slug: string) => `${window.location.origin}/s/${slug}`
const isoAt = (value: string, end = false) => {
  if (!value) return null
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`)
  return date.toISOString()
}
const datesForRange = () => {
  const now = new Date()
  if (range.value === 'all') return { dateFrom: null, dateTo: null }
  if (range.value === 'custom') return { dateFrom: isoAt(dateFrom.value), dateTo: isoAt(dateTo.value, true) }
  const start = new Date(now)
  const end = new Date(now)
  if (range.value === 'month') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}
const defaultTitle = () => range.value === 'day'
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())
  : range.value === 'month'
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())
    : 'Shared collection'

const loadCollections = async () => {
  const [shareResponse, projectResponse, tagResponse] = await Promise.all([
    $fetch<ListResponse>('/api/shares'),
    $fetch<OptionsResponse<'projects'>>('/api/projects'),
    $fetch<OptionsResponse<'tags'>>('/api/tags')
  ])
  collections.value = shareResponse.data.collections
  projects.value = projectResponse.data.projects
  tags.value = tagResponse.data.tags
}
const open = async () => {
  message.value = ''
  errorMessage.value = ''
  title.value ||= defaultTitle()
  dialog.value?.showModal()
  await nextTick()
  titleInput.value?.focus()
  try { await loadCollections() } catch { errorMessage.value = 'Unable to load sharing settings. Check your connection and try again.' }
}
const close = () => dialog.value?.close()
const createCollection = async () => {
  busy.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const response = await $fetch<CreateResponse>('/api/shares', { method: 'POST', body: {
      title: title.value,
      mode: mode.value,
      filters: { search: props.currentSearch ?? '', projectId: projectId.value || null, tagId: tagId.value || null, ...datesForRange() },
      expiresAt: isoAt(expiry.value, true)
    } })
    collections.value.unshift(response.data.collection)
    await copyLink(response.data.collection)
    message.value = response.data.collection.mode === 'static'
      ? `Link copied. The snapshot contains ${response.data.collection.itemCount ?? 0} approved items.`
      : 'Link copied. New approved items matching these filters will appear automatically.'
  } catch { errorMessage.value = 'Unable to create the public link. Check the settings and try again.' }
  finally { busy.value = false }
}
const copyLink = async (collection: Collection) => {
  try {
    await navigator.clipboard.writeText(collectionUrl(collection.slug))
    message.value = `Link copied for ${collection.title}.`
  } catch { errorMessage.value = 'Unable to copy automatically. Open the link and copy it from the address bar.' }
}
const updateSnapshot = async (collection: Collection) => {
  busy.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ data: { itemCount: number } }>(`/api/shares/${collection.id}`, { method: 'PATCH', body: { action: 'refresh' } })
    message.value = `${collection.title} now contains ${response.data.itemCount} approved items.`
  } catch { errorMessage.value = 'Unable to update the snapshot. Try again.' }
  finally { busy.value = false }
}
const revoke = async (collection: Collection) => {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/shares/${collection.id}`, { method: 'PATCH', body: { action: 'revoke' } })
    collections.value = collections.value.filter(item => item.id !== collection.id)
    message.value = `${collection.title} is no longer public.`
  } catch { errorMessage.value = 'Unable to disable the link. Try again.' }
  finally { busy.value = false }
}
</script>

<template>
  <button type="button" class="button-plain share-trigger" @click="open">Share</button>
  <dialog ref="dialog" class="share-dialog" aria-labelledby="share-title" @click.self="close">
    <div class="share-panel">
      <header><div><p>Public collection</p><h2 id="share-title">Share approved work</h2></div><button type="button" class="button-secondary button-icon close-button" aria-label="Close sharing settings" @click="close"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19" /></svg></button></header>
      <form @submit.prevent="createCollection">
        <label>Collection name<input ref="titleInput" v-model="title" name="title" required maxlength="120"></label>
        <fieldset><legend>Updates</legend><label class="choice"><input v-model="mode" type="radio" value="dynamic" name="mode"><span><strong>Dynamic</strong><small>New approved items matching the filters appear automatically.</small></span></label><label class="choice"><input v-model="mode" type="radio" value="static" name="mode"><span><strong>Static</strong><small>Freeze the current results and update the snapshot manually.</small></span></label></fieldset>
        <div class="form-grid"><label>Date range<select v-model="range" name="range"><option value="month">This month</option><option value="day">Today</option><option value="all">Any date</option><option value="custom">Custom dates</option></select></label><label>Project<select v-model="projectId" name="project"><option value="">Any project</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label><label>Tag<select v-model="tagId" name="tag"><option value="">Any tag</option><option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></label><label>Link expiry <span>(optional)</span><input v-model="expiry" type="date" name="expiry"></label></div>
        <div v-if="range === 'custom'" class="form-grid custom-dates"><label>Start date<input v-model="dateFrom" type="date" name="dateFrom" required></label><label>End date<input v-model="dateTo" type="date" name="dateTo" required></label></div>
        <p class="approval-note">Only approved items can appear on a public link.</p>
        <button type="submit" :disabled="busy">{{ busy ? 'Creating link…' : 'Create public link' }}</button>
      </form>
      <p class="feedback" role="status" aria-live="polite">{{ message }}</p><p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
      <section v-if="collections.length" class="existing" aria-labelledby="existing-title"><h3 id="existing-title">Active links</h3><ul><li v-for="collection in collections" :key="collection.id"><div><strong>{{ collection.title }}</strong><span>{{ collection.mode }}<template v-if="collection.expires_at"> · expires {{ new Date(collection.expires_at).toLocaleDateString() }}</template></span></div><div class="actions"><a class="button-secondary" :href="collectionUrl(collection.slug)" target="_blank" rel="noopener noreferrer">Open</a><button class="button-secondary" type="button" @click="copyLink(collection)">Copy link</button><button v-if="collection.mode === 'static'" class="button-secondary" type="button" :disabled="busy" @click="updateSnapshot(collection)">Update snapshot</button><button class="button-secondary" type="button" :disabled="busy" @click="revoke(collection)">Disable</button></div></li></ul></section>
    </div>
  </dialog>
</template>

<style scoped>
.share-dialog {
  width: min(720px, calc(100% - var(--space) * 2));
  max-height: calc(100dvh - var(--space) * 2);
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius) * 1.5);
  color: var(--color-fg);
  background: var(--color-bg);
  box-shadow: 0 24px 80px rgb(0 0 0 / .2);
  overscroll-behavior: contain;
}

.share-dialog::backdrop {
  background: rgb(0 0 0 / .45);
  backdrop-filter: blur(8px);
}

.share-panel { padding: var(--space); }

header {
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: var(--space);
}

header :is(p, h2) { margin: 0; }
header p { color: var(--color-muted); }
.close-button { flex: 0 0 var(--control-height); }
.close-button svg { width: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; }

form { display: grid; gap: var(--space); }
label, legend { color: var(--color-muted); font-size: 12px; }
input, select { width: 100%; min-height: var(--control-height); padding: 0 8px; }
fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space); margin: 0; padding: 0; border: 0; }
legend { grid-column: 1 / -1; margin-bottom: calc(var(--space) / 2); }
.choice { min-height: 64px; display: flex; align-items: flex-start; gap: calc(var(--space) / 2); color: var(--color-fg); cursor: pointer; }
.choice input { width: 18px; min-height: 18px; margin: 2px 0; }
.choice span { display: grid; gap: 4px; }
.choice small { color: var(--color-muted); font-size: 12px; font-weight: 500; line-height: 1.3; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space); }
.form-grid label > span { font-weight: 500; }
.custom-dates { margin-top: calc(var(--space) * -1); }
.approval-note, .feedback { min-height: 1.2em; margin: 0; color: var(--color-muted); font-size: 12px; }
.feedback { margin-top: var(--space); }
.error { color: var(--color-danger); }
form > button { justify-self: start; margin-left: -2px; }

.existing { margin-top: var(--space); }
h3 { margin: 0 0 calc(var(--space) / 2); color: var(--color-muted); font-size: 12px; }
ul { margin: 0; padding: 0; list-style: none; }
li { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--space); padding: var(--space) 0; border-top: 1px solid var(--color-line); }
li > div:first-child { display: grid; }
li span { color: var(--color-muted); font-size: 12px; text-transform: capitalize; }
.actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: calc(var(--space) / 2); }

@media (max-width: 600px) {
  .share-dialog { width: calc(100% - var(--space)); max-height: calc(100dvh - var(--space)); }
  fieldset, .form-grid { grid-template-columns: 1fr; }
  li { grid-template-columns: 1fr; }
  .actions { justify-content: flex-start; }
}
</style>
