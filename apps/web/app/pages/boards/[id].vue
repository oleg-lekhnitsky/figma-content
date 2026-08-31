<script setup lang="ts">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'
import { Xmark } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })

type BoardRole = 'owner' | 'editor' | 'contributor' | 'viewer'
type WorkspaceRole = 'viewer' | 'contributor' | 'editor' | 'admin'
interface ContactLink { label:string; url:string }
interface Collection { id:string; slug:string; title:string; purpose:'showcase'|'review'|'portfolio'|'case'; review_month:string|null; submission_deadline:string|null; portfolio_kind:'main'|'client'|null; portfolio_client:string|null; introduction:string|null; contact_heading:string|null; contact_links:ContactLink[]|null; mode:'dynamic'|'static'; layout:BoardLayout; view_settings?:BoardViewSettings|null; expires_at:string|null; publication_enabled:boolean; content_strategy:'dynamic'|'snapshot'|'manual'; updated_at:string }
interface Member { user_id:string; role:BoardRole; allowed_users:{email:string|null;figma_handle:string|null;avatar_url:string|null}|null }
interface Filters { search:string; projectId:string|null; tagId:string|null; projectIds:string[]; tagIds:string[]; uploadedBy:string|null; dateFrom:string|null; dateTo:string|null }
interface Asset { id:string; title:string; description:string|null; previewUrl:string; preview2xUrl?:string|null; mime_type?:string|null; width:number; height:number; status:'draft'|'approved'; uploaded_by:string; projects?:{name:string}|null; allowed_users?:{email:string|null;figma_handle:string|null;avatar_url:string|null}|null; submission?:{review_status:'ready'|'reviewed';created_at:string;reviewed_at:string|null}|null }
interface Option { id:string; name:string }

