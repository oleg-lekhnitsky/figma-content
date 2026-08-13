<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { ControllerMessage, ExportSettings, SelectedFrame, UiMessage } from './messages'

interface Item extends SelectedFrame { title: string; progress: 'idle'|'exporting'|'uploading'|'done'|'error'|'skipped'; error?: string; existingAction: 'version'|'separate'|'cancel' }
interface Project { id: string; name: string }
interface Tag { id: string; name: string; slug: string }
interface Workspace { id: string; name: string; slug: string; role: string }
interface ReviewBoard { id: string; title: string; review_month: string | null; submission_deadline: string | null; role: string }
const appUrl = __APP_URL__.replace(/\/$/, '')
const token = ref('')
const authCode = ref('')
const email = ref('')
const password = ref('')
const authBusy = ref(false)
const authState = ref<'checking'|'signed-out'|'signed-in'>('checking')
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
const announcement = ref('')
const globalError = ref('')
const previewUrls = new Map<string, string>()
const pending = new Map<string, { resolve: (value: Uint8Array) => void; reject: (error: Error) => void }>()
let requestSequence = 0
const previewUrl = (frame: SelectedFrame) => previewUrls.get(frame.id) ?? ''
const eligible = computed(() => frames.value.filter(frame => frame.existingAction !== 'cancel'))
const selectedTags = computed(() => shared.tags.split(',').map(value => value.trim()).filter(Boolean))
const suggestedTags = computed(() => availableTags.value.filter(tag => !selectedTags.value.some(selected => selected.toLocaleLowerCase() === tag.name.toLocaleLowerCase())))
const currentWorkspace = computed(() => workspaces.value.find(workspace => workspace.id === workspaceId.value))
const selectedReviewBoard = computed(() => reviewBoards.value.find(board => board.id === reviewBoardId.value))
const canCreateProjects = computed(() => ['editor','admin'].includes(currentWorkspace.value?.role ?? ''))
const reviewBoardLabel = (board: ReviewBoard) => board.review_month
  ? `${board.title} · ${new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(`${board.review_month}T12:00:00`))}`
  : board.title
const post = (message: UiMessage) => parent.postMessage({ pluginMessage: message }, '*')
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
const loadReviewBoards = async () => {
  const response = await fetch(`${appUrl}/api/plugin/boards`, { headers: { Authorization: `Bearer ${token.value}` } })
  if (!response.ok) throw new Error('Unable to load monthly review boards.')
  const payload = await response.json() as { data: { boards: ReviewBoard[] } }
  reviewBoards.value = payload.data.boards
  if (!reviewBoards.value.some(board => board.id === reviewBoardId.value)) reviewBoardId.value = ''
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
  try { await fetch(`${appUrl}/api/plugin/session`, { headers: { Authorization: `Bearer ${token.value}` } }).then(response => { if (!response.ok) throw new Error() }); authState.value = 'signed-in'; await Promise.all([loadWorkspace(), resolveExistingFrames()]) }
  catch { post({ type: 'save-session', token: null }); token.value = ''; authState.value = 'signed-out' }
}
const openLogin = () => post({ type: 'open-external', url: `${appUrl}/oauth/figma/start?flow=plugin` })
const exchangeCode = async () => {
  globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/auth/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: authCode.value.trim() }) })
    if (!response.ok) throw new Error()
    const payload = await response.json() as { data: { token: string } }
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); authCode.value = ''; authState.value = 'signed-in'; await loadWorkspace(); announcement.value = 'Signed in.'
  } catch { globalError.value = 'Unable to sign in. Copy a new code from the browser and try again.' }
}
const passwordLogin = async () => {
  authBusy.value = true; globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/auth/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value, password: password.value }) })
    const payload = await response.json().catch(() => null) as { data?: { token?: string }; error?: { message?: string } } | null
    if (!response.ok || !payload?.data?.token) throw new Error(payload?.error?.message || 'Email or password is incorrect.')
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); password.value = ''; authState.value = 'signed-in'; await loadWorkspace(); announcement.value = 'Signed in.'
  } catch (error) { globalError.value = error instanceof Error ? error.message : 'Unable to sign in. Check your email and password.' }
  finally { authBusy.value = false }
}
const signOut = () => { post({ type: 'save-session', token: null }); token.value = ''; projects.value = []; availableTags.value = []; reviewBoards.value = []; reviewBoardId.value = ''; workspaces.value = []; workspaceId.value = ''; authState.value = 'signed-out' }

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
      post({ type: 'bind-asset', nodeId: frame.id, assetId: payload.data.asset.id })
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
  busy.value = false; announcement.value = `${completed} of ${eligible.value.length} frames ${reviewBoardId.value ? 'submitted' : 'uploaded'}.`; post({ type: 'save-state', value: { settings: { ...settings }, shared: { tags: shared.tags, projectId: shared.projectId, language: shared.language, contentType: shared.contentType } } })
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
    const value = message.value as { settings?: Partial<ExportSettings>; shared?: Partial<typeof shared> }; Object.assign(settings, value.settings); Object.assign(shared, value.shared)
  }
  if (message.type === 'stored-state') { token.value = message.sessionToken ?? ''; void checkSession() }
}
watch([frames, authState], async () => { await nextTick(); post({ type: 'resize', height: Math.min(800, document.documentElement.scrollHeight) }) }, { deep: true })
onMounted(() => { post({ type: 'load-state' }); post({ type: 'refresh-selection' }) })
</script>

