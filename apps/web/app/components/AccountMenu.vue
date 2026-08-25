<script setup lang="ts">
import { Profile, Xmark } from 'reicon-vue'

const props = defineProps<{
  email?: string | null
  figmaHandle?: string | null
  avatarUrl?: string | null
  role: string
  hasPassword?: boolean
}>()

const open = ref(false)
const signingOut = ref(false)
const displayName = computed(() => props.figmaHandle || props.email || 'Account')
const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')
const isAdmin = computed(() => props.role === 'admin')

const close = () => { open.value = false }

const signOut = async () => {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <div class="account-menu">
    <button
      class="account-menu-trigger" type="button" :title="displayName"
      aria-label="Open your account" :aria-expanded="open" @click="open = true">
      <Profile :size="20" weight="Filled" aria-hidden="true" />
    </button>

    <SelectionPanel :visible="open" label="Your account" wide overlay raised @close="close">
      <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded account-panel">
        <button class="filter-sheet-handle" type="button" aria-label="Close account" @click="close"><span aria-hidden="true" /></button>
        <div class="filter-sheet-content">
          <section class="filter-option-group account-profile">
            <h2 class="filter-overlay-title">Your account</h2>
            <div class="account-profile-card">
              <span class="account-profile-avatar" aria-hidden="true">
                <img v-if="avatarUrl" :src="avatarUrl" alt="">
                <span v-else>{{ initial }}</span>
              </span>
              <span class="account-profile-copy">
                <strong>{{ displayName }}</strong>
                <small v-if="email && email !== displayName">{{ email }}</small>
                <small class="account-profile-role">{{ role }}</small>
              </span>
            </div>
            <div class="account-action-grid">
              <NuxtLink v-if="hasPassword" class="panel-secondary-action" to="/change-password" @click="close">Change password</NuxtLink>
              <button class="panel-secondary-action" type="button" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
            </div>
          </section>

          <section v-if="isAdmin" class="filter-option-group account-admin">
            <h2 class="filter-overlay-title">Administration</h2>
            <nav class="account-action-grid" aria-label="Administration">
              <NuxtLink class="panel-secondary-action" to="/admin/projects" @click="close">Projects</NuxtLink>
              <NuxtLink class="panel-secondary-action" to="/admin/audit-log" @click="close">Audit log</NuxtLink>
            </nav>
          </section>
        </div>
      </div>
      <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close account" aria-expanded="true" @click="close">
        <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
    </SelectionPanel>
  </div>
</template>

<style scoped>
.account-menu { min-width: 0; }
.account-menu-trigger { box-sizing: border-box; width: var(--identity-avatar-size, 36px); height: var(--identity-avatar-size, 36px); min-width: var(--identity-avatar-size, 36px); min-height: var(--identity-avatar-size, 36px); display: grid; place-items: center; padding: 0; overflow: hidden; border-radius: 50%; color: var(--color-fg); background: var(--color-surface); }
.account-menu-trigger:is(:hover, :focus-visible) { opacity: .65; }
.account-panel { min-width: min(30rem, calc(100vw - var(--space) * 2)); }
.account-profile-card { display: flex; align-items: center; gap: var(--space); min-width: 0; }
.account-profile-avatar { width: calc(var(--control-height) * 1.35); height: calc(var(--control-height) * 1.35); display: grid; place-items: center; flex: 0 0 auto; overflow: hidden; border-radius: 50%; color: var(--filter-overlay-primary-color); background: var(--filter-overlay-primary-background); }
.account-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.account-profile-copy { min-width: 0; display: grid; gap: .15rem; }
.account-profile-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-profile-copy small { color: var(--filter-overlay-muted-color); }
.account-profile-copy .account-profile-role { text-transform: capitalize; }
.account-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(var(--space) / 2); }
@media (max-width: 520px) { .account-action-grid { grid-template-columns: 1fr; } }
</style>
