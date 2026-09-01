<script setup lang="ts">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'
import { ArrowDown, ArrowUp, Copy, ArrowUpRight } from 'reicon-vue'
import { boardLayoutOptions } from '../utils/board-layouts'

interface ContactLink { label: string; url: string }

const props = defineProps<{
  boardId: string
  slug: string
  title: string
  portfolioKind: 'main' | 'client' | null
  portfolioClient: string | null
  introduction: string | null
  contactHeading: string | null
  contactLinks: ContactLink[] | null
  layout: BoardLayout
  viewSettings: BoardViewSettings
  publicationEnabled: boolean
  canEdit: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  saved: []
  publicationChanged: [enabled: boolean]
  layoutChanged: [layout: BoardLayout]
  viewSettingsChanged: [viewSettings: BoardViewSettings]
  deleteRequested: []
}>()

const apiFetch = useRequestFetch()
const titleDraft = ref('')
const portfolioClientDraft = ref('')
const introductionDraft = ref('')
const contactHeadingDraft = ref('')
const contactLinkDrafts = ref<ContactLink[]>([])
const busy = ref(false)
const feedback = ref('')
const feedbackError = ref(false)
const layoutDraft = ref<BoardLayout>(props.layout)
const viewSettingsDraft = ref<BoardViewSettings>({ ...props.viewSettings })
const portfolioDestination = computed(() => props.publicationEnabled ? `/s/${props.slug}` : `/s/${props.slug}?preview=true`)
const portfolioDestinationLabel = computed(() => props.publicationEnabled ? 'Open published portfolio' : 'Preview portfolio')

const reset = () => {
  titleDraft.value = props.title
  portfolioClientDraft.value = props.portfolioClient ?? ''
  introductionDraft.value = props.introduction ?? ''
  contactHeadingDraft.value = props.contactHeading ?? ''
  contactLinkDrafts.value = Array.isArray(props.contactLinks) ? props.contactLinks.map(link => ({ ...link })) : []
  layoutDraft.value = props.layout
  viewSettingsDraft.value = { ...props.viewSettings }
  feedback.value = ''
  feedbackError.value = false
}

watch(() => props.boardId, reset, { immediate: true })
watch(() => props.layout, layout => { layoutDraft.value = layout })
watch(() => props.viewSettings, viewSettings => { viewSettingsDraft.value = { ...viewSettings } }, { deep: true })

let feedbackTimer: ReturnType<typeof setTimeout> | undefined
watch([feedback, feedbackError], ([message, isError]) => {
  clearTimeout(feedbackTimer)
  if (!message || isError) return
  feedbackTimer = setTimeout(() => { feedback.value = '' }, 2500)
})
onBeforeUnmount(() => clearTimeout(feedbackTimer))

const addContactLink = () => contactLinkDrafts.value.push({ label: '', url: '' })
const removeContactLink = (index: number) => contactLinkDrafts.value.splice(index, 1)
const moveContactLink = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (target < 0 || target >= contactLinkDrafts.value.length) return
  ;[contactLinkDrafts.value[index], contactLinkDrafts.value[target]] = [contactLinkDrafts.value[target]!, contactLinkDrafts.value[index]!]
}

const save = async () => {
  if (!props.canEdit) return
  const nextTitle = titleDraft.value.trim()
  if (!nextTitle) return
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    if (nextTitle !== props.title) {
      await apiFetch(`/api/shares/${props.boardId}`, { method: 'PATCH', body: { action: 'rename', title: nextTitle } })
    }
    await apiFetch(`/api/shares/${props.boardId}`, {
      method: 'PATCH',
      body: {
        action: 'portfolio-settings',
        portfolioKind: props.portfolioKind ?? 'main',
        portfolioClient: props.portfolioKind === 'client' ? portfolioClientDraft.value.trim() || null : null,
        introduction: introductionDraft.value.trim() || null,
        contactHeading: contactHeadingDraft.value.trim() || null,
        contactLinks: contactLinkDrafts.value.map(link => ({ label: link.label.trim(), url: link.url.trim() }))
      }
    })
    feedback.value = 'Portfolio details saved.'
    emit('saved')
  } catch {
    feedback.value = 'Unable to save portfolio details.'
    feedbackError.value = true
  } finally {
    busy.value = false
  }
}

