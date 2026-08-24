<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { ControllerMessage, ExportSettings, SelectedFrame, UiMessage } from './messages'

interface Item extends SelectedFrame { title: string; progress: 'idle'|'exporting'|'uploading'|'done'|'error'|'skipped'; error?: string; existingAction: 'version'|'separate'|'cancel' }
interface Project { id: string; name: string }
interface Tag { id: string; name: string; slug: string }
interface Workspace { id: string; name: string; slug: string; role: string }
interface ReviewBoard { id: string; title: string; review_month: string | null; submission_deadline: string | null; role: string }
interface PluginAccount { email: string; figmaHandle: string | null; avatarUrl: string | null; role: string }
const appUrl = __APP_URL__.replace(/\/$/, '')
const token = ref('')
const authCode = ref('')
const email = ref('')
const password = ref('')
const authBusy = ref(false)
const authState = ref<'checking'|'signed-out'|'signed-in'>('checking')
const account = ref<PluginAccount | null>(null)
const avatarFailed = ref(false)
const accountAvatarUrl = ref('')
const layoutMode = ref<'compact'|'widget'>('compact')
const frames = ref<Item[]>([])
const projects = ref<Project[]>([])
const projectDraft = ref('')
const projectBusy = ref(false)
const availableTags = ref<Tag[]>([])
const tagDraft = ref('')
const tagBusy = ref(false)
const workspaces = ref<Workspace[]>([])
const workspaceId = ref('')
const workspaceBusy = ref(false)
const reviewBoards = ref<ReviewBoard[]>([])
const reviewBoardId = ref('')
const settings = reactive<ExportSettings>({ format: 'PNG', scale: 2, jpgQuality: 90 })
const shared = reactive({ tags: '', projectId: '', campaignId: '', language: '', contentType: '', description: '', status: 'draft' })
const busy = ref(false)
const detailsOpen = ref(false)
const announcement = ref('')
const globalError = ref('')
const previewUrls = new Map<string, string>()
const pending = new Map<string, { resolve: (value: Uint8Array) => void; reject: (error: Error) => void }>()
let requestSequence = 0
const previewUrl = (frame: SelectedFrame) => previewUrls.get(frame.id) ?? ''
const isWidgetLayout = computed(() => layoutMode.value === 'widget' && authState.value === 'signed-in')
const eligible = computed(() => frames.value.filter(frame => frame.existingAction !== 'cancel'))
const selectedTags = computed(() => shared.tags.split(',').map(value => value.trim()).filter(Boolean))
const suggestedTags = computed(() => availableTags.value.filter(tag => !selectedTags.value.some(selected => selected.toLocaleLowerCase() === tag.name.toLocaleLowerCase())))
const currentWorkspace = computed(() => workspaces.value.find(workspace => workspace.id === workspaceId.value))
const selectedReviewBoard = computed(() => reviewBoards.value.find(board => board.id === reviewBoardId.value))
const canCreateProjects = computed(() => ['editor','admin'].includes(currentWorkspace.value?.role ?? ''))
const canChooseDestination = computed(() => ['editor','admin'].includes(currentWorkspace.value?.role ?? ''))
const reviewBoardLabel = (board: ReviewBoard) => board.review_month
  ? `${board.title} · ${new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(`${board.review_month}T12:00:00`))}`
  : board.title
