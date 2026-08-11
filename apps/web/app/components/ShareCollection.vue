<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'

interface CurrentFilters { search?: string; projectId?: string; projectName?: string; dateFrom?: string; dateTo?: string; dateLabel?: string; status?: string }
const props = withDefaults(defineProps<{ currentFilters?: CurrentFilters; portfolioOnly?: boolean; hideTrigger?: boolean }>(), { portfolioOnly: false, hideTrigger: false })
const emit = defineEmits<{ created: [] }>()

interface Option { id: string; name: string }
type BoardRole = 'owner' | 'editor' | 'contributor' | 'viewer' | 'admin'
interface Collection { id: string; slug: string; title: string; purpose: 'showcase' | 'review' | 'portfolio' | 'case'; portfolio_kind?:'main'|'client'|null; portfolio_client?:string|null; introduction?:string|null; review_month: string | null; submission_deadline: string | null; mode: 'dynamic' | 'static'; layout: BoardLayout; role: BoardRole; expires_at: string | null; publication_enabled: boolean; content_strategy: 'dynamic' | 'snapshot' | 'manual'; created_at: string; updated_at: string; itemCount: number; previewAssets: Array<{ id: string; title: string; previewUrl: string; width: number; height: number }> }
interface ListResponse { data: { collections: Collection[] } }
interface OptionsResponse<T extends string> { data: Record<T, Option[]> }
interface CreateResponse { data: { collection: Omit<Collection, 'previewAssets'> & { itemCount: number | null } } }

const dialog = ref<HTMLDialogElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const createButton = ref<HTMLButtonElement | null>(null)
const view = ref<'list' | 'create'>('list')
const title = ref('')
const purpose = ref<'showcase' | 'review' | 'portfolio'>('showcase')
const portfolioKind = ref<'main'|'client'>('client')
const portfolioClient = ref('')
const introduction = ref('')
const mode = ref<'dynamic' | 'static'>('dynamic')
const range = ref<'all' | 'day' | 'month' | 'custom'>('month')
const dateFrom = ref('')
const dateTo = ref('')
const projectId = ref('')
const tagId = ref('')
const searchFilter = ref('')
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
const usingCurrentFilters = ref(false)
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
const hasCurrentFilters = computed(() => Boolean(props.currentFilters?.search || props.currentFilters?.projectId || props.currentFilters?.dateFrom || props.currentFilters?.dateTo || props.currentFilters?.status))
const currentFilterLabels = computed(() => {
  const labels: string[] = []
  if (props.currentFilters?.search) labels.push(`Search “${props.currentFilters.search}”`)
  if (props.currentFilters?.projectId) labels.push(`Project: ${props.currentFilters.projectName ?? 'Selected project'}`)
  if (props.currentFilters?.dateLabel) labels.push(props.currentFilters.dateLabel)
  return labels
})

