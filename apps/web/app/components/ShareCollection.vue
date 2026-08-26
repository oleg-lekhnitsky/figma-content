<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'
import { Xmark } from 'reicon-vue'

interface CurrentFilters { search?: string; projectIds?: string[]; projectNames?: string[]; tagIds?: string[]; tagNames?: string[]; uploadedBy?: string|null; dateFrom?: string; dateTo?: string; dateLabel?: string; status?: string }
const props = withDefaults(defineProps<{ currentFilters?: CurrentFilters; portfolioOnly?: boolean; hideTrigger?: boolean }>(), { portfolioOnly: false, hideTrigger: false })
const emit = defineEmits<{ created: [collectionId: string]; openChange: [open: boolean] }>()

interface Option { id: string; name: string }
type BoardRole = 'owner' | 'editor' | 'contributor' | 'viewer' | 'admin'
interface Collection { id: string; slug: string; title: string; purpose: 'showcase' | 'review' | 'portfolio' | 'case'; portfolio_kind?:'main'|'client'|null; portfolio_client?:string|null; introduction?:string|null; review_month: string | null; submission_deadline: string | null; mode: 'dynamic' | 'static'; layout: BoardLayout; role: BoardRole; expires_at: string | null; publication_enabled: boolean; content_strategy: 'dynamic' | 'snapshot' | 'manual'; created_at: string; updated_at: string; itemCount: number; previewAssets: Array<{ id: string; title: string; previewUrl: string; mime_type?: string|null; width: number; height: number }> }
interface ListResponse { data: { collections: Collection[] } }
interface OptionsResponse<T extends string> { data: Record<T, Option[]> }
interface CreateResponse { data: { collection: Omit<Collection, 'previewAssets'> & { itemCount: number | null } } }

const dialog = ref<HTMLDialogElement | null>(null)
const createPanelOpen = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const createButton = ref<HTMLButtonElement | null>(null)
const view = ref<'list' | 'create'>('list')
const title = ref('')
const purpose = ref<'showcase' | 'review' | 'portfolio'>('showcase')
const collectsSubmissions = computed({
  get: () => purpose.value === 'review',
  set: (enabled: boolean) => { purpose.value = enabled ? 'review' : 'showcase' }
})
const portfolioKind = ref<'main'|'client'>('main')
const portfolioClient = ref('')
const introduction = ref('')
const mode = ref<'dynamic' | 'static'>('dynamic')
const range = ref<'all' | 'today' | 'week' | 'two-weeks' | 'month' | 'custom'>('month')
const dateFrom = ref('')
const dateTo = ref('')
const projectIds = ref<string[]>([])
const tagIds = ref<string[]>([])
const searchFilter = ref('')
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
  } else if (range.value === 'week') {
    start.setDate(start.getDate() - 6)
  } else if (range.value === 'two-weeks') {
    start.setDate(start.getDate() - 13)
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}
const defaultTitle = () => range.value === 'today'
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())
  : range.value === 'month'
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())
    : 'Shared collection'