const post = (message: UiMessage) => parent.postMessage({ pluginMessage: message }, '*')
const savePreferences = () => post({ type: 'save-state', value: { layout: layoutMode.value, settings: { ...settings }, shared: { tags: shared.tags, projectId: shared.projectId, language: shared.language, contentType: shared.contentType } } })
const resizePlugin = async () => {
  await nextTick()
  if (authState.value === 'checking') return
  const contentHeight = Math.ceil(document.querySelector('main')?.getBoundingClientRect().height ?? 0)
  post({ type: 'resize', width: isWidgetLayout.value ? 260 : 320, height: isWidgetLayout.value ? contentHeight : Math.min(460, contentHeight) })
}
const toggleLayoutMode = () => { layoutMode.value = layoutMode.value === 'compact' ? 'widget' : 'compact'; savePreferences() }
let resolveSequence = 0
const resolveExistingFrames = async () => {
  if (!token.value || !frames.value.length) return
  const sequence = ++resolveSequence
  const refs = frames.value.flatMap(frame => frame.fileKey ? [{ fileKey: frame.fileKey, nodeId: frame.id }] : [])
  if (!refs.length) return
  const response = await fetch(`${appUrl}/api/plugin/assets/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refs })
  }).catch(() => null)
  if (!response?.ok || sequence !== resolveSequence) return
  const payload = await response.json() as { data: { assets: Record<string, string> } }
  for (const frame of frames.value) {
    if (!frame.fileKey) continue
    const assetId = payload.data.assets[`${frame.fileKey}:${frame.id}`] ?? null
    frame.assetId = assetId
    frame.existingAction = assetId ? 'version' : 'separate'
  }
}
const createRequestId = () => {
  requestSequence += 1
  const bytes = new Uint32Array(2)
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes)
  return `${Date.now().toString(36)}-${requestSequence.toString(36)}-${bytes[0]!.toString(36)}${bytes[1]!.toString(36)}`
}

const loadProjects = async () => {
  const response = await fetch(`${appUrl}/api/projects`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load projects.')
  const payload = await response.json() as { data: { projects: Project[] } }
  projects.value = payload.data.projects
}
const createProject = async () => {
  const name=projectDraft.value.trim()
  if(!name||projectBusy.value)return
  const existing=projects.value.find(project=>project.name.toLocaleLowerCase()===name.toLocaleLowerCase())
  if(existing){shared.projectId=existing.id;projectDraft.value='';announcement.value=`${existing.name} selected.`;return}
  projectBusy.value=true;globalError.value=''
  try {
    const response=await fetch(`${appUrl}/api/projects`,{method:'POST',headers:{Authorization:`Bearer ${token.value}`,'Content-Type':'application/json'},body:JSON.stringify({name})})
    const payload=await response.json().catch(()=>null) as {data?:{project?:Project};error?:{message?:string}}|null
    if(!response.ok||!payload?.data?.project)throw new Error(payload?.error?.message||'Unable to create project.')
    projects.value.push(payload.data.project);projects.value.sort((a,b)=>a.name.localeCompare(b.name));shared.projectId=payload.data.project.id;projectDraft.value='';announcement.value=`${payload.data.project.name} created and selected.`
  } catch(error){globalError.value=error instanceof Error?error.message:'Unable to create project.'}
  finally{projectBusy.value=false}
}
const loadTags = async () => {
  const response = await fetch(`${appUrl}/api/tags`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load tags.')
  const payload = await response.json() as { data: { tags: Tag[] } }
  availableTags.value = payload.data.tags
}
const setSelectedTags = (values: string[]) => { shared.tags = [...new Map(values.map(value => [value.toLocaleLowerCase(), value])).values()].join(', ') }
const selectTag = (name: string) => { setSelectedTags([...selectedTags.value, name]); announcement.value = `${name} selected.` }
const removeTag = (name: string) => { setSelectedTags(selectedTags.value.filter(tag => tag.toLocaleLowerCase() !== name.toLocaleLowerCase())); announcement.value = `${name} removed.` }
const createTag = async () => {
  const name = tagDraft.value.replace(/,$/, '').trim()
  if (!name || tagBusy.value) return
  const existing = availableTags.value.find(tag => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (existing) { selectTag(existing.name); tagDraft.value = ''; return }
  tagBusy.value = true; globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/tags`, { method:'POST', headers:{ Authorization:`Bearer ${token.value}`, 'Content-Type':'application/json' }, body:JSON.stringify({ name }) })
    const payload = await response.json().catch(() => null) as { data?:{tag?:Tag}; error?:{message?:string} } | null
    if (!response.ok || !payload?.data?.tag) throw new Error(payload?.error?.message || 'Unable to add tag.')
    if (!availableTags.value.some(tag => tag.id === payload.data!.tag!.id)) availableTags.value.push(payload.data.tag)
    availableTags.value.sort((a,b) => a.name.localeCompare(b.name)); selectTag(payload.data.tag.name); tagDraft.value = ''
  } catch (error) { globalError.value = error instanceof Error ? error.message : 'Unable to add tag.' }
  finally { tagBusy.value = false }
}
const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); void createTag() }
  else if (event.key === 'Backspace' && !tagDraft.value && selectedTags.value.length) removeTag(selectedTags.value.at(-1)!)
}