const route = useRoute()
const id = String(route.params.id)
const apiFetch = useRequestFetch()
const { data, error } = await useFetch<{data:{collection:Collection&{filters:Filters};role:BoardRole;currentUserId:string;workspaceRole:WorkspaceRole;workspaceAdmin:boolean}}>(`/api/shares/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Board unavailable' })

const collection = reactive({ ...data.value!.data.collection })
if (collection.purpose === 'showcase' || collection.purpose === 'case') {
  throw createError({ statusCode: 404, statusMessage: 'This board opens in the library' })
}
const defaultViewSettings:BoardViewSettings={showText:true,radius:'default',gap:'default',columns:'auto'}
const viewSettings=ref<BoardViewSettings>({ ...defaultViewSettings, ...(collection.view_settings ?? {}) })
provide('boardViewSettings', viewSettings)
const portfolioKind = ref<'main'|'client'>(collection.portfolio_kind ?? 'client')
const portfolioClient = ref(collection.portfolio_client ?? '')
const introduction = ref(collection.introduction ?? '')
const contactHeading = ref(collection.contact_heading ?? '')
const contactLinks = ref<ContactLink[]>(Array.isArray(collection.contact_links) ? collection.contact_links.map(link => ({ ...link })) : [])
const role = data.value!.data.role
const currentUserId = data.value!.data.currentUserId
const workspaceRole = data.value!.data.workspaceRole
const workspaceAdmin = data.value!.data.workspaceAdmin
const canEdit = computed(() => workspaceAdmin || ['owner','editor'].includes(role))
const canManageMembers = computed(() => workspaceAdmin || role === 'owner')
const canApprove = computed(() => ['editor','admin'].includes(workspaceRole))
const activeView = computed(() => {
  if (collection.purpose !== 'review') return 'settings'
  const view = String(route.query.view ?? 'review')
  return ['review','members','settings'].includes(view) ? view : 'review'
})
const reviewFilter = ref<'all'|'ready'|'reviewed'>('all')
const groupBy = ref<'contributor'|'project'>('contributor')
const selectedAssetIds = reactive(new Set<string>())
const feedback = reactive({ text:'', error:false })
const portfolioTitleDraft = ref(collection.title)
const portfolioTitleInput = ref<HTMLTextAreaElement | null>(null)
const members = ref<Member[]>([])
const memberEmail = ref('')
const memberRole = ref<'editor'|'contributor'|'viewer'>('contributor')
const busy = ref(false)
const contentBusy = ref(false)
const deleteDialogOpen = ref(false)
const deleteError = ref('')
const filtersExpanded = ref(false)
const compactFiltersVisible = ref(true)
const boardAssets = ref<Asset[]>([])
const projects = ref<Option[]>([])
const tags = ref<Option[]>([])
const initialProjectIds = Array.isArray(collection.filters.projectIds) ? collection.filters.projectIds : []
const initialTagIds = Array.isArray(collection.filters.tagIds) ? collection.filters.tagIds : []
const filters = reactive({
  search: collection.filters.search,
  projectIds: initialProjectIds.length ? [...initialProjectIds] : collection.filters.projectId ? [collection.filters.projectId] : [],
  tagIds: initialTagIds.length ? [...initialTagIds] : collection.filters.tagId ? [collection.filters.tagId] : [],
  dateFrom: collection.filters.dateFrom?.slice(0,10) ?? '',
  dateTo: collection.filters.dateTo?.slice(0,10) ?? ''
})
const activeFilterCount = computed(() => [filters.search,filters.projectIds.length,filters.tagIds.length,filters.dateFrom,filters.dateTo].filter(Boolean).length)
let filterSaveTimer: ReturnType<typeof setTimeout> | undefined

const publicUrl = computed(() => `/s/${collection.slug}`)
const loadMembers = async () => {
  const response = await apiFetch<{data:{members:Member[]}}>(`/api/shares/${id}/members`)
  members.value = response.data.members
}
const loadContent = async () => {
  const response = await apiFetch<{data:{assets:Asset[]}}>(`/api/shares/${id}/content`)
  boardAssets.value=response.data.assets
}
const loadOptions = async () => {
  const [projectResponse,tagResponse]=await Promise.all([
    apiFetch<{data:{projects:Option[]}}>('/api/projects'),
    apiFetch<{data:{tags:Option[]}}>('/api/tags')
  ])
  projects.value=projectResponse.data.projects
  tags.value=tagResponse.data.tags
}
await Promise.all([loadMembers(),loadContent(),loadOptions()])

const resizePortfolioTitle = async () => {
  await nextTick()
  const input=portfolioTitleInput.value
  if(!input)return
  input.style.height='auto'
  input.style.height=`${input.scrollHeight}px`
}
const handlePortfolioTitleKeydown = (event:KeyboardEvent) => {
  const input=event.currentTarget as HTMLTextAreaElement
  if(event.key==='Enter'){event.preventDefault();input.blur()}
  if(event.key==='Escape'){event.preventDefault();portfolioTitleDraft.value=collection.title;input.blur()}
}
const rename = async (event:Event) => {
  feedback.text=''; feedback.error=false
  const input=event.target as HTMLInputElement | HTMLTextAreaElement
  const nextTitle=input.value.trim()
  if(!nextTitle){portfolioTitleDraft.value=collection.title;void resizePortfolioTitle();return}
  if(nextTitle===collection.title)return
  const previous=collection.title
  collection.title=nextTitle
  try { await apiFetch(`/api/shares/${id}`,{method:'PATCH',body:{action:'rename',title:nextTitle}}); feedback.text='Saved' }
  catch { collection.title=previous; portfolioTitleDraft.value=previous; input.value=previous; void resizePortfolioTitle(); feedback.text='Unable to rename. Try a different name.'; feedback.error=true }
}
const copyLink = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}${publicUrl.value}`)
  feedback.text='Public link copied.'; feedback.error=false
}
const setPublication = async (enabled:boolean) => {
  busy.value=true;feedback.text='';feedback.error=false
  try { await apiFetch(`/api/shares/${id}`,{method:'PATCH',body:{action:enabled?'publish':'revoke'}});collection.publication_enabled=enabled;feedback.text=enabled?'Public link enabled.':'Public link disabled. The board remains available to its members.' }
  catch { feedback.text='Unable to update public access.';feedback.error=true }
  finally { busy.value=false }
}
const savePortfolioSettings = async () => {
  busy.value=true; feedback.text=''; feedback.error=false
  try {
    const response=await apiFetch<{data:{collection:Pick<Collection,'portfolio_kind'|'portfolio_client'|'introduction'|'contact_heading'|'contact_links'>}}>(`/api/shares/${id}`,{method:'PATCH',body:{
      action:'portfolio-settings',portfolioKind:portfolioKind.value,
      portfolioClient:portfolioKind.value==='client'?(portfolioClient.value.trim()||null):null,
      introduction:introduction.value.trim()||null,
      contactHeading:contactHeading.value.trim()||null,
      contactLinks:contactLinks.value.map(link => ({label:link.label.trim(),url:link.url.trim()}))
    }})
    Object.assign(collection,response.data.collection)
    feedback.text='Portfolio details saved.'
  } catch { feedback.text='Unable to save portfolio details.'; feedback.error=true }
  finally { busy.value=false }
}
const addContactLink = () => contactLinks.value.push({label:'',url:''})
const removeContactLink = (index:number) => contactLinks.value.splice(index,1)
const moveContactLink = (index:number,direction:-1|1) => {
  const target=index+direction
  if(target<0||target>=contactLinks.value.length)return
  ;[contactLinks.value[index],contactLinks.value[target]]=[contactLinks.value[target]!,contactLinks.value[index]!]
}
const isoDate = (value:string,end=false) => value ? new Date(`${value}T${end?'23:59:59.999':'00:00:00.000'}`).toISOString() : null
const saveFilters = async () => {
  contentBusy.value=true; feedback.text=''; feedback.error=false
  try {
    await apiFetch(`/api/shares/${id}`,{method:'PATCH',body:{action:'settings',filters:{
      search:filters.search,projectId:null,tagId:null,projectIds:filters.projectIds,tagIds:filters.tagIds,
      uploadedBy:collection.filters.uploadedBy,dateFrom:isoDate(filters.dateFrom),dateTo:isoDate(filters.dateTo,true)
    }}})
    await loadContent()
    feedback.text=collection.mode==='dynamic'?'Board updated.':'Filters updated. Replace the snapshot when you are ready.'
  } catch { feedback.text='Unable to save board filters.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const clearFilters = () => {
  filters.search=''
  filters.projectIds=[]
  filters.tagIds=[]
  filters.dateFrom=''
  filters.dateTo=''
}
const openFilters = () => {
  compactFiltersVisible.value=false
  filtersExpanded.value=true
}
const closeFilters = () => {
  filtersExpanded.value=false
}
const finishFiltersClose = () => {
  if(!filtersExpanded.value) compactFiltersVisible.value=true
}
watch(() => [filters.search,filters.projectIds.join(','),filters.tagIds.join(','),filters.dateFrom,filters.dateTo], () => {
  clearTimeout(filterSaveTimer)
  filterSaveTimer=setTimeout(() => { void saveFilters() },450)
})
onBeforeUnmount(() => { clearTimeout(filterSaveTimer) })
const submitterName = (asset:Asset) => asset.allowed_users?.figma_handle || asset.allowed_users?.email || 'Workspace member'
const canRemoveAsset = (asset:Asset) => canEdit.value || asset.uploaded_by === currentUserId
const visibleReviewAssets = computed(() => reviewFilter.value === 'all'
  ? boardAssets.value
  : boardAssets.value.filter(asset => (asset.submission?.review_status ?? 'ready') === reviewFilter.value))
const reviewGroups = computed(() => {
  const groups = new Map<string,{id:string;name:string;avatarUrl:string|null;assets:Asset[]}>()
  for (const asset of visibleReviewAssets.value) {
    const id = groupBy.value === 'project' ? `project:${asset.projects?.name ?? 'none'}` : asset.uploaded_by
    const name = groupBy.value === 'project' ? asset.projects?.name ?? 'No project' : submitterName(asset)
    const current = groups.get(id)
    if (current) current.assets.push(asset)
    else groups.set(id, {
      id,
      name,
      avatarUrl: groupBy.value === 'contributor' ? asset.allowed_users?.avatar_url ?? null : null,
      assets: [asset]
    })
  }
  return [...groups.values()].sort((a,b) => a.name.localeCompare(b.name))
})
const reviewCount = (status:'ready'|'reviewed') => boardAssets.value.filter(asset => (asset.submission?.review_status ?? 'ready') === status).length
const selectedAssets = computed(() => boardAssets.value.filter(asset => selectedAssetIds.has(asset.id)))
const selectedHasDraft = computed(() => selectedAssets.value.some(asset => asset.status === 'draft'))
const selectedHasReady = computed(() => selectedAssets.value.some(asset => (asset.submission?.review_status ?? 'ready') === 'ready'))
const selectedHasReviewed = computed(() => selectedAssets.value.some(asset => asset.submission?.review_status === 'reviewed'))
const allVisibleSelected = computed(() => visibleReviewAssets.value.length > 0 && visibleReviewAssets.value.every(asset => selectedAssetIds.has(asset.id)))
const toggleSelection = (asset:Asset) => selectedAssetIds.has(asset.id) ? selectedAssetIds.delete(asset.id) : selectedAssetIds.add(asset.id)
const toggleVisibleSelection = () => {
  if (allVisibleSelected.value) visibleReviewAssets.value.forEach(asset => selectedAssetIds.delete(asset.id))
  else visibleReviewAssets.value.forEach(asset => selectedAssetIds.add(asset.id))
}
const setLayout = async (layout:BoardLayout) => {
  if (layout===collection.layout || !canEdit.value) return
  const previous=collection.layout
  collection.layout=layout
  feedback.text=''; feedback.error=false
  try { await apiFetch(`/api/shares/${id}`,{method:'PATCH',body:{action:'layout',layout}}); feedback.text=`${layout.charAt(0).toUpperCase()+layout.slice(1)} layout saved.` }
  catch { collection.layout=previous; feedback.text='Unable to save the board layout.'; feedback.error=true }
}
const applyDecision = async (assets:Asset[],decision:'approve'|'pass'|'reopen') => {
  const eligibleAssets=assets.filter(asset => decision==='approve'
    ? asset.status==='draft'
    : decision==='pass'
      ? (asset.submission?.review_status??'ready')==='ready'
      : asset.submission?.review_status==='reviewed')
  if (!eligibleAssets.length) return
  contentBusy.value=true; feedback.text=''; feedback.error=false
  try {
    await apiFetch(`/api/shares/${id}/review`,{method:'PATCH',body:{assetIds:eligibleAssets.map(asset=>asset.id),decision}})
    const reviewStatus=decision==='reopen'?'ready':'reviewed'
    for (const asset of eligibleAssets) {
      if (decision==='approve') asset.status='approved'
      if (asset.submission) asset.submission.review_status=reviewStatus
      else asset.submission={review_status:reviewStatus,created_at:new Date().toISOString(),reviewed_at:reviewStatus==='reviewed'?new Date().toISOString():null}
      selectedAssetIds.delete(asset.id)
    }
    const subject=eligibleAssets.length===1?eligibleAssets[0]!.title:`${eligibleAssets.length} submissions`
    feedback.text=decision==='approve'?`${subject} approved and reviewed.`:decision==='pass'?`${subject} passed without approval.`:`${subject} moved back to ready.`
  } catch { feedback.text='Unable to apply this review decision.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const removeAsset = async (asset:Asset) => {
  if (contentBusy.value) return
  const previous=[...boardAssets.value]
  boardAssets.value=previous.filter(item=>item.id!==asset.id)
  selectedAssetIds.delete(asset.id)
  collection.content_strategy='manual'
  feedback.text=`${asset.title} removed.`; feedback.error=false
  contentBusy.value=true
  try { await apiFetch(`/api/shares/${id}/assets/${asset.id}`,{method:'DELETE'}) }
  catch { boardAssets.value=previous; feedback.text='Unable to remove this item.'; feedback.error=true }
  finally { contentBusy.value=false }
}
const boardAssetIndex = (assetId:string) => boardAssets.value.findIndex(asset => asset.id===assetId)
const reorderBoardAssets = async (fromIndex:number,toIndex:number) => {
  if (!canEdit.value||contentBusy.value||fromIndex===toIndex) return
  const previous=[...boardAssets.value]
  const next=[...previous]
  const [moved]=next.splice(fromIndex,1)
  if (!moved||toIndex<0||toIndex>=next.length+1) return
  next.splice(toIndex,0,moved)
  boardAssets.value=next
  contentBusy.value=true; feedback.text=''; feedback.error=false
  try {
    await apiFetch(`/api/shares/${id}/order`,{method:'PATCH',body:{assetIds:next.map(asset=>asset.id)}})
    feedback.text='Board order updated.'
  } catch {
    boardAssets.value=previous
    feedback.text='Unable to save the board order.'; feedback.error=true
  } finally { contentBusy.value=false }
}
const moveBoardAsset = (assetId:string,direction:-1|1) => {
  const fromIndex=boardAssetIndex(assetId)
  const toIndex=fromIndex+direction
  if (fromIndex>=0&&toIndex>=0&&toIndex<boardAssets.value.length) void reorderBoardAssets(fromIndex,toIndex)
}
const saveMember = async () => {
  busy.value=true; feedback.text=''; feedback.error=false
  try { await apiFetch(`/api/shares/${id}/members`,{method:'POST',body:{email:memberEmail.value,role:memberRole.value}}); memberEmail.value=''; await loadMembers(); feedback.text='Board access saved.' }
  catch { feedback.text='Unable to add this person. Add them to the workspace first.'; feedback.error=true }
  finally { busy.value=false }
}
const removeMember = async (member:Member) => {
  busy.value=true; feedback.text=''; feedback.error=false
  try { await apiFetch(`/api/shares/${id}/members/${member.user_id}`,{method:'DELETE'}); await loadMembers(); feedback.text='Board access removed.' }
  catch { feedback.text='Unable to remove this board member.'; feedback.error=true }
  finally { busy.value=false }
}
const openDeleteDialog = () => {
  deleteError.value=''
  deleteDialogOpen.value=true
}
const deleteBoard = async () => {
  busy.value=true; deleteError.value=''
  try {
    await apiFetch(`/api/shares/${id}`,{method:'DELETE'})
    deleteDialogOpen.value=false
    await navigateTo('/library')
  } catch { deleteError.value='Unable to delete this board. Check your connection and try again.' }
  finally { busy.value=false }
}
</script>

<template>
  <div class="admin-shell board-shell" :class="{ 'portfolio-settings-page selection-panel--filter-overlay': collection.purpose === 'portfolio' }">
    <header class="toolbar">
      <WorkspaceSwitcher class="identity" />
      <span>{{ collection.purpose === 'portfolio' ? 'Portfolio settings' : collection.purpose === 'review' ? activeView === 'review' ? 'Board review' : activeView === 'members' ? 'Board members' : 'Board settings' : 'Board settings' }}</span>
      <span class="muted">{{ workspaceAdmin ? 'workspace admin' : role }}</span>
      <NuxtLink class="close" :to="collection.purpose === 'portfolio' ? '/portfolio' : { path: '/library', query: { board: collection.id } }" aria-label="Close board settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg></NuxtLink>
    </header>
    <main>
      <section class="intro"><p>{{ collection.purpose === 'review' ? 'Monthly review' : 'Board' }}</p><h1>{{ collection.title }}</h1><div v-if="collection.purpose === 'review'" class="review-summary"><span>{{ collection.review_month ? new Date(`${collection.review_month}T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'}) : 'Monthly review' }}</span><span>{{ collection.submission_deadline ? `Due ${new Date(collection.submission_deadline).toLocaleDateString()}` : 'No deadline' }}</span><div class="member-avatars" aria-label="Board members"><span v-for="member in members.slice(0,5)" :key="member.user_id" :title="member.allowed_users?.figma_handle || member.allowed_users?.email || member.role"><img v-if="member.allowed_users?.avatar_url" :src="member.allowed_users.avatar_url" alt=""><span v-else aria-hidden="true">{{ (member.allowed_users?.figma_handle || member.allowed_users?.email || '?').charAt(0).toUpperCase() }}</span></span><span v-if="members.length>5" class="avatar-more">+{{ members.length-5 }}</span></div></div></section>
      <nav v-if="collection.purpose === 'review'" class="review-tabs" aria-label="Board views"><NuxtLink :class="{active:activeView==='review'}" :to="{query:{view:'review'}}">Review</NuxtLink><NuxtLink :class="{active:activeView==='members'}" :to="{query:{view:'members'}}">Members</NuxtLink><NuxtLink :class="{active:activeView==='settings'}" :to="{query:{view:'settings'}}">Settings</NuxtLink></nav>
      <section v-if="collection.purpose === 'review' && activeView === 'review'" class="review-workspace" aria-labelledby="review-title">
        <header class="review-heading"><div><p class="section-label">Review queue</p><h2 id="review-title">Submitted work</h2></div><p class="muted">New work is submitted from the Figma plugin.</p></header>
        <div class="review-toolbar"><div class="review-controls" role="group" aria-label="Filter submissions"><button type="button" class="button-secondary" :class="{active:reviewFilter==='all'}" @click="reviewFilter='all'">All <span>{{ boardAssets.length }}</span></button><button type="button" class="button-secondary" :class="{active:reviewFilter==='ready'}" @click="reviewFilter='ready'">Ready <span>{{ reviewCount('ready') }}</span></button><button type="button" class="button-secondary" :class="{active:reviewFilter==='reviewed'}" @click="reviewFilter='reviewed'">Reviewed <span>{{ reviewCount('reviewed') }}</span></button></div><div class="review-toolbar-actions"><LayoutControl v-if="canEdit" :model-value="collection.layout" @update:model-value="setLayout" /><button v-if="canEdit" class="button-secondary select-visible" type="button" :disabled="contentBusy||!visibleReviewAssets.length" @click="toggleVisibleSelection">{{ allVisibleSelected?'Deselect visible':'Select visible' }}</button><label v-if="collection.layout!=='presentation'" class="group-control">Group by<select v-model="groupBy"><option value="contributor">Contributor</option><option value="project">Project</option></select></label></div></div>
        <p class="review-feedback" :class="{error:feedback.error}" role="status" aria-live="polite">{{ feedback.text }}</p>
        <div v-if="reviewGroups.length&&collection.layout!=='presentation'" class="review-groups">
          <section v-for="(group,groupIndex) in reviewGroups" :key="group.id" class="review-group" :aria-labelledby="`group-${groupIndex}`"><header><div class="submitter"><span v-if="groupBy==='contributor'" class="submitter-avatar"><img v-if="group.avatarUrl" :src="group.avatarUrl" alt=""><span v-else aria-hidden="true">{{ group.name.charAt(0).toUpperCase() }}</span></span><h3 :id="`group-${groupIndex}`">{{ group.name }}</h3></div><span class="muted">{{ group.assets.length }} {{ group.assets.length===1?'submission':'submissions' }}</span></header><BoardLayoutRenderer :assets="group.assets" :layout="collection.layout" :label="`${group.name} submissions`" heading-tag="h4" selectable :selected-ids="[...selectedAssetIds]" @toggle-selection="toggleSelection"><template #details="{asset}"><div v-if="groupBy==='project'" class="card-submitter"><span class="card-submitter-avatar"><img v-if="asset.allowed_users?.avatar_url" :src="asset.allowed_users.avatar_url" alt=""><span v-else aria-hidden="true">{{ submitterName(asset).charAt(0).toUpperCase() }}</span></span><span>{{ submitterName(asset) }}</span></div><p>{{ groupBy === 'contributor' && asset.projects?.name ? `${asset.projects.name} · ` : '' }}{{ asset.status }} · {{ asset.submission?.review_status ?? 'ready' }}</p></template><template #previewActions="{asset}"><div class="card-actions"><button v-if="canApprove&&asset.status==='draft'" class="button-secondary approve-button" type="button" :disabled="contentBusy" @click="applyDecision([asset],'approve')">Approve</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='ready'&&asset.status==='draft'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'pass')">Pass</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='ready'&&asset.status==='approved'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'pass')">Complete</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='reviewed'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'reopen')">Reopen</button><button v-if="canRemoveAsset(asset)" class="button-secondary remove-icon" type="button" :disabled="contentBusy" :aria-label="`Remove ${asset.title}`" title="Remove" @click="removeAsset(asset)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg></button></div></template></BoardLayoutRenderer></section>
        </div>
        <AssetPresentation v-else-if="visibleReviewAssets.length" :assets="visibleReviewAssets" label="Submitted work presentation" selectable :selected-ids="[...selectedAssetIds]" @toggle-selection="toggleSelection"><template #details="{asset}"><div class="card-submitter"><span class="card-submitter-avatar"><img v-if="asset.allowed_users?.avatar_url" :src="asset.allowed_users.avatar_url" alt=""><span v-else aria-hidden="true">{{ submitterName(asset).charAt(0).toUpperCase() }}</span></span><span>{{ submitterName(asset) }}</span></div><p>{{ asset.projects?.name ? `${asset.projects.name} · ` : '' }}{{ asset.status }} · {{ asset.submission?.review_status ?? 'ready' }}</p></template><template #previewActions="{asset}"><div class="card-actions"><button v-if="canApprove&&asset.status==='draft'" class="button-secondary approve-button" type="button" :disabled="contentBusy" @click="applyDecision([asset],'approve')">Approve</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='ready'&&asset.status==='draft'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'pass')">Pass</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='ready'&&asset.status==='approved'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'pass')">Complete</button><button v-if="canEdit&&(asset.submission?.review_status??'ready')==='reviewed'" class="button-secondary" type="button" :disabled="contentBusy" @click="applyDecision([asset],'reopen')">Reopen</button><button v-if="canRemoveAsset(asset)" class="button-secondary remove-icon" type="button" :disabled="contentBusy" :aria-label="`Remove ${asset.title}`" title="Remove" @click="removeAsset(asset)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg></button></div></template></AssetPresentation>
        <div v-else class="review-empty"><strong>{{ boardAssets.length ? `No ${reviewFilter} submissions` : 'No submissions yet' }}</strong><span class="muted">{{ boardAssets.length ? 'Choose another filter to see submitted work.' : 'Designers can select this board as a destination in the Figma plugin.' }}</span></div>
        <SelectionPanel :visible="Boolean(selectedAssets.length)" label="Selected submission actions" close-label="Clear selection" :close-disabled="contentBusy" @close="selectedAssetIds.clear()"><strong>{{ selectedAssets.length }} selected</strong><button v-if="canApprove&&selectedHasDraft" type="button" :disabled="contentBusy" @click="applyDecision(selectedAssets,'approve')">Approve</button><button v-if="selectedHasReady" type="button" :disabled="contentBusy" @click="applyDecision(selectedAssets,'pass')">Pass</button><button v-if="selectedHasReviewed" type="button" :disabled="contentBusy" @click="applyDecision(selectedAssets,'reopen')">Reopen</button></SelectionPanel>
      </section>
      <section v-if="collection.purpose !== 'review' || activeView === 'settings'" class="settings" aria-labelledby="settings-title">
        <div><p v-if="collection.purpose !== 'portfolio'" class="section-label">Settings</p><h2 id="settings-title" :class="{ 'filter-overlay-title': collection.purpose === 'portfolio' }">{{ collection.purpose === 'portfolio' ? 'Portfolio details' : 'Manage board' }}</h2></div>
        <div class="settings-content" :class="{ 'asset-filter-controls asset-filter-controls--expanded': collection.purpose === 'portfolio' }">
          <div :class="{ 'filter-sheet-content': collection.purpose === 'portfolio' }">
          <div v-if="collection.purpose === 'portfolio'" class="board-settings-intro portfolio-title-intro">
            <h2 class="shared-editable-title"><textarea v-if="canEdit" ref="portfolioTitleInput" v-model="portfolioTitleDraft" class="shared-editable-title-input" rows="1" maxlength="120" aria-label="Portfolio name" :aria-invalid="feedback.error || undefined" aria-describedby="board-title-feedback" @input="resizePortfolioTitle" @change="rename" @keydown="handlePortfolioTitleKeydown" /><span class="shared-editable-title-display" :aria-hidden="canEdit || undefined">{{ collection.title }}</span></h2>
            <p class="board-type-summary">{{ portfolioKind === 'main' ? 'Main portfolio.' : 'Client version.' }}<template v-if="portfolioKind === 'client' && portfolioClient.trim()"> {{ portfolioClient.trim() }}</template></p>
            <small id="board-title-feedback" class="shared-editable-title-feedback" :class="{error:feedback.error}" role="status" aria-live="polite">{{ feedback.text }}</small>
          </div>
          <label v-else class="title-field"><span>Board name</span><input :value="collection.title" :readonly="!canEdit" maxlength="120" aria-describedby="board-title-feedback" @change="rename"><small id="board-title-feedback" :class="{error:feedback.error}" role="status" aria-live="polite">{{ feedback.text }}</small></label>
          <form v-if="collection.purpose === 'portfolio' && canEdit" class="portfolio-settings" @submit.prevent="savePortfolioSettings">
            <section class="filter-option-group" role="group" aria-labelledby="portfolio-type-title"><h3 id="portfolio-type-title">Portfolio type</h3><div class="filter-option-list filter-option-list--segmented"><button type="button" :aria-pressed="portfolioKind === 'main'" @click="portfolioKind = 'main'">Main portfolio</button><button type="button" :aria-pressed="portfolioKind === 'client'" @click="portfolioKind = 'client'">Client version</button></div></section>
            <section v-if="portfolioKind === 'client'" class="filter-option-group"><h3>Client or recipient</h3><input v-model="portfolioClient" class="panel-field" required maxlength="120" autocomplete="off"></section>
            <section class="filter-option-group"><h3>Introduction</h3><textarea v-model="introduction" class="panel-field portfolio-introduction" rows="4" maxlength="2000" placeholder="A short note about this selection"></textarea></section>
            <section class="filter-option-group contact-fields" aria-labelledby="portfolio-contact-title"><h3 id="portfolio-contact-title">Contact</h3><label class="contact-heading"><span class="filter-option-label">Closing message</span><input v-model="contactHeading" class="panel-field" maxlength="160" placeholder="Let’s work together"></label><div v-for="(link,index) in contactLinks" :key="index" class="contact-link-row"><label><span class="filter-option-label">Link label</span><input v-model="link.label" class="panel-field" required maxlength="80" placeholder="Email"></label><label><span class="filter-option-label">URL</span><input v-model="link.url" class="panel-field" required inputmode="url" placeholder="mailto:you@example.com"></label><div class="contact-link-actions filter-option-list"><button type="button" :disabled="index===0" :aria-label="`Move ${link.label || `link ${index+1}`} earlier`" @click="moveContactLink(index,-1)">↑</button><button type="button" :disabled="index===contactLinks.length-1" :aria-label="`Move ${link.label || `link ${index+1}`} later`" @click="moveContactLink(index,1)">↓</button><button type="button" @click="removeContactLink(index)">Remove</button></div></div><button class="panel-secondary-action add-contact-link" type="button" @click="addContactLink">Add link</button></section>
            <div class="board-settings-actions"><button class="panel-secondary-action" type="submit" :disabled="busy">Save portfolio details</button></div>
          </form>
          <section v-if="collection.purpose === 'portfolio'" class="portfolio-publishing filter-option-group" aria-labelledby="portfolio-publishing-title">
            <div class="portfolio-section-heading"><h3 id="portfolio-publishing-title">Publishing</h3><p class="muted">{{ collection.publication_enabled ? 'Your portfolio is available through its public link.' : 'Publish when the portfolio is ready to share.' }}</p></div>
            <div class="portfolio-publishing-actions"><NuxtLink v-if="collection.publication_enabled" class="panel-secondary-action" :to="publicUrl" target="_blank">View portfolio</NuxtLink><button v-if="collection.publication_enabled" class="panel-secondary-action" type="button" @click="copyLink">Copy public link</button><button v-if="canEdit" class="panel-secondary-action" type="button" :disabled="busy" @click="setPublication(!collection.publication_enabled)">{{ collection.publication_enabled ? 'Unpublish portfolio' : 'Publish portfolio' }}</button></div>
          </section>
          <dl v-if="collection.purpose !== 'portfolio'"><div><dt>{{ collection.purpose === 'review' ? 'Review month' : 'Updates' }}</dt><dd>{{ collection.purpose === 'review' && collection.review_month ? new Date(`${collection.review_month}T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'}) : collection.mode === 'dynamic' ? 'Dynamic' : collection.content_strategy==='manual'?'Manual selection':'Filter snapshot' }}</dd></div><div v-if="collection.purpose === 'review'"><dt>Deadline</dt><dd>{{ collection.submission_deadline ? new Date(collection.submission_deadline).toLocaleDateString() : 'No deadline' }}</dd></div><div><dt>Public access</dt><dd>{{ collection.publication_enabled?'Anyone with the link can view':'Disabled' }}</dd></div></dl>
          <div v-if="collection.purpose !== 'portfolio'" class="layout-setting"><span>Public layout</span><LayoutControl :model-value="collection.layout" :disabled="!canEdit" label="Public board layout" @update:model-value="setLayout" /></div>
          <div v-if="collection.purpose !== 'portfolio'" class="actions"><NuxtLink v-if="collection.publication_enabled" class="button-secondary" :to="publicUrl" target="_blank">View public page</NuxtLink><button v-if="collection.publication_enabled" class="button-secondary" type="button" @click="copyLink">Copy public link</button><button v-if="canEdit" class="button-secondary" type="button" :disabled="busy" @click="setPublication(!collection.publication_enabled)">{{ collection.publication_enabled?'Disable public link':'Enable public link' }}</button></div>
          </div>
        </div>
      </section>
      <section v-if="collection.purpose !== 'review' && collection.purpose !== 'portfolio' && collection.mode === 'dynamic'" class="content" aria-labelledby="content-title">
        <div><p class="section-label">Content</p><h2 id="content-title">Choose what appears</h2></div>
        <div class="content-settings">
          <p class="muted content-explanation">Approved items matching these filters appear automatically. Drag to arrange them; newly matching items appear first.</p>
          <template v-if="canEdit"><SelectionPanel :visible="filtersExpanded" label="Board asset filters" wide overlay @close="closeFilters" @after-leave="finishFiltersClose"><AssetFilterControls v-model:search="filters.search" v-model:project-ids="filters.projectIds" v-model:tag-ids="filters.tagIds" v-model:date-from="filters.dateFrom" v-model:date-to="filters.dateTo" :projects="projects" :tags="tags" :heading="collection.title" show-search expanded :actions-visible="Boolean(activeFilterCount)"><template #actions><button class="clear-filters-button" type="button" @click="clearFilters">Clear filters</button></template></AssetFilterControls><button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide filters" aria-expanded="true" @click="closeFilters"><Xmark :size="20" :stroke-width="2" aria-hidden="true" /></button></SelectionPanel><SelectionPanel :visible="compactFiltersVisible && !filtersExpanded" label="Board controls" bare><button class="filter-panel-toggle" type="button" aria-label="Show filters" aria-expanded="false" @click="openFilters"><span>Filters</span><span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span></button><button v-if="activeFilterCount" class="filter-clear-compact" type="button" aria-label="Clear filters" title="Clear filters" @click="clearFilters"><Xmark :size="20" :stroke-width="2" aria-hidden="true" /></button></SelectionPanel></template>
          <div class="content-heading"><strong>{{ boardAssets.length }} {{ boardAssets.length===1 ? 'item' : 'items' }} on this board</strong></div>
          <AssetMasonry v-if="boardAssets.length" :assets="boardAssets" label="Board content" heading-tag="h3" :reorderable="canEdit&&!contentBusy" @reorder="reorderBoardAssets"><template #details="{asset}"><p>{{ asset.projects?.name ?? 'No project' }}</p></template><template #previewActions="{asset}"><div v-if="canEdit" class="asset-order-actions" role="group" :aria-label="`Reorder ${asset.title}`"><button class="button-secondary order-button" type="button" :disabled="contentBusy||boardAssetIndex(asset.id)===0" :aria-label="`Move ${asset.title} up`" title="Move up" @click="moveBoardAsset(asset.id,-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6" /></svg></button><button class="button-secondary order-button" type="button" :disabled="contentBusy||boardAssetIndex(asset.id)===boardAssets.length-1" :aria-label="`Move ${asset.title} down`" title="Move down" @click="moveBoardAsset(asset.id,1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6" /></svg></button></div></template></AssetMasonry>
          <p v-else class="muted">No content matches this board yet.</p>
        </div>
      </section>
      <section v-if="collection.purpose !== 'portfolio' && (collection.purpose !== 'review' || activeView === 'members')" class="members" aria-labelledby="members-title">
        <div><p class="section-label">Workspace access</p><h2 id="members-title">Board roles</h2></div>
        <div>
          <p class="muted member-explanation">{{ collection.purpose === 'review' ? 'Only added members can access this review board.' : 'Everyone in the workspace can view this board. Roles grant additional board permissions.' }} Public-link access is controlled separately. Workspace admins can manage every board without being added here.</p>
          <form v-if="canManageMembers" class="member-form" @submit.prevent="saveMember"><label>Email<input v-model="memberEmail" required type="email" autocomplete="email"></label><label>Board role<select v-model="memberRole"><option value="editor">Editor</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select></label><button class="button-secondary" type="submit" :disabled="busy">Save access</button></form>
          <ul><li v-for="member in members" :key="member.user_id"><div><strong>{{ member.allowed_users?.email ?? member.allowed_users?.figma_handle ?? 'Workspace member' }}</strong><span class="muted">{{ member.role }}</span></div><button v-if="canManageMembers && member.role!=='owner'" class="button-secondary" type="button" :disabled="busy" @click="removeMember(member)">Remove</button></li></ul>
        </div>
      </section>
      <section v-if="collection.purpose !== 'portfolio' && canManageMembers && (collection.purpose !== 'review' || activeView === 'settings')" class="danger" aria-labelledby="danger-title">
        <div><p class="section-label">Danger zone</p><h2 id="danger-title">Delete board</h2></div>
        <div class="danger-content"><p>Delete this board, its member access, and its public link.</p><button class="button-secondary destructive-button" type="button" :disabled="busy" @click="openDeleteDialog">Delete board</button></div>
      </section>
    </main>
    <AppDialog
      v-model:open="deleteDialogOpen" :title="`Delete “${collection.title}”?`"
      description="This permanently deletes the board, removes member access, and disables its public link. This action cannot be undone."
      :confirm-label="busy ? 'Deleting board…' : 'Delete board'" :busy="busy" :error="deleteError"
      @confirm="deleteBoard" @close="deleteError = ''" />
  </div>
</template>

<style scoped>
.toolbar>span:nth-child(3){text-align:right;text-transform:capitalize}.section-label{margin:0;color:var(--color-muted)}.settings,.content,.members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space);padding:var(--section-gap) 0}.settings>div:last-child,.content>div:last-child,.members>div:last-child{grid-column:2/5}.settings h2,.content h2,.members h2{margin-top:6px}.settings-content,.content-settings{display:grid;gap:var(--space)}.title-field{display:grid;gap:6px}.title-field>span,dt{color:var(--color-muted)}.title-field input{width:100%;min-height:44px}.title-field small{height:1em;color:var(--color-muted)}.title-field small.error{color:var(--color-danger)}dl{margin:0}dl>div{display:grid;grid-template-columns:1fr 2fr;gap:var(--space);padding:12px 0}dt,dd{margin:0}.actions{display:flex;flex-wrap:wrap;gap:calc(var(--space)/2)}.content,.members{border-top:1px solid var(--color-line)}.content-explanation{max-width:50rem;margin:0}.filter-form{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;align-items:end;gap:var(--space)}.filter-form label{display:grid;gap:6px;color:var(--color-muted)}.filter-form input,.filter-form select{width:100%;min-height:44px}.filter-form button{grid-column:1;justify-self:start}.content-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space);margin-top:var(--space)}.asset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space)}.content-card{min-width:0}.image-wrap{overflow:hidden;background:var(--color-surface)}.image-wrap img{width:100%;height:100%;display:block;object-fit:contain}.content-card>div:last-child{display:flex;align-items:start;justify-content:space-between;gap:8px;padding-top:8px}.content-card>div:last-child>span{min-width:0;display:grid;gap:3px}.content-card small{color:var(--color-muted);text-transform:capitalize}.content-card strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.content-card button{flex:0 0 auto}.available-grid .selected{opacity:.45}.content-settings h3{margin:var(--section-gap) 0 0}.member-explanation{max-width:42rem;margin:0 0 var(--space)}.member-form{display:grid;grid-template-columns:1fr 14rem auto;align-items:end;gap:var(--space);margin-bottom:var(--space)}.member-form label{display:grid;gap:6px;color:var(--color-muted)}.member-form input,.member-form select{width:100%;min-height:44px}.member-form button{margin:0}ul{margin:0;padding:0;list-style:none}li{min-height:64px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:var(--space)}li>div{display:grid}@media(max-width:1000px){.filter-form{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.settings,.content,.members{grid-template-columns:1fr}.settings>div:last-child,.content>div:last-child,.members>div:last-child{grid-column:1}.member-form,.filter-form{grid-template-columns:1fr}.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar>span:nth-child(3){display:none}}@media(max-width:460px){.asset-grid{grid-template-columns:1fr}}

.member-form {
  grid-template-columns: 1fr 14rem;
}

.member-form button {
  grid-column: 1;
  justify-self: start;
}

.members li {
  grid-template-columns: 1fr 14rem;
}

.members li > button {
  justify-self: start;
}

.review-summary {
  grid-column: 2 / 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  color: var(--color-muted);
}

.member-avatars {
  display: flex;
  align-items: center;
}

.member-avatars > span,
.submitter-avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 2px solid var(--color-bg);
  border-radius: 50%;
  color: var(--color-fg);
  background: var(--color-surface);
  font-size: 12px;
}