const reviewTitle = () => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  .format(new Date(`${reviewMonth.value}-01T12:00:00`))
const hasCurrentFilters = computed(() => Boolean(props.currentFilters?.search || props.currentFilters?.projectIds?.length || props.currentFilters?.tagIds?.length || props.currentFilters?.uploadedBy || props.currentFilters?.dateFrom || props.currentFilters?.dateTo || props.currentFilters?.status))
const currentFilterLabels = computed(() => {
  const labels: string[] = []
  if (props.currentFilters?.search) labels.push(`Search “${props.currentFilters.search}”`)
  if (props.currentFilters?.projectIds?.length) labels.push(`Projects: ${props.currentFilters.projectNames?.join(', ') ?? props.currentFilters.projectIds.length}`)
  if (props.currentFilters?.tagIds?.length) labels.push(`Tags: ${props.currentFilters.tagNames?.join(', ') ?? props.currentFilters.tagIds.length}`)
  if (props.currentFilters?.dateLabel) labels.push(props.currentFilters.dateLabel)
  return labels
})
const loadCollections = async () => {
  const shareResponse = await $fetch<ListResponse>('/api/shares')
  collections.value = shareResponse.data.collections
}
let createOptionsRequest: Promise<void> | undefined
const loadCreateOptions = () => {
  if (projects.value.length || tags.value.length) return Promise.resolve()
  if (createOptionsRequest) return createOptionsRequest
  createOptionsRequest = Promise.all([
    $fetch<OptionsResponse<'projects'>>('/api/projects'),
    $fetch<OptionsResponse<'tags'>>('/api/tags')
  ]).then(([projectResponse, tagResponse]) => {
    projects.value = projectResponse.data.projects
    tags.value = tagResponse.data.tags
  }).finally(() => { createOptionsRequest = undefined })
  return createOptionsRequest
}
const hydrateCreateOptions = async () => {
  try {
    await loadCreateOptions()
  } catch {
    if (createPanelOpen.value) errorMessage.value = 'Unable to load project and tag options. Try again.'
  }
}
const open = async () => {
  if (opening.value) return
  opening.value = true
  message.value = ''
  errorMessage.value = ''
  view.value = props.portfolioOnly ? 'create' : 'list'
  try { await loadCollections() } catch { errorMessage.value = 'Unable to load sharing settings. Check your connection and try again.' }
  if (props.portfolioOnly) await showCreate(false)
  else {
    lockPageScroll()
    dialog.value?.showModal()
    await nextTick()
    createButton.value?.focus()
  }
  opening.value = false
}
const close = () => {
  const panelWasOpen = createPanelOpen.value
  if (createPanelOpen.value) createPanelOpen.value = false
  dialog.value?.close()
  unlockPageScroll()
  if (!panelWasOpen) emit('openChange', false)
}
const finishPanelClose = () => emit('openChange', false)
const showCreate = async (fromCurrentView = false) => {
  emit('openChange', true)
  message.value = ''
  errorMessage.value = ''
  usingCurrentFilters.value = fromCurrentView
  purpose.value = props.portfolioOnly ? 'portfolio' : 'showcase'
  portfolioKind.value = 'main'
  portfolioClient.value = ''
  introduction.value = ''
  mode.value = 'static'
  searchFilter.value = fromCurrentView ? props.currentFilters?.search ?? '' : ''
  projectIds.value = fromCurrentView ? [...(props.currentFilters?.projectIds ?? [])] : []
  tagIds.value = fromCurrentView ? [...(props.currentFilters?.tagIds ?? [])] : []
  if (fromCurrentView && (props.currentFilters?.dateFrom || props.currentFilters?.dateTo)) {
    range.value = 'custom'
    dateFrom.value = props.currentFilters?.dateFrom?.slice(0, 10) ?? ''
    dateTo.value = props.currentFilters?.dateTo?.slice(0, 10) ?? ''
  } else {
    range.value = 'all'
    dateFrom.value = ''
    dateTo.value = ''
  }
  title.value = defaultTitle()
  view.value = 'create'
  dialog.value?.close()
  unlockPageScroll()
  createPanelOpen.value = true
  await nextTick()
  titleInput.value?.focus()
}
const openCreate = async () => {
  if (opening.value) return
  opening.value = true
  message.value = ''
  errorMessage.value = ''
  await showCreate(false)
  opening.value = false
  void hydrateCreateOptions()
}
const openCreateFromCurrentView = async () => {
  if (opening.value) return
  opening.value = true
  message.value = ''
  errorMessage.value = ''
  await showCreate(true)
  opening.value = false
  void hydrateCreateOptions()
}
defineExpose({ openCreate, openCreateFromCurrentView })
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
        title: title.value || (review ? reviewTitle() : portfolio ? 'Portfolio' : defaultTitle()),
        purpose: purpose.value,
        mode: review || portfolio ? 'static' : mode.value,
        contentStrategy: review || portfolio ? 'manual' : mode.value === 'dynamic' ? 'dynamic' : usingCurrentFilters.value ? 'snapshot' : 'manual',
        filters: review
          ? { search: '', projectId: null, tagId: null, projectIds: [], tagIds: [], uploadedBy: null, dateFrom: reviewStart?.toISOString(), dateTo: reviewEnd?.toISOString() }
          : { search: mode.value === 'dynamic' ? '' : searchFilter.value, projectId: null, tagId: null, projectIds: projectIds.value, tagIds: tagIds.value, uploadedBy: usingCurrentFilters.value ? props.currentFilters?.uploadedBy ?? null : null, ...datesForRange() },
        expiresAt: null,
        reviewMonth: review ? `${reviewMonth.value}-01` : null,
        submissionDeadline: review ? isoAt(submissionDeadline.value, true) : null,
        portfolioKind: portfolio ? portfolioKind.value : null,
        portfolioClient: portfolio && portfolioKind.value === 'client' ? portfolioClient.value : null,
        introduction: portfolio ? introduction.value || null : null
      }
    })
    const createdCollection: Collection = { ...response.data.collection, itemCount: response.data.collection.itemCount ?? 0, previewAssets: [] }
    collections.value.unshift(createdCollection)
    emit('created', createdCollection.id)
    if (createdCollection.purpose === 'portfolio') {
      close()
      await navigateTo(`/boards/${createdCollection.id}`)
      return
    }
    message.value = response.data.collection.purpose === 'review'
      ? 'Board created. Add contributors so they can submit their work.'
      : response.data.collection.mode === 'static'
      ? `Board created with ${response.data.collection.itemCount ?? 0} approved items.`
      : 'Board created. New approved items matching these filters will appear automatically.'
    close()
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
  <button v-if="!props.hideTrigger" type="button" :class="[props.portfolioOnly ? 'button' : 'button-plain', 'share-trigger']" :disabled="opening" @click="open">{{ props.portfolioOnly ? 'Create portfolio' : 'Boards' }}</button>
  <dialog
