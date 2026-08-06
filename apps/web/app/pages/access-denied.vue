<template>
  <main class="page-shell">
    <section class="message-panel" aria-labelledby="denied-title">
      <p class="eyebrow">Access restricted</p>
      <h1 id="denied-title" class="display-title">This account<br>doesn’t have access.</h1>
      <p class="muted">Contact a library administrator.</p>
      <NuxtLink class="button" to="/login">Try another account</NuxtLink>
    </section>
  </main>
</template>

<style scoped>.button{display:inline-flex;align-items:center;margin-top:var(--space)}</style>
