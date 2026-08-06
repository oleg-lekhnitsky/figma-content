<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { ControllerMessage, ExportSettings, SelectedFrame, UiMessage } from './messages'

interface Item extends SelectedFrame { title: string; progress: 'idle'|'exporting'|'uploading'|'done'|'error'|'skipped'; error?: string; existingAction: 'version'|'separate'|'cancel' }
const appUrl = __APP_URL__.replace(/\/$/, '')
const token = ref('')
const authCode = ref('')
const authState = ref<'checking'|'signed-out'|'signed-in'>('checking')
const frames = ref<Item[]>([])
const settings = reactive<ExportSettings>({ format: 'PNG', scale: 2, jpgQuality: 90 })
const shared = reactive({ tags: '', projectId: '', campaignId: '', language: '', contentType: '', description: '', status: 'draft' })
const busy = ref(false)
const announcement = ref('')
const globalError = ref('')
const previewUrls = new Map<string, string>()
const pending = new Map<string, (value: Uint8Array) => void>()
let requestSequence = 0
const previewUrl = (frame: SelectedFrame) => previewUrls.get(frame.id) ?? ''
const eligible = computed(() => frames.value.filter(frame => frame.existingAction !== 'cancel'))
const post = (message: UiMessage) => parent.postMessage({ pluginMessage: message }, '*')
const createRequestId = () => {
  requestSequence += 1
  const bytes = new Uint32Array(2)
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes)
  return `${Date.now().toString(36)}-${requestSequence.toString(36)}-${bytes[0]!.toString(36)}${bytes[1]!.toString(36)}`
}