ref="dialog" class="share-dialog" aria-labelledby="share-title" @click.self="close" @cancel.prevent="close"
    @close="unlockPageScroll">
    <div class="share-panel">
      <header v-if="view === 'list'">
        <div class="dialog-heading"><h2 id="share-title" class="display-title">{{ props.portfolioOnly ? 'Create portfolio' : 'My boards and shared with me' }}</h2></div><button
type="button"
          class="button-secondary button-icon close-button" aria-label="Close board settings" @click="close">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>
      <Transition name="panel-view" @after-enter="focusCurrentView">
        <section v-if="view === 'list'" key="list" class="boards-view">
          <div class="boards-intro"><p>Create collections, share them, or invite people to submit work.</p><div class="boards-intro-actions"><button v-if="hasCurrentFilters" ref="createButton" type="button" @click="showCreate(true)">Create from this view</button><button v-else ref="createButton" type="button" @click="showCreate(false)">Create board</button><button v-if="hasCurrentFilters" type="button" class="button-secondary" @click="showCreate(false)">Create board</button></div></div>
          <p class="feedback" role="status" aria-live="polite">{{ message }}</p>
          <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
          <ul v-if="collections.length" class="board-grid">
            <li v-for="collection in collections" :key="collection.id" class="board-card">
              <NuxtLink class="board-preview" :class="{ 'is-empty': !collection.previewAssets.length }" :to="`/boards/${collection.id}`" :aria-label="`${['owner', 'editor', 'admin'].includes(collection.role) ? 'Edit' : 'Open'} ${collection.title}`"><div class="preview-strip"><template v-if="collection.previewAssets.length"><AssetMedia v-for="asset in collection.previewAssets" :key="asset.id" :src="asset.previewUrl" :mime-type="asset.mime_type" :width="asset.width" :height="asset.height" alt="" loading="lazy" /></template><span v-else>No items yet</span></div></NuxtLink>
              <div class="board-info"><div><label v-if="['owner', 'editor', 'admin'].includes(collection.role)" class="board-title"><span class="sr-only">Board name</span><textarea
:value="collection.title" rows="1" maxlength="120" :aria-describedby="`board-feedback-${collection.id}`"
                    :aria-invalid="boardFeedback[collection.id]?.error || undefined" @change="renameBoard(collection, $event)" /><span