.member-avatars > span + span {
  margin-left: -8px;
}

.member-avatars img,
.submitter-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-avatars .avatar-more {
  width: auto;
  min-width: 32px;
  padding: 0 7px;
  border-radius: 999px;
}

.review-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
  padding-bottom: var(--space);
}

.review-tabs a:first-child {
  grid-column: 2;
}

.review-tabs a {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-muted);
}

.review-tabs a.active {
  border-color: var(--color-fg);
  color: var(--color-fg);
}

.review-workspace {
  padding: var(--section-gap-compact) 0 var(--section-gap);
  border-top: 1px solid var(--color-line);
}

.review-heading {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
}

.review-heading p {
  margin: 0;
}

.review-heading h2 {
  margin: 6px 0 0;
}

.review-heading > p {
  grid-column: 2 / 5;
  max-width: 34rem;
}

.review-controls,
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--space) / 2);
}

.asset-order-actions {
  display: flex;
  align-items: center;
  gap: calc(var(--space) / 2);
}

.order-button.order-button {
  width: 32px;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
  box-shadow: 0 1px 4px rgb(0 0 0 / .12);
}

.order-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.review-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space);
  margin: var(--space) 0 var(--space) calc(25% + var(--space) / 4);
}

.group-control {
  display: grid;
  gap: 4px;
  color: var(--color-muted);
}