const loadWorkspaces = async () => {
  const response = await fetch(`${appUrl}/api/plugin/workspaces`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load workspaces.')
  const payload = await response.json() as { data: { currentId: string; workspaces: Workspace[] } }
  workspaces.value = payload.data.workspaces
  workspaceId.value = payload.data.currentId
}
const clearAccountAvatar = () => {
  if (accountAvatarUrl.value) URL.revokeObjectURL(accountAvatarUrl.value)
  accountAvatarUrl.value = ''
}
const loadAccountAvatar = async () => {
  clearAccountAvatar()
  avatarFailed.value = false
  if (!account.value?.avatarUrl) return
  try {
    const response = await fetch(`${appUrl}/api/plugin/avatar`, { headers: { Authorization: `Bearer ${token.value}` } })
    if (!response.ok) throw new Error()
    accountAvatarUrl.value = URL.createObjectURL(await response.blob())
  } catch { avatarFailed.value = true }
}
const loadSession = async () => {
  const response = await fetch(`${appUrl}/api/plugin/session`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load your account.')
  const payload = await response.json() as { data: { user: PluginAccount } }
  account.value = payload.data.user
  await loadAccountAvatar()
}
const loadReviewBoards = async () => {
  const response = await fetch(`${appUrl}/api/plugin/boards`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load monthly review boards.')
  const payload = await response.json() as { data: { boards: ReviewBoard[] } }
  reviewBoards.value = payload.data.boards
  if (!canChooseDestination.value) {
    reviewBoardId.value = reviewBoards.value[0]?.id ?? ''
  } else if (!reviewBoards.value.some(board => board.id === reviewBoardId.value)) {
    reviewBoardId.value = ''
  }
}
const loadWorkspace = async () => { await loadWorkspaces(); await Promise.all([loadProjects(),loadTags(),loadReviewBoards()]) }
const switchWorkspace = async () => {
  if (!workspaceId.value) return
  workspaceBusy.value = true; globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/workspaces`, { method: 'POST', headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: workspaceId.value }) })
    const payload = await response.json().catch(() => null) as { data?: { token?: string }; error?: { message?: string } } | null
    if (!response.ok || !payload?.data?.token) throw new Error(payload?.error?.message || 'Unable to switch workspace.')
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); shared.projectId = ''; shared.tags = ''; reviewBoardId.value = ''; projects.value = []; availableTags.value = []; reviewBoards.value = []; await loadWorkspace(); announcement.value = 'Workspace changed.'
  } catch (error) { globalError.value = error instanceof Error ? error.message : 'Unable to switch workspace.'; await loadWorkspaces().catch(() => undefined) }
  finally { workspaceBusy.value = false }
}

const checkSession = async () => {
  if (!token.value) return authState.value = 'signed-out'
  try { await loadSession(); authState.value = 'signed-in'; await Promise.all([loadWorkspace(), resolveExistingFrames()]) }
  catch { post({ type: 'save-session', token: null }); token.value = ''; account.value = null; authState.value = 'signed-out' }
}
const openLogin = () => post({ type: 'open-external', url: `${appUrl}/oauth/figma/start?flow=plugin` })
const exchangeCode = async () => {
  globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/auth/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: authCode.value.trim() }) })
    if (!response.ok) throw new Error()
    const payload = await response.json() as { data: { token: string } }
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); authCode.value = ''; await Promise.all([loadSession(), loadWorkspace()]); authState.value = 'signed-in'; announcement.value = 'Signed in.'
  } catch { globalError.value = 'Unable to sign in. Copy a new code from the browser and try again.' }
}
const passwordLogin = async () => {
  authBusy.value = true; globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/auth/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value, password: password.value }) })
    const payload = await response.json().catch(() => null) as { data?: { token?: string }; error?: { message?: string } } | null
    if (!response.ok || !payload?.data?.token) throw new Error(payload?.error?.message || 'Email or password is incorrect.')
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); password.value = ''; await Promise.all([loadSession(), loadWorkspace()]); authState.value = 'signed-in'; announcement.value = 'Signed in.'
  } catch (error) { globalError.value = error instanceof Error ? error.message : 'Unable to sign in. Check your email and password.' }
  finally { authBusy.value = false }
}
const signOut = () => { post({ type: 'save-session', token: null }); token.value = ''; clearAccountAvatar(); account.value = null; projects.value = []; availableTags.value = []; reviewBoards.value = []; reviewBoardId.value = ''; workspaces.value = []; workspaceId.value = ''; authState.value = 'signed-out' }

const reencodeJpg = async (bytes: Uint8Array, quality: number) => {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close()
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error()), 'image/jpeg', quality / 100))
}
const exportFrame = (frame: Item) => new Promise<Uint8Array>((resolve, reject) => {
  const requestId = createRequestId(); pending.set(requestId, { resolve, reject }); post({ type: 'export', requestId, nodeId: frame.id, settings: { ...settings } })
})
const upload = async () => {
  busy.value = true; globalError.value = ''; let completed = 0
  for (const frame of eligible.value) {
    try {
      if (!frame.fileKey || !frame.figmaUrl) throw new Error('Unable to identify this Figma file. Reload the private plugin, then try again.')
      const metadata = { title: frame.title, description: shared.description, tags: shared.tags.split(',').map(v => v.trim()).filter(Boolean), projectId: shared.projectId || null, campaignId: shared.campaignId || null, language: shared.language || null, contentType: shared.contentType || null, status: shared.status, figmaFileKey: frame.fileKey, figmaNodeId: frame.id, figmaNodeName: frame.name, figmaUrl: frame.figmaUrl, width: frame.width, height: frame.height }
      let response: Response
      if (settings.format === 'MP4') {
        if (!frame.videoHash) throw new Error('No embedded video was found in this frame.')
        frame.progress = 'uploading'; announcement.value = `Importing ${frame.title}.`
        response = await fetch(`${appUrl}/api/plugin/figma-video`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileKey: frame.fileKey, videoHash: frame.videoHash, metadata, assetId: frame.assetId && frame.existingAction === 'version' ? frame.assetId : null })
        })
      } else {
        frame.progress = 'exporting'; announcement.value = `Exporting ${frame.title}.`
        const blob = await exportFrame(frame).then(bytes => settings.format === 'JPG'
          ? reencodeJpg(bytes, settings.jpgQuality)
          : new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
        frame.progress = 'uploading'; announcement.value = `Uploading ${frame.title}.`
        const extension = settings.format === 'JPG' ? 'jpg' : 'png'
        const form = new FormData(); form.append('file', blob, `${frame.name}.${extension}`); form.append('metadata', JSON.stringify(metadata))
        const endpoint = frame.assetId && frame.existingAction === 'version' ? `/api/assets/${frame.assetId}/version` : '/api/assets'
        response = await fetch(`${appUrl}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token.value}` }, body: form })
      }
      if (!response.ok) { const body = await response.json().catch(() => null) as { data?: { error?: { message?: string } }; error?: { message?: string } } | null; throw new Error(body?.data?.error?.message || body?.error?.message || 'Upload failed.') }
      const payload = await response.json() as { data: { asset: { id: string } } }
      frame.assetId = payload.data.asset.id
      frame.existingAction = 'version'
      if (reviewBoardId.value) {
        const submission = await fetch(`${appUrl}/api/plugin/boards/${reviewBoardId.value}/assets`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: payload.data.asset.id })
        })
        if (!submission.ok) {
          const body = await submission.json().catch(() => null) as { error?: { message?: string }; data?: { error?: { message?: string } } } | null
          throw new Error(body?.error?.message || body?.data?.error?.message || 'Uploaded to the library, but could not submit to the review board.')
        }
      }
      frame.progress = 'done'; completed++
    } catch (error) { frame.progress = 'error'; frame.error = error instanceof Error ? error.message : 'Upload failed.' }
  }
  busy.value = false; announcement.value = `${completed} of ${eligible.value.length} frames ${reviewBoardId.value ? 'submitted' : 'uploaded'}.`; savePreferences()
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: ControllerMessage }>) => {
  const message = event.data.pluginMessage; if (!message) return
  if (message.type === 'selection') {
    for (const url of previewUrls.values()) URL.revokeObjectURL(url); previewUrls.clear()
    frames.value = message.frames.map(frame => { if (frame.preview) previewUrls.set(frame.id, URL.createObjectURL(new Blob([new Uint8Array(frame.preview)], { type: 'image/png' }))); return { ...frame, title: frame.name, progress: 'idle', existingAction: frame.assetId ? 'version' : 'separate' } })
    if (authState.value === 'signed-in') void resolveExistingFrames()
  }
  if (message.type === 'export-result') { const request = pending.get(message.requestId); if (request && message.bytes) request.resolve(message.bytes); else if (request) request.reject(new Error(message.error || 'Unable to export this frame.')); pending.delete(message.requestId) }
  if (message.type === 'stored-state' && message.value && typeof message.value === 'object') {
    const value = message.value as { layout?: 'compact'|'widget'; settings?: Partial<ExportSettings>; shared?: Partial<typeof shared> }; layoutMode.value = value.layout === 'widget' ? 'widget' : 'compact'; Object.assign(settings, value.settings); Object.assign(shared, value.shared)
  }
  if (message.type === 'stored-state') { token.value = message.sessionToken ?? ''; void checkSession() }
}
watch([frames, authState, layoutMode, detailsOpen], resizePlugin, { deep: true })
onMounted(() => { post({ type: 'load-state' }); post({ type: 'refresh-selection' }) })
onBeforeUnmount(clearAccountAvatar)
</script>

<template>
  <main class="is-compact" :class="{ 'is-widget': isWidgetLayout }">
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    <div v-if="authState === 'checking'" class="session-checking" role="status" aria-label="Checking your session"></div>
    <section v-else-if="authState === 'signed-out'" class="auth" aria-label="Sign in"><form class="password-form" @submit.prevent="passwordLogin"><label class="sr-only" for="plugin-email">Email</label><input id="plugin-email" v-model="email" name="email" type="email" autocomplete="username" placeholder="Email" required><label class="sr-only" for="plugin-password">Password</label><input id="plugin-password" v-model="password" name="password" type="password" autocomplete="current-password" placeholder="Password" required><button class="primary" type="submit" :disabled="authBusy">{{ authBusy ? 'Signing in…' : 'Sign in' }}</button></form><div class="auth-divider"><span>or</span></div><button class="oauth-button" type="button" @click="openLogin">Continue with Figma</button><label class="sr-only" for="auth-code">One-time code</label><div class="code-row"><input id="auth-code" v-model="authCode" autocomplete="one-time-code" placeholder="One-time code"><button :disabled="!authCode.trim()" @click="exchangeCode">Connect</button></div><p v-if="globalError" class="error" role="alert">{{ globalError }}</p></section>
    <template v-else>
      <header v-if="layoutMode === 'compact'">
        <div>
          <h1>{{ reviewBoardId ? 'Submit frames' : 'Upload frames to your library' }}</h1>
        </div>
      </header>
      <label v-if="canChooseDestination && reviewBoards.length" class="destination-field" for="plugin-destination">
        Destination
        <select id="plugin-destination" v-model="reviewBoardId" :disabled="busy">
          <option value="">Library</option>
          <option v-for="board in reviewBoards" :key="board.id" :value="board.id">{{ reviewBoardLabel(board) }}</option>
        </select>
      </label>
      <p v-if="canChooseDestination && selectedReviewBoard" class="destination-note">Frames will be uploaded to the library and submitted to this review.<template v-if="selectedReviewBoard.submission_deadline"> Deadline {{ new Date(selectedReviewBoard.submission_deadline).toLocaleDateString() }}.</template></p>
      <section v-if="!frames.length" class="center"><strong>Select frame to upload</strong><button class="layout-toggle frame-layout-toggle" type="button" :aria-label="`Switch to ${layoutMode === 'compact' ? 'widget' : 'compact'} layout`" @click="toggleLayoutMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v4M12 4h4v4M8 16H4v-4M12 16h4v-4" /></svg></button></section>
      <form v-else @submit.prevent="upload">
        <section class="frames-section" aria-labelledby="selected-title"><h2 id="selected-title" class="sr-only">Selected frames</h2><ul class="frames"><li v-for="(frame, index) in frames" :key="frame.id" :class="{ 'has-layout-toggle': index === 0 }"><img :src="previewUrl(frame)" alt=""><div class="frame-fields"><label :for="`title-${frame.id}`"><span class="sr-only">Title</span><input :id="`title-${frame.id}`" v-model="frame.title" required maxlength="200"></label><p class="frame-meta"><span>{{ frame.width }} × {{ frame.height }}</span><span v-if="settings.format === 'MP4' && !frame.videoHash" class="frame-warning" title="No embedded video found in this frame"><span aria-hidden="true">No video</span><span class="sr-only">No embedded video found in this frame.</span></span></p><p v-if="!frame.fileKey" class="error">Reload this private plugin to enable a direct link to the file.</p><p v-if="frame.assetId && frame.progress !== 'done'" class="existing">This frame already exists in the library.</p><label v-if="frame.assetId && frame.progress !== 'done'" :for="`action-${frame.id}`"><span class="sr-only">Upload choice</span><select :id="`action-${frame.id}`" v-model="frame.existingAction" :disabled="busy"><option value="version">Upload new version</option><option value="separate">Create separate asset</option><option value="cancel">Skip this frame</option></select></label><p v-if="frame.progress !== 'idle'" class="progress" :data-state="frame.progress">{{ frame.progress === 'done' ? 'Uploaded' : frame.progress === 'error' ? frame.error : frame.progress === 'exporting' ? settings.format === 'MP4' ? 'Downloading…' : 'Exporting…' : 'Uploading…' }}</p></div><button v-if="index === 0" class="layout-toggle frame-layout-toggle" type="button" :aria-label="`Switch to ${layoutMode === 'compact' ? 'widget' : 'compact'} layout`" @click="toggleLayoutMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v4M12 4h4v4M8 16H4v-4M12 16h4v-4" /></svg></button></li></ul></section>
        <label v-if="workspaces.length > 1" class="workspace-field" for="plugin-workspace"><span class="sr-only">Workspace</span><select id="plugin-workspace" v-model="workspaceId" :disabled="workspaceBusy || busy" @change="switchWorkspace"><option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }} · {{ workspace.role }}</option></select></label>
        <section class="media-panel" aria-labelledby="export-title"><h2 id="export-title" class="sr-only">Media</h2><div class="settings"><label><span class="sr-only">Format</span><select v-model="settings.format"><option>PNG</option><option>JPG</option><option>MP4</option></select></label><label v-if="settings.format !== 'MP4'"><span class="sr-only">Scale</span><select v-model.number="settings.scale"><option :value="1">1×</option><option :value="2">2×</option><option :value="3">3×</option></select></label><label v-if="settings.format === 'JPG'"><span class="sr-only">JPG quality</span><input v-model.number="settings.jpgQuality" type="number" min="10" max="100" step="5"></label></div><p v-if="settings.format === 'MP4'" class="field-note">The original MP4 from the selected frame's video fill will be uploaded directly.</p></section>
        <section class="details-panel"><div id="metadata-panel" v-show="detailsOpen" aria-labelledby="metadata-title"><h2 id="metadata-title">Details</h2><div class="tag-field"><span class="field-label">Tags</span><div v-if="selectedTags.length" class="selected-tags" aria-label="Selected tags"><button v-for="tag in selectedTags" :key="tag" class="tag-chip selected" type="button" :aria-label="`Remove ${tag}`" @click="removeTag(tag)"><span>{{ tag }}</span><span aria-hidden="true">×</span></button></div><div class="tag-entry"><input v-model="tagDraft" maxlength="80" aria-label="Add a tag" placeholder="Add a tag" @keydown="handleTagKeydown"><button type="button" :disabled="tagBusy || !tagDraft.trim()" @click="createTag">{{ tagBusy ? 'Adding…' : 'Add' }}</button></div><div v-if="suggestedTags.length" class="tag-quick-options" aria-label="Suggested tags"><button v-for="tag in suggestedTags" :key="tag.id" class="tag-chip" type="button" @click="selectTag(tag.name)">{{ tag.name }}</button></div></div><div class="project-field"><label for="plugin-project">Project<select id="plugin-project" v-model="shared.projectId"><option value="">No project</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label><div v-if="canCreateProjects" class="project-entry"><input v-model="projectDraft" maxlength="120" aria-label="New project name" placeholder="New project" @keydown.enter.prevent="createProject"><button type="button" :disabled="projectBusy||!projectDraft.trim()" @click="createProject">{{ projectBusy?'Creating…':'Create' }}</button></div><p v-else class="field-note">Editors and admins can create projects.</p></div><label>Description <textarea v-model="shared.description" rows="3" placeholder="Describe how this asset should be used"></textarea></label></div><button class="details-toggle" type="button" :aria-expanded="detailsOpen" aria-controls="metadata-panel" @click="detailsOpen = !detailsOpen">{{ detailsOpen ? 'Hide details' : 'Details (optional)' }}</button></section>
        <p v-if="globalError" class="error" role="alert">{{ globalError }}</p><section v-if="account" class="account-panel" aria-label="Signed in account"><div class="account-identity"><span class="account-avatar" aria-hidden="true"><img v-if="accountAvatarUrl && !avatarFailed" :src="accountAvatarUrl" alt="" @error="avatarFailed = true"><span v-else>{{ account.email.charAt(0).toUpperCase() }}</span></span><div class="account-copy"><strong>{{ account.email }}</strong><span v-if="account.figmaHandle">{{ account.figmaHandle }}</span></div></div><button class="quiet" type="button" @click="signOut">Sign out</button></section><footer><span>{{ eligible.length }} ready</span><button class="primary" type="submit" :disabled="busy || !eligible.length">{{ busy ? reviewBoardId ? 'Submitting…' : 'Uploading…' : `${reviewBoardId ? 'Submit' : 'Upload'} ${eligible.length} ${eligible.length === 1 ? 'frame' : 'frames'}` }}</button></footer>
      </form>
    </template>
  </main>
</template>

<style src="./plugin.css"></style>
