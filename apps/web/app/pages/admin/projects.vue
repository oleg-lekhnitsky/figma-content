<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
interface Project { id:string; name:string; slug:string; archived_at:string|null; created_at:string; assetCount:number }
interface SessionResponse { data:{ authenticated:boolean; user?:{ role:string; workspace?:{ name:string }|null } } }
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const role = session.value?.data.user?.role
if (!['editor','admin'].includes(role ?? '')) await navigateTo('/library')
const { data, refresh } = await useFetch<{data:{projects:Project[]}}>('/api/projects/manage')
const projects = computed(() => data.value?.data.projects ?? [])
const name = ref('')
const message = ref('')
const errorMessage = ref('')
const projectFeedback = reactive<Record<string,{ text:string; error:boolean }>>({})
const clearMessages = () => { message.value=''; errorMessage.value='' }
const createProject = async () => {
  clearMessages()
  try {
    await $fetch('/api/projects',{method:'POST',body:{name:name.value}})
    name.value=''; await refresh(); message.value='Project created. It is now available in the Figma plugin.'
  } catch { errorMessage.value='Unable to create this project. Try a different name.' }
}
const renameProject = async (project:Project,event:Event) => {
  clearMessages()
  projectFeedback[project.id]={text:'',error:false}
  const input=event.target as HTMLInputElement
  const nextName=input.value.trim()
  if (!nextName || nextName===project.name) return
  const previousName=project.name
  project.name=nextName
  try { await $fetch(`/api/projects/${project.id}`,{method:'PATCH',body:{name:nextName}}); projectFeedback[project.id]={text:'Saved',error:false} }
  catch { project.name=previousName; input.value=previousName; projectFeedback[project.id]={text:'Unable to rename. Try a different name.',error:true} }
}
const setArchived = async (project:Project) => {
  clearMessages()
  try { await $fetch(`/api/projects/${project.id}`,{method:'PATCH',body:{archived:!project.archived_at}}); await refresh(); message.value=project.archived_at?'Project restored.':'Project archived.' }
  catch { errorMessage.value='Unable to update this project.' }
}
</script>

<template>
  <div class="admin-shell projects-shell">
    <header class="toolbar">
      <WorkspaceSwitcher class="identity" />
      <nav aria-label="Administration"><NuxtLink v-if="role==='admin'" to="/admin/users">Users</NuxtLink><NuxtLink to="/admin/projects" aria-current="page">Projects</NuxtLink><NuxtLink v-if="role==='admin'" to="/admin/audit-log">Audit log</NuxtLink></nav>
      <span class="count">{{ projects.filter(project=>!project.archived_at).length }} active</span>
      <NuxtLink class="close" to="/library" aria-label="Close administration"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg></NuxtLink>
    </header>
    <main>
      <section class="intro"><p>Organization</p><h1>Projects organize<br>your library.</h1></section>
      <form class="create-project" @submit.prevent="createProject"><span>Create a project</span><label><span>Project name</span><input v-model="name" required maxlength="120" autocomplete="off" placeholder="Website redesign"></label><button class="button-secondary" type="submit">Create project</button></form>
      <p class="message" role="status" aria-live="polite">{{ message }}</p><p v-if="errorMessage" class="message error-message" role="alert">{{ errorMessage }}</p>
      <section class="project-list" aria-label="Projects">
        <div class="labels" aria-hidden="true"><span>Project</span><span>Assets</span><span>Status</span></div>
        <article v-for="project in projects" :key="project.id" class="project" :class="{archived:project.archived_at}"><label><span class="sr-only">Project name</span><input :value="project.name" maxlength="120" :aria-describedby="`project-feedback-${project.id}`" :aria-invalid="projectFeedback[project.id]?.error || undefined" @change="renameProject(project,$event)"><span :id="`project-feedback-${project.id}`" class="field-message" :class="{error:projectFeedback[project.id]?.error}" role="status" aria-live="polite">{{ projectFeedback[project.id]?.text }}</span></label><span>{{ project.assetCount }} {{ project.assetCount===1?'asset':'assets' }}</span><button class="button-secondary" type="button" @click="setArchived(project)">{{ project.archived_at?'Restore':'Archive' }}</button></article>
      </section>
    </main>
  </div>
</template>

<style scoped>
.projects-shell{min-height:100vh}.toolbar{position:sticky;z-index:3;top:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space);padding:var(--space);background:rgb(255 255 255/.94);backdrop-filter:blur(14px)}.identity{font-weight:760;letter-spacing:-.025em}.toolbar nav{display:flex;gap:var(--space)}.toolbar nav a,.count{color:var(--color-muted)}.toolbar nav [aria-current=page]{color:var(--color-fg)}.count{text-align:right}.close{width:44px;height:44px;margin-top:-10px;justify-self:end;display:grid;place-items:center;border-radius:50%;background:var(--color-surface);transition-property:scale,opacity;transition-duration:150ms}.close svg{width:22px;fill:none;stroke:currentColor;stroke-width:1.7}.close:active{scale:.96}main{padding:clamp(4rem,9vw,9rem) var(--space) 6rem}.intro{display:grid;grid-template-columns:var(--admin-columns);gap:var(--space);margin-bottom:clamp(5rem,11vw,11rem)}.intro p{margin:0;color:var(--color-muted)}.intro h1{grid-column:2/5}.create-project{display:grid;grid-template-columns:var(--admin-columns);align-items:end;gap:var(--space)}.create-project>span{align-self:start;color:var(--color-muted)}.create-project label{grid-column:2/4;display:grid;gap:6px}.create-project label span,.labels{color:var(--color-muted);font-size:12px}.create-project input{width:100%;min-height:36px}.create-project button{justify-self:end}.message{min-height:1.25rem;margin:10px 0;color:var(--color-muted)}.error-message{color:var(--color-danger)}.project-list{margin-top:clamp(3rem,7vw,7rem)}.labels,.project{display:grid;grid-template-columns:2fr 1fr 1fr;align-items:center;gap:var(--space)}.labels{padding-bottom:10px}.project{min-height:60px}.project label{min-width:0}.project input{width:100%;min-height:36px;padding:0;border-bottom-color:transparent;font-weight:700}.project input:hover{border-bottom-color:var(--color-line)}.project>span{color:var(--color-muted)}.project button{justify-self:start}.project.archived{opacity:.4}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:720px){.toolbar{grid-template-columns:1fr auto}.toolbar nav{grid-row:2}.count{display:none}.close{grid-column:2;grid-row:1/3}.intro,.create-project{grid-template-columns:1fr}.intro h1,.create-project label{grid-column:1}.create-project button{justify-self:start}.labels{display:none}.project{grid-template-columns:1fr auto}.project label{grid-column:1/-1}}@media(prefers-reduced-motion:reduce){.close{transition:none}.close:active{scale:1}}
.field-message{height:1em;display:block;margin-top:4px;color:var(--color-muted);font-size:12px;font-weight:700;line-height:1}.field-message.error{color:var(--color-danger)}
</style>