.group-control select {
  min-width: 10rem;
  min-height: 36px;
}

.review-controls button.active {
  color: var(--color-bg);
  background: var(--color-fg);
}

.approve-button {
  color: var(--color-bg);
  background: var(--color-fg);
}

.review-workspace :deep(.preview-actions) .card-actions {
  flex-wrap: nowrap;
  justify-content: center;
  gap: 6px;
}

.review-workspace :deep(.preview-actions) button {
  min-height: 32px;
  padding: 0 13px;
  border-radius: 999px;
  color: #000;
  background: #fff;
  font-size: 12px;
  box-shadow: 0 1px 3px rgb(0 0 0 / .12);
}

.review-workspace :deep(.preview-actions) button:hover {
  opacity: .8;
}

.review-workspace :deep(.preview-actions) button:active {
  scale: .96;
}

.review-workspace :deep(.preview-actions) .remove-icon {
  width: 32px;
  padding: 0;
  display: grid;
  place-items: center;
}

.remove-icon svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.review-toolbar-actions {
  display: flex;
  align-items: end;
  gap: var(--space);
}

.layout-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
}

.select-visible {
  min-height: 36px;
}

.review-controls button span {
  margin-left: 8px;
  opacity: .55;
}

.review-feedback {
  min-height: 1.15em;
  margin: 0 0 var(--space) calc(25% + var(--space) / 4);
}

