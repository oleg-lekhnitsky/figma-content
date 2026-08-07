<script setup lang="ts">
const props = defineProps<{ currentSearch?: string }>()

interface Option { id: string; name: string }
type BoardRole = 'owner' | 'editor' | 'contributor' | 'viewer' | 'admin'
interface Collection { id: string; slug: string; title: string; purpose: 'showcase' | 'review'; review_month: string | null; submission_deadline: string | null; mode: 'dynamic' | 'static'; layout: 'masonry' | 'column' | 'presentation'; role: BoardRole; expires_at: string | null; publication_enabled: boolean; content_strategy: 'dynamic' | 'snapshot' | 'manual'; created_at: string; updated_at: string }
interface ListResponse { data: { collections: Collection[] } }
interface OptionsResponse<T extends string> { data: Record<T, Option[]> }
interface CreateResponse { data: { collection: Collection & { itemCount: number | null } } }

const dialog = ref<HTMLDialogElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const purpose = ref<'showcase' | 'review'>('showcase')
const mode = ref<'dynamic' | 'static'>('dynamic')
const range = ref<'all' | 'day' | 'month' | 'custom'>('month')
const dateFrom = ref('')
const dateTo = ref('')
const projectId = ref('')
const tagId = ref('')
const expiry = ref('')
const reviewMonth = ref(new Date().toISOString().slice(0, 7))
const submissionDeadline = ref('')
const projects = ref<Option[]>([])
const tags = ref<Option[]>([])
const collections = ref<Collection[]>([])
const busy = ref(false)
const opening = ref(false)
const message = ref('')
const errorMessage = ref('')
const boardFeedback = reactive<Record<string, { text: string; error: boolean }>>({})
let previousBodyOverflow = ''
let previousRootOverflow = ''
let scrollLocked = false

const lockPageScroll = () => {
  if (scrollLocked) return
  previousBodyOverflow = document.body.style.overflow
  previousRootOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  scrollLocked = true
}
const unlockPageScroll = () => {
  if (!scrollLocked) return
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousRootOverflow
  scrollLocked = false
}
onBeforeUnmount(unlockPageScroll)

const collectionUrl = (slug: string) => `/s/${slug}`
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
const reviewTitle = () => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  .format(new Date(`${reviewMonth.value}-01T12:00:00`))

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
  if (opening.value) return
  opening.value = true
  message.value = ''
  errorMessage.value = ''
  title.value ||= defaultTitle()
  try { await loadCollections() } catch { errorMessage.value = 'Unable to load sharing settings. Check your connection and try again.' }
  lockPageScroll()
  dialog.value?.showModal()
  await nextTick()
  titleInput.value?.focus()
  opening.value = false
}
const close = () => { dialog.value?.close(); unlockPageScroll() }
const createCollection = async () => {
  busy.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const review = purpose.value === 'review'
    const reviewStart = review ? new Date(`${reviewMonth.value}-01T00:00:00.000`) : null
    const reviewEnd = reviewStart ? new Date(reviewStart.getFullYear(), reviewStart.getMonth() + 1, 0, 23, 59, 59, 999) : null
    const response = await $fetch<CreateResponse>('/api/shares', {
      method: 'POST', body: {
        title: title.value || (review ? reviewTitle() : defaultTitle()),
        purpose: purpose.value,
        mode: review ? 'static' : mode.value,
        filters: review
          ? { search: '', projectId: null, tagId: null, uploadedBy: null, dateFrom: reviewStart?.toISOString(), dateTo: reviewEnd?.toISOString() }
          : { search: props.currentSearch ?? '', projectId: projectId.value || null, tagId: tagId.value || null, ...datesForRange() },
        expiresAt: review ? null : isoAt(expiry.value, true),
        reviewMonth: review ? `${reviewMonth.value}-01` : null,
        submissionDeadline: review ? isoAt(submissionDeadline.value, true) : null
      }
    })
    collections.value.unshift(response.data.collection)
    if (response.data.collection.purpose !== 'review') await copyLink(response.data.collection)
    message.value = response.data.collection.purpose === 'review'
      ? 'Monthly review created. Add contributors so they can submit their work.'
      : response.data.collection.mode === 'static'
      ? `Link copied. The snapshot contains ${response.data.collection.itemCount ?? 0} approved items.`
      : 'Link copied. New approved items matching these filters will appear automatically.'
  } catch { errorMessage.value = 'Unable to create the public link. Check the settings and try again.' }
  finally { busy.value = false }
}
const copyLink = async (collection: Collection) => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${collectionUrl(collection.slug)}`)
    message.value = `Link copied for ${collection.title}.`
  } catch { errorMessage.value = 'Unable to copy automatically. Open the link and copy it from the address bar.' }
}
const revoke = async (collection: Collection) => {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/shares/${collection.id}`, { method: 'PATCH', body: { action: 'revoke' } })
    collection.publication_enabled = false
    message.value = `${collection.title} is no longer public.`
  } catch { errorMessage.value = 'Unable to disable the link. Try again.' }
  finally { busy.value = false }
}
const publish = async (collection: Collection) => {
  busy.value = true; errorMessage.value = ''
  try { await $fetch(`/api/shares/${collection.id}`, { method: 'PATCH', body: { action: 'publish' } }); collection.publication_enabled = true; message.value = `${collection.title} is public.` }
  catch { errorMessage.value = 'Unable to enable the public link. Try again.' }
  finally { busy.value = false }
}
const renameBoard = async (collection: Collection, event: Event) => {
  message.value = ''
  errorMessage.value = ''
  boardFeedback[collection.id] = { text: '', error: false }
  const input = event.target as HTMLInputElement
  const nextTitle = input.value.trim()
  if (!nextTitle || nextTitle === collection.title) return
  const previousTitle = collection.title
  collection.title = nextTitle
  try { await $fetch(`/api/shares/${collection.id}`, { method: 'PATCH', body: { action: 'rename', title: nextTitle } }); boardFeedback[collection.id] = { text: 'Saved', error: false } }
  catch { collection.title = previousTitle; input.value = previousTitle; boardFeedback[collection.id] = { text: 'Unable to rename. Try a different name.', error: true } }
}
</script>

