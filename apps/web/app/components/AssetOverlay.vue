<script setup lang="ts">
const props = defineProps<{ assetId: string }>()
const emit = defineEmits<{ close: []; deleted: [id: string] }>()
interface AssetDetail { id: string; uploaded_by: string; title: string; description: string | null; previewUrl: string; width: number; height: number; file_size: number; mime_type: string; status: string; version: number; created_at: string; updated_at: string; figma_url: string; language: string | null; content_type: string | null; project_id: string | null; campaign_id: string | null; projects: { name: string } | null; campaigns: { name: string } | null; asset_tags: Array<{ tags: { id: string; name: string } | null }>; allowed_users: { figma_handle: string | null } | null; versions: Array<{ id: string; version: number; width: number; height: number; file_size: number; created_at: string }> }
interface SessionResponse { data: { authenticated: boolean; user?: { id: string; role: string } } }
interface Board { id:string; title:string; mode:'dynamic'|'static'; role:'owner'|'editor'|'contributor'|'viewer' }
interface Option { id:string; name:string }
const dialog = ref<HTMLDialogElement>()
const { data, status, error, refresh } = await useFetch<{ data: { asset: AssetDetail } }>(() => `/api/assets/${props.assetId}`)
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const { data: boardData } = await useFetch<{data:{collections:Board[]}}>('/api/shares')
const { data: projectData } = await useFetch<{data:{projects:Option[]}}>('/api/projects')
const { data: campaignData } = await useFetch<{data:{campaigns:Option[]}}>('/api/campaigns')
const asset = computed(() => data.value?.data.asset)
const role = computed(() => session.value?.data.user?.role)
const canEdit = computed(() => ['editor', 'admin'].includes(role.value ?? '') || (role.value === 'contributor' && asset.value?.uploaded_by === session.value?.data.user?.id))
const canApprove = computed(() => ['editor', 'admin'].includes(role.value ?? ''))
const eligibleBoards = computed(() => (boardData.value?.data.collections ?? []).filter(board => board.mode==='static' && ['owner','editor','contributor'].includes(board.role) && (board.role!=='contributor' || asset.value?.uploaded_by===session.value?.data.user?.id)))
const boardId = ref('')
const editing = ref(false); const title = ref(''); const description = ref(''); const projectId = ref(''); const campaignId = ref(''); const tagsText = ref(''); const language = ref(''); const contentType = ref(''); const actionError = ref(''); const actionMessage = ref(''); const downloading = ref(false); const saving = ref(false)
const isClosing = ref(false)
let previousBodyOverflow = ''
let previousRootOverflow = ''
let scrollLocked = false
let closeTimer: ReturnType<typeof setTimeout> | undefined
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
onMounted(() => { lockPageScroll(); dialog.value?.showModal() })
onBeforeUnmount(() => { clearTimeout(closeTimer); unlockPageScroll() })
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
const startEditing = () => { resetEditor(); actionError.value = ''; actionMessage.value = ''; editing.value = true }
const cancelEditing = () => { resetEditor(); actionError.value = ''; editing.value = false }
const saveDetails = async () => {
  saving.value = true
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
const addToBoard = async () => { if(!boardId.value)return; actionError.value=''; actionMessage.value=''; try { await $fetch(`/api/shares/${boardId.value}/assets`,{method:'POST',body:{assetId:props.assetId}}); actionMessage.value='Added to board.' } catch { actionError.value='Unable to add this asset to the board.' } }
const formatBytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`
</script>

<template>
  <Teleport to="body">
    <dialog
ref="dialog" class="asset-dialog" :class="{ 'is-closing': isClosing }"
      aria-labelledby="asset-overlay-title" @cancel.prevent="close">
      <div class="overlay-toolbar"><span id="asset-overlay-title">Asset details</span><span v-if="asset" class="muted">Version {{ asset.version
          }}</span><button
class="close-button" type="button" aria-label="Close asset details" autofocus
          @click="close"><svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg></button></div>
      <div v-if="status === 'pending'" class="overlay-state" role="status">Loading asset…</div>
      <div v-else-if="error" class="overlay-state" role="alert"><strong>Unable to load this asset.</strong><button
          @click="refresh()">Try again</button></div>
      <main v-else-if="asset" class="overlay-content">
        <section class="asset-visual"><img :src="asset.previewUrl" :alt="`Preview of ${asset.title}`"></section>
        <aside>
          <span class="asset-status">{{ asset.status }}</span>
          <form v-if="editing" class="edit-form" @submit.prevent="saveDetails">
            <label>Title<input v-model="title" name="title" required maxlength="200"></label>
            <label>Description<textarea v-model="description" name="description" rows="4" maxlength="5000" /></label>
            <div class="edit-grid">
              <label>Project<select v-model="projectId" name="project"><option value="">No project</option><option v-for="project in projectData?.data.projects ?? []" :key="project.id" :value="project.id">{{ project.name }}</option></select></label>
              <label>Campaign<select v-model="campaignId" name="campaign"><option value="">No campaign</option><option v-for="campaign in campaignData?.data.campaigns ?? []" :key="campaign.id" :value="campaign.id">{{ campaign.name }}</option></select></label>
              <label>Language<input v-model="language" name="language" maxlength="35" placeholder="English"></label>
              <label>Content type<input v-model="contentType" name="contentType" maxlength="80" placeholder="Campaign image"></label>
            </div>
            <label>Tags<textarea v-model="tagsText" name="tags" rows="2" maxlength="4049" aria-describedby="tags-hint" /></label>
            <small id="tags-hint" class="field-hint">Separate tags with commas.</small>
            <div class="action-row"><button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button><button class="button-secondary" type="button" :disabled="saving" @click="cancelEditing">Cancel</button></div>
          </form>
          <template v-else>
            <h1>{{ asset.title }}</h1>
            <p v-if="asset.description" class="description">{{ asset.description }}</p>
          </template>
          <div v-if="!editing" class="primary-actions"><button :disabled="downloading" @click="download">{{
            downloading ? 'Preparing…' :'Download'
              }}</button><a
class="button button-secondary" :href="asset.figma_url" target="_blank"
              rel="noopener noreferrer">Open in
              Figma</a></div>
          <div v-if="!editing && asset.status==='approved' && eligibleBoards.length" class="board-action"><label><span>Add to board</span><select v-model="boardId"><option value="">Choose a static board</option><option v-for="board in eligibleBoards" :key="board.id" :value="board.id">{{ board.title }}</option></select></label><button class="button-secondary" type="button" :disabled="!boardId" @click="addToBoard">Add</button></div>
          <div v-if="!editing && canEdit" class="manage-actions"><button class="button-secondary" type="button" @click="startEditing">Edit details</button><button
v-if="canApprove && asset.status !== 'approved'" class="button-secondary" type="button"
              @click="patchAsset({ status: 'approved' })">Approve</button><button
v-if="asset.status !== 'archived'"
              class="button-secondary" type="button" @click="patchAsset({ status: 'archived' })">Archive</button><button
v-if="role === 'admin'"
              class="button-secondary danger-button" type="button" @click="remove">Delete asset</button></div>
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
              <dd>{{ asset.allowed_users?.figma_handle ?? 'Unknown' }}</dd>
            </div>
          </dl>
          <section v-if="!editing" class="meta-section">
            <h2>Tags</h2>
            <p>{{asset.asset_tags.map(item => item.tags?.name).filter(Boolean).join(', ') || 'No tags'}}</p>
          </section>
          <section class="meta-section">
            <h2>Version history</h2>
            <ol>
              <li v-for="item in asset.versions" :key="item.id"><strong>Version {{ item.version }}</strong><span>{{
                  item.width }}
                  × {{ item.height }} · {{ new Date(item.created_at).toLocaleDateString() }}</span></li>
            </ol>
          </section>
        </aside>
      </main>
    </dialog>
  </Teleport>
</template>

<style scoped>
.asset-dialog {
  width: 100%;
  max-width: none;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--color-fg);
  background: var(--color-bg);
  box-shadow: 0 24px 80px rgb(0 0 0/.18);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: visible;
  overscroll-behavior: contain;
  transform: translateY(0);
  transition-property: transform, opacity;
  transition-duration: .26s, .2s;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1), ease-out
}

.asset-dialog::backdrop {
  background: rgb(0 0 0/.24);
  backdrop-filter: blur(3px);
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

.overlay-toolbar {
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: center;
  gap: var(--space);
  min-height: calc(44px + var(--space)*2);
  padding: var(--space);
  background: rgb(255 255 255/.94);
  backdrop-filter: blur(12px)
}

.close-button {
  width: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  color: #000;
  background: var(--color-surface)
}

.close-button svg {
  width: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7
}

.overlay-content {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(20rem, .65fr);
  gap: calc(var(--space)*2);
  padding: 0 var(--space) var(--space);
  overflow: visible
}

.asset-visual {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--bg);
  border-radius: var(--radius);
  overflow: hidden
}

.asset-visual img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain
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
  color: var(--color-muted);
  text-transform: capitalize
}

h1 {
  margin: .3em 0
}

.description {
  max-width: 38rem;
  color: var(--color-muted);
  line-height: 1.35
}

.primary-actions,
.action-row,
.manage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: var(--space) 0;
}

.primary-actions > :first-child,
.action-row > :first-child {
  margin-left: -2px
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center
}

.danger-button {
  color: var(--color-danger)
}

.error {
  color: var(--color-danger)
}

.success { color: var(--color-muted) }
.board-action{display:flex;align-items:end;gap:8px;margin:var(--space) 0}.board-action label{min-width:0;flex:1;margin:0}.board-action label span{display:block;margin-bottom:4px}.board-action select{width:100%;min-height:36px}.board-action button{flex:0 0 auto}

label {
  display: block;
  margin-top: var(--space);
  color: var(--color-muted)
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
  color: var(--color-muted);
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
  border-top: 1px solid rgb(0 0 0/.16)
}

dl div {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: var(--space);
  padding: 10px 0;
  border-bottom: 1px solid rgb(0 0 0/.16)
}

dt {
  color: var(--color-muted)
}

dd {
  margin: 0
}

.meta-section {
  margin-top: calc(var(--space)*2)
}

h2 {
  font-size: 1rem
}

.meta-section p {
  color: var(--color-muted)
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
  color: var(--color-muted)
}

.overlay-state {
  min-height: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space)
}

@media(max-width:760px) {
  .overlay-content {
    display: block;
    padding-bottom: calc(var(--space)*2);
    overflow-y: auto
  }

  .asset-visual {
    height: min(58dvh, 36rem)
  }

  .overlay-toolbar {
    grid-template-columns: 1fr auto
  }

  .overlay-toolbar>span:nth-child(2) {
    display: none
  }

  aside {
    padding: var(--space) 0 0;
    overflow: visible
  }

  h1 {
    font-size: var(--font-size-h1-mobile)
  }
}

@media(prefers-reduced-motion:reduce) {
  .asset-dialog,
  .asset-dialog::backdrop {
    transition-duration: .01ms
  }
}
</style>
