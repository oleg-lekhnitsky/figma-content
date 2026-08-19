<script setup lang="ts">
import type { VideoComposerSettings, VideoFormat } from '~/types/video-composer'
import VideoHexColorInput from '~/components/video-composer/VideoHexColorInput.vue'
const props = defineProps<{ modelValue: VideoComposerSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: VideoComposerSettings] }>()
const set = <K extends keyof VideoComposerSettings>(key: K, value: VideoComposerSettings[K]) => emit('update:modelValue', { ...props.modelValue, [key]: value })
const formats: Array<{ value: VideoFormat; label: string }> = [{ value:'portrait-3-4',label:'3:4' },{ value:'portrait',label:'9:16' },{ value:'square',label:'1:1' },{ value:'landscape-4-3',label:'4:3' },{ value:'landscape',label:'16:9' }]
</script>

<template><section class="video-panel video-inspector"><div class="video-panel-scroll"><header><p>Canvas</p></header><fieldset><legend>Aspect</legend><div class="video-choice-row"><button v-for="option in formats" :key="option.value" type="button" :aria-pressed="modelValue.format === option.value" @click="set('format',option.value)">{{ option.label }}</button></div></fieldset><fieldset><legend>FPS</legend><div class="video-choice-row"><button v-for="value in [15,25,30,60] as const" :key="value" type="button" :aria-pressed="modelValue.fps === value" @click="set('fps',value)">{{ value }}</button></div></fieldset><fieldset><legend>Safe area</legend><div class="video-choice-row"><button type="button" :aria-pressed="!modelValue.safeArea" @click="set('safeArea',false)">Off</button><button type="button" :aria-pressed="modelValue.safeArea" @click="set('safeArea',true)">On</button></div></fieldset><VideoHexColorInput label="Background" :model-value="modelValue.backgroundColor" @update:model-value="set('backgroundColor',$event)" /></div></section></template>
