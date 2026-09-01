<script setup lang="ts">
import { Xmark } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })

interface SessionResponse {
  data: { authenticated: boolean; user?: { mustChangePassword?: boolean } }
}

const { data: session } = useNuxtData<SessionResponse>('auth-session')
const currentPassword = ref('')
const newPassword = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const panelVisible = ref(false)
const canSubmit = computed(() => Boolean(currentPassword.value && newPassword.value.length >= 12))
let panelOpenFrame = 0

onMounted(() => {
  panelOpenFrame = requestAnimationFrame(() => { panelVisible.value = true })
})
onBeforeUnmount(() => cancelAnimationFrame(panelOpenFrame))

const changePassword = async () => {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/password/change', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })
    if (session.value?.data.user) session.value.data.user.mustChangePassword = false
    panelVisible.value = false
  } catch {
    errorMessage.value = 'Unable to change the password. Check your temporary password and use at least 12 characters for the new one.'
  } finally {
    submitting.value = false
  }
}

const close = () => {
  if (!submitting.value) panelVisible.value = false
}
const finishClose = () => navigateTo('/library')
</script>

<template>
  <main class="change-password-page">
    <SelectionPanel
      :visible="panelVisible"
      label="Set a new password"
      wide
      overlay
      :close-disabled="submitting"
      @close="close"
      @after-leave="finishClose"
    >
      <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded password-panel">
        <button class="filter-sheet-handle" type="button" aria-label="Close password settings" :disabled="submitting" @click="close"><span aria-hidden="true" /></button>
        <div class="filter-sheet-content">
          <section class="filter-option-group">
            <h1 class="filter-overlay-title">Set a new password</h1>
            <form class="password-form" @submit.prevent="changePassword">
              <AppInlineActionField
                v-model="currentPassword"
                label="Temporary password"
                placeholder="Current temporary password"
                action-label="Continue"
                input-type="password"
                autocomplete="current-password"
                :max-length="128"
                :disabled="submitting"
              />
              <AppInlineActionField
                v-model="newPassword"
                label="New password"
                placeholder="New password"
                action-label="Save"
                busy-label="Saving…"
                input-type="password"
                autocomplete="new-password"
                :min-length="12"
                :max-length="128"
                :show-action="canSubmit || submitting"
                :busy="submitting"
                :disabled="submitting"
              />
            </form>
            <p class="board-type-summary">12 characters minimum.</p>
          </section>
          <AppStatusToast :message="errorMessage" error />
        </div>
      </div>
      <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close password settings" aria-expanded="true" :disabled="submitting" @click="close">
        <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
    </SelectionPanel>
  </main>
</template>

<style scoped>
.change-password-page { min-height: 100vh; }
.password-panel { min-width: min(30rem, calc(100vw - var(--space) * 2)); }
.password-form { min-width: 0; display: grid; gap: var(--filter-option-gap); }

@media (max-width: 520px) {
  .password-panel { min-width: 0; }
}
</style>