<template>
  <button type="button" class="button-plain share-trigger" :disabled="opening" @click="open">Boards</button>
  <dialog
ref="dialog" class="share-dialog" aria-labelledby="share-title" @click.self="close" @cancel.prevent="close"
    @close="unlockPageScroll">
    <div class="share-panel">
      <header>
        <h2 id="share-title" class="display-title">Build and share boards</h2><button
type="button"
          class="button-secondary button-icon close-button" aria-label="Close board settings" @click="close"><svg
            aria-hidden="true" viewBox="0 0 24 24">
            <path d="m5 5 14 14M19 5 5 19" />
          </svg></button>
      </header>
      <form @submit.prevent="createCollection">
        <fieldset>
          <legend>Board type</legend><label class="choice"><input
v-model="purpose" type="radio" value="showcase"
              name="purpose"><span><strong>Showcase</strong><small>Curate work for a public link or portfolio.</small></span></label><label class="choice"><input
v-model="purpose" type="radio"
              value="review" name="purpose"><span><strong>Monthly review</strong><small>Collect work privately from invited contributors.</small></span></label>
        </fieldset>
        <label>Board name<input ref="titleInput" v-model="title" name="title" required maxlength="120"></label>
        <fieldset v-if="purpose === 'showcase'">
          <legend>Updates</legend><label class="choice"><input
v-model="mode" type="radio" value="dynamic"
              name="mode"><span><strong>Dynamic</strong><small>New approved items matching the filters appear
                automatically.</small></span></label><label class="choice"><input
v-model="mode" type="radio"
              value="static" name="mode"><span><strong>Static</strong><small>Freeze the current results and update the
                snapshot manually.</small></span></label>
        </fieldset>
        <div v-if="purpose === 'showcase'" class="form-grid"><label>Date range<select v-model="range" name="range">
              <option value="month">This month</option>
              <option value="day">Today</option>
              <option value="all">Any date</option>
              <option value="custom">Custom dates</option>
            </select></label><label>Project<select v-model="projectId" name="project">
              <option value="">Any project</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select></label><label>Tag<select v-model="tagId" name="tag">
              <option value="">Any tag</option>
              <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select></label><label>Link expiry <span>(optional)</span><input
v-model="expiry" type="date"
              name="expiry"></label></div>
        <div v-else class="form-grid"><label>Review month<input
v-model="reviewMonth" type="month" required
              name="review-month"></label><label>Submission deadline <span>(optional)</span><input
v-model="submissionDeadline" type="date" name="submission-deadline"></label></div>
        <div v-if="purpose === 'showcase' && range === 'custom'" class="form-grid custom-dates"><label>Start date<input
v-model="dateFrom"
              type="date" name="dateFrom" required></label><label>End date<input
v-model="dateTo" type="date"
              name="dateTo" required></label></div>
        <p class="approval-note">{{ purpose === 'review' ? 'Review boards start private. Contributors can add their own work.' : 'Only approved items can appear on a public link.' }}</p>
        <button type="submit" :disabled="busy">{{ busy ? 'Creating board…' : purpose === 'review' ? 'Create monthly review' : 'Create board' }}</button>
      </form>
      <p class="feedback" role="status" aria-live="polite">{{ message }}</p>
      <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
      <section v-if="collections.length" class="existing" aria-labelledby="existing-title">
        <h3 id="existing-title">My boards and shared with me</h3>
        <ul>
          <li v-for="collection in collections" :key="collection.id">
            <div><label v-if="['owner', 'editor', 'admin'].includes(collection.role)" class="board-title"><span
                  class="sr-only">Board name</span><textarea