.review-groups {
  display: grid;
  gap: var(--section-gap);
}

.review-group {
  padding-top: var(--space);
  border-top: 1px solid var(--color-line);
}

.review-group > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: var(--space);
}

.submitter {
  display: flex;
  align-items: center;
  gap: calc(var(--space) / 2);
}

.submitter h3 {
  margin: 0;
}

.review-group :deep(.card-body) {
  display: grid;
  gap: 8px;
}

.review-group :deep(.card-body p) {
  margin: 0;
  color: var(--color-muted);
}

.card-submitter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.card-submitter-avatar {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-surface);
  font-size: 9px;
}

.card-submitter-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-empty {
  min-height: 36vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
}

.danger {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
  padding: var(--section-gap) 0;
  border-top: 1px solid var(--color-line);
}

.danger > div:last-child {
  grid-column: 2 / 5;
}

.danger h2 {
  margin-top: 6px;
}

.danger-content {
  display: grid;
  justify-items: start;
  gap: var(--space);
}

.danger-content p {
  margin: 0;
  color: var(--color-muted);
}

.button-secondary.button-secondary.destructive-button {
  color: var(--color-danger);
}

.clear-filters-button {
  width: max-content;
  min-width: 0;
  padding-inline: var(--space);
  color: var(--color-fg);
  background: var(--color-surface);
  white-space: nowrap;
}

