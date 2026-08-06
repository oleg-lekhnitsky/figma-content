<script setup lang="ts">
definePageMeta({ middleware:'auth' })
const route=useRoute()
const close=()=>navigateTo('/library')
</script>

<template><AssetOverlay :asset-id="String(route.params.id)" @close="close" /></template>