:value="collection.title" rows="1" maxlength="120"
                  :aria-describedby="`board-feedback-${collection.id}`"
                  :aria-invalid="boardFeedback[collection.id]?.error || undefined"
                  @change="renameBoard(collection, $event)" /><span
:id="`board-feedback-${collection.id}`"
                  class="field-message" :class="{ error: boardFeedback[collection.id]?.error }" role="status"
                  aria-live="polite">{{ boardFeedback[collection.id]?.text }}</span></label><template v-else><strong>{{
                  collection.title }}</strong><span class="field-message" aria-hidden="true" /></template><span>{{
                collection.role }} · {{ collection.purpose === 'review' ? 'monthly review' : collection.mode }} · {{ collection.publication_enabled ? 'public' : 'private'
                }}<template v-if="collection.expires_at"> · expires {{ new
                  Date(collection.expires_at).toLocaleDateString() }}</template></span>
            </div>
            <div class="actions">
              <NuxtLink class="button-secondary" :to="`/boards/${collection.id}`">{{
                ['owner', 'editor', 'admin'].includes(collection.role) ? 'Edit board' : 'Open board' }}</NuxtLink><a
                v-if="collection.publication_enabled" class="button-secondary" :href="collectionUrl(collection.slug)"
                target="_blank" rel="noopener noreferrer">View public page</a><button
                v-if="collection.publication_enabled" class="button-secondary" type="button"
                @click="copyLink(collection)">Copy public link</button><button
                v-if="['owner', 'editor', 'admin'].includes(collection.role)" class="button-secondary" type="button"
                :disabled="busy" @click="collection.publication_enabled ? revoke(collection) : publish(collection)">{{
                  collection.publication_enabled ? 'Disable public link' :'Enable public link' }}</button>
            </div>
          </li>
        </ul>
      </section>
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
  background-color: var(--color-bg);
  box-shadow: 0 24px 80px rgb(0 0 0 / .2);
  overscroll-behavior: contain;
  scrollbar-width: none;
  border-radius: calc(var(--radius)*4);
}

.share-dialog::-webkit-scrollbar {
  display: none;
}

.share-dialog::backdrop {
  background: rgb(0 0 0 / .15);
  backdrop-filter: blur(48px);
}

.share-panel {
  padding: var(--space);
  padding: calc(var(--space)*2);
  background-color: var(--color-bg);
}

header {
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: var(--section-gap-compact);
}

header h2 {
  width: 75%;
}

.close-button {
  flex: 0 0 var(--control-height);
}

.close-button svg {
  width: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

form {
  display: grid;
  gap: var(--space);
}

label,
legend {
  color: var(--color-muted);
}

input,
select {
  width: 100%;
  min-height: var(--control-height);
  padding: 0 8px;
}

fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space);
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  grid-column: 1 / -1;
  margin-bottom: var(--cluster-gap);
}

.choice {
  min-height: 64px;
  display: flex;
  align-items: flex-start;
  gap: var(--cluster-gap);
  color: var(--color-fg);
  cursor: pointer;
}

.choice input {
  width: 18px;
  min-height: 18px;
  margin: 2px 0;
}

.choice span {
  display: grid;
  gap: 4px;
}

.choice small {
  color: var(--color-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space);
}

.custom-dates {
  margin-top: calc(var(--space) * -1);
}

.approval-note,
.feedback {
  min-height: 1.2em;
  margin: 0;
  color: var(--color-muted);
}

.feedback {
  margin-top: var(--cluster-gap);
}

.error {
  color: var(--color-danger);
}

form>button {
  justify-self: start;
  margin-left: -2px;
}

.existing {
  margin-top: var(--section-gap-compact);
}

h3 {
  margin: 0 0 var(--cluster-gap);
  color: var(--color-muted);
}

ul {
  display: grid;
  row-gap: var(--space);
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--cluster-gap);
  padding: var(--space) 0;
  border-top: 1px solid var(--color-line);
}

li>div:first-child {
  display: grid;
}

li span {
  color: var(--color-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--cluster-gap);
}

.board-title {
  display: block;
  min-width: 0
}

.board-title textarea {
  width: 100%;
  min-height: 28px;
  padding: 0;
  overflow: hidden;
  resize: none;
  field-sizing: content;
  border-bottom-color: transparent;
  color: var(--color-fg)
}

.board-title textarea:hover {
  border-bottom-color: var(--color-line)
}

.field-message {
  height: 1em;
  display: block;
  margin-top: 4px;
  color: var(--color-muted)
}

.field-message.error {
  color: var(--color-danger)
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap
}

@media (max-width: 600px) {
  .share-dialog {
    width: calc(100% - var(--space));
    max-height: calc(100dvh - var(--space));
  }

  fieldset,
  .form-grid,
  .member-form {
    grid-template-columns: 1fr;
  }

  li {
    grid-template-columns: 1fr;
  }

  .actions {
    justify-content: flex-start;
  }
}
</style>