const setPublication = async (enabled: boolean) => {
  if (!props.canEdit || busy.value || enabled === props.publicationEnabled) return
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    await apiFetch(`/api/shares/${props.boardId}`, { method: 'PATCH', body: { action: enabled ? 'publish' : 'revoke' } })
    emit('publicationChanged', enabled)
  } catch {
    feedback.value = 'Unable to update public access.'
    feedbackError.value = true
  } finally {
    busy.value = false
  }
}

const setLayout = async (layout: BoardLayout) => {
  if (!props.canEdit || busy.value || layout === layoutDraft.value) return
  const previousLayout = layoutDraft.value
  layoutDraft.value = layout
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    await apiFetch(`/api/shares/${props.boardId}`, { method: 'PATCH', body: { action: 'layout', layout } })
    feedback.value = 'Portfolio layout updated.'
    emit('layoutChanged', layout)
  } catch {
    layoutDraft.value = previousLayout
    feedback.value = 'Unable to update the portfolio layout.'
    feedbackError.value = true
  } finally {
    busy.value = false
  }
}

const setShowText = async (showText: boolean) => {
  if (!props.canEdit || busy.value || showText === viewSettingsDraft.value.showText) return
  const previousSettings = { ...viewSettingsDraft.value }
  const nextSettings = { ...viewSettingsDraft.value, showText }
  viewSettingsDraft.value = nextSettings
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    await apiFetch(`/api/shares/${props.boardId}`, {
      method: 'PATCH',
      body: { action: 'view-settings', viewSettings: nextSettings }
    })
    feedback.value = showText ? 'Card text shown.' : 'Card text hidden.'
    emit('viewSettingsChanged', nextSettings)
  } catch {
    viewSettingsDraft.value = previousSettings
    feedback.value = 'Unable to update card text.'
    feedbackError.value = true
  } finally {
    busy.value = false
  }
}