const checkSession = async () => {
  if (!token.value) return authState.value = 'signed-out'
  try { await fetch(`${appUrl}/api/plugin/session`, { headers: { Authorization: `Bearer ${token.value}` } }).then(response => { if (!response.ok) throw new Error() }); authState.value = 'signed-in' }
  catch { post({ type: 'save-session', token: null }); token.value = ''; authState.value = 'signed-out' }
}
const openLogin = () => post({ type: 'open-external', url: `${appUrl}/oauth/figma/start?flow=plugin` })
const exchangeCode = async () => {
  globalError.value = ''
  try {
    const response = await fetch(`${appUrl}/api/plugin/auth/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: authCode.value.trim() }) })
    if (!response.ok) throw new Error()
    const payload = await response.json() as { data: { token: string } }
    token.value = payload.data.token; post({ type: 'save-session', token: token.value }); authCode.value = ''; authState.value = 'signed-in'; announcement.value = 'Signed in.'
  } catch { globalError.value = 'Unable to sign in. Copy a new code from the browser and try again.' }
}
const signOut = () => { post({ type: 'save-session', token: null }); token.value = ''; authState.value = 'signed-out' }

const reencodeJpg = async (bytes: Uint8Array, quality: number) => {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close()
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error()), 'image/jpeg', quality / 100))
}
const exportFrame = (frame: Item) => new Promise<Uint8Array>((resolve) => {
  const requestId = createRequestId(); pending.set(requestId, resolve); post({ type: 'export', requestId, nodeId: frame.id, settings: { ...settings } })
})
const upload = async () => {
  busy.value = true; globalError.value = ''; let completed = 0
  for (const frame of eligible.value) {
    try {
      if (!frame.fileKey || !frame.figmaUrl) throw new Error('Unable to identify this Figma file. Reload the private plugin, then try again.')
      frame.progress = 'exporting'; announcement.value = `Exporting ${frame.title}.`
      const bytes = await exportFrame(frame)
      const blob = settings.format === 'JPG' ? await reencodeJpg(bytes, settings.jpgQuality) : new Blob([new Uint8Array(bytes)], { type: 'image/png' })
      frame.progress = 'uploading'; announcement.value = `Uploading ${frame.title}.`
      const metadata = { title: frame.title, description: shared.description, tags: shared.tags.split(',').map(v => v.trim()).filter(Boolean), projectId: shared.projectId || null, campaignId: shared.campaignId || null, language: shared.language || null, contentType: shared.contentType || null, status: shared.status, figmaFileKey: frame.fileKey, figmaNodeId: frame.id, figmaNodeName: frame.name, figmaUrl: frame.figmaUrl }
      const form = new FormData(); form.append('file', blob, `${frame.name}.${settings.format === 'JPG' ? 'jpg' : 'png'}`); form.append('metadata', JSON.stringify(metadata))
      const endpoint = frame.assetId && frame.existingAction === 'version' ? `/api/assets/${frame.assetId}/version` : '/api/assets'
      const response = await fetch(`${appUrl}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token.value}` }, body: form })
      if (!response.ok) { const body = await response.json().catch(() => null) as { data?: { error?: { message?: string } } } | null; throw new Error(body?.data?.error?.message || 'Upload failed.') }
      const payload = await response.json() as { data: { asset: { id: string } } }
      post({ type: 'bind-asset', nodeId: frame.id, assetId: payload.data.asset.id }); frame.progress = 'done'; completed++
    } catch (error) { frame.progress = 'error'; frame.error = error instanceof Error ? error.message : 'Upload failed.' }
  }
  busy.value = false; announcement.value = `${completed} of ${eligible.value.length} frames uploaded.`; post({ type: 'save-state', value: { settings: { ...settings }, shared: { tags: shared.tags, projectId: shared.projectId, language: shared.language, contentType: shared.contentType } } })
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: ControllerMessage }>) => {
  const message = event.data.pluginMessage; if (!message) return
  if (message.type === 'selection') {
    for (const url of previewUrls.values()) URL.revokeObjectURL(url); previewUrls.clear()
    frames.value = message.frames.map(frame => { if (frame.preview) previewUrls.set(frame.id, URL.createObjectURL(new Blob([new Uint8Array(frame.preview)], { type: 'image/png' }))); return { ...frame, title: frame.name, progress: 'idle', existingAction: frame.assetId ? 'version' : 'separate' } })
  }
  if (message.type === 'export-result') { const resolve = pending.get(message.requestId); if (resolve && message.bytes) resolve(message.bytes); pending.delete(message.requestId) }
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
    <section v-else-if="authState === 'signed-out'" class="auth" aria-labelledby="auth-title"><p class="eyebrow">Private library</p><h1 id="auth-title">Connect your account</h1><p>Sign in with an approved Figma account, then copy the one-time code from your browser.</p><button class="primary" @click="openLogin">Continue with Figma</button><label for="auth-code">One-time code</label><div class="code-row"><input id="auth-code" v-model="authCode" autocomplete="one-time-code" placeholder="Paste code"><button :disabled="!authCode.trim()" @click="exchangeCode">Connect</button></div><p v-if="globalError" class="error" role="alert">{{ globalError }}</p></section>
    <template v-else>
      <header><div><p class="eyebrow">Content Library</p><h1>Upload frames</h1></div><button class="quiet" @click="signOut">Sign out</button></header>
      <section v-if="!frames.length" class="center"><strong>Select one or more frames to upload.</strong><p>Frames, components, and instances are supported.</p><button @click="post({ type: 'refresh-selection' })">Check selection</button></section>
      <form v-else @submit.prevent="upload">
        <section aria-labelledby="selected-title"><div class="section-title"><h2 id="selected-title">Selected frames</h2><span>{{ frames.length }}</span></div><ul class="frames"><li v-for="frame in frames" :key="frame.id"><img :src="previewUrl(frame)" alt=""><div class="frame-fields"><label :for="`title-${frame.id}`">Title</label><input :id="`title-${frame.id}`" v-model="frame.title" required maxlength="200"><p>{{ frame.width }} × {{ frame.height }} · {{ frame.pageName }}</p><p v-if="!frame.fileKey" class="error">Reload this private plugin to enable a direct link to the file.</p><p v-if="frame.assetId" class="existing">This frame already exists in the library.</p><label v-if="frame.assetId" :for="`action-${frame.id}`">Upload choice</label><select v-if="frame.assetId" :id="`action-${frame.id}`" v-model="frame.existingAction"><option value="version">Upload new version</option><option value="separate">Create separate asset</option><option value="cancel">Skip this frame</option></select><p v-if="frame.progress !== 'idle'" class="progress" :data-state="frame.progress">{{ frame.progress === 'done' ? 'Uploaded' : frame.progress === 'error' ? frame.error : frame.progress === 'exporting' ? 'Exporting…' : 'Uploading…' }}</p></div></li></ul></section>
        <section aria-labelledby="metadata-title"><h2 id="metadata-title">Shared metadata</h2><div class="grid"><label>Tags <input v-model="shared.tags" placeholder="social, launch, summer"></label><label>Project ID <input v-model="shared.projectId" placeholder="Optional UUID"></label><label>Language <input v-model="shared.language" placeholder="en-US"></label><label>Content type <input v-model="shared.contentType" placeholder="Social post"></label></div><label>Description <textarea v-model="shared.description" rows="3" placeholder="Describe how this asset should be used"></textarea></label></section>
        <section aria-labelledby="export-title"><h2 id="export-title">Export</h2><div class="settings"><label>Format <select v-model="settings.format"><option>PNG</option><option>JPG</option></select></label><label>Scale <select v-model.number="settings.scale"><option :value="1">1×</option><option :value="2">2×</option><option :value="3">3×</option></select></label><label v-if="settings.format === 'JPG'">JPG quality <input v-model.number="settings.jpgQuality" type="number" min="10" max="100" step="5"></label></div></section>
        <p v-if="globalError" class="error" role="alert">{{ globalError }}</p><footer><span>{{ eligible.length }} ready</span><button class="primary" type="submit" :disabled="busy || !eligible.length">{{ busy ? 'Uploading…' : `Upload ${eligible.length} ${eligible.length === 1 ? 'frame' : 'frames'}` }}</button></footer>
      </form>
    </template>
  </main>
</template>

<style>
*{box-sizing:border-box}body{margin:0;color:var(--figma-color-text,#222);background:var(--figma-color-bg,#fff);font:12px/1.4 Inter,system-ui,sans-serif}main{min-height:100vh;padding:16px}h1{margin:2px 0;font-size:20px;letter-spacing:-.03em}h2{margin:18px 0 8px;font-size:12px}.eyebrow{margin:0;color:var(--figma-color-text-secondary,#666);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}header{display:flex;align-items:start;justify-content:space-between;margin-bottom:12px}.quiet{border:0;background:transparent;color:var(--figma-color-text-secondary,#666)}button,input,select,textarea{font:inherit;color:inherit}button{min-height:32px;padding:0 10px;border:1px solid var(--figma-color-border,#ccc);border-radius:6px;background:var(--figma-color-bg,#fff);cursor:pointer}button:active{scale:.96}button:disabled{cursor:default;opacity:.45;scale:1}.primary{border-color:#111;color:#fff;background:#111;font-weight:650}label{display:block;margin-top:8px;color:var(--figma-color-text-secondary,#666);font-size:10px;font-weight:650}input,select,textarea{width:100%;margin-top:4px;padding:7px 8px;border:1px solid var(--figma-color-border,#ccc);border-radius:5px;background:var(--figma-color-bg,#fff)}:is(button,input,select,textarea):focus-visible{outline:2px solid #1684ff;outline-offset:2px}.auth{padding-top:40px}.auth>p:not(.eyebrow){color:var(--figma-color-text-secondary,#666)}.auth .primary{width:100%;margin:12px 0}.code-row{display:grid;grid-template-columns:1fr auto;gap:6px}.code-row button{align-self:end}.center{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--figma-color-text-secondary,#666)}.center strong{color:var(--figma-color-text,#222)}.section-title{display:flex;align-items:center;justify-content:space-between}.section-title span{color:var(--figma-color-text-secondary,#666)}.frames{display:grid;gap:8px;margin:0;padding:0;list-style:none}.frames li{display:grid;grid-template-columns:88px 1fr;gap:10px;padding:8px;border-radius:9px;background:var(--figma-color-bg-secondary,#f5f5f5)}.frames img{width:88px;height:88px;object-fit:cover;border-radius:5px;outline:1px solid oklch(0 0 0/.1)}.frame-fields label:first-child{margin-top:0}.frame-fields p{margin:4px 0;color:var(--figma-color-text-secondary,#666);font-size:10px}.existing{color:#9b6400!important}.progress[data-state=done]{color:#14733b!important}.progress[data-state=error],.error{color:#b42318!important}.grid,.settings{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}footer{position:sticky;bottom:-16px;display:flex;align-items:center;justify-content:space-between;margin:18px -16px -16px;padding:10px 16px;background:var(--figma-color-bg,#fff);border-top:1px solid var(--figma-color-border,#ddd)}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}@media(prefers-reduced-motion:reduce){button:active{scale:1}}
</style>
