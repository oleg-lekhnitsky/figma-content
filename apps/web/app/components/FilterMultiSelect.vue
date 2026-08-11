<script setup lang="ts">
interface Option { id: string; name: string }

const props = defineProps<{ modelValue: string[]; label: string; options: Option[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const selected = computed(() => new Set(props.modelValue))
const summary = computed(() => props.modelValue.length ? `${props.modelValue.length} ${props.label.toLowerCase()}` : `All ${props.label.toLowerCase()}`)

const open = () => dialog.value?.showModal()
const close = () => { dialog.value?.close(); trigger.value?.focus() }
const toggle = (id: string) => emit('update:modelValue', selected.value.has(id) ? props.modelValue.filter(value => value !== id) : [...props.modelValue, id])
const clear = () => emit('update:modelValue', [])
</script>

<template>
  <button ref="trigger" class="multi-select-trigger" type="button" aria-haspopup="dialog" @click="open">
    <span>{{ summary }}</span><span class="chevron" aria-hidden="true" />
  </button>
  <dialog ref="dialog" class="multi-select-dialog" :aria-label="`Select ${label.toLowerCase()}`" @cancel.prevent="close">
    <form method="dialog" @submit.prevent="close">
      <header><h2>{{ label }}</h2><button class="dialog-close" type="button" aria-label="Close" @click="close">×</button></header>
      <div class="option-list">
        <label v-for="option in options" :key="option.id">
          <input type="checkbox" :checked="selected.has(option.id)" @change="toggle(option.id)">
          <span>{{ option.name }}</span>
        </label>
      </div>
      <footer><button v-if="modelValue.length" class="button-secondary" type="button" @click="clear">Clear</button><button type="submit">Done</button></footer>
    </form>
  </dialog>
</template>

<style scoped>
.multi-select-trigger{height:36px;min-height:36px;display:flex;align-items:center;gap:var(--space);padding:0 14px;color:var(--color-fg);background:var(--color-surface);font-size:13px;white-space:nowrap}.chevron{width:7px;height:7px;margin:-3px 1px 0 6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg)}
.multi-select-dialog{width:min(28rem,calc(100vw - var(--space)*2));max-height:min(70dvh,36rem);padding:0;border:0;border-radius:calc(var(--radius) + var(--space));color:var(--color-fg);background:var(--color-bg);box-shadow:0 24px 80px rgb(0 0 0/.2)}.multi-select-dialog::backdrop{background:rgb(0 0 0/.18)}.multi-select-dialog form{display:grid;gap:var(--space);padding:var(--space)}header,footer{display:flex;align-items:center;justify-content:space-between;gap:var(--space)}h2{margin:0;font:inherit}.dialog-close{width:44px;min-width:44px;padding:0;font-size:24px}.option-list{display:grid;gap:calc(var(--space)/4);overflow:auto}.option-list label{min-height:44px;display:flex;align-items:center;gap:calc(var(--space)/2);padding:0 calc(var(--space)/2);border-radius:var(--radius);cursor:pointer}.option-list label:hover{background:var(--color-surface)}.option-list input{width:20px;height:20px;accent-color:var(--color-fg)}footer{justify-content:flex-end}
@media(max-width:520px){.multi-select-trigger{height:44px;min-height:44px}.multi-select-dialog{width:calc(100vw - var(--space)*2);max-height:calc(100dvh - var(--space)*2)}}
</style>