const copyLink = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/s/${props.slug}`)
  feedback.value = 'Public link copied.'
  feedbackError.value = false
}

defineExpose({ save, busy })
</script>

<template>
  <form id="portfolio-details-form" class="portfolio-settings portfolio-details-form" @submit.prevent="save">
    <section class="filter-option-group">
      <h2 class="filter-overlay-title">Portfolio details</h2>
      <p class="board-type-summary">{{ portfolioKind === 'client' ? portfolioClient ? `Client version for ${portfolioClient}.` : 'Client version.' : 'Main portfolio.' }}</p>
      <label class="sr-only" for="portfolio-name">Portfolio name</label>
      <input id="portfolio-name" v-model="titleDraft" class="panel-field" required maxlength="120" placeholder="Portfolio name" :disabled="!canEdit || busy">
    </section>

    <section v-if="portfolioKind === 'client'" class="filter-option-group">
      <h2 class="filter-overlay-title">Client or recipient</h2>
      <input v-model="portfolioClientDraft" class="panel-field" required maxlength="120" placeholder="Client or recipient" :disabled="!canEdit || busy">
    </section>

    <section class="filter-option-group">
      <h2 class="filter-overlay-title">Introduction</h2>
      <textarea v-model="introductionDraft" class="panel-field" rows="4" maxlength="2000" placeholder="A short note about this selection" :disabled="!canEdit || busy" />
    </section>

    <section class="filter-option-group contact-fields" aria-labelledby="portfolio-contact-title">
      <h2 id="portfolio-contact-title" class="filter-overlay-title">Contact</h2>
      <label>
        <span class="filter-option-label">Closing message</span>
        <input v-model="contactHeadingDraft" class="panel-field" maxlength="160" placeholder="Let’s work together" :disabled="!canEdit || busy">
      </label>
      <AppPanelRow v-for="(link, index) in contactLinkDrafts" :key="index" :title="link.label || `Link ${index + 1}`">
        <label><span class="filter-option-label">Link label</span><input v-model="link.label" class="panel-field" required maxlength="80" placeholder="Email" :disabled="busy"></label>
        <label><span class="filter-option-label">URL</span><input v-model="link.url" class="panel-field" required inputmode="url" placeholder="mailto:you@example.com" :disabled="busy"></label>
        <template #actions>
          <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === 0" :aria-label="`Move ${link.label || `link ${index + 1}`} earlier`" @click="moveContactLink(index, -1)"><ArrowUp :size="20" :stroke-width="1.75" aria-hidden="true" /></button>
          <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === contactLinkDrafts.length - 1" :aria-label="`Move ${link.label || `link ${index + 1}`} later`" @click="moveContactLink(index, 1)"><ArrowDown :size="20" :stroke-width="1.75" aria-hidden="true" /></button>
          <button class="panel-secondary-action" type="button" :disabled="busy" @click="removeContactLink(index)">Remove</button>
        </template>
      </AppPanelRow>
      <button v-if="canEdit" class="panel-secondary-action" type="button" :disabled="busy" @click="addContactLink">Add link</button>
    </section>

    <section class="filter-option-group" role="group" aria-labelledby="portfolio-layout-title">
      <h2 id="portfolio-layout-title" class="filter-overlay-title">Portfolio layout</h2>
      <p class="board-type-summary">Use one layout for every case in this portfolio.</p>
      <div class="filter-option-list filter-option-list--segmented">
        <button v-for="option in boardLayoutOptions" :key="option.value" type="button" :aria-pressed="layoutDraft === option.value" :disabled="!canEdit || busy" @click="setLayout(option.value)">{{ option.label }}</button>
      </div>
    </section>

    <BoardCardTextControl
      title-id="portfolio-card-text-title"
      :show-text="viewSettingsDraft.showText"
      :disabled="!canEdit || busy"
      @change="setShowText"
    />

    <section class="filter-option-group" role="group" aria-labelledby="portfolio-public-access">
      <div class="portfolio-public-heading">
        <h2 id="portfolio-public-access" class="filter-overlay-title">Public access</h2>
        <span class="portfolio-public-actions">
          <a class="panel-secondary-action panel-icon-action" :href="portfolioDestination" target="_blank" rel="noopener" :aria-label="portfolioDestinationLabel" :title="portfolioDestinationLabel"><ArrowUpRight :size="18" :stroke-width="2" aria-hidden="true" /></a>
          <button v-if="publicationEnabled" class="panel-secondary-action panel-icon-action" type="button" aria-label="Copy public link" title="Copy public link" @click="copyLink"><Copy :size="18" :stroke-width="2" aria-hidden="true" /></button>
        </span>
      </div>
      <p class="board-type-summary">{{ publicationEnabled ? 'Anyone with the link can view this portfolio.' : 'Preview saved changes before publishing.' }}</p>
      <div class="filter-option-list filter-option-list--segmented">
        <button type="button" :aria-pressed="!publicationEnabled" :disabled="!canEdit || busy" @click="setPublication(false)">Unpublished</button>
        <button type="button" :aria-pressed="publicationEnabled" :disabled="!canEdit || busy" @click="setPublication(true)">Published</button>
      </div>
    </section>

    <section v-if="portfolioKind === 'client' && canDelete" class="filter-option-group" aria-labelledby="delete-portfolio-version-title">
      <h2 id="delete-portfolio-version-title" class="filter-overlay-title">Delete client version</h2>
      <p class="board-type-summary">Permanently delete this version without changing the main portfolio.</p>
      <button class="panel-secondary-action panel-compact-action" type="button" :disabled="busy" @click="emit('deleteRequested')">Delete client version</button>
    </section>

    <AppStatusToast :message="feedback" :error="feedbackError" />
  </form>
</template>

<style scoped>
.portfolio-details-form { display: contents; }
.contact-fields, .contact-fields label { display: grid; gap: var(--filter-option-gap); }
.portfolio-public-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--filter-option-gap); }
.portfolio-public-actions { display: flex; gap: var(--filter-action-gap); }
.portfolio-public-heading .filter-overlay-title { flex: 1 1 auto; }
</style>
