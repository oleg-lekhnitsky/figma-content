<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
await navigateTo('/library?workspaceSettings=1', { replace: true })
</script>

<template><span /></template>
