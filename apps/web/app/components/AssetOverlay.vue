<script setup lang="ts">
import { Figma, Heart, MoreH, Search, X } from 'reicon-vue'
import { toTitleCase } from '~/utils/text'

const props = withDefaults(defineProps<{ assetId: string; assetIds?: string[]; previewUrl?: string; previewUrls?: Record<string, string> }>(), { assetIds: () => [], previewUrl: '', previewUrls: () => ({}) })
const emit = defineEmits<{ close: []; deleted: [id: string]; navigate: [id: string]; renamed: [id: string, title: string] }>()
interface AssetDetail { id: string; uploaded_by: string; title: string; description: string | null; width: number; height: number; file_size: number; mime_type: string; status: string; version: number; created_at: string; updated_at: string; figma_url: string; language: string | null; content_type: string | null; project_id: string | null; campaign_id: string | null; projects: { name: string } | null; campaigns: { name: string } | null; asset_tags: Array<{ tags: { id: string; name: string } | null }>; allowed_users: { figma_handle: string | null; avatar_url: string | null } | null; versions: Array<{ id: string; version: number; width: number; height: number; file_size: number; created_at: string }> }
interface SessionResponse { data: { authenticated: boolean; user?: { id: string; role: string } } }
interface Board { id: string; title: string; mode: 'dynamic' | 'static'; role: 'owner' | 'editor' | 'contributor' | 'viewer'; itemCount: number; previewAssets: Array<{ id: string; previewUrl: string; mime_type?: string | null; width: number; height: number }> }
interface Option { id: string; name: string }
const dialog = ref<HTMLDialogElement>()
const overlayContent = ref<HTMLElement>()
const assetVisual = ref<HTMLElement>()
const assetMore = ref<HTMLElement>()
const assetMoreTrigger = ref<HTMLButtonElement>()
const assetMoreMenu = ref<HTMLElement>()
const moreOpen = ref(false)
const { data, error, refresh } = await useLazyFetch<{ data: { asset: AssetDetail } }>(() => `/api/assets/${props.assetId}`)
const { data: previewData, execute: loadFullPreview } = await useLazyFetch<{ data: { id: string; url: string } }>(() => `/api/assets/${props.assetId}/preview`, { immediate: false })
const { data: session } = await useLazyFetch<SessionResponse>('/api/auth/session')
const { data: boardData, status: boardStatus, refresh: refreshBoards } = await useLazyFetch<{ data: { collections: Board[] } }>('/api/shares')
const boardCreator = ref<{ openCreate: () => Promise<void> }>()
const { data: projectData } = await useLazyFetch<{ data: { projects: Option[] } }>('/api/projects')
const { data: campaignData } = await useLazyFetch<{ data: { campaigns: Option[] } }>('/api/campaigns')
const fetchedAsset = computed(() => data.value?.data.asset)
const retainedAsset = shallowRef<AssetDetail>()
watch(fetchedAsset, next => { if (next) retainedAsset.value = next }, { immediate: true })
const asset = computed(() => fetchedAsset.value ?? retainedAsset.value)
const showInitialSkeleton = ref(!asset.value)
const skeletonRevealing = ref(false)
let skeletonTimer: ReturnType<typeof setTimeout> | undefined
watch(asset, async next => {
  if (!next || !showInitialSkeleton.value) return
  await nextTick()
  requestAnimationFrame(() => requestAnimationFrame(() => {
    skeletonRevealing.value = true
    skeletonTimer = setTimeout(() => {
      showInitialSkeleton.value = false
      skeletonRevealing.value = false
    }, 140)
  }))
}, { immediate: true })
const thumbnailPreviewUrl = computed(() => props.previewUrl || props.previewUrls[props.assetId] || '')
const displayedPreviewUrl = ref(thumbnailPreviewUrl.value)
watch(() => [props.assetId, thumbnailPreviewUrl.value], () => {
  displayedPreviewUrl.value = thumbnailPreviewUrl.value
}, { immediate: true, flush: 'sync' })
watch(() => previewData.value?.data, async (preview) => {
  if (!preview || preview.id !== props.assetId || !import.meta.client) return
  const requestedAssetId = props.assetId
  if (asset.value?.mime_type.startsWith('video/')) {
    displayedPreviewUrl.value = preview.url
    return
  }
  const image = new Image()
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to load preview.'))
  }).catch(() => undefined)
  image.src = preview.url
  try { await image.decode() } catch { await loaded }
  if (props.assetId === requestedAssetId && image.complete && image.naturalWidth > 0) displayedPreviewUrl.value = preview.url
}, { immediate: true })
const resolvedPreviewUrl = computed(() => displayedPreviewUrl.value || thumbnailPreviewUrl.value)
const role = computed(() => session.value?.data.user?.role)
const canEdit = computed(() => ['editor', 'admin'].includes(role.value ?? '') || (role.value === 'contributor' && asset.value?.uploaded_by === session.value?.data.user?.id))
const canApprove = computed(() => ['editor', 'admin'].includes(role.value ?? ''))
const canOpenBoardPicker = computed(() => {
  if (asset.value?.status !== 'approved') return false
  if (!session.value?.data.user) return true
  return ['editor', 'admin'].includes(role.value ?? '') || (role.value === 'contributor' && asset.value.uploaded_by === session.value.data.user.id)
})
const eligibleBoards = computed(() => (boardData.value?.data.collections ?? []).filter(board => board.mode === 'static' && ['owner', 'editor', 'contributor'].includes(board.role) && (board.role !== 'contributor' || asset.value?.uploaded_by === session.value?.data.user?.id)))
const boardSearch = ref('')
const filteredEligibleBoards = computed(() => {
  const term = boardSearch.value.trim().toLocaleLowerCase()
  return term ? eligibleBoards.value.filter(board => board.title.toLocaleLowerCase().includes(term)) : eligibleBoards.value
})
const assetIndex = computed(() => props.assetIds.indexOf(props.assetId))
const previousAssetId = computed(() => assetIndex.value > 0 ? props.assetIds[assetIndex.value - 1] : undefined)
const nextAssetId = computed(() => assetIndex.value >= 0 && assetIndex.value < props.assetIds.length - 1 ? props.assetIds[assetIndex.value + 1] : undefined)
const previousPreviewUrl = computed(() => previousAssetId.value ? props.previewUrls[previousAssetId.value] : undefined)
const nextPreviewUrl = computed(() => nextAssetId.value ? props.previewUrls[nextAssetId.value] : undefined)
const boardId = ref('')
const boardPickerOpen = ref(false)
const addingBoardId = ref('')
const editing = ref(false); const title = ref(''); const description = ref(''); const projectId = ref(''); const campaignId = ref(''); const tagsText = ref(''); const language = ref(''); const contentType = ref(''); const actionError = ref(''); const actionMessage = ref(''); const downloading = ref(false); const saving = ref(false); const titleSaving = ref(false); const approvalBusy = ref(false)
const isClosing = ref(false)
const isMobile = ref(false)
const gestureX = ref(0)
const gestureY = ref(0)
const gestureActive = ref(false)
const gestureSettling = ref(false)
const gestureAxis = ref<'x' | 'y' | ''>('')
let gesturePointerId: number | undefined
let gestureStartX = 0
let gestureStartY = 0
let swipeNavigationTarget = ''
let swipeTimer: ReturnType<typeof setTimeout> | undefined
let previousBodyOverflow = ''
let previousRootOverflow = ''
let scrollLocked = false
let closeTimer: ReturnType<typeof setTimeout> | undefined
let mobileQuery: MediaQueryList | undefined
const updateMobile = () => { isMobile.value = mobileQuery?.matches ?? false }
const closeMoreMenu = (restoreFocus = false) => {
  moreOpen.value = false
  if (restoreFocus) void nextTick(() => assetMoreTrigger.value?.focus())
}
const handleMoreMenuPointerDown = (event: PointerEvent) => {
  if (moreOpen.value && !assetMore.value?.contains(event.target as Node)) closeMoreMenu()
}
const menuItems = () => [...(assetMoreMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
const handleMoreMenuKeydown = (event: KeyboardEvent) => {
  const items = menuItems()
  if (!items.length) return
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  let next = current
  if (event.key === 'ArrowDown') next = (current + 1) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else return
  event.preventDefault()
  items[next]?.focus()
}
watch(moreOpen, async open => {
  if (!open) return
  await nextTick()
  menuItems()[0]?.focus()
})
const resetEditor = () => {
  if (!asset.value) return
  title.value = asset.value.title
  description.value = asset.value.description ?? ''
  projectId.value = asset.value.project_id ?? ''
  campaignId.value = asset.value.campaign_id ?? ''
  tagsText.value = asset.value.asset_tags.map(item => item.tags?.name).filter(Boolean).join(', ')
  language.value = asset.value.language ?? ''
  contentType.value = asset.value.content_type ?? ''
}
watch(asset, resetEditor, { immediate: true })
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
onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 760px)')
  updateMobile()
  mobileQuery.addEventListener('change', updateMobile)
  lockPageScroll()
  dialog.value?.showModal()
  document.addEventListener('pointerdown', handleMoreMenuPointerDown)
  if (!props.previewUrl || !isMobile.value) void loadFullPreview()
})
onBeforeUnmount(() => {
  clearTimeout(closeTimer)
  clearTimeout(swipeTimer)
  clearTimeout(skeletonTimer)
  mobileQuery?.removeEventListener('change', updateMobile)
  document.removeEventListener('pointerdown', handleMoreMenuPointerDown)
  unlockPageScroll()
})
const finishClose = () => {
  unlockPageScroll()
  dialog.value?.close()
  emit('close')
}
const close = () => {
  if (isClosing.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finishClose()
  isClosing.value = true
  closeTimer = setTimeout(finishClose, 180)
}
const patchAsset = async (body: Record<string, unknown>) => { actionError.value = ''; try { await $fetch(`/api/assets/${props.assetId}`, { method: 'PATCH', body }); await refresh(); editing.value = false; return true } catch { actionError.value = 'Unable to update this asset.'; return false } }
const toggleApproval = async () => {
  if (!asset.value || !canApprove.value || approvalBusy.value) return
  approvalBusy.value = true
  actionMessage.value = ''
  const approving = asset.value.status !== 'approved'
  const saved = await patchAsset({ status: approving ? 'approved' : 'draft' })
  if (saved) actionMessage.value = approving ? 'Asset approved.' : 'Approval removed.'
  approvalBusy.value = false
}
const startEditing = () => { resetEditor(); actionError.value = ''; actionMessage.value = ''; editing.value = true }
const cancelEditing = () => { resetEditor(); actionError.value = ''; editing.value = false }
const saveTitle = async () => {
  if (!asset.value || !canEdit.value || titleSaving.value) return
  const nextTitle = toTitleCase(title.value)
  if (!nextTitle) {
    title.value = asset.value.title
    return
  }
  if (nextTitle === asset.value.title) return
  const previousTitle = asset.value.title
  titleSaving.value = true
  actionError.value = ''
  asset.value.title = nextTitle
  emit('renamed', asset.value.id, nextTitle)
  try {
    await $fetch(`/api/assets/${asset.value.id}`, { method: 'PATCH', body: { title: nextTitle } })
    actionMessage.value = `${nextTitle} saved.`
  } catch {
    asset.value.title = previousTitle
    title.value = previousTitle
    emit('renamed', asset.value.id, previousTitle)
    actionError.value = 'Unable to rename this asset.'
  } finally {
    titleSaving.value = false
  }
}
const handleTitleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    ;(event.currentTarget as HTMLTextAreaElement).blur()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    title.value = asset.value?.title ?? ''
    ;(event.currentTarget as HTMLTextAreaElement).blur()
  }
}
const saveDetails = async () => {
  saving.value = true
  title.value = toTitleCase(title.value)
  const tags = [...new Set(tagsText.value.split(/[,\n]/).map(tag => tag.trim()).filter(Boolean))]
  try {
    const saved = await patchAsset({
      title: title.value,
      description: description.value.trim() || null,
      projectId: projectId.value || null,
      campaignId: campaignId.value || null,
      tags,
      language: language.value.trim() || null,
      contentType: contentType.value.trim() || null
    })
    if (saved) actionMessage.value = 'Asset details saved.'
  } finally { saving.value = false }
}
const download = async () => { if (!asset.value) return; downloading.value = true; try { const response = await $fetch<{ data: { url: string } }>(`/api/assets/${props.assetId}/download-url`, { method: 'POST' }); window.location.assign(response.data.url) } catch { actionError.value = 'Unable to prepare the download.' } finally { downloading.value = false } }
const remove = async () => { if (!confirm('Permanently delete this asset and every version?')) return; try { await $fetch(`/api/assets/${props.assetId}`, { method: 'DELETE' }); emit('deleted', props.assetId); close() } catch { actionError.value = 'Unable to delete this asset.' } }
const addToBoard = async (targetBoardId = boardId.value) => {
  if (!targetBoardId || addingBoardId.value) return
  actionError.value = ''
  actionMessage.value = ''
  addingBoardId.value = targetBoardId
  try {
    await $fetch(`/api/shares/${targetBoardId}/assets`, { method: 'POST', body: { assetId: props.assetId } })
    actionMessage.value = 'Added to board.'
    boardPickerOpen.value = false
  } catch { actionError.value = 'Unable to add this asset to the board.' }
  finally { addingBoardId.value = '' }
}
const formatBytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`
const navigateAsset = (id?: string) => {
  if (!id || editing.value) return
  actionError.value = ''
  actionMessage.value = ''
  boardId.value = ''
  boardPickerOpen.value = false
  emit('navigate', id)
}
const cancelOverlay = () => {
  if (boardPickerOpen.value) boardPickerOpen.value = false
  else close()
}
const openBoardPicker = () => {
  boardSearch.value = ''
  boardPickerOpen.value = true
}
const handleArrowNavigation = (event: KeyboardEvent, direction: -1 | 1) => {
  const target = event.target as HTMLElement | null
  if (editing.value || target?.matches('input, textarea, select, [contenteditable="true"]')) return
  const id = direction < 0 ? previousAssetId.value : nextAssetId.value
  if (!id) return
  event.preventDefault()
  navigateAsset(id)
}
const handleAssetNavigationKey = (event: KeyboardEvent) => {
  if (event.key === 'ArrowLeft') handleArrowNavigation(event, -1)
  if (event.key === 'ArrowRight') handleArrowNavigation(event, 1)
}
const gestureStyle = computed(() => ({
  transform: `translate3d(0, ${Math.max(0, gestureY.value)}px, 0)`,
  opacity: String(Math.max(.42, 1 - Math.max(0, gestureY.value) / 320)),
  '--swipe-x': `${gestureX.value}px`
}))
const assetVisualStyle = computed(() => {
  if (isMobile.value) return gestureStyle.value
  const thumbnail = thumbnailPreviewUrl.value
  const background = !thumbnail || asset.value?.mime_type.startsWith('video/') ? {} : {
    backgroundImage: `url(${JSON.stringify(thumbnail)})`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain'
  }
  return background
})
const startGesture = (event: PointerEvent) => {
  if (event.pointerType !== 'touch' || editing.value || gestureSettling.value) return
  gesturePointerId = event.pointerId
  gestureStartX = event.clientX
  gestureStartY = event.clientY
  gestureAxis.value = ''
  gestureActive.value = true
    ; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const moveGesture = (event: PointerEvent) => {
  if (!gestureActive.value || event.pointerId !== gesturePointerId) return
  const x = event.clientX - gestureStartX
  const y = event.clientY - gestureStartY
  if (!gestureAxis.value && Math.hypot(x, y) > 8) gestureAxis.value = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
  if (gestureAxis.value === 'x') {
    const hasDestination = x < 0 ? nextAssetId.value : previousAssetId.value
    gestureX.value = hasDestination ? x : x * .18
    gestureY.value = 0
  } else if (gestureAxis.value === 'y') {
    gestureX.value = 0
    gestureY.value = y
  }
}
const resetGesture = () => {
  clearTimeout(swipeTimer)
  swipeNavigationTarget = ''
  gestureSettling.value = false
  gestureActive.value = false
  gestureAxis.value = ''
  gesturePointerId = undefined
  gestureX.value = 0
  gestureY.value = 0
}
const revealDetails = () => overlayContent.value?.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
const finishGesture = (event: PointerEvent) => {
  if (!gestureActive.value || event.pointerId !== gesturePointerId) return
  const axis = gestureAxis.value
  const x = gestureX.value
  const y = gestureY.value
  gesturePointerId = undefined
  if (axis === 'y' && y > 90) return close()
  if (axis === 'y' && y < -56) { resetGesture(); return revealDetails() }
  const destination = x < 0 ? nextAssetId.value : previousAssetId.value
  if (axis === 'x' && Math.abs(x) > 56 && destination) {
    gestureActive.value = false
    gestureSettling.value = true
    gestureX.value = x < 0 ? -(assetVisual.value?.clientWidth ?? window.innerWidth) : (assetVisual.value?.clientWidth ?? window.innerWidth)
    swipeNavigationTarget = destination
    swipeTimer = setTimeout(() => completeSwipe(), 320)
    return
  }
  resetGesture()
}
const completeSwipe = () => {
  if (!gestureSettling.value || !swipeNavigationTarget) return
  clearTimeout(swipeTimer)
  navigateAsset(swipeNavigationTarget)
}
const finishSwipeTransition = (event: TransitionEvent) => {
  const target = event.target as HTMLElement
  if (event.propertyName !== 'transform' || !target.classList.contains('current-preview')) return
  completeSwipe()
}
watch(() => props.assetId, id => {
  if (!swipeNavigationTarget || id !== swipeNavigationTarget) return
  clearTimeout(swipeTimer)
  swipeNavigationTarget = ''
  gestureSettling.value = false
  gestureActive.value = true
  gestureAxis.value = ''
  gestureX.value = 0
  gestureY.value = 0
  nextTick(() => requestAnimationFrame(() => { gestureActive.value = false }))
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="asset-dialog" :class="{ 'is-closing': isClosing }" aria-label="Asset details"
      @cancel.prevent="cancelOverlay" @keydown="handleAssetNavigationKey">
      <main v-if="showInitialSkeleton" class="overlay-content overlay-loading"
        :class="{ 'is-revealing': skeletonRevealing }" role="status" aria-label="Loading asset details">
        <section class="asset-visual" :class="{ 'skeleton-visual': !resolvedPreviewUrl }" aria-hidden="true">
          <AssetMedia v-if="resolvedPreviewUrl" class="current-preview" :src="resolvedPreviewUrl" alt="" />
        </section>
        <aside class="skeleton-panel" aria-hidden="true">
          <span class="skeleton-line skeleton-title" />
          <div class="skeleton-actions"><span /><span /></div>
          <span class="skeleton-line skeleton-field" />
          <div class="skeleton-rows"><span v-for="index in 6" :key="index" /></div>
          <span class="skeleton-line skeleton-section" />
          <span class="skeleton-line skeleton-meta" />
        </aside>
      </main>
      <div v-if="error && !asset && !showInitialSkeleton" class="overlay-state" role="alert"><strong>Unable to load this
          asset.</strong><button @click="refresh()">Try again</button></div>
      <main v-if="asset" ref="overlayContent" class="overlay-content">
        <section ref="assetVisual" class="asset-visual"
          :class="{ 'skeleton-visual': !resolvedPreviewUrl, 'is-dragging': isMobile && gestureActive }"
          :style="assetVisualStyle" aria-describedby="mobile-gesture-hint" @pointerdown="startGesture"
          @pointermove="moveGesture" @pointerup="finishGesture" @pointercancel="resetGesture"
          @transitionend="finishSwipeTransition"><span id="mobile-gesture-hint" class="sr-only">Swipe left or right to
            browse assets. Pull down to close.</span><button class="pull-handle" type="button"
            aria-label="Close asset details" @pointerdown.stop @click="close" /><img
            v-if="isMobile && previousPreviewUrl" class="swipe-preview previous-preview" :src="previousPreviewUrl"
            alt="" draggable="false">
          <AssetMedia v-if="resolvedPreviewUrl" class="current-preview" :src="resolvedPreviewUrl"
            :mime-type="asset.mime_type" :alt="`Preview of ${asset.title}`" loading="eager" fetchpriority="high"
            draggable="false" /><img
            v-if="isMobile && nextPreviewUrl" class="swipe-preview next-preview" :src="nextPreviewUrl" alt=""
            draggable="false"><button class="details-hint" type="button" aria-label="Show asset details"
            @pointerdown.stop @click="revealDetails"><svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg><span>Details</span></button><button v-if="previousAssetId && !editing"
            class="asset-navigation previous" type="button" aria-label="Previous asset"
            @click.stop="navigateAsset(previousAssetId)"><svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg></button><button v-if="nextAssetId && !editing" class="asset-navigation next" type="button"
            aria-label="Next asset" @click.stop="navigateAsset(nextAssetId)"><svg viewBox="0 0 24 24"
              aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg></button>
        </section>
        <aside>
          <form v-if="editing" class="edit-form" @submit.prevent="saveDetails">
            <label>Title<input v-model="title" name="title" required maxlength="200"></label>
            <label>Description<textarea v-model="description" name="description" rows="4" maxlength="5000" /></label>
            <div class="edit-grid">
              <label>Project<select v-model="projectId" name="project">
                  <option value="">No project</option>
                  <option v-for="project in projectData?.data.projects ?? []" :key="project.id" :value="project.id">{{
                    project.name }}</option>
                </select></label>
              <label>Campaign<select v-model="campaignId" name="campaign">
                  <option value="">No campaign</option>
                  <option v-for="campaign in campaignData?.data.campaigns ?? []" :key="campaign.id"
                    :value="campaign.id">{{ campaign.name }}</option>
                </select></label>
              <label>Language<input v-model="language" name="language" maxlength="35" placeholder="English"></label>
              <label>Content type<input v-model="contentType" name="contentType" maxlength="80"
                  placeholder="Campaign image"></label>
            </div>
            <label>Tags<textarea v-model="tagsText" name="tags" rows="2" maxlength="4049"
                aria-describedby="tags-hint" /></label>
            <small id="tags-hint" class="field-hint">Separate tags with commas.</small>
            <div class="action-row"><button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes'
            }}</button><button class="button-secondary" type="button" :disabled="saving"
                @click="cancelEditing">Cancel</button></div>
          </form>
          <template v-else>
            <h1><textarea v-if="canEdit" v-model="title" class="asset-title-input" rows="1" maxlength="200"
                aria-label="Asset name" :disabled="titleSaving" @change="saveTitle"
                @keydown="handleTitleKeydown" /><span v-else>{{ asset.title }}</span></h1>
            <p v-if="asset.description" class="description">{{ asset.description }}</p>
          </template>
          <div v-if="!editing" class="primary-actions"><button v-if="canOpenBoardPicker"
              class="button board-picker-trigger" type="button" @click="openBoardPicker">Add</button>
              <button v-if="canApprove" class="button-secondary approval-toggle" type="button"
              :aria-pressed="asset.status === 'approved'"
              :aria-label="asset.status === 'approved' ? 'Remove approval' : 'Approve asset'"
              :title="asset.status === 'approved' ? 'Remove approval' : 'Approve asset'" :disabled="approvalBusy"
              @click="toggleApproval">
              <Heart :size="20" :weight="asset.status === 'approved' ? 'Filled' : 'Outline'" aria-hidden="true" />
            </button>
              <a
              class="button-secondary action-button" :href="asset.figma_url" target="_blank"
              rel="noopener noreferrer" aria-label="Open in Figma" title="Open in Figma"><Figma class="figma-mark" :size="18" aria-hidden="true" /></a>
            <div ref="assetMore" class="asset-more" @keydown.esc.stop.prevent="closeMoreMenu(true)">
              <button ref="assetMoreTrigger" class="button-secondary" type="button" aria-label="More asset actions" aria-haspopup="menu"
                :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
                <MoreH :size="20" aria-hidden="true" />
              </button>
              <Transition name="asset-menu">
                <div v-if="moreOpen" ref="assetMoreMenu" class="asset-more-menu" role="menu"
                  aria-label="Asset actions" @keydown="handleMoreMenuKeydown"><button role="menuitem" type="button"
                    :disabled="downloading" @click="closeMoreMenu(); download()">{{ downloading ? 'Preparing…' :
                    'Download' }}</button><button v-if="canEdit" role="menuitem" type="button"
                    @click="closeMoreMenu(); startEditing()">Edit details</button><button
                    v-if="canEdit && asset.status !== 'archived'" role="menuitem" type="button"
                    @click="closeMoreMenu(); patchAsset({ status: 'archived' })">Archive</button><button
                    v-if="role === 'admin'" class="danger-button" role="menuitem" type="button"
                    @click="closeMoreMenu(); remove()">Delete asset</button></div>
              </Transition>
            </div>
          </div>
          <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
          <p v-if="actionMessage" class="success" role="status">{{ actionMessage }}</p>
          <dl v-if="!editing">
            <div>
              <dt>Project</dt>
              <dd>{{ asset.projects?.name ?? '—' }}</dd>
            </div>
            <div>
              <dt>Campaign</dt>
              <dd>{{ asset.campaigns?.name ?? '—' }}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{{ asset.width }} × {{ asset.height }}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>{{ asset.mime_type.replace('image/', '').toUpperCase() }} · {{ formatBytes(asset.file_size) }}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{{ asset.language ?? '—' }}</dd>
            </div>
            <div>
              <dt>Content type</dt>
              <dd>{{ asset.content_type ?? '—' }}</dd>
            </div>
            <div>
              <dt>Uploaded by</dt>
              <dd class="uploader-info">
                <img v-if="asset.allowed_users?.avatar_url" :src="asset.allowed_users.avatar_url" alt="">
                <span>{{ asset.allowed_users?.figma_handle ?? 'Unknown' }}</span>
              </dd>
            </div>
          </dl>
          <section v-if="!editing && asset.asset_tags.some(item => item.tags)" class="meta-section">
            <ul class="meta-tags" aria-label="Asset tags">
              <li v-for="item in asset.asset_tags" v-show="item.tags" :key="item.tags?.id">
                {{ item.tags?.name }}
              </li>
            </ul>
          </section>

        </aside>
      </main>
      <section v-if="boardPickerOpen" class="board-picker" role="dialog" aria-modal="true"
        aria-labelledby="board-picker-title">
        <header>
          <h2 id="board-picker-title">Add to board</h2>
        </header>
        <label class="board-picker-search">
          <Search :size="22" aria-hidden="true" /><span class="sr-only">Search boards</span><input v-model="boardSearch"
            type="search" placeholder="Search" autofocus>
        </label>
        <div class="board-picker-list">
          <button v-for="board in filteredEligibleBoards" :key="board.id" class="board-picker-option" type="button"
            :disabled="Boolean(addingBoardId)" :aria-label="`Add asset to ${board.title}`"
            @click="addToBoard(board.id)">
            <span class="board-picker-preview" :class="{ 'is-empty': !board.previewAssets.length }">
              <AssetMedia v-if="board.previewAssets[0]" :src="board.previewAssets[0].previewUrl"
                :mime-type="board.previewAssets[0].mime_type" alt="" loading="lazy" /><span v-else aria-hidden="true" />
            </span>
            <span class="board-picker-info"><strong>{{ board.title }}</strong><span>{{ addingBoardId === board.id ?
              'Adding…' :
              `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}` }}</span></span>
          </button>
          <p v-if="boardStatus === 'pending'" class="board-picker-empty">Loading boards…</p>
          <p v-else-if="!filteredEligibleBoards.length" class="board-picker-empty">No boards found</p>
        </div>
        <footer class="board-picker-footer"><button class="button" type="button"
            @click="boardCreator?.openCreate()">Create
            board</button><button class="button-secondary board-picker-cancel" type="button"
            aria-label="Close board picker" @click="boardPickerOpen = false">
            <X :size="20" aria-hidden="true" />
          </button>
          <ShareCollection ref="boardCreator" hide-trigger @created="refreshBoards" />
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.asset-dialog {
  --asset-overlay-fg: rgb(0 0 0 / .82);
  --asset-overlay-muted: rgb(0 0 0 / .5);
  --asset-overlay-divider: rgb(0 0 0 / .14);
  width: 100%;
  max-width: none;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--asset-overlay-fg);
  background: transparent;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  overflow: visible;
  overscroll-behavior: contain;
  transform: translateY(0);
  transition-property: transform, opacity;
  transition-duration: .26s, .2s;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1), ease-out
}

.asset-dialog::before {
  content: '';
  position: fixed;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  background: rgb(255 255 255 / .72);
  backdrop-filter: blur(var(--filter-overlay-blur));
  -webkit-backdrop-filter: blur(var(--filter-overlay-blur))
}

.overlay-content {
  position: relative;
  z-index: 1
}

.asset-dialog::backdrop {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition-property: background-color, backdrop-filter;
  transition-duration: .2s;
  transition-timing-function: ease-out
}

.asset-dialog.is-closing {
  opacity: 0;
  transform: translateY(12px);
  transition-duration: .18s
}

.asset-dialog.is-closing::backdrop {
  background: transparent;
  backdrop-filter: blur(0)
}

@starting-style {
  .asset-dialog[open] {
    opacity: 0;
    transform: translateY(18px)
  }

  .asset-dialog[open]::backdrop {
    background: transparent;
    backdrop-filter: blur(0)
  }
}

.asset-dialog .muted {
  color: var(--asset-overlay-muted)
}

.overlay-content {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(18rem, .5fr);
  gap: calc(var(--space)*2);
  padding: var(--page-padding);
  overflow: visible
}

.asset-visual {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--bg);
  border-radius: var(--radius);
  clip-path: inset(0 round var(--radius));
  overflow: hidden;
  transition-property: transform, opacity;
  transition-duration: .24s;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.asset-visual.is-dragging {
  transition-duration: 0s
}

.pull-handle {
  display: none
}

.details-hint {
  display: none
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

.asset-visual :is(img, video) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: contain
}

.swipe-preview {
  display: none
}

.skeleton-visual,
.skeleton-line,
.skeleton-actions span,
.skeleton-rows span {
  background: var(--color-surface);
  opacity: .4;
}

.skeleton-panel {
  display: grid;
  align-content: start;
  gap: var(--space);
}

@media(min-width:761px) {
  .overlay-loading {
    position: absolute;
    z-index: 1;
    inset: 0;
    background: transparent;
    opacity: 1;
    transition: opacity 140ms ease-out;
    pointer-events: none;
  }

  .overlay-loading.is-revealing {
    opacity: 0;
  }
}

.skeleton-line {
  display: block;
  min-height: 16px;
  border-radius: var(--radius);
}

.skeleton-status {
  width: 24%;
}

.skeleton-title {
  width: 72%;
  min-height: clamp(48px, 5vw, 72px);
}

.skeleton-actions {
  display: flex;
  gap: calc(var(--space) / 2);
}

.skeleton-actions span {
  width: 118px;
  min-height: 44px;
  border-radius: 999px;
}

.skeleton-actions span:last-child {
  width: 142px;
}

.skeleton-field {
  width: 100%;
  min-height: 42px;
  margin-top: var(--space);
}

.skeleton-rows {
  display: grid;
  margin-top: var(--space);
}

.skeleton-rows span {
  min-height: 44px;
  border-bottom: 1px solid var(--color-bg);
}

.skeleton-section {
  width: 32%;
  margin-top: var(--space);
}

.skeleton-meta {
  width: 48%;
}

.asset-navigation {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 44px;
  min-height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  color: var(--color-fg);
  background: color-mix(in srgb, var(--color-bg) 86%, transparent);
  box-shadow: 0 2px 10px rgb(0 0 0 / .14);
  opacity: .72;
  translate: 0 -50%;
  transition-property: opacity, scale;
  transition-duration: 120ms;
}

.asset-navigation:hover,
.asset-navigation:focus-visible {
  opacity: 1;
}

.asset-navigation:active {
  scale: .96;
}

.asset-navigation.previous {
  left: calc(var(--space) / 2);
}

.asset-navigation.next {
  right: calc(var(--space) / 2);
}

.asset-navigation svg {
  width: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

aside {
  min-height: 0;
  padding-right: var(--space);
  padding-bottom: calc(var(--space)*2);
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow: visible;
}

.asset-status {
  color: var(--asset-overlay-muted);
  text-transform: capitalize
}

h1 {
  /* margin: .3em 0 */
  font-size: calc(var(--font-size-h2)/1.25)
}

.asset-title-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: calc(1lh + .22em);
  margin-block: -.08em -.14em;
  padding-block: .08em .14em;
  padding-inline: 0;
  overflow: hidden;
  resize: none;
  border: 0;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  field-sizing: content;
}

.asset-title-input:focus {
  border-bottom-color: currentColor;
  outline: 0;
}

.asset-title-input:disabled {
  opacity: var(--muted);
}

.description {
  max-width: 38rem;
  color: var(--asset-overlay-muted);
  line-height: 1.35
}

.primary-actions,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--filter-action-gap);
  margin: var(--space) 0;
}

.primary-actions {
  flex-wrap: nowrap
}

.primary-actions> :first-child,
.action-row> :first-child {
  margin-left: -2px
}

.primary-actions>.button,
.primary-actions>.action-button.action-button,
.primary-actions>.approval-toggle,
.primary-actions>.asset-more,
.primary-actions>.asset-more>button {
  box-sizing: border-box;
  height: var(--control-height);
  min-height: var(--control-height);
}

.primary-actions>.button,
.primary-actions>.action-button.action-button,
.primary-actions>.approval-toggle,
.primary-actions>.asset-more>button {
  margin: 0;
  border: 0;
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
  box-shadow: none;
  opacity: 1;
  backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  transition:
    scale 150ms ease-out,
    background-color 150ms ease-out;
}

@media (hover: hover) and (pointer: fine) {

  .primary-actions>.button:hover,
  .primary-actions>.action-button.action-button:hover,
  .primary-actions>.approval-toggle:hover,
  .primary-actions>.asset-more>button:hover {
    color: var(--filter-overlay-panel-color);
    background: var(--filter-overlay-control-hover-background);
    opacity: 1;
  }
}

.primary-actions>.action-button.action-button {
  margin-left: 0;
  width: var(--control-height);
  min-width: var(--control-height);
  padding: 0
}

.primary-actions .figma-mark {
  flex: 0 0 auto;
  transform: translateY(-1px)
}

.approval-toggle {
  width: var(--control-height);
  min-width: var(--control-height);
  padding: 0;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center
}

.asset-more {
  position: relative
}

.asset-more>button {
  width: var(--control-height);
  height: var(--control-height);
  min-height: var(--control-height);
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  cursor: pointer
}

.asset-more-menu {
  position: absolute;
  z-index: 5;
  right: 0;
  top: calc(100% + var(--filter-action-gap));
  min-width: 12rem;
  display: grid;
  gap: calc(var(--space) / 8);
  padding: calc(var(--space) / 4);

  border-radius: var(--radius);
  color: var(--material-tinted-fg);
  background: var(--material-tinted-bg);
  box-shadow: 0 calc(var(--space) / 2) calc(var(--space) * 2) rgb(0 0 0/.14);
  backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation))
}

.asset-more-menu>button {
  width: 100%;
  min-height: var(--control-height);
  margin: 0;
  padding-inline: calc(var(--space) / 2);
  justify-content: flex-start;
  border-radius: calc(var(--radius) - var(--space) / 4);
  color: inherit;
  background: transparent;
  text-align: left;
  opacity: 1;
}

.asset-more-menu>button:is(:hover,:focus-visible) {
  color: inherit;
  background: var(--material-tinted-hover-bg);
  opacity: 1;
}

.asset-more-menu>.danger-button {
  color: var(--color-danger);
  background: transparent
}

.asset-more-menu>.danger-button:is(:hover,:focus-visible) {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent)
}

.asset-menu-enter-active,
.asset-menu-leave-active {
  transition-property: opacity, translate, scale;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
  transform-origin: top right;
}

.asset-menu-enter-from,
.asset-menu-leave-to {
  opacity: 0;
  translate: 0 calc(var(--space) / -4);
  scale: .98;
}

@media (prefers-reduced-motion: reduce) {
  .asset-menu-enter-active,
  .asset-menu-leave-active {
    transition-property: opacity;
  }

  .asset-menu-enter-from,
  .asset-menu-leave-to {
    translate: none;
    scale: 1;
  }
}

.danger-button {
  color: var(--color-danger)
}

.error {
  color: var(--color-danger)
}

.success {
  color: var(--asset-overlay-muted)
}

.board-picker-trigger {
  margin-bottom: var(--space)
}

.board-picker {
  position: fixed;
  z-index: 20;
  inset: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: var(--space);
  padding: var(--space);
  color: var(--color-fg);
  background: var(--color-bg);
  overflow: hidden
}

.board-picker header {
  display: flex;
  align-items: center;
  justify-content: center
}

.board-picker h2 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1;
  text-align: center;
  white-space: nowrap
}

.board-picker-search,
.board-picker-list,
.board-picker-footer {
  width: min(100%, 40rem);
  justify-self: center
}

.board-picker-search {
  height: calc(var(--control-height) + var(--space) / 2);
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: calc(var(--space) / 2);
  box-sizing: border-box;
  margin: 0;
  padding-inline: var(--space);
  border-radius: calc(var(--control-height) + var(--space));
  background: var(--color-surface);
  color: var(--color-muted)
}

.board-picker-search input {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-fg);
  font: inherit
}

.board-picker-search input::placeholder {
  color: var(--color-muted)
}

.board-picker-search input:focus {
  outline: 0
}

.board-picker-search input::-webkit-search-cancel-button {
  appearance: none
}

.board-picker-list {
  align-content: start;
  overflow-y: auto;
  overscroll-behavior: contain
}

.board-picker-option {
  width: 100%;
  min-height: calc(var(--control-height) + var(--space) * 2);
  display: grid;
  grid-template-columns: calc(var(--control-height) + var(--space) / 2) minmax(0, 1fr);
  align-items: center;
  gap: var(--space);
  padding: calc(var(--space) / 2);
  color: var(--color-fg);
  background: transparent;
  text-align: left;
  border-radius: var(--radius);
}

.board-picker-option:hover {
  opacity: 1;
  background: var(--color-surface)
}

.board-picker-preview {
  width: calc(var(--control-height) + var(--space) / 2);
  height: calc(var(--control-height) + var(--space) / 2);
  display: block;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-surface)
}

.board-picker-preview :is(img, video) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover
}

.board-picker-preview.is-empty span {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-surface)
}

.board-picker-info {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space)
}

.board-picker-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.board-picker-info>span {
  flex: 0 0 auto;
  color: var(--color-muted)
}

.board-picker-empty {
  color: var(--color-muted);
  text-align: center
}

.board-picker-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: calc(var(--space) / 2);
  padding-top: var(--space);
  background: var(--color-bg)
}

.board-picker-footer>button {
  min-height: calc(var(--control-height) + var(--space) / 2);
  padding-inline: calc(var(--space) * 1.5)
}

.board-picker-footer>.board-picker-cancel {
  width: calc(var(--control-height) + var(--space) / 2);
  padding: 0
}

.board-picker-cancel svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.1;
  stroke-linecap: round
}

label {
  display: block;
  margin-top: var(--space);
  color: var(--asset-overlay-muted)
}

.edit-form {
  display: grid;
  gap: var(--space);
}

.edit-form label {
  margin: 0;
}

.edit-form .action-row {
  margin: 0;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space);
}

.field-hint {
  margin-top: calc(var(--space) * -1);
  color: var(--asset-overlay-muted);
}

input,
textarea,
.edit-form select {
  width: 100%;
  padding: 10px 0
}

.edit-form select {
  min-height: 44px;
}

dl {
  margin-top: calc(var(--space)*2);
  border-top: 1px solid var(--asset-overlay-divider)
}

dl div {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: var(--space);
  padding: 10px 0;
  border-bottom: 1px solid var(--asset-overlay-divider)
}

dt {
  color: var(--asset-overlay-muted)
}

dd {
  margin: 0
}

.uploader-info {
  display: flex;
  align-items: center;
  gap: calc(var(--space) / 3)
}

.uploader-info img {
  width: calc(var(--control-height) * .5);
  height: calc(var(--control-height) * .5);
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
  outline: 1px solid oklch(0 0 0 / .1)
}

.meta-section {
  margin-top: calc(var(--space)*2)
}

h2 {
  font-size: 1rem
}

.meta-section p {
  color: var(--asset-overlay-muted)
}

.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--space) / 3);
  margin: 0;
  padding: 0;
  list-style: none
}

.meta-tags li {
  min-height: calc(var(--control-height) * .75);
  display: inline-flex;
  align-items: center;
  padding-inline: calc(var(--space) / 2);
  border: 1px solid var(--asset-overlay-divider);
  border-radius: 999px;
  color: var(--asset-overlay-fg);
  font-size: .875rem;
  line-height: 1
}

ol {
  padding: 0;
  list-style: none
}

li {
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  padding: 8px 0
}

li span {
  color: var(--asset-overlay-muted)
}

.overlay-state {
  min-height: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space)
}

@media(max-width:760px) {
  .asset-dialog {
    --asset-overlay-fg: var(--color-fg);
    --asset-overlay-muted: var(--color-muted);
    --asset-overlay-divider: rgb(0 0 0 / .16);
    color: var(--asset-overlay-fg);
    background: var(--color-bg);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    grid-template-rows: minmax(0, 1fr)
  }

  .asset-dialog::before {
    background: var(--color-bg);
    backdrop-filter: none;
    -webkit-backdrop-filter: none
  }

  .overlay-content {
    height: 100dvh;
    display: block;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-x: none;
    overscroll-behavior-y: none;
    touch-action: pan-y
  }

  .asset-visual {
    width: 100%;
    height: 100dvh;
    border-radius: 0;
    background: var(--color-bg);
    clip-path: none;
    touch-action: none;
    user-select: none
  }

  .asset-visual :is(img, video) {
    padding: max(calc(var(--space)*3), env(safe-area-inset-top)) var(--space) max(calc(var(--space)*3), env(safe-area-inset-bottom));
    border-radius: var(--radius-mobile);
    object-fit: contain;
    object-position: 50% calc(50% - 2dvh);
    pointer-events: none;
    transition: transform .22s cubic-bezier(.2, 0, 0, 1)
  }

  .asset-visual.is-dragging img {
    transition-duration: 0s
  }

  .asset-visual .current-preview {
    transform: translate3d(var(--swipe-x), 0, 0);
    view-transition-name: asset-preview
  }

  .asset-visual .swipe-preview {
    display: block
  }

  .asset-visual .previous-preview {
    transform: translate3d(calc(-100% + var(--swipe-x)), 0, 0)
  }

  .asset-visual .next-preview {
    transform: translate3d(calc(100% + var(--swipe-x)), 0, 0)
  }

  .pull-handle {
    position: absolute;
    z-index: 4;
    top: max(calc(var(--space) / 2), env(safe-area-inset-top));
    left: 50%;
    width: 44px;
    height: 44px;
    min-height: 44px;
    display: block;
    padding: 0;
    background: transparent;
    translate: -50% 0
  }

  .pull-handle::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 0;
    width: 44px;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-fg) 34%, transparent)
  }

  .details-hint {
    position: absolute;
    z-index: 4;
    bottom: max(var(--space), env(safe-area-inset-bottom));
    left: 50%;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 16px;
    color: var(--color-muted);
    background: transparent;
    translate: -50% 0
  }

  .details-hint svg {
    width: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round
  }

  .details-hint span {
    font-size: 12px
  }

  .asset-navigation {
    display: none
  }

  .overlay-content>aside,
  .skeleton-panel {
    min-height: 100dvh;
    display: block;
    box-sizing: border-box;
    padding: calc(var(--space)*2) var(--space) max(calc(var(--space)*3), env(safe-area-inset-bottom));
    color: var(--color-fg);
    background: var(--color-bg);
    overflow: visible
  }

  .skeleton-panel {
    display: grid
  }

  h1 {
    font-size: clamp(2rem, 10vw, 3rem)
  }

  .board-picker {
    padding: max(var(--space), env(safe-area-inset-top)) var(--space) max(var(--space), env(safe-area-inset-bottom))
  }
}

:global(::view-transition-group(asset-preview)) {
  z-index: 10000;
  animation-duration: .32s;
  animation-timing-function: cubic-bezier(.2, 0, 0, 1)
}

:global(::view-transition-old(root)),
:global(::view-transition-new(root)) {
  animation: none;
  mix-blend-mode: normal
}

:global(::view-transition-old(asset-preview)),
:global(::view-transition-new(asset-preview)) {
  animation-duration: .32s;
  animation-timing-function: cubic-bezier(.2, 0, 0, 1);
  mix-blend-mode: normal
}

@media(prefers-reduced-motion:reduce) {

  .asset-dialog,
  .asset-dialog::backdrop,
  .asset-navigation {
    transition-duration: .01ms
  }

  .asset-visual {
    transition-duration: .01ms
  }
}
</style>
