<script setup lang="ts">
import type { VideoComposerSettings, VideoFormat } from '~/types/video-composer'
import VideoHexColorInput from '~/components/video-composer/VideoHexColorInput.vue'
import VideoRangeInput from '~/components/video-composer/VideoRangeInput.vue'
const props = defineProps<{ modelValue: VideoComposerSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: VideoComposerSettings] }>()
const set = <K extends keyof VideoComposerSettings>(key: K, value: VideoComposerSettings[K]) => emit('update:modelValue', { ...props.modelValue, [key]: value })
const formats: Array<{ value: VideoFormat; label: string }> = [{ value:'portrait-3-4',label:'3:4' },{ value:'portrait',label:'9:16' },{ value:'square',label:'1:1' },{ value:'landscape-4-3',label:'4:3' },{ value:'landscape',label:'16:9' }]
</script>

<template>
  <section class="video-panel video-inspector">
    <div class="video-panel-scroll">
      <header><h2 class="filter-overlay-title">Canvas</h2></header>
      <fieldset><legend>Aspect</legend><div class="video-choice-row"><button v-for="option in formats" :key="option.value" type="button" :aria-pressed="modelValue.format === option.value" @click="set('format',option.value)">{{ option.label }}</button></div></fieldset>
      <fieldset><legend>FPS</legend><div class="video-choice-row"><button v-for="value in [15,25,30,60] as const" :key="value" type="button" :aria-pressed="modelValue.fps === value" @click="set('fps',value)">{{ value }}</button></div></fieldset>
      <fieldset><legend>Safe area</legend><div class="video-choice-row"><button type="button" :aria-pressed="!modelValue.safeArea" @click="set('safeArea',false)">Off</button><button type="button" :aria-pressed="modelValue.safeArea" @click="set('safeArea',true)">On</button></div></fieldset>
      <fieldset><legend>Export motion blur</legend><div class="video-choice-row"><button type="button" :aria-pressed="!modelValue.exportMotionBlur" @click="set('exportMotionBlur',false)">Off</button><button type="button" :aria-pressed="modelValue.exportMotionBlur" @click="set('exportMotionBlur',true)">On</button></div></fieldset>
      <fieldset><legend>Background</legend><div class="video-choice-row"><button type="button" :aria-pressed="modelValue.backgroundType === 'solid'" @click="set('backgroundType','solid')">Solid</button><button type="button" :aria-pressed="modelValue.backgroundType === 'gradient'" @click="set('backgroundType','gradient')">Gradient</button></div></fieldset>
      <VideoHexColorInput :label="modelValue.backgroundType === 'gradient' ? 'Start color' : 'Color'" :model-value="modelValue.backgroundColor" @update:model-value="set('backgroundColor',$event)" />
      <template v-if="modelValue.backgroundType === 'gradient'">
        <VideoHexColorInput label="End color" :model-value="modelValue.backgroundGradientColor" @update:model-value="set('backgroundGradientColor',$event)" />
        <label><span>Angle <output>{{ modelValue.backgroundGradientAngle }}°</output></span><VideoRangeInput min="0" max="360" :value="modelValue.backgroundGradientAngle" @input="set('backgroundGradientAngle',Number(($event.target as HTMLInputElement).value))" /></label>
      </template>
    </div>
  </section>
</template>