<template>
  <main>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    <section v-if="authState === 'checking'" class="center" role="status">Checking your session…</section>
    <section v-else-if="authState === 'signed-out'" class="auth" aria-labelledby="auth-title"><p class="eyebrow">Private library</p><h1 id="auth-title">Connect your account</h1><p>Use the email and password provided by a library administrator.</p><form class="password-form" @submit.prevent="passwordLogin"><label for="plugin-email">Email</label><input id="plugin-email" v-model="email" name="email" type="email" autocomplete="username" required><label for="plugin-password">Password</label><input id="plugin-password" v-model="password" name="password" type="password" autocomplete="current-password" required><button class="primary" type="submit" :disabled="authBusy">{{ authBusy ? 'Signing in…' : 'Sign in' }}</button></form><div class="auth-divider"><span>or</span></div><p>Team members can connect through Figma OAuth and paste the one-time code.</p><button class="oauth-button" type="button" @click="openLogin">Continue with Figma</button><label for="auth-code">One-time code</label><div class="code-row"><input id="auth-code" v-model="authCode" autocomplete="one-time-code" placeholder="Paste code"><button :disabled="!authCode.trim()" @click="exchangeCode">Connect</button></div><p v-if="globalError" class="error" role="alert">{{ globalError }}</p></section>
    <template v-else>
      <header><h1>{{ reviewBoardId ? 'Submit frames' : 'Upload frames' }}</h1><button class="quiet" @click="signOut">Sign out</button></header>
      <label v-if="workspaces.length" class="workspace-field" for="plugin-workspace">Workspace<select id="plugin-workspace" v-model="workspaceId" :disabled="workspaceBusy || busy" @change="switchWorkspace"><option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }} · {{ workspace.role }}</option></select></label>
      <label class="destination-field" for="plugin-destination">Destination<select id="plugin-destination" v-model="reviewBoardId" :disabled="busy"><option value="">Library only</option><option v-for="board in reviewBoards" :key="board.id" :value="board.id">{{ reviewBoardLabel(board) }}</option></select></label>
      <p v-if="selectedReviewBoard" class="destination-note">Frames will be uploaded to the library and submitted to this review.<template v-if="selectedReviewBoard.submission_deadline"> Deadline {{ new Date(selectedReviewBoard.submission_deadline).toLocaleDateString() }}.</template></p>
      <section v-if="!frames.length" class="center"><strong>Select one or more frames to upload.</strong><p>Frames, components, and instances are supported.</p><button @click="post({ type: 'refresh-selection' })">Check selection</button></section>
      <form v-else @submit.prevent="upload">
        <section aria-labelledby="selected-title"><div class="section-title"><h2 id="selected-title">Selected frames</h2><span>{{ frames.length }}</span></div><ul class="frames"><li v-for="frame in frames" :key="frame.id"><img :src="previewUrl(frame)" alt=""><div class="frame-fields"><label :for="`title-${frame.id}`">Title</label><input :id="`title-${frame.id}`" v-model="frame.title" required maxlength="200"><p>{{ frame.width }} × {{ frame.height }} · {{ frame.pageName }}</p><p v-if="settings.format === 'MP4' && !frame.videoHash" class="error">No embedded video found in this frame.</p><p v-if="!frame.fileKey" class="error">Reload this private plugin to enable a direct link to the file.</p><p v-if="frame.assetId" class="existing">This frame already exists in the library.</p><label v-if="frame.assetId" :for="`action-${frame.id}`">Upload choice</label><select v-if="frame.assetId" :id="`action-${frame.id}`" v-model="frame.existingAction"><option value="version">Upload new version</option><option value="separate">Create separate asset</option><option value="cancel">Skip this frame</option></select><p v-if="frame.progress !== 'idle'" class="progress" :data-state="frame.progress">{{ frame.progress === 'done' ? 'Uploaded' : frame.progress === 'error' ? frame.error : frame.progress === 'exporting' ? settings.format === 'MP4' ? 'Downloading…' : 'Exporting…' : 'Uploading…' }}</p></div></li></ul></section>
        <section aria-labelledby="metadata-title"><h2 id="metadata-title">Shared metadata</h2><div class="tag-field"><span class="field-label">Tags</span><div v-if="selectedTags.length" class="selected-tags" aria-label="Selected tags"><button v-for="tag in selectedTags" :key="tag" class="tag-chip selected" type="button" :aria-label="`Remove ${tag}`" @click="removeTag(tag)"><span>{{ tag }}</span><span aria-hidden="true">×</span></button></div><div class="tag-entry"><input v-model="tagDraft" maxlength="80" aria-label="Add a tag" placeholder="Add a tag" @keydown="handleTagKeydown"><button type="button" :disabled="tagBusy || !tagDraft.trim()" @click="createTag">{{ tagBusy ? 'Adding…' : 'Add' }}</button></div><div v-if="suggestedTags.length" class="tag-suggestions"><span>Available</span><div><button v-for="tag in suggestedTags" :key="tag.id" class="tag-chip" type="button" @click="selectTag(tag.name)">{{ tag.name }}</button></div></div></div><div class="project-field"><label for="plugin-project">Project</label><select id="plugin-project" v-model="shared.projectId"><option value="">No project</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select><div v-if="canCreateProjects" class="project-entry"><input v-model="projectDraft" maxlength="120" aria-label="New project name" placeholder="New project" @keydown.enter.prevent="createProject"><button type="button" :disabled="projectBusy||!projectDraft.trim()" @click="createProject">{{ projectBusy?'Creating…':'Create' }}</button></div><p v-else class="field-note">Editors and admins can create projects.</p></div><div class="grid"><label>Language <input v-model="shared.language" placeholder="en-US"></label><label>Content type <input v-model="shared.contentType" placeholder="Social post"></label></div><label>Description <textarea v-model="shared.description" rows="3" placeholder="Describe how this asset should be used"></textarea></label></section>
        <section aria-labelledby="export-title"><h2 id="export-title">Media</h2><div class="settings"><label>Format <select v-model="settings.format"><option>PNG</option><option>JPG</option><option>MP4</option></select></label><label v-if="settings.format !== 'MP4'">Scale <select v-model.number="settings.scale"><option :value="1">1×</option><option :value="2">2×</option><option :value="3">3×</option></select></label><label v-if="settings.format === 'JPG'">JPG quality <input v-model.number="settings.jpgQuality" type="number" min="10" max="100" step="5"></label></div><p v-if="settings.format === 'MP4'" class="field-note">The original MP4 from the selected frame's video fill will be uploaded directly.</p></section>
        <p v-if="globalError" class="error" role="alert">{{ globalError }}</p><footer><span>{{ eligible.length }} ready</span><button class="primary" type="submit" :disabled="busy || !eligible.length">{{ busy ? reviewBoardId ? 'Submitting…' : 'Uploading…' : `${reviewBoardId ? 'Submit' : 'Upload'} ${eligible.length} ${eligible.length === 1 ? 'frame' : 'frames'}` }}</button></footer>
      </form>
    </template>
  </main>
