<script setup lang="ts">
definePageMeta({middleware:'auth'})
type Workspace={id:string;name:string;slug:string;role:string}
const {data,refresh}=await useFetch<{data:{currentId:string;workspaces:Workspace[]}}>('/api/workspaces')
const name=ref('');const email=ref('');const role=ref('viewer');const inviteUrl=ref('');const message=ref('');const busy=ref(false)
const switchWorkspace=async(id:string)=>{if(id===data.value?.data.currentId)return;busy.value=true;await $fetch('/api/workspaces/switch',{method:'POST',body:{workspaceId:id}});window.location.assign('/library')}
const createWorkspace=async()=>{busy.value=true;message.value='';try{const result=await $fetch<{data:{workspace:Workspace}}>('/api/workspaces',{method:'POST',body:{name:name.value}});name.value='';await refresh();await switchWorkspace(result.data.workspace.id)}catch{message.value='Unable to create this workspace.'}finally{busy.value=false}}
const invite=async()=>{busy.value=true;message.value='';inviteUrl.value='';try{const result=await $fetch<{data:{inviteUrl:string}}>('/api/workspaces/invitations',{method:'POST',body:{email:email.value,role:role.value}});inviteUrl.value=result.data.inviteUrl;email.value=''}catch{message.value='Unable to create this invitation.'}finally{busy.value=false}}
const copyInvite=async()=>{await navigator.clipboard.writeText(inviteUrl.value);message.value='Invitation link copied.'}
const current=computed(()=>data.value?.data.workspaces.find(item=>item.id===data.value?.data.currentId))
</script>
<template>
  <div class="admin-shell account-shell">
    <header class="toolbar">
      <NuxtLink class="identity" to="/library">Content Library</NuxtLink>
      <span>Workspace</span>
      <span class="current-name">{{ current?.name }}</span>
      <NuxtLink class="close" to="/library" aria-label="Close account">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
      </NuxtLink>
    </header>
    <main>
      <section class="intro"><p>Workspace settings</p><h1>Manage your<br>workspaces.</h1></section>

      <section class="settings-section" aria-labelledby="workspace-list-title">
        <div class="section-heading"><p>Workspaces</p><h3 id="workspace-list-title">Switch workspace</h3></div>
        <ul class="workspace-list">
          <li v-for="workspace in data?.data.workspaces" :key="workspace.id">
            <div><strong>{{ workspace.name }}</strong><span>{{ workspace.role }}</span></div>
            <button class="button-secondary" type="button" :disabled="busy || workspace.id === data?.data.currentId" @click="switchWorkspace(workspace.id)">{{ workspace.id === data?.data.currentId ? 'Current' : 'Open' }}</button>
          </li>
        </ul>
      </section>

      <form class="settings-section settings-form" @submit.prevent="createWorkspace">
        <div class="section-heading"><p>New workspace</p><h3>Create your own</h3></div>
        <label><span>Name</span><input v-model="name" required maxlength="120" placeholder="Studio name"></label>
        <button class="button-secondary" :disabled="busy">Create workspace</button>
      </form>

      <form v-if="current?.role === 'admin'" class="settings-section settings-form invite-form" @submit.prevent="invite">
        <div class="section-heading"><p>Access</p><h3>Invite someone</h3></div>
        <label><span>Email</span><input v-model="email" required type="email" autocomplete="email"></label>
        <label><span>Role</span><select v-model="role"><option value="viewer">Viewer</option><option value="contributor">Contributor</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
        <button class="button-secondary" :disabled="busy">Create invitation</button>
        <div v-if="inviteUrl" class="invite-result"><input :value="inviteUrl" readonly aria-label="Invitation link"><button class="button-secondary" type="button" @click="copyInvite">Copy link</button></div>
      </form>
      <p v-if="message" class="message" role="status" aria-live="polite">{{ message }}</p>
    </main>
  </div>
</template>

<style scoped>
.current-name{justify-self:end;color:var(--color-muted)}
.settings-section{display:grid;grid-template-columns:var(--admin-columns);align-items:end;gap:var(--space);padding:var(--space) 0}
.settings-section+.settings-section{margin-top:var(--section-gap)}
.section-heading{align-self:start}.section-heading p{margin:0 0 6px;color:var(--color-muted)}.section-heading h3{margin:0;font-size:1rem}
.workspace-list{grid-column:2/5;display:grid;gap:calc(var(--space)*1.5);margin:0;padding:0;list-style:none}.workspace-list li{display:grid;justify-items:start;gap:10px}.workspace-list li div{display:grid}.workspace-list span{color:var(--color-muted);text-transform:capitalize}
.settings-form>label{display:grid;gap:6px}.settings-form>label span{color:var(--color-muted);font-size:12px}.settings-form input,.settings-form select{width:100%;min-height:36px}.settings-form>label{grid-column:2/4}.settings-form>button{grid-column:2/5;justify-self:start;margin-top:4px}.invite-form>label{grid-column:auto}.invite-form>label:nth-of-type(1){grid-column:2}.invite-form>label:nth-of-type(2){grid-column:3}.invite-result{grid-column:2/5;display:flex;gap:var(--space);margin-top:8px}.invite-result input{min-width:0;flex:1}.message{margin:var(--space) 0 0;color:var(--color-muted)}
@media(max-width:900px){.current-name{display:none}.settings-section{grid-template-columns:1fr 1fr}.section-heading,.workspace-list,.settings-form>label,.settings-form>button,.invite-form>label:nth-of-type(1),.invite-form>label:nth-of-type(2),.invite-result{grid-column:1/-1}.settings-form>button{justify-self:start}}
@media(max-width:520px){.settings-section{grid-template-columns:1fr}.invite-result{flex-direction:column;align-items:flex-start}}
</style>