const loadCollections = async () => {
  const [shareResponse, projectResponse, tagResponse] = await Promise.all([
    $fetch<ListResponse>('/api/shares'),
    $fetch<OptionsResponse<'projects'>>('/api/projects'),
    $fetch<OptionsResponse<'tags'>>('/api/tags')
  ])
  collections.value = shareResponse.data.collections.filter(collection => collection.purpose !== 'case')
  projects.value = projectResponse.data.projects
  tags.value = tagResponse.data.tags
}
const open = async () => {
  if (opening.value) return
  opening.value = true
  message.value = ''
  errorMessage.value = ''
  view.value = props.portfolioOnly ? 'create' : 'list'
  try { await loadCollections() } catch { errorMessage.value = 'Unable to load sharing settings. Check your connection and try again.' }
  lockPageScroll()
  dialog.value?.showModal()
  await nextTick()
  if (props.portfolioOnly) await showCreate(false)
  else createButton.value?.focus()
  opening.value = false
}
const close = () => { dialog.value?.close(); unlockPageScroll() }
const showCreate = async (fromCurrentView = false) => {
  message.value = ''
  errorMessage.value = ''
  usingCurrentFilters.value = fromCurrentView
  purpose.value = props.portfolioOnly ? 'portfolio' : 'showcase'
  portfolioKind.value = 'client'
  portfolioClient.value = ''
  introduction.value = ''
  mode.value = 'dynamic'
  searchFilter.value = fromCurrentView ? props.currentFilters?.search ?? '' : ''
  projectId.value = fromCurrentView ? props.currentFilters?.projectId ?? '' : ''
  tagId.value = ''
  if (fromCurrentView && (props.currentFilters?.dateFrom || props.currentFilters?.dateTo)) {
    range.value = 'custom'
    dateFrom.value = props.currentFilters?.dateFrom?.slice(0, 10) ?? ''
    dateTo.value = props.currentFilters?.dateTo?.slice(0, 10) ?? ''
  } else {
    range.value = fromCurrentView ? 'all' : 'month'
    dateFrom.value = ''
    dateTo.value = ''
  }
  title.value = defaultTitle()
  view.value = 'create'
  await nextTick()
  titleInput.value?.focus()
}
const openCreate = async () => {
  await open()
  if (!props.portfolioOnly) await showCreate(false)
}
defineExpose({ openCreate })
const showList = async () => {
  errorMessage.value = ''
  view.value = 'list'
  await nextTick()
  createButton.value?.focus()
}
const focusCurrentView = () => {
  if (view.value === 'create') titleInput.value?.focus()
  else createButton.value?.focus()
}
const createCollection = async () => {
  busy.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const review = purpose.value === 'review'
    const portfolio = purpose.value === 'portfolio'
    const reviewStart = review ? new Date(`${reviewMonth.value}-01T00:00:00.000`) : null
    const reviewEnd = reviewStart ? new Date(reviewStart.getFullYear(), reviewStart.getMonth() + 1, 0, 23, 59, 59, 999) : null
    const response = await $fetch<CreateResponse>('/api/shares', {
      method: 'POST', body: {
        title: title.value || (review ? reviewTitle() : portfolio ? 'Portfolio project' : defaultTitle()),
        purpose: purpose.value,
        mode: review || portfolio ? 'static' : mode.value,
        filters: review
          ? { search: '', projectId: null, tagId: null, uploadedBy: null, dateFrom: reviewStart?.toISOString(), dateTo: reviewEnd?.toISOString() }
          : { search: searchFilter.value, projectId: projectId.value || null, tagId: tagId.value || null, ...datesForRange() },
        expiresAt: review || portfolio ? null : isoAt(expiry.value, true),
        reviewMonth: review ? `${reviewMonth.value}-01` : null,
        submissionDeadline: review ? isoAt(submissionDeadline.value, true) : null,
        portfolioKind: portfolio ? portfolioKind.value : null,
        portfolioClient: portfolio && portfolioKind.value === 'client' ? portfolioClient.value : null,
        introduction: portfolio ? introduction.value || null : null
      }
    })
    const createdCollection: Collection = { ...response.data.collection, itemCount: response.data.collection.itemCount ?? 0, previewAssets: [] }
    collections.value.unshift(createdCollection)
    emit('created')
    if (createdCollection.purpose === 'showcase') await copyLink(createdCollection)
    message.value = response.data.collection.purpose === 'review'
      ? 'Monthly review created. Add contributors so they can submit their work.'
      : response.data.collection.purpose === 'portfolio'
      ? 'Portfolio project created. Arrange the work, choose a layout, then publish it.'
      : response.data.collection.mode === 'static'
      ? `Link copied. The snapshot contains ${response.data.collection.itemCount ?? 0} approved items.`
      : 'Link copied. New approved items matching these filters will appear automatically.'
    view.value = 'list'
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
const closeActionMenu = (event: Event) => {
  const details = (event.currentTarget as HTMLElement).closest('details')
  details?.removeAttribute('open')
}
</script>

<template>
  <button v-if="!props.hideTrigger" type="button" :class="[props.portfolioOnly ? 'button' : 'button-plain', 'share-trigger']" :disabled="opening" @click="open">{{ props.portfolioOnly ? 'Create edition' : 'Boards' }}</button>
  <dialog
ref="dialog" class="share-dialog" aria-labelledby="share-title" @click.self="close" @cancel.prevent="close"
    @close="unlockPageScroll">
    <div class="share-panel">
      <header>
        <div class="dialog-heading"><button
v-if="view === 'create' && !props.portfolioOnly" type="button" class="button-plain back-button" @click="showList">Back to boards</button><h2 id="share-title" class="display-title">{{ props.portfolioOnly ? 'Create portfolio edition' : view === 'list' ? 'My boards and shared with me' : 'Create board' }}</h2></div><button
type="button"
          class="button-secondary button-icon close-button" aria-label="Close board settings" @click="close"><svg
            aria-hidden="true" viewBox="0 0 24 24">
            <path d="m5 5 14 14M19 5 5 19" />
          </svg></button>
      </header>
      <Transition name="panel-view" mode="out-in" @after-enter="focusCurrentView">
        <section v-if="view === 'list'" key="list" class="boards-view">
          <div class="boards-intro"><p>Manage showcases, portfolio projects, and private review boards.</p><div class="boards-intro-actions"><button v-if="hasCurrentFilters" ref="createButton" type="button" @click="showCreate(true)">Create from this view</button><button v-else ref="createButton" type="button" @click="showCreate(false)">Create board</button><button v-if="hasCurrentFilters" type="button" class="button-secondary" @click="showCreate(false)">Create board</button></div></div>
          <p class="feedback" role="status" aria-live="polite">{{ message }}</p>
          <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
          <ul v-if="collections.length" class="board-grid">
            <li v-for="collection in collections" :key="collection.id" class="board-card">
              <NuxtLink class="board-preview" :class="{ 'is-empty': !collection.previewAssets.length }" :to="`/boards/${collection.id}`" :aria-label="`${['owner', 'editor', 'admin'].includes(collection.role) ? 'Edit' : 'Open'} ${collection.title}`"><div class="preview-strip"><template v-if="collection.previewAssets.length"><img v-for="asset in collection.previewAssets" :key="asset.id" :src="asset.previewUrl" :width="asset.width" :height="asset.height" alt="" loading="lazy" decoding="async"></template><span v-else>No items yet</span></div></NuxtLink>
              <div class="board-info"><div><label v-if="['owner', 'editor', 'admin'].includes(collection.role)" class="board-title"><span class="sr-only">Board name</span><textarea
:value="collection.title" rows="1" maxlength="120" :aria-describedby="`board-feedback-${collection.id}`"
                    :aria-invalid="boardFeedback[collection.id]?.error || undefined" @change="renameBoard(collection, $event)" /><span
:id="`board-feedback-${collection.id}`" class="field-message" :class="{ error: boardFeedback[collection.id]?.error }" role="status" aria-live="polite">{{ boardFeedback[collection.id]?.text }}</span></label><template v-else><strong>{{ collection.title }}</strong></template><span class="board-meta">{{ collection.role }} · {{ collection.purpose === 'review' ? 'monthly review' : collection.purpose === 'portfolio' ? 'portfolio' : collection.mode }} · {{ collection.publication_enabled ? 'public' : 'private' }}<template v-if="collection.expires_at"> · expires {{ new Date(collection.expires_at).toLocaleDateString() }}</template></span></div>
                <details class="action-menu board-menu" @keydown.esc.prevent="closeActionMenu"><summary aria-label="More board actions">•••</summary><div><a v-if="collection.publication_enabled" :href="collectionUrl(collection.slug)" target="_blank" rel="noopener noreferrer">View public page</a><button v-if="collection.publication_enabled" type="button" @click="copyLink(collection); closeActionMenu($event)">Copy public link</button><button v-if="['owner', 'editor', 'admin'].includes(collection.role)" type="button" :disabled="busy" @click="collection.publication_enabled ? revoke(collection) : publish(collection); closeActionMenu($event)">{{ collection.publication_enabled ? 'Disable public link' :'Enable public link' }}</button></div></details></div>
            </li>
          </ul>
          <div v-else-if="!errorMessage" class="empty-boards"><strong>No boards yet</strong><span>Create a showcase, portfolio project, or monthly review.</span></div>
        </section>
        <form v-else key="create" @submit.prevent="createCollection">
          <fieldset v-if="!props.portfolioOnly"><legend>Board type</legend><label class="choice"><input v-model="purpose" type="radio" value="showcase" name="purpose"><span><strong>Showcase</strong><small>Share an automatically updating or fixed collection.</small></span></label><label class="choice"><input v-model="purpose" type="radio" value="portfolio" name="purpose"><span><strong>Portfolio project</strong><small>Arrange selected work, choose a layout, then publish.</small></span></label><label class="choice"><input v-model="purpose" type="radio" value="review" name="purpose"><span><strong>Monthly review</strong><small>Collect work privately from invited contributors.</small></span></label></fieldset>
          <label>Board name<input ref="titleInput" v-model="title" name="title" required maxlength="120"></label>
          <fieldset v-if="purpose === 'portfolio'"><legend>Edition</legend><label class="choice"><input v-model="portfolioKind" type="radio" value="main" name="portfolio-kind"><span><strong>Main portfolio</strong><small>Your canonical selection of work.</small></span></label><label class="choice"><input v-model="portfolioKind" type="radio" value="client" name="portfolio-kind"><span><strong>Client edition</strong><small>A tailored selection for one recipient.</small></span></label></fieldset>
          <div v-if="purpose === 'portfolio'" class="form-grid"><label v-if="portfolioKind === 'client'">Client or recipient<input v-model="portfolioClient" name="portfolio-client" required maxlength="120" placeholder="Acme Studio"></label><label>Introduction<textarea v-model="introduction" name="introduction" rows="3" maxlength="2000" placeholder="A short note about this selection" /></label></div>
          <div v-if="usingCurrentFilters" class="filter-context"><strong>Starting with current filters</strong><span>{{ currentFilterLabels.join(' · ') || 'All dates' }}</span><small v-if="props.currentFilters?.status==='draft'">Draft status is not included because showcase boards contain approved assets only.</small><small v-else>Showcase boards contain approved assets only.</small></div>
          <fieldset v-if="purpose === 'showcase'"><legend>Updates</legend><label class="choice"><input v-model="mode" type="radio" value="dynamic" name="mode"><span><strong>Dynamic</strong><small>New approved items matching the filters appear automatically.</small></span></label><label class="choice"><input v-model="mode" type="radio" value="static" name="mode"><span><strong>Static</strong><small>Freeze the current results and update the snapshot manually.</small></span></label></fieldset>
          <div v-if="purpose !== 'review'" class="form-grid"><label>Search<input v-model="searchFilter" type="search" name="search" maxlength="200"></label><label>Date range<select v-model="range" name="range"><option value="month">This month</option><option value="day">Today</option><option value="all">Any date</option><option value="custom">Custom dates</option></select></label><label>Project<select v-model="projectId" name="project"><option value="">Any project</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label><label>Tag<select v-model="tagId" name="tag"><option value="">Any tag</option><option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></label><label v-if="purpose === 'showcase'">Link expiry <span>(optional)</span><input v-model="expiry" type="date" name="expiry"></label></div>
          <div v-else class="form-grid"><label>Review month<input v-model="reviewMonth" type="month" required name="review-month"></label><label>Submission deadline <span>(optional)</span><input v-model="submissionDeadline" type="date" name="submission-deadline"></label></div>
          <div v-if="purpose !== 'review' && range === 'custom'" class="form-grid custom-dates"><label>Start date<input v-model="dateFrom" type="date" name="dateFrom" required></label><label>End date<input v-model="dateTo" type="date" name="dateTo" required></label></div>
          <p class="approval-note">{{ purpose === 'review' ? 'Review boards start private. Contributors can add their own work.' : purpose === 'portfolio' ? 'Portfolio projects start private. Publish when the order and layout are ready.' : 'Only approved items can appear on a public link.' }}</p>
          <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
          <div class="form-actions"><button type="submit" :disabled="busy">{{ busy ? 'Creating board…' : purpose === 'review' ? 'Create monthly review' : purpose === 'portfolio' ? 'Create portfolio project' : 'Create board' }}</button><button type="button" class="button-secondary" @click="showList">Cancel</button></div>
        </form>
      </Transition>
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
  padding: calc(var(--space)*1.5);
  background-color: var(--color-bg);
}

