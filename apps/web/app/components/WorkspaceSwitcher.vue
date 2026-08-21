<script setup lang="ts">
interface Workspace {
  id: string
  name: string
  slug: string
  role: string
}

const open = ref(false)
const switchingId = ref('')
const { data } = await useFetch<{ data: { currentId: string; workspaces: Workspace[] } }>('/api/workspaces')
const workspaces = computed(() => data.value?.data.workspaces ?? [])
const currentId = computed(() => data.value?.data.currentId ?? '')
const current = computed(() => workspaces.value.find(workspace => workspace.id === currentId.value))

const switchWorkspace = async (workspace: Workspace) => {
  if (workspace.id === currentId.value || switchingId.value) {
    open.value = false
    return
  }
  switchingId.value = workspace.id
  try {
    await $fetch('/api/workspaces/switch', { method: 'POST', body: { workspaceId: workspace.id } })
    window.location.assign('/library')
  } finally {
    switchingId.value = ''
  }
}

</script>

<template>
  <AppDropdownMenu v-model:open="open" class="workspace-switcher" content-class="workspace-popover">
    <template #trigger="{ triggerProps }">
      <button v-bind="triggerProps" class="workspace-trigger" type="button">
        <span>{{ current?.name ?? 'Content Library' }}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
    </template>
    <template #default>
        <button v-for="workspace in workspaces" :key="workspace.id" role="menuitem" tabindex="-1" type="button" :disabled="Boolean(switchingId)" :aria-disabled="Boolean(switchingId)" @click="switchWorkspace(workspace)">
          <span>{{ workspace.name }}</span>
          <span class="workspace-item-meta"><small>{{ workspace.role }}</small></span>
        </button>
        <div class="workspace-links" role="group">
          <NuxtLink role="menuitem" tabindex="-1" to="/account#new-workspace">Create workspace</NuxtLink>
          <NuxtLink role="menuitem" tabindex="-1" to="/account">Manage workspaces</NuxtLink>
        </div>
    </template>
  </AppDropdownMenu>
</template>