.filter-controls-enter-active,
.filter-controls-leave-active {
  transition: opacity 140ms ease, transform 180ms cubic-bezier(.2, 0, 0, 1);
}

.filter-controls-enter-from,
.filter-controls-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

@media (max-width: 720px) {
  .danger {
    grid-template-columns: 1fr;
  }

  .danger > div:last-child {
    grid-column: 1;
  }

  .member-form {
    grid-template-columns: 1fr;
  }

  .members li {
    grid-template-columns: 1fr;
  }

  .review-summary {
    grid-column: 1;
  }

  .review-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .review-tabs a:first-child {
    grid-column: 1;
  }

  .review-heading {
    grid-template-columns: 1fr;
  }

  .review-heading > p {
    grid-column: 1;
  }

  .review-toolbar,
  .review-feedback {
    margin-left: 0;
  }

  .review-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .review-toolbar-actions {
    align-items: end;
    justify-content: space-between;
  }

  .group-control select {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .filter-controls-enter-active,
  .filter-controls-leave-active {
    transition-duration: .01ms;
  }
}
.portfolio-settings { display: grid; gap: var(--space); }
.portfolio-settings fieldset { display: flex; flex-wrap: wrap; gap: calc(var(--space) / 2) var(--space); margin: 0; padding: 0; border: 0; }
.portfolio-settings legend { width: 100%; margin-bottom: calc(var(--space) / 2); color: var(--color-muted); }
.portfolio-settings label { display: grid; gap: calc(var(--space) / 2); }
.portfolio-settings fieldset label { display: flex; align-items: center; }
.portfolio-settings .contact-fields { display: grid; grid-template-columns: minmax(0, 1fr); }
.portfolio-settings .contact-fields label { display: grid; align-items: initial; }
.contact-link-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(var(--space) / 2) var(--space); padding-block: calc(var(--space) / 2); }
.contact-link-actions { grid-column: 1 / 3; display: flex; align-items: center; gap: calc(var(--space) / 2); }
.contact-link-actions .button-secondary { min-width: var(--control-height); padding-inline: calc(var(--space) / 2); }
.contact-link-actions .button-plain { min-height: 36px; }
.add-contact-link { margin-top: calc(var(--space) / 2); }
.portfolio-settings button { justify-self: start; }
.portfolio-section-heading { display: grid; gap: calc(var(--space) / 2); }
.portfolio-publishing { display: grid; gap: var(--space); }
.portfolio-publishing h3, .portfolio-publishing p { margin: 0; }
.portfolio-publishing-actions { display: grid; gap: var(--filter-action-gap); }

