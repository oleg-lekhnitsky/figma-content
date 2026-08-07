<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const currentPassword = ref('')
const newPassword = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const changePassword = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/password/change', { method: 'POST', body: { currentPassword: currentPassword.value, newPassword: newPassword.value } })
    await navigateTo('/library')
  } catch { errorMessage.value = 'Unable to change the password. Check your current password and use at least 12 characters for the new one.' }
  finally { submitting.value = false }
}
</script>

<template><main class="page-shell"><section class="message-panel" aria-labelledby="password-title"><p class="eyebrow">Account security</p><h1 id="password-title" class="display-title">Choose a new<br>password.</h1><p class="muted">Replace the temporary password before opening the library.</p><form @submit.prevent="changePassword"><label for="current-password">Temporary password</label><input id="current-password" v-model="currentPassword" type="password" name="currentPassword" autocomplete="current-password" required><label for="new-password">New password</label><input id="new-password" v-model="newPassword" type="password" name="newPassword" autocomplete="new-password" minlength="12" maxlength="128" required><small>Use at least 12 characters.</small><button type="submit" :disabled="submitting">{{ submitting ? 'Saving password…' : 'Save password' }}</button></form><p class="form-error" role="alert">{{ errorMessage }}</p></section></main></template>

<style scoped>.message-panel form{display:grid;gap:8px;margin-top:var(--space)}label{margin-top:8px;color:var(--color-muted);font-size:12px}input{box-sizing:border-box;width:100%;min-height:44px;padding:0 8px;border:0;border-bottom:1px solid var(--color-line);border-radius:0;color:inherit;background:transparent;font:inherit}small{color:var(--color-muted)}button{justify-self:start;margin-top:8px}.form-error{min-height:1.25rem;color:#a20f0f}:is(button):focus-visible{outline:2px solid #06f90e;outline-offset:2px}</style>