header {
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: var(--section-gap-compact);
}

.dialog-heading {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--cluster-gap);
}

header h2 {
  width: 75%;
}

.back-button {
  width: max-content;
  color: var(--color-muted);
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
select,
textarea {
  width: 100%;
  min-height: var(--control-height);
  padding: 0 8px;
  color: var(--color-fg);
}

textarea { padding-block: calc(var(--space) / 3); resize: vertical; }

input::placeholder {
  color: var(--color-muted);
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

.filter-context {
  display: grid;
  gap: calc(var(--space) / 4);
  padding: calc(var(--space) * .75);
  border-radius: calc(var(--radius) * 1.5);
  background: var(--color-surface);
}

.filter-context span,
.filter-context small {
  color: var(--color-muted);
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

.boards-view {
  min-height: 360px;
}

.boards-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: var(--space);
}

.boards-intro p {
  margin: 4px 0 0;
  color: var(--color-muted);
}

.boards-intro button {
  flex: 0 0 auto;
}

.boards-intro-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: calc(var(--space) / 2);
}

ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-grid {
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: var(--section-gap-compact) var(--space);
}

.board-card {
  position: relative;
  min-width: 0;
  display: grid;
  gap: calc(var(--space));
  /* background: var(--color-surface);
  padding: var(--space);
  border-radius: calc(var(--radius)*3) */
}

.board-preview {
  position: relative;
  overflow: visible;
  border-radius: var(--radius);
  color: var(--color-muted);
  background: var(--color-bg);
  text-decoration: none;
}

.board-preview:hover {
  opacity: 1;
}

.preview-strip {
  width: 100%;
  display: flex;
  align-items: center;
  gap: calc(var(--space) / 4);
}

.preview-strip img {
  display: block;
  width: 100%;
  height: auto;
  min-width: 0;
  flex: 1 1 0;
  object-fit: contain;
}

.board-menu summary {
  min-height: 32px;
  height: 32px;
  font-size: 12px;
}

.board-menu summary {
  width: 32px;
}

.board-preview.is-empty .preview-strip > span {
  flex: 1;
  display: grid;
  place-items: center;
}

.board-menu > div {
  top: calc(100% + 8px);
  bottom: auto;
}

.board-preview.is-empty .preview-strip {
  min-height: 160px;
  align-items: center;
}

.board-info {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space);
}