</template>

<style>
*{box-sizing:border-box}body{margin:0;color:var(--figma-color-text,#222);background:var(--figma-color-bg,#fff);font:12px/1.4 Inter,system-ui,sans-serif}main{min-height:100vh;padding:16px}h1{margin:2px 0;font-size:20px;letter-spacing:-.03em}h2{margin:18px 0 8px;font-size:12px}.eyebrow{margin:0;color:var(--figma-color-text-secondary,#666);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}header{display:flex;align-items:start;justify-content:space-between;margin-bottom:12px}.quiet{border:0;background:transparent;color:var(--figma-color-text-secondary,#666)}button,input,select,textarea{font:inherit;color:inherit}button{min-height:32px;padding:0 10px;border:1px solid var(--figma-color-border,#ccc);border-radius:6px;background:var(--figma-color-bg,#fff);cursor:pointer}button:active{scale:.96}button:disabled{cursor:default;opacity:.45;scale:1}.primary{border-color:#111;color:#fff;background:#111;font-weight:650}label{display:block;margin-top:8px;color:var(--figma-color-text-secondary,#666);font-size:10px;font-weight:650}input,select,textarea{width:100%;margin-top:4px;padding:7px 8px;border:1px solid var(--figma-color-border,#ccc);border-radius:5px;background:var(--figma-color-bg,#fff)}:is(button,input,select,textarea):focus-visible{outline:2px solid #1684ff;outline-offset:2px}.auth{padding-top:24px}.auth>p:not(.eyebrow){color:var(--figma-color-text-secondary,#666)}.password-form{display:grid}.auth .password-form .primary{width:100%;margin:12px 0 0}.oauth-button{width:100%;margin:4px 0}.auth-divider{display:flex;align-items:center;gap:8px;margin:16px 0;color:var(--figma-color-text-secondary,#666);font-size:10px}.auth-divider::before,.auth-divider::after{height:1px;flex:1;background:var(--figma-color-border,#ddd);content:""}.code-row{display:grid;grid-template-columns:1fr auto;gap:6px}.code-row button{align-self:end}.center{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--figma-color-text-secondary,#666)}.center strong{color:var(--figma-color-text,#222)}.section-title{display:flex;align-items:center;justify-content:space-between}.section-title span{color:var(--figma-color-text-secondary,#666)}.frames{display:grid;gap:8px;margin:0;padding:0;list-style:none}.frames li{display:grid;grid-template-columns:88px 1fr;gap:10px;padding:8px;border-radius:9px;background:var(--figma-color-bg-secondary,#f5f5f5)}.frames img{width:88px;height:88px;object-fit:cover;border-radius:5px;outline:1px solid oklch(0 0 0/.1)}.frame-fields label:first-child{margin-top:0}.frame-fields p{margin:4px 0;color:var(--figma-color-text-secondary,#666);font-size:10px}.existing{color:#9b6400!important}.progress[data-state=done]{color:#14733b!important}.progress[data-state=error],.error{color:#b42318!important}.grid,.settings{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}footer{position:sticky;bottom:-16px;display:flex;align-items:center;justify-content:space-between;margin:18px -16px -16px;padding:10px 16px;background:var(--figma-color-bg,#fff);border-top:1px solid var(--figma-color-border,#ddd)}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}@media(prefers-reduced-motion:reduce){button:active{scale:1}}
.workspace-field{margin:0 0 14px}.workspace-field select{color:var(--figma-color-text,#222);font-weight:600}
.destination-field{margin:0 0 8px}.destination-field select{color:var(--figma-color-text,#222);font-weight:600}.destination-note{margin:0 0 14px;color:var(--figma-color-text-secondary,#666);font-size:10px}
.tag-field{margin-top:8px}.field-label,.tag-suggestions>span{color:var(--figma-color-text-secondary,#666);font-size:10px;font-weight:650}.selected-tags,.tag-suggestions>div{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.tag-chip{min-height:26px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;border:0;border-radius:999px;background:var(--figma-color-bg-secondary,#eee);font-weight:600;transition-property:scale,opacity;transition-duration:150ms}.tag-chip.selected{color:var(--figma-color-bg,#fff);background:var(--figma-color-text,#222)}.tag-entry{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:6px}.tag-entry input{margin:0}.tag-entry button{align-self:stretch}.tag-suggestions{margin-top:8px}
.project-field{margin-top:12px}.project-field>label{margin-top:0}.project-field>select{margin-top:4px}.project-entry{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:6px}.project-entry input{margin:0}.project-entry button{align-self:stretch}.field-note{margin:5px 0 0;color:var(--figma-color-text-secondary,#666);font-size:10px}
</style>