:id="`board-feedback-${collection.id}`" class="field-message" :class="{ error: boardFeedback[collection.id]?.error }" role="status" aria-live="polite">{{ boardFeedback[collection.id]?.text }}</span></label><template v-else><strong>{{ collection.title }}</strong></template><span class="board-meta">{{ collection.role }} · {{ collection.purpose === 'review' ? 'submissions on' : collection.purpose === 'portfolio' ? 'portfolio' : collection.mode }} · {{ collection.publication_enabled ? 'public' : 'private' }}<template v-if="collection.expires_at"> · expires {{ new Date(collection.expires_at).toLocaleDateString() }}</template></span></div>
                <details class="action-menu board-menu" @keydown.esc.prevent="closeActionMenu"><summary aria-label="More board actions">•••</summary><div><a v-if="collection.publication_enabled" :href="collectionUrl(collection.slug)" target="_blank" rel="noopener noreferrer">View public page</a><button v-if="collection.publication_enabled" type="button" @click="copyLink(collection); closeActionMenu($event)">Copy public link</button><button v-if="['owner', 'editor', 'admin'].includes(collection.role)" type="button" :disabled="busy" @click="collection.publication_enabled ? revoke(collection) : publish(collection); closeActionMenu($event)">{{ collection.publication_enabled ? 'Disable public link' :'Enable public link' }}</button></div></details></div>
            </li>
          </ul>
          <div v-else-if="!errorMessage" class="empty-boards"><strong>No boards yet</strong><span>Create a board to collect or share work.</span></div>
        </section>
      </Transition>
    </div>
  </dialog>
  <SelectionPanel :visible="createPanelOpen" :label="props.portfolioOnly ? 'Create portfolio' : 'Create board'" wide overlay
    @close="close" @after-leave="finishPanelClose">
    <AssetFilterControls
      v-model:search="searchFilter" v-model:project-ids="projectIds" v-model:tag-ids="tagIds"
      v-model:date-range="range" v-model:date-from="dateFrom" v-model:date-to="dateTo"
      :projects="projects" :tags="tags" :heading="props.portfolioOnly ? 'Create portfolio' : 'Create board'"
      :description="props.portfolioOnly ? 'Start with the details, then add and arrange work.' : 'Name the board and choose what should appear in it.'"
      :show-asset-filters="purpose === 'showcase' && mode === 'dynamic'" :use-date-presets="purpose === 'showcase' && mode === 'dynamic'" expanded
      :actions-visible="true" @submit="createCollection">
      <template #before>
        <section class="filter-option-group"><h3 id="create-title-label">{{ props.portfolioOnly ? 'Portfolio name' : 'Board name' }}</h3><input ref="titleInput" v-model="title" class="panel-field" name="title" required maxlength="120" aria-labelledby="create-title-label"></section>
        <section
          v-if="!props.portfolioOnly"
          class="filter-option-group"
          role="group"
          aria-labelledby="create-board-submissions"
          aria-describedby="create-board-submissions-summary"
        >
          <h3 id="create-board-submissions">Collect submissions</h3>
          <div class="filter-option-list filter-option-list--segmented">
            <button type="button" :aria-pressed="!collectsSubmissions" @click="collectsSubmissions = false">Off</button>
            <button type="button" :aria-pressed="collectsSubmissions" @click="collectsSubmissions = true">On</button>
          </div>
          <p id="create-board-submissions-summary" class="board-type-summary">{{ collectsSubmissions ? 'Invited contributors can add work to this board.' : 'Build the board from approved work in your library.' }}</p>
        </section>
        <section v-if="purpose === 'portfolio'" class="filter-option-group" aria-labelledby="create-portfolio-type"><h3 id="create-portfolio-type">Portfolio type</h3><div class="filter-option-list filter-option-list--segmented"><button type="button" :aria-pressed="portfolioKind === 'main'" @click="portfolioKind = 'main'">Main portfolio</button><button type="button" :aria-pressed="portfolioKind === 'client'" @click="portfolioKind = 'client'">Client version</button></div><p class="board-type-summary">{{ portfolioKind === 'main' ? 'Your main selection of work.' : 'A tailored selection for one recipient.' }}</p></section>
        <section v-if="purpose === 'portfolio' && portfolioKind === 'client'" class="filter-option-group"><h3 id="create-client-label">Client or recipient</h3><input v-model="portfolioClient" class="panel-field" name="portfolio-client" required maxlength="120" placeholder="Acme Studio" aria-labelledby="create-client-label"></section>
        <section v-if="purpose === 'portfolio'" class="filter-option-group"><h3 id="create-introduction-label">Introduction</h3><textarea v-model="introduction" class="panel-field" name="introduction" rows="3" maxlength="2000" placeholder="A short note about this selection" aria-labelledby="create-introduction-label" /></section>
        <section v-if="usingCurrentFilters && purpose === 'showcase'" class="board-setting-group"><p class="board-type-summary"><strong>Starting with current filters</strong><br>{{ currentFilterLabels.join(' · ') || 'All dates' }}<br>{{ props.currentFilters?.status === 'draft' ? 'Draft status is not included because boards contain approved assets only.' : 'Boards contain approved assets only.' }}</p></section>
        <section v-if="purpose === 'showcase'" class="filter-option-group" aria-labelledby="create-board-updates"><h3 id="create-board-updates">Updates</h3><div class="filter-option-list filter-option-list--segmented"><button type="button" :aria-pressed="mode === 'static'" @click="mode = 'static'">Manual</button><button type="button" :aria-pressed="mode === 'dynamic'" @click="mode = 'dynamic'">Automatic</button></div><p class="board-type-summary">{{ mode === 'dynamic' ? 'Choose filters below. New approved items that match them appear automatically.' : usingCurrentFilters ? 'Create a fixed snapshot from the current view.' : 'Start with an empty board and add work manually.' }}</p></section>
      </template>
      <section v-if="purpose === 'review'" class="filter-option-group"><AppDatePicker v-model="reviewMonth" label="Submission month" precision="month" :clearable="false" surface="field" /></section>
      <section v-if="purpose === 'review'" class="filter-option-group"><AppDatePicker v-model="submissionDeadline" label="Submission deadline (optional)" surface="field" /></section>
      <section class="board-setting-group"><p class="board-type-summary">{{ purpose === 'review' ? 'This board starts private. Add contributors after creating it.' : purpose === 'portfolio' ? 'Your portfolio starts private. Add work and publish when it is ready.' : 'This board starts private. Publish it when it is ready.' }}</p></section>
      <section v-if="errorMessage" class="board-setting-group"><p class="board-type-summary error" role="alert">{{ errorMessage }}</p></section>
      <template #actions><button class="filter-create-board" type="submit" :disabled="busy">{{ busy ? 'Creating…' : purpose === 'portfolio' ? 'Create portfolio' : 'Create board' }}</button><button type="button" class="clear-filters-button" @click="close">Cancel</button></template>
    </AssetFilterControls>
    <button class="filter-panel-toggle is-expanded" type="button" :aria-label="props.portfolioOnly ? 'Close create portfolio' : 'Close create board'" aria-expanded="true" @click="close">
      <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
    </button>
  </SelectionPanel>
</template>

<style scoped>
.share-dialog {
  width: min(720px, calc(100% - var(--space) * 2));
  max-height: calc(100% - var(--space) * 2);
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
  background: var(--filter-overlay-backdrop-background);
  backdrop-filter: blur(var(--filter-overlay-blur));
  -webkit-backdrop-filter: blur(var(--filter-overlay-blur));
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

.preview-strip :is(img,video) {
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
  font-size: var(--font-size-label);
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
  font-size: var(--font-size-body-compact);
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
  font-size: var(--font-size-label);
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
    max-height: calc(100% - var(--space));
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
  .board-preview :is(img,video) {
    transition: none;
  }

  .panel-view-enter-active,
  .panel-view-leave-active {
    transition: none;
  }
}
</style>