.board-info>div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.board-info span {
  color: var(--color-muted);
}

.board-meta {
  font-size: 14px;
  line-height: 1.2;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: var(--cluster-gap); */
  margin-top: 2px;
}

.action-menu {
  position: relative;
}

.action-menu summary {
  width: var(--control-height);
  height: var(--control-height);
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--color-surface);
  cursor: pointer;
  list-style: none;
  letter-spacing: .08em;
}

.action-menu summary::-webkit-details-marker {
  display: none;
}

.action-menu[open] summary {
  color: var(--color-bg);
  background: var(--color-fg);
}

.action-menu>div {
  position: absolute;
  z-index: 5;
  right: 0;
  bottom: calc(100% + 8px);
  width: max-content;
  min-width: 190px;
  display: grid;
  padding: 6px;
  border-radius: calc(var(--radius) * 1.5);
  background: var(--color-bg);
  box-shadow: 0 12px 40px rgb(0 0 0 / .18);
}

.action-menu :is(a, button) {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius);
  color: var(--color-fg);
  background: transparent;
  font: inherit;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.action-menu :is(a, button):hover {
  background: var(--color-surface);
}

.empty-boards {
  min-height: 220px;
  display: grid;
  place-content: center;
  gap: 6px;
  color: var(--color-muted);
  text-align: center;
}

.empty-boards strong {
  color: var(--color-fg);
}

.form-actions {
  display: flex;
  gap: var(--cluster-gap);
}

.panel-view-enter-active,
.panel-view-leave-active {
  transition-property: opacity, transform;
  transition-duration: 180ms;
  transition-timing-function: ease-out;
}

.panel-view-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.panel-view-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.board-title {
  position: relative;
  display: block;
  min-width: 0
}

.board-title textarea,
.board-info>div>strong {
  font-size: clamp(18px, 1.25vw, 22px);
  line-height: 1.05;
  letter-spacing: -.035em;
}

.board-title textarea {
  width: 100%;
  min-height: 24px;
  padding: 0 52px 0 0;
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
  position: absolute;
  top: 3px;
  right: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.2
}

.field-message:empty {
  display: none
}

.field-message.error {
  position: static;
  display: block;
  margin-top: 4px;
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
  .form-grid {
    grid-template-columns: 1fr;
  }

  .board-grid {
    grid-template-columns: 1fr;
  }

  .boards-intro {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-preview img {
    transition: none;
  }

  .panel-view-enter-active,
  .panel-view-leave-active {
    transition: none;
  }
}
</style>
