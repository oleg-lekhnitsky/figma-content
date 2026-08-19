<script setup lang="ts">
import { Pipette } from 'reicon-vue'

const props = defineProps<{ label: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const inputId = useId()
const paletteId = useId()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const hex = ref(props.modelValue.replace(/^#/,'').toUpperCase())
const open = ref(false)
const hue = ref(0)
const saturation = ref(0)
const brightness = ref(0)
const eyedropperSupported = ref(false)

const hexToHsv = (value: string) => {
  const raw=value.replace(/^#/,'').padEnd(6,'0'),r=parseInt(raw.slice(0,2),16)/255,g=parseInt(raw.slice(2,4),16)/255,b=parseInt(raw.slice(4,6),16)/255
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min
  let h=0
  if(delta){if(max===r)h=60*(((g-b)/delta)%6);else if(max===g)h=60*((b-r)/delta+2);else h=60*((r-g)/delta+4)}
  return { h:(h+360)%360,s:max===0?0:delta/max,v:max }
}

const hsvToHex = (h: number,s: number,v: number) => {
  const chroma=v*s,x=chroma*(1-Math.abs((h/60)%2-1)),match=v-chroma
  const [r,g,b]=h<60?[chroma,x,0]:h<120?[x,chroma,0]:h<180?[0,chroma,x]:h<240?[0,x,chroma]:h<300?[x,0,chroma]:[chroma,0,x]
  return `#${[r,g,b].map(channel=>Math.round((channel+match)*255).toString(16).padStart(2,'0')).join('').toUpperCase()}`
}

const syncFromHex = (value: string) => {
  const hsv=hexToHsv(value);hue.value=hsv.h;saturation.value=hsv.s;brightness.value=hsv.v
}

watch(() => props.modelValue, value => { hex.value=value.replace(/^#/,'').toUpperCase();syncFromHex(value) },{ immediate:true })

const update = (event: Event) => {
  const input=event.target as HTMLInputElement
  const next=input.value.replace(/[^0-9a-f]/gi,'').slice(0,6).toUpperCase()
  hex.value=next
  input.value=next
  if(next.length===6){const color=`#${next}`;syncFromHex(color);emit('update:modelValue',color)}
}

const restoreIfIncomplete = () => {
  if(hex.value.length!==6)hex.value=props.modelValue.replace(/^#/,'').toUpperCase()
}

const selectValue = (event: FocusEvent) => {
  (event.target as HTMLInputElement).select()
}

const emitHsv = () => {
  const color=hsvToHex(hue.value,saturation.value,brightness.value)
  hex.value=color.slice(1);emit('update:modelValue',color)
}

const updateSpectrum = (event: PointerEvent) => {
  if(event.type==='pointermove'&&event.buttons===0)return
  const target=event.currentTarget as HTMLElement,rect=target.getBoundingClientRect()
  if(event.type==='pointerdown')target.setPointerCapture(event.pointerId)
  saturation.value=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))
  brightness.value=1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))
  emitHsv()
}

const adjustSpectrum = (event: KeyboardEvent) => {
  const step=event.shiftKey?.1:.02
  if(event.key==='ArrowLeft')saturation.value=Math.max(0,saturation.value-step)
  else if(event.key==='ArrowRight')saturation.value=Math.min(1,saturation.value+step)
  else if(event.key==='ArrowDown')brightness.value=Math.max(0,brightness.value-step)
  else if(event.key==='ArrowUp')brightness.value=Math.min(1,brightness.value+step)
  else return
  event.preventDefault();emitHsv()
}

const updateHue = (event: Event) => {
  hue.value=Number((event.target as HTMLInputElement).value);emitHsv()
}

const pickFromScreen = async () => {
  const EyeDropper=(window as unknown as { EyeDropper?: new()=>{ open:()=>Promise<{ sRGBHex:string }> } }).EyeDropper
  if(!EyeDropper)return
  try{
    const result=await new EyeDropper().open(),color=result.sRGBHex.toUpperCase()
    syncFromHex(color);hex.value=color.slice(1);emit('update:modelValue',color)
  }catch{/* The user cancelled the screen picker. */}
}

const handleDocumentPointer = (event: PointerEvent) => {
  if(open.value&&!root.value?.contains(event.target as Node))open.value=false
}

const handleDocumentKey = (event: KeyboardEvent) => {
  if(event.key==='Escape'&&open.value){open.value=false;trigger.value?.focus()}
}

onMounted(()=>{eyedropperSupported.value='EyeDropper' in window;document.addEventListener('pointerdown',handleDocumentPointer);document.addEventListener('keydown',handleDocumentKey)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',handleDocumentPointer);document.removeEventListener('keydown',handleDocumentKey)})
</script>

<template>
  <div ref="root" class="video-hex-color">
    <label :for="inputId">{{ label }}</label>
    <div class="video-hex-color-field">
      <button ref="trigger" class="video-hex-color-swatch" type="button" :style="{ backgroundColor:modelValue }" aria-label="Open background color palette" :aria-expanded="open" :aria-controls="paletteId" @click="open=!open" />
      <span aria-hidden="true">#</span>
      <input :id="inputId" :value="hex" type="text" inputmode="text" maxlength="6" autocomplete="off" spellcheck="false" pattern="[0-9A-Fa-f]{6}" aria-label="Six-digit hexadecimal canvas background color" @focus="selectValue" @click="selectValue" @input="update" @blur="restoreIfIncomplete">
    </div>
    <div v-if="open" :id="paletteId" class="video-hex-palette" aria-label="Background color picker">
      <div class="video-color-picker-toolbar"><span>{{ modelValue.toUpperCase() }}</span><button v-if="eyedropperSupported" type="button" aria-label="Pick a color from the screen" title="Pick from screen" @click="pickFromScreen"><Pipette aria-hidden="true" /></button></div>
      <div class="video-color-spectrum" role="slider" tabindex="0" aria-label="Color saturation and brightness" :aria-valuetext="`${Math.round(saturation*100)}% saturation, ${Math.round(brightness*100)}% brightness`" :style="{ '--video-picker-hue':`${hue}deg` }" @pointerdown="updateSpectrum" @pointermove="updateSpectrum" @keydown="adjustSpectrum">
        <span class="video-color-spectrum-handle" :style="{ left:`${saturation*100}%`,top:`${(1-brightness)*100}%`,backgroundColor:modelValue }" />
      </div>
      <label class="video-color-hue"><span class="sr-only">Hue</span><input type="range" min="0" max="359" step="1" :value="hue" aria-label="Color hue" @input="updateHue"></label>
    </div>
  </div>
</template>
