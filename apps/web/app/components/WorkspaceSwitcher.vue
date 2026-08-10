<script setup lang="ts">
interface Workspace {
  id: string
  name: string
  slug: string
  role: string
}

const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const open = ref(false)
const switchingId = ref('')
const { data } = await useFetch<{ data: { currentId: string; workspaces: Workspace[] } }>('/api/workspaces')
const workspaces = computed(() => data.value?.data.workspaces ?? [])
const currentId = computed(() => data.value?.data.currentId ?? '')
const current = computed(() => workspaces.value.find(workspace => workspace.id === currentId.value))

const close = (restoreFocus = false) => {
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

const switchWorkspace = async (workspace: Workspace) => {
  if (workspace.id === currentId.value || switchingId.value) return close()
  switchingId.value = workspace.id
  try {
    await $fetch('/api/workspaces/switch', { method: 'POST', body: { workspaceId: workspace.id } })
    window.location.assign('/library')
  } finally {
    switchingId.value = ''
  }
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!root.value?.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <div ref="root" class="workspace-switcher">
    <button ref="trigger" class="workspace-trigger" type="button" :aria-expanded="open" aria-haspopup="true" @click="open = !open" @keydown.esc="close(true)">
      <span>{{ current?.name ?? 'Content Library' }}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <div v-if="open" class="workspace-popover" @keydown.esc="close(true)">
      <p>Workspaces</p>
      <button v-for="workspace in workspaces" :key="workspace.id" type="button" :disabled="Boolean(switchingId)" @click="switchWorkspace(workspace)">
        <span>{{ workspace.name }}<small>{{ workspace.role }}</small></span>
        <svg v-if="workspace.id === currentId" viewBox="0 0 16 16" aria-label="Current workspace"><path d="m3 8 3 3 7-7" /></svg>
      </button>
      <div class="workspace-links">
        <NuxtLink to="/account#new-workspace" @click="close()">Create workspace</NuxtLink>
        <NuxtLink to="/account" @click="close()">Manage workspaces</NuxtLink>
      </div>
    </div>
  </div>
</template>
