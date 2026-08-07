<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type BoardRole = 'owner' | 'editor' | 'contributor' | 'viewer'
interface Collection { id:string; slug:string; title:string; mode:'dynamic'|'static'; expires_at:string|null; publication_enabled:boolean; content_strategy:'dynamic'|'snapshot'|'manual'; updated_at:string }
interface Member { user_id:string; role:BoardRole; allowed_users:{email:string|null;figma_handle:string|null;avatar_url:string|null}|null }
interface Filters { search:string; projectId:string|null; tagId:string|null; uploadedBy:string|null; dateFrom:string|null; dateTo:string|null }
interface Asset { id:string; title:string; description:string|null; previewUrl:string; preview2xUrl?:string|null; width:number; height:number }
interface Option { id:string; name:string }

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<{data:{collection:Collection&{filters:Filters};role:BoardRole;workspaceAdmin:boolean}}>(`/api/shares/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Board unavailable' })

const collection = reactive({ ...data.value!.data.collection })
const role = data.value!.data.role
const workspaceAdmin = data.value!.data.workspaceAdmin
const canEdit = computed(() => workspaceAdmin || ['owner','editor'].includes(role))
const canManageMembers = computed(() => workspaceAdmin || role === 'owner')
const feedback = reactive({ text:'', error:false })
const members = ref<Member[]>([])
const memberEmail = ref('')
const memberRole = ref<'editor'|'contributor'|'viewer'>('contributor')
const busy = ref(false)
const contentBusy = ref(false)
const boardAssets = ref<Asset[]>([])
const availableAssets = ref<Asset[]>([])
const projects = ref<Option[]>([])
const tags = ref<Option[]>([])
const filters = reactive({
  search: collection.filters.search,
  projectId: collection.filters.projectId ?? '',
  tagId: collection.filters.tagId ?? '',
  dateFrom: collection.filters.dateFrom?.slice(0,10) ?? '',
  dateTo: collection.filters.dateTo?.slice(0,10) ?? ''
})

const publicUrl = computed(() => `/s/${collection.slug}`)
const loadMembers = async () => {
  const response = await $fetch<{data:{members:Member[]}}>(`/api/shares/${id}/members`)
  members.value = response.data.members
}
const loadContent = async () => {
  const response = await $fetch<{data:{assets:Asset[]}}>(`/api/shares/${id}/content`)
  boardAssets.value=response.data.assets
}
const loadOptions = async () => {
  const [projectResponse,tagResponse]=await Promise.all([
    $fetch<{data:{projects:Option[]}}>('/api/projects'),
    $fetch<{data:{tags:Option[]}}>('/api/tags')
  ])
  projects.value=projectResponse.data.projects
  tags.value=tagResponse.data.tags
}
const loadAvailableAssets = async () => {
  if(collection.mode!=='static'||!canEdit.value)return
  const response=await $fetch<{data:{assets:Asset[]}}>('/api/assets',{query:{status:'approved',pageSize:60,sort:'newest'}})
  availableAssets.value=response.data.assets
}
await Promise.all([loadMembers(),loadContent(),loadOptions(),loadAvailableAssets()])

const rename = async (event:Event) => {
  feedback.text=''; feedback.error=false
  const input=event.target as HTMLInputElement
  const nextTitle=input.value.trim()
  if(!nextTitle || nextTitle===collection.title)return
  const previous=collection.title
  collection.title=nextTitle
  try { await $fetch(`/api/shares/${id}`,{method:'PATCH',body:{action:'rename',title:nextTitle}}); feedback.text='Saved' }
  catch { collection.title=previous; input.value=previous; feedback.text='Unable to rename. Try a different name.'; feedback.error=true }
}
const copyLink = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}${publicUrl.value}`)
  feedback.text='Public link copied.'; feedback.error=false
}
const setPublication = async (enabled:boolean) => {
  busy.value=true;feedback.text='';feedback.error=false
  try { await $fetch(`/api/shares/${id}`,{method:'PATCH',body:{action:enabled?'publish':'revoke'}});collection.publication_enabled=enabled;feedback.text=enabled?'Public link enabled.':'Public link disabled. The board remains available to its members.' }
  catch { feedback.text='Unable to update public access.';feedback.error=true }
  finally { busy.value=false }
}
const refreshSnapshot = async () => {
  busy.value=true; feedback.text=''; feedback.error=false
  try { const response=await $fetch<{data:{itemCount:number}}>(`/api/shares/${id}`,{method:'PATCH',body:{action:'refresh'}}); collection.content_strategy='snapshot'; await loadContent(); feedback.text=`Snapshot updated with ${response.data.itemCount} items.` }
  catch { feedback.text='Unable to update the snapshot.'; feedback.error=true }
  finally { busy.value=false }
}
const isoDate = (value:string,end=false) => value ? new Date(`${value}T${end?'23:59:59.999':'00:00:00.000'}`).toISOString() : null
const saveFilters = async () => {
  contentBusy.value=true; feedback.text=''; feedback.error=false
  try {
    await $fetch(`/api/shares/${id}`,{method:'PATCH',body:{action:'settings',filters:{
      search:filters.search,projectId:filters.projectId||null,tagId:filters.tagId||null,
      uploadedBy:collection.filters.uploadedBy,dateFrom:isoDate(filters.dateFrom),dateTo:isoDate(filters.dateTo,true)
    }}})
    await loadContent()
    feedback.text=collection.mode==='dynamic'?'Filters saved. The public board is updated.':'Filters saved. Update the snapshot when you want to replace its content.'
  } catch { feedback.text='Unable to save board filters.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const hasAsset = (assetId:string) => boardAssets.value.some(asset=>asset.id===assetId)
const addAsset = async (asset:Asset) => {
  contentBusy.value=true
  try { await $fetch(`/api/shares/${id}/assets`,{method:'POST',body:{assetId:asset.id}}); collection.content_strategy='manual'; await loadContent(); feedback.text=`${asset.title} added.`; feedback.error=false }
  catch { feedback.text='Unable to add this item.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const removeAsset = async (asset:Asset) => {
  contentBusy.value=true
  try { await $fetch(`/api/shares/${id}/assets/${asset.id}`,{method:'DELETE'}); collection.content_strategy='manual'; await loadContent(); feedback.text=`${asset.title} removed.`; feedback.error=false }
  catch { feedback.text='Unable to remove this item.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const saveMember = async () => {
  busy.value=true; feedback.text=''; feedback.error=false
  try { await $fetch(`/api/shares/${id}/members`,{method:'POST',body:{email:memberEmail.value,role:memberRole.value}}); memberEmail.value=''; await loadMembers(); feedback.text='Board access saved.' }
  catch { feedback.text='Unable to add this person. Add them to the workspace first.'; feedback.error=true }
  finally { busy.value=false }
}
const removeMember = async (member:Member) => {
  busy.value=true; feedback.text=''; feedback.error=false
  try { await $fetch(`/api/shares/${id}/members/${member.user_id}`,{method:'DELETE'}); await loadMembers(); feedback.text='Board access removed.' }
  catch { feedback.text='Unable to remove this board member.'; feedback.error=true }
  finally { busy.value=false }
}
</script>

<template>
  <div class="admin-shell board-shell">
    <header class="toolbar">
      <NuxtLink class="identity" to="/library">Content Library</NuxtLink>
      <span>Board settings</span>
      <span class="muted">{{ workspaceAdmin ? 'workspace admin' : role }}</span>
      <NuxtLink class="close" to="/library" aria-label="Close board settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg></NuxtLink>
    </header>
    <main>
      <section class="intro"><p>Board</p><h1>{{ collection.title }}</h1></section>
      <section class="settings" aria-labelledby="settings-title">
        <div><p class="section-label">Settings</p><h2 id="settings-title">Manage board</h2></div>
        <div class="settings-content">
          <label class="title-field"><span>Board name</span><input :value="collection.title" :readonly="!canEdit" maxlength="120" :aria-describedby="'board-title-feedback'" @change="rename"><small id="board-title-feedback" :class="{error:feedback.error}" role="status" aria-live="polite">{{ feedback.text }}</small></label>
          <dl><div><dt>Updates</dt><dd>{{ collection.mode === 'dynamic' ? 'Dynamic' : collection.content_strategy==='manual'?'Manual selection':'Filter snapshot' }}</dd></div><div><dt>Public access</dt><dd>{{ collection.publication_enabled?'Anyone with the link can view':'Disabled' }}</dd></div></dl>
          <div class="actions"><NuxtLink v-if="collection.publication_enabled" class="button-secondary" :to="publicUrl" target="_blank">View public page</NuxtLink><button v-if="collection.publication_enabled" class="button-secondary" type="button" @click="copyLink">Copy public link</button><button v-if="canEdit" class="button-secondary" type="button" :disabled="busy" @click="setPublication(!collection.publication_enabled)">{{ collection.publication_enabled?'Disable public link':'Enable public link' }}</button></div>
        </div>
      </section>
      <section class="content" aria-labelledby="content-title">
        <div><p class="section-label">Content</p><h2 id="content-title">{{ collection.mode==='dynamic' ? 'Choose what appears' : 'Manage snapshot' }}</h2></div>
        <div class="content-settings">
          <p class="muted content-explanation">{{ collection.mode==='dynamic' ? 'Approved items matching these filters appear on the public board automatically.' : collection.content_strategy==='manual' ? 'This board uses a manual selection. Rebuilding from filters will replace it.' : 'This frozen snapshot was generated from the saved filters. Adding or removing one item switches it to manual selection.' }}</p>
          <form v-if="canEdit" class="filter-form" @submit.prevent="saveFilters">
            <label>Search<input v-model="filters.search" type="search" placeholder="Any title or description"></label>
            <label>Project<select v-model="filters.projectId"><option value="">Any project</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label>
            <label>Tag<select v-model="filters.tagId"><option value="">Any tag</option><option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></label>
            <label>From<input v-model="filters.dateFrom" type="date" :max="filters.dateTo||undefined"></label>
            <label>To<input v-model="filters.dateTo" type="date" :min="filters.dateFrom||undefined"></label>
            <button class="button-secondary" type="submit" :disabled="contentBusy">Save filters</button>
          </form>
          <div class="content-heading"><strong>{{ boardAssets.length }} {{ boardAssets.length===1?'item':'items' }} on this board</strong><button v-if="collection.mode==='static'&&canEdit" class="button-secondary" type="button" :disabled="busy" @click="refreshSnapshot">Replace with filter snapshot</button></div>
          <div v-if="boardAssets.length" class="asset-grid">
            <article v-for="asset in boardAssets" :key="asset.id" class="content-card"><div class="image-wrap" :style="{aspectRatio:`${asset.width}/${asset.height}`}"><img :src="asset.previewUrl" :srcset="asset.preview2xUrl?`${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x`:undefined" :alt="asset.title"></div><div><strong>{{ asset.title }}</strong><button v-if="collection.mode==='static'&&canEdit" class="button-secondary" type="button" :disabled="contentBusy" @click="removeAsset(asset)">Remove</button></div></article>
          </div>
          <p v-else class="muted">No content matches this board yet.</p>
          <template v-if="collection.mode==='static'&&canEdit">
            <h3>Add approved content</h3>
            <div class="asset-grid available-grid"><article v-for="asset in availableAssets" :key="asset.id" class="content-card" :class="{selected:hasAsset(asset.id)}"><div class="image-wrap" :style="{aspectRatio:`${asset.width}/${asset.height}`}"><img :src="asset.previewUrl" :srcset="asset.preview2xUrl?`${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x`:undefined" :alt="asset.title"></div><div><strong>{{ asset.title }}</strong><button class="button-secondary" type="button" :disabled="contentBusy||hasAsset(asset.id)" @click="addAsset(asset)">{{ hasAsset(asset.id)?'Added':'Add' }}</button></div></article></div>
          </template>
        </div>
      </section>
      <section class="members" aria-labelledby="members-title">
        <div><p class="section-label">Private access</p><h2 id="members-title">Board members</h2></div>
        <div>
          <p class="muted member-explanation">Members manage this board after signing in. They do not control who can view its public link. Workspace admins can manage every board without being added here.</p>
          <form v-if="canManageMembers" class="member-form" @submit.prevent="saveMember"><label>Email<input v-model="memberEmail" required type="email" autocomplete="email"></label><label>Board role<select v-model="memberRole"><option value="editor">Editor</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select></label><button class="button-secondary" type="submit" :disabled="busy">Save access</button></form>
          <ul><li v-for="member in members" :key="member.user_id"><div><strong>{{ member.allowed_users?.email ?? member.allowed_users?.figma_handle ?? 'Workspace member' }}</strong><span class="muted">{{ member.role }}</span></div><button v-if="canManageMembers && member.role!=='owner'" class="button-secondary" type="button" :disabled="busy" @click="removeMember(member)">Remove</button></li></ul>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.toolbar>span:nth-child(3){text-align:right;text-transform:capitalize}.section-label{margin:0;color:var(--color-muted)}.settings,.content,.members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space);padding:var(--section-gap) 0}.settings>div:last-child,.content>div:last-child,.members>div:last-child{grid-column:2/5}.settings h2,.content h2,.members h2{margin-top:6px}.settings-content,.content-settings{display:grid;gap:var(--space)}.title-field{display:grid;gap:6px}.title-field>span,dt{color:var(--color-muted)}.title-field input{width:100%;min-height:44px}.title-field small{height:1em;color:var(--color-muted)}.title-field small.error{color:var(--color-danger)}dl{margin:0}dl>div{display:grid;grid-template-columns:1fr 2fr;gap:var(--space);padding:12px 0}dt,dd{margin:0}.actions{display:flex;flex-wrap:wrap;gap:calc(var(--space)/2)}.content,.members{border-top:1px solid var(--color-line)}.content-explanation{max-width:50rem;margin:0}.filter-form{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;align-items:end;gap:var(--space)}.filter-form label{display:grid;gap:6px;color:var(--color-muted)}.filter-form input,.filter-form select{width:100%;min-height:44px}.filter-form button{grid-column:1;justify-self:start}.content-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space);margin-top:var(--space)}.asset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space)}.content-card{min-width:0}.image-wrap{overflow:hidden;background:var(--color-surface)}.image-wrap img{width:100%;height:100%;display:block;object-fit:contain}.content-card>div:last-child{display:flex;align-items:start;justify-content:space-between;gap:8px;padding-top:8px}.content-card strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.content-card button{flex:0 0 auto}.available-grid .selected{opacity:.45}.content-settings h3{margin:var(--section-gap) 0 0}.member-explanation{max-width:42rem;margin:0 0 var(--space)}.member-form{display:grid;grid-template-columns:1fr 14rem auto;align-items:end;gap:var(--space);margin-bottom:var(--space)}.member-form label{display:grid;gap:6px;color:var(--color-muted)}.member-form input,.member-form select{width:100%;min-height:44px}.member-form button{margin:0}ul{margin:0;padding:0;list-style:none}li{min-height:64px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:var(--space)}li>div{display:grid}@media(max-width:1000px){.filter-form{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.settings,.content,.members{grid-template-columns:1fr}.settings>div:last-child,.content>div:last-child,.members>div:last-child{grid-column:1}.member-form,.filter-form{grid-template-columns:1fr}.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar>span:nth-child(3){display:none}}@media(max-width:460px){.asset-grid{grid-template-columns:1fr}}
</style>
