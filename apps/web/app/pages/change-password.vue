<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface SessionResponse {
  data: { authenticated: boolean; user?: { mustChangePassword?: boolean } }
}

const { data: session } = useNuxtData<SessionResponse>('auth-session')
const currentPassword = ref('')
const newPassword = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const routedPanel = ref<{ close: () => void } | null>(null)
const canSubmit = computed(() => Boolean(currentPassword.value && newPassword.value.length >= 12))

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
    routedPanel.value?.close()
  } catch {
    errorMessage.value = 'Unable to change the password. Check your temporary password and use at least 12 characters for the new one.'
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <main class="change-password-page">
    <AppRoutedPanelPage
      ref="routedPanel"
      label="Set a new password"
      close-label="Close password settings"
      panel-class="password-panel"
      :close-disabled="submitting"
    >
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
    </AppRoutedPanelPage>
  </main>
</template>

<style scoped>
.change-password-page { min-height: 100vh; }
:global(.password-panel) { min-width: min(30rem, calc(100vw - var(--space) * 2)); }
.password-form { min-width: 0; display: grid; gap: var(--filter-option-gap); }

@media (max-width: 520px) {
  :global(.password-panel) { min-width: 0; }
}
</style>