.portfolio-settings-page > main {
  min-height: 0;
  padding: var(--filter-overlay-margin) 0;
  overflow: hidden;
}

.portfolio-settings-page > main > .intro {
  display: none;
}

.portfolio-settings-page .settings {
  width: min(100%, var(--filter-overlay-width));
  height: 100%;
  min-height: 0;
  max-width: none;
  display: block;
  margin-inline: auto;
  padding: 0;
}

.portfolio-settings-page {
  height: 100dvh;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.portfolio-settings-page .settings > div:first-child { display: none; }
.portfolio-settings-page .settings-content.asset-filter-controls {
  height: 100%;
  min-height: 0;
  max-height: none;
}
.portfolio-settings-page .portfolio-settings { display: contents; }
.portfolio-settings-page .portfolio-introduction { min-height: calc(var(--filter-action-height) * 2.5); padding-block: var(--filter-option-padding); }
.portfolio-settings-page .contact-fields { display: grid; }
.portfolio-settings-page .contact-link-row { grid-template-columns: minmax(0, 1fr); }
.portfolio-settings-page .contact-link-actions { grid-column: 1; }
.portfolio-settings-page .portfolio-settings label > span,
.portfolio-settings-page .portfolio-publishing .muted { color: var(--filter-overlay-muted-color); }

@media (max-width: 560px) { .contact-link-row { grid-template-columns: 1fr; } .contact-link-actions { grid-column: 1; } }
</style>
