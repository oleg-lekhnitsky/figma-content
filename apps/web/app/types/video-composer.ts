export type VideoFormat = 'portrait-3-4' | 'portrait' | 'square' | 'landscape-4-3' | 'landscape'
export type VideoFit = 'contain' | 'cover'
export type VideoTransition = 'cut' | 'fade'
export type VideoRendererKind = 'canvas-2d' | 'webgl'
export type VideoTiltMode = 'off' | 'fan' | 'uniform' | 'alternate'
export type VideoEasing = 'flow' | 'glide' | 'linear' | 'ease' | 'sweep' | 'smooth'
export type VideoScaleFocus = 'center' | 'start' | 'end'
export type VideoTemplateCollection = 'carousel' | 'carousel-3d' | 'grid' | 'orbit' | 'globe' | 'scale' | 'stories' | 'flicker' | 'test' | 'swipe-depth'
export type VideoScaleStyle = 'bloom' | 'recede'
export type VideoGrowFrom = 'center' | 'top' | 'bottom' | 'left' | 'right'

export interface VideoTemplate {
  id: string
  name: string
  description: string
  renderer: VideoRendererKind
  collection?: VideoTemplateCollection
  thumbnail: string
  preset?: Partial<VideoComposerSettings>
  bezier?: readonly [number, number, number, number]
}

export interface VideoComposerSettings {
  templateId: string
  format: VideoFormat
  fit: VideoFit
  transition: VideoTransition
  secondsPerSlide: number
  showTitles: boolean
  direction: 'up' | 'down' | 'left' | 'right'
  gap: number
  tilt: number
  scaleCenter: boolean
  tiltMode: VideoTiltMode
  easing: VideoEasing
  cornerRadius: number
  distance: number
  centerScale: number
  fade: number
  offsetX: number
  offsetY: number
  scaleFocus: VideoScaleFocus
  solo: boolean
  visibleCount: number
  planeSize: number
  planeRotation: number
  cycles: number
  loop: boolean
  staggerFrames: number
  delayFrames: number
  cycleDegrees: number
  orbitRadius: number
  perspective: number
  rotationX: number
  rotationY: number
  rotationZ: number
  reverse: boolean
  spin: number
  spread: number
  staggerSeconds: number
  scaleStyle: VideoScaleStyle
  growFrom: VideoGrowFrom
  imageFit: 'fit' | 'fill'
  flickerEffect: 'off' | 'scale' | 'drift' | 'flip'
  flipMaterial: 'flat' | 'lit'
  flipLightIntensity: number
  flipRoughness: number
  flipGridColumns: number
  flipGridRows: number
  flipGridGap: number
  flipStagger: number
  flipShuffle?: boolean
  flickerPacing: 'equal' | 'eased'
  scaleDirection: 'forward' | 'reverse'
  driftDirection: 'up' | 'down' | 'left' | 'right'
  scaleAmount: number
  driftAmount: number
  gridMoveDistance: number
  gridStaggerCurve: VideoEasing
  delaySeconds: number
  fps: 15 | 25 | 30 | 60
  safeArea: boolean
  exportMotionBlur: boolean
  backgroundColor: string
  globeMinScale: number
  globeMaxScale: number
  globeAxis: 'x' | 'y' | 'z'
  globeMotion: 'continuous' | 'stepped'
  globeStops: number
  globeShuffle: boolean
  globeFaceCamera: boolean
  globeShowBackfaces: boolean
  globeFlipImage: boolean
  storiesBigScale: number
  storiesBigDrift: number
  storiesThumbSize: number
  storiesThumbAspect: '1:1' | '3:4' | '4:3'
  storiesContainerOpacity: number
  storiesContainerBlur: number
  storiesSelectorPad: number
  storiesSelectorStroke: number
  storiesDimAmount: number
  swipeAlternating: boolean
}

export const videoFormatDimensions: Record<VideoFormat, readonly [number, number]> = {
  'portrait-3-4': [810, 1080],
  portrait: [720, 1280],
  square: [1080, 1080],
  'landscape-4-3': [1080, 810],
  landscape: [1280, 720]
}
