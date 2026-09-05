<script setup lang="ts">
const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const draft = ref('')
const error = ref('')
const input = ref<HTMLInputElement>()
const id = useId()
const tags = computed(() => props.modelValue.split(/[,\n]/).map(tag => tag.trim()).filter(Boolean))

const commit = () => {
  if (props.disabled) return false
  const additions = draft.value.split(/[,\n]/).map(tag => tag.trim()).filter(Boolean)
  const next = [...tags.value]
  for (const tag of additions) {
    if (!next.some(existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) next.push(tag)
  }
  error.value = next.some(tag => tag.length > 80) ? 'Keep each tag under 81 characters.'
    : next.length > 50 ? 'You can add up to 50 tags.' : ''
  if (error.value) {
    input.value?.focus()
    return false
  }
  emit('update:modelValue', next.join(', '))
  draft.value = ''
  return true
}

const remove = (index: number) => {
  if (props.disabled) return
  emit('update:modelValue', tags.value.filter((_, itemIndex) => itemIndex !== index).join(', '))
  error.value = ''
  nextTick(() => input.value?.focus())
}

const keydown = (event: KeyboardEvent) => {
  if (event.isComposing || (event.key !== 'Enter' && event.key !== ',')) return
  event.preventDefault()
  commit()
}

const paste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[,\n]/.test(text)) return
  event.preventDefault()
  const field = event.currentTarget as HTMLInputElement
  draft.value = draft.value.slice(0, field.selectionStart ?? 0) + text + draft.value.slice(field.selectionEnd ?? draft.value.length)
  commit()
}

defineExpose({ commit })
</script>

<template>
  <div class="tag-editor">
    <ul v-if="tags.length" class="tag-editor-list" aria-label="Tags">
      <li v-for="(tag, index) in tags" :key="tag">
        <button class="panel-secondary-action tag-editor-chip" type="button" :disabled="disabled" :aria-label="`Remove tag ${tag}`" @click="remove(index)">
          <span>{{ tag }}</span><span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>
    <div class="tag-editor-entry">
      <label :for="id" class="sr-only">Add tag</label>
      <input :id="id" ref="input" v-model="draft" class="panel-field" placeholder="Add tag" autocomplete="off" enterkeyhint="done" :disabled="disabled" :aria-invalid="!!error" :aria-describedby="error ? `${id}-error` : undefined" @keydown="keydown" @paste="paste">
      <button v-if="draft.trim()" class="panel-secondary-action" type="button" :disabled="disabled" @click="commit">Add</button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="tag-editor-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.tag-editor { display: grid; gap: var(--filter-option-gap); min-width: 0; }
.tag-editor-list { display: flex; flex-wrap: wrap; gap: var(--filter-option-gap); padding: 0; margin: 0; list-style: none; }
.tag-editor-list > li { min-width: 0; max-width: 100%; }
.tag-editor-chip { width: auto; gap: var(--filter-option-gap); min-height: 44px; }
.tag-editor-chip > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.tag-editor-entry { display: flex; align-items: center; gap: var(--filter-action-gap); }
.tag-editor-entry > input { min-width: 0; flex: 1; }
.tag-editor-entry > button { width: auto; flex: 0 0 auto; }
.tag-editor-error { margin: 0; font-size: var(--filter-option-font-size); }
</style>
