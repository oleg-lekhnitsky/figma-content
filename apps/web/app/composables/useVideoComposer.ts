import type { AssetMasonryItem } from '~/types/asset-masonry'
import type { VideoComposerSettings } from '~/types/video-composer'
import { videoFormatDimensions } from '~/types/video-composer'
import { videoTemplates } from '~/utils/video-templates'

const easingCurves: Record<VideoComposerSettings['easing'], readonly [number, number, number, number]> = {
  flow: [.2, 0, .2, 1],
  glide: [.33, 0, 0, 1],
  linear: [0, 0, 1, 1],
  ease: [.25, .1, .25, 1],
  sweep: [.86, .14, .14, .86],
  smooth: [.76, 0, .24, 1]
}

const cubicBezierProgress = (progress: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) => {
  if (progress <= 0 || progress >= 1 || (x1 === y1 && x2 === y2)) return progress
  const sample = (time: number, first: number, second: number) => ((1 - 3 * second + 3 * first) * time + (3 * second - 6 * first)) * time * time + 3 * first * time
  let low = 0, high = 1, time = progress
  for (let iteration = 0; iteration < 20; iteration++) {
    time = (low + high) / 2
    if (sample(time, x1, x2) < progress) low = time
    else high = time
  }
  return sample(time, y1, y2)
}

interface VideoComposerRuntimeOptions {
  maxPreviewDimension?: number
  preserveDrawingBuffer?: boolean
  transparentBackground?: boolean
}

export const useVideoComposer = (assets: Ref<AssetMasonryItem[]>, boardTitle: Ref<string>, initialTemplateId='flicker-01', runtimeOptions:VideoComposerRuntimeOptions={}) => {
  const settings = ref<VideoComposerSettings>({ templateId:initialTemplateId,format:'portrait',fit:'contain',transition:'fade',secondsPerSlide:6,showTitles:false,direction:'up',gap:40,tilt:0,scaleCenter:false,tiltMode:'off',easing:'glide',cornerRadius:0,distance:100,centerScale:1.4,fade:0,offsetX:0,offsetY:0,scaleFocus:'center',solo:false,visibleCount:6,planeSize:100,planeRotation:0,cycles:1,loop:true,staggerFrames:2,delayFrames:0,cycleDegrees:360,orbitRadius:280,perspective:140,rotationX:0,rotationY:0,rotationZ:0,reverse:false,spin:0,spread:0,staggerSeconds:.4,scaleStyle:'bloom',growFrom:'center',imageFit:'fit',flickerEffect:'off',flipMaterial:'lit',flipLightIntensity:100,flipRoughness:72,flipGridColumns:1,flipGridRows:1,flipGridGap:4,flipStagger:0,flickerPacing:'equal',scaleDirection:'forward',driftDirection:'up',scaleAmount:30,driftAmount:30,gridMoveDistance:300,gridStaggerCurve:'linear',delaySeconds:0,fps:30,safeArea:false,exportMotionBlur:false,backgroundColor:'#f1efed',globeMinScale:10,globeMaxScale:20,globeAxis:'y',globeMotion:'continuous',globeStops:8,globeShuffle:false,globeFaceCamera:true,globeShowBackfaces:true,globeFlipImage:false,storiesBigScale:115,storiesBigDrift:40,storiesThumbSize:85,storiesThumbAspect:'1:1',storiesContainerOpacity:40,storiesContainerBlur:60,storiesSelectorPad:5,storiesSelectorStroke:2,storiesDimAmount:20,swipeAlternating:true })
  Object.assign(settings.value,videoTemplates.find(item=>item.id===initialTemplateId)?.preset)
  const canvas = shallowRef<HTMLCanvasElement>()
  const playing = ref(false)
  const exporting = ref(false)
  const progress = ref(0)
  const feedback = ref('')
  const images = new Map<string, HTMLImageElement>()
  const imageRequests = new Map<string, Promise<HTMLImageElement>>()
  const videos = new Map<string, HTMLVideoElement>()
  const textures = new Map<string, unknown>()
  const webglMeshes = new Map<string, import('three').Mesh>()
  const gridWrapMeshes = new Map<string, import('three').Mesh>()
  let animationFrame = 0
  let playbackStartedAt = 0
  let gridPlaybackTime = 0
  let lastPreviewFrameAt = 0
  let renderRevision = 0
  let templateChangeRevision = 0
  let textureRefreshFrame = 0
  let threeRenderer: import('three').WebGLRenderer | undefined

  const disposeWebglMeshes = () => {
    gridWrapMeshes.forEach(mesh=>mesh.removeFromParent())
    gridWrapMeshes.clear()
    webglMeshes.forEach(mesh=>{
      mesh.removeFromParent()
      mesh.geometry.dispose()
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
      materials.forEach(material=>material.dispose())
    })
    webglMeshes.clear()
  }
  const disposeTextures = () => {
    disposeWebglMeshes()
    textures.forEach(texture=>(texture as import('three').Texture).dispose())
    textures.clear()
  }
  const disposeRenderer = () => {
    if(!threeRenderer)return
    threeRenderer.dispose()
    threeRenderer.forceContextLoss()
    threeRenderer=undefined
    disposeTextures()
  }

  const template = computed(() => videoTemplates.find(item => item.id === settings.value.templateId) || videoTemplates[0]!)
  const countForAssets = () => {
    const minimum=template.value.collection==='carousel-3d'?3:2
    const maximum=template.value.collection==='globe'||template.value.collection==='grid'?60:template.value.collection==='carousel-3d'?40:template.value.collection==='flicker'?30:20
    return Math.max(minimum,Math.min(maximum,assets.value.length||minimum))
  }
  const dimensions = computed(() => videoFormatDimensions[settings.value.format])
  const totalDuration = computed(() => template.value.collection==='scale'
    ? Math.max(1,settings.value.visibleCount)*settings.value.staggerSeconds
    : template.value.collection==='globe'&&settings.value.globeMotion==='stepped'
      ? settings.value.secondsPerSlide+Math.max(1,Math.round(settings.value.cycles*Math.min(settings.value.visibleCount,settings.value.globeStops)))*settings.value.delaySeconds
    : template.value.collection==='orbit' ? Math.max(.5,settings.value.secondsPerSlide)+Math.max(0,settings.value.delaySeconds)*Math.max(1,settings.value.cycles*Math.max(1,Math.round(settings.value.visibleCount)))
    : template.value.collection==='grid' ? (settings.value.secondsPerSlide+settings.value.delaySeconds)*settings.value.cycles
    : template.value.collection==='carousel-3d'||template.value.collection==='globe' ? settings.value.secondsPerSlide*settings.value.cycles
    : template.value.collection==='flicker'||template.value.collection==='test'||template.value.collection==='swipe-depth' ? settings.value.secondsPerSlide*settings.value.cycles
    : template.value.collection==='stories' ? settings.value.secondsPerSlide*settings.value.cycles
    : Math.max(1, assets.value.length) * settings.value.secondsPerSlide)
  const urlsFor = (asset: AssetMasonryItem) => {
    if (/^(data|blob):/.test(asset.previewUrl)) return [asset.previewUrl]
    return ['preview2x','preview','original'].map(variant => `/api/assets/${encodeURIComponent(asset.id)}/media?variant=${variant}`)
  }
  const loadImageUrl = (url:string) => {
    const cacheKey=url,cached=images.get(cacheKey)
    if(cached?.complete&&cached.naturalWidth)return Promise.resolve(cached)
    const pending=imageRequests.get(cacheKey)
    if(pending)return pending
    const request=new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=cached||new Image();image.decoding='async'
      image.onload=()=>{images.set(cacheKey,image);resolve(image)};image.onerror=()=>{images.delete(cacheKey);reject(new Error(`Could not load ${url}`))}
      if(!cached)image.src=url
    })
    const tracked=request.finally(()=>{if(imageRequests.get(cacheKey)===tracked)imageRequests.delete(cacheKey)})
    imageRequests.set(cacheKey,tracked)
    return tracked
  }
  const loadImage = async(asset:AssetMasonryItem) => {
    for(const url of urlsFor(asset)){try{return await loadImageUrl(url)}catch{/* Try the smaller preview. */}}
    throw new Error(`Could not load a preview for ${asset.id}`)
  }
  const loadVideo = (asset:AssetMasonryItem) => {
    const cached=videos.get(asset.id)
    if(cached&&cached.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA)return Promise.resolve(cached)
    return new Promise<HTMLVideoElement>((resolve,reject)=>{
      const video=cached||document.createElement('video')
      video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto'
      const ready=()=>{videos.set(asset.id,video);resolve(video)}
      const failed=()=>{videos.delete(asset.id);reject(new Error(`Could not load video ${asset.id}`))}
      video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true})
      if(!cached)video.src=`/api/assets/${encodeURIComponent(asset.id)}/media?variant=original`
      video.load()
    })
  }
  const missingAssetSource = (asset:AssetMasonryItem) => {
    const placeholder=document.createElement('canvas'),width=720,height=Math.max(480,Math.round(width*Math.max(.55,Math.min(1.8,asset.height/Math.max(1,asset.width)))))
    placeholder.width=width;placeholder.height=height
    const context=placeholder.getContext('2d')
    if(context){
      context.fillStyle='#e8e6e3';context.fillRect(0,0,width,height)
      context.fillStyle='#252525';context.font='700 34px sans-serif';context.textAlign='center';context.textBaseline='middle'
      context.fillText(asset.title||'Asset preview',width/2,height/2,width-80)
    }
    return placeholder
  }
  const loadRenderable = async(asset:AssetMasonryItem):Promise<HTMLImageElement|HTMLCanvasElement> => {
    try{return await loadImage(asset)}catch{return missingAssetSource(asset)}
  }
  const preloadFlickerAssets = async () => {
    const count=Math.min(assets.value.length,Math.max(1,Math.min(30,Math.round(settings.value.visibleCount))))
    await Promise.all(assets.value.slice(0,count).map(asset=>loadRenderable(asset)))
  }
  const cachedImageFor = (asset:AssetMasonryItem) => urlsFor(asset)
    .map(url=>images.get(url))
    .find((image):image is HTMLImageElement=>Boolean(image?.complete&&image.naturalWidth))
  const scheduleWebglTextureRefresh = () => {
    cancelAnimationFrame(textureRefreshFrame)
    textureRefreshFrame=requestAnimationFrame(()=>{
      if(template.value.renderer!=='webgl')return
      disposeTextures()
      void drawAt(progress.value)
    })
  }

  const sizeCanvas = (target: HTMLCanvasElement, resize=true) => {
    const [formatWidth,formatHeight]=dimensions.value
    const previewScale=runtimeOptions.maxPreviewDimension
      ? Math.min(1,runtimeOptions.maxPreviewDimension/Math.max(formatWidth,formatHeight))
      : 1
    const width=Math.max(1,Math.round(formatWidth*previewScale)),height=Math.max(1,Math.round(formatHeight*previewScale))
    if(resize&&(target.width!==width||target.height!==height)){
      let previousFrame:HTMLCanvasElement|undefined
      if(template.value.renderer!=='webgl'&&target.width>0&&target.height>0){
        previousFrame=document.createElement('canvas');previousFrame.width=target.width;previousFrame.height=target.height
        previousFrame.getContext('2d')?.drawImage(target,0,0)
      }
      target.width=width;target.height=height
      if(previousFrame)target.getContext('2d')?.drawImage(previousFrame,0,0,width,height)
    }
    return {width,height}
  }
  const paintImage = (context:CanvasRenderingContext2D,image:HTMLImageElement|HTMLCanvasElement,width:number,height:number,opacity=1) => {
    const sourceWidth=image instanceof HTMLImageElement?image.naturalWidth:image.width
    const sourceHeight=image instanceof HTMLImageElement?image.naturalHeight:image.height
    const scale=settings.value.fit==='cover'?Math.max(width/sourceWidth,height/sourceHeight):Math.min(width/sourceWidth,height/sourceHeight)
    const drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale
    context.save();context.globalAlpha=opacity;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);context.restore()
  }
  const paintBackground = (context:CanvasRenderingContext2D,width:number,height:number) => {
    if(runtimeOptions.transparentBackground)return
    context.fillStyle=settings.value.backgroundColor;context.fillRect(0,0,width,height)
  }
  const draw2d = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const {width,height}=sizeCanvas(target)
    const frame=document.createElement('canvas');frame.width=width;frame.height=height
    const context=frame.getContext('2d');if(!context)return
    paintBackground(context,width,height)
    const index=Math.min(assets.value.length-1,Math.floor(time/settings.value.secondsPerSlide)),local=(time%settings.value.secondsPerSlide)/settings.value.secondsPerSlide,next=Math.min(assets.value.length-1,index+1)
    const current=await loadRenderable(assets.value[index]!);paintImage(context,current,width,height)
    if(settings.value.transition==='fade'&&next!==index&&local>.78)paintImage(context,await loadRenderable(assets.value[next]!),width,height,(local-.78)/.22)
    if(settings.value.showTitles){context.fillStyle='rgba(0,0,0,.72)';context.fillRect(0,height-86,width,86);context.fillStyle='#fff';context.font=`700 ${Math.max(24,Math.round(width*.035))}px sans-serif`;context.fillText(assets.value[index]?.title||'',28,height-32,width-56)}
    if(revision!==renderRevision||target!==canvas.value)return
    const visibleContext=target.getContext('2d');if(!visibleContext)return
    visibleContext.clearRect(0,0,width,height);visibleContext.drawImage(frame,0,0)
    feedback.value=''
  }
  const drawScale = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const {width,height}=sizeCanvas(target),frame=document.createElement('canvas');frame.width=width;frame.height=height
    const context=frame.getContext('2d');if(!context)return
    paintBackground(context,width,height)
    const count=Math.max(1,Math.min(20,Math.floor(settings.value.visibleCount)))
    const duration=Math.max(.05,settings.value.secondsPerSlide),stagger=Math.max(.02,settings.value.staggerSeconds)
    const transitionSpan=Math.min(duration,Math.max(1,count-1)*stagger)
    const cycleDuration=stagger*count,cyclePosition=((time%cycleDuration)+cycleDuration)%cycleDuration/stagger
    const current=Math.floor(cyclePosition)
    const curve=template.value.bezier||easingCurves[settings.value.easing],planeScale=Math.max(.05,Math.min(4,settings.value.planeSize/100))
    const anchorX=settings.value.growFrom==='left'?0:settings.value.growFrom==='right'?1:.5
    const anchorY=settings.value.growFrom==='top'?0:settings.value.growFrom==='bottom'?1:.5
    const entries=await Promise.all(Array.from({length:count},async(_,position)=>{
      const sequenceIndex=current-position,assetIndex=((sequenceIndex%count)+count)%count%assets.value.length
      const age=(cyclePosition-sequenceIndex)*stagger,raw=Math.max(0,Math.min(1,age/transitionSpan))
      const eased=cubicBezierProgress(raw,curve)
      const scale=(settings.value.scaleStyle==='recede'?1-eased:eased)*planeScale
      if(scale<=.0008)return null
      return {image:await loadRenderable(assets.value[assetIndex]!),assetIndex,age,scale,rotation:settings.value.spin*Math.PI/180*(1-Math.min(1,scale/planeScale))}
    }))
    const renderable=entries.filter(entry=>entry!==null).sort((a,b)=>b.age-a.age)
    for(const entry of renderable){
      const sourceWidth=entry.image instanceof HTMLImageElement?entry.image.naturalWidth:entry.image.width
      const sourceHeight=entry.image instanceof HTMLImageElement?entry.image.naturalHeight:entry.image.height
      const sourceAspect=sourceWidth/sourceHeight,canvasAspect=width/height
      let drawWidth:number,drawHeight:number,sourceX=0,sourceY=0,cropWidth=sourceWidth,cropHeight=sourceHeight
      if(settings.value.imageFit==='fill'){
        drawWidth=entry.scale*width;drawHeight=entry.scale*height
        if(sourceAspect>canvasAspect){cropWidth=sourceHeight*canvasAspect;sourceX=(sourceWidth-cropWidth)/2}else{cropHeight=sourceWidth/canvasAspect;sourceY=(sourceHeight-cropHeight)/2}
      }else if(sourceAspect>canvasAspect){drawWidth=entry.scale*width;drawHeight=drawWidth/sourceAspect}else{drawHeight=entry.scale*height;drawWidth=drawHeight*sourceAspect}
      const centerX=anchorX*width+(.5-anchorX)*drawWidth+settings.value.offsetX*width/100
      const centerY=anchorY*height+(.5-anchorY)*drawHeight+settings.value.offsetY*height/100
      context.save();context.translate(centerX,centerY);if(entry.rotation)context.rotate(entry.rotation)
      if(settings.value.cornerRadius>0){const radius=Math.min(settings.value.cornerRadius*entry.scale,drawWidth/2,drawHeight/2);context.beginPath();context.roundRect(-drawWidth/2,-drawHeight/2,drawWidth,drawHeight,radius);context.clip()}
      context.drawImage(entry.image,sourceX,sourceY,cropWidth,cropHeight,-drawWidth/2,-drawHeight/2,drawWidth,drawHeight);context.restore()
    }
    if(revision!==renderRevision||target!==canvas.value)return
    const visibleContext=target.getContext('2d');if(!visibleContext)return
    visibleContext.clearRect(0,0,width,height);visibleContext.drawImage(frame,0,0);feedback.value=''
  }
  const drawFlicker = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const {width,height}=sizeCanvas(target),frame=document.createElement('canvas');frame.width=width;frame.height=height
    const context=frame.getContext('2d');if(!context)return
    paintBackground(context,width,height)
    const count=Math.max(1,Math.min(30,Math.round(settings.value.visibleCount))),duration=Math.max(.1,settings.value.secondsPerSlide)
    const slotDuration=duration/count,delay=Math.min(slotDuration*.95,Math.max(0,settings.value.delaySeconds)),activeDuration=slotDuration-delay
    const curve=settings.value.flickerEffect==='flip'
      ? easingCurves[settings.value.easing]
      : template.value.bezier||easingCurves[settings.value.easing]
    const phase=((time/duration)%1+1)%1
    let slotIndex:number,localProgress:number,pulse:(value:number)=>number
    if(settings.value.flickerPacing==='eased'){
      const inverse=(targetValue:number)=>{let low=0,high=1;for(let index=0;index<25;index++){const midpoint=(low+high)/2;if(cubicBezierProgress(midpoint,curve)<targetValue)low=midpoint;else high=midpoint}return(low+high)/2}
      const boundaries=Array.from({length:count+1},(_,index)=>inverse(index/count))
      slotIndex=Math.max(0,boundaries.findIndex((boundary,index)=>index>0&&phase<boundary)-1);if(slotIndex<0)slotIndex=count-1
      const start=boundaries[slotIndex]!,end=boundaries[slotIndex+1]!
      localProgress=Math.max(0,Math.min(1,(phase-start)/Math.max(.0001,end-start)))
      const smooth=(value:number)=>value*value*(3-2*value),hold=Math.min(.95,delay/slotDuration),edge=(1-hold)/2
      pulse=value=>value<edge?.5*smooth(value/Math.max(.001,edge)):value<edge+hold?.5:.5+.5*smooth((value-edge-hold)/Math.max(.001,edge))
    }else{
      const slotPosition=phase*count;slotIndex=Math.min(count-1,Math.floor(slotPosition));localProgress=slotPosition-slotIndex
      const activeFraction=activeDuration/slotDuration,start=.5*activeFraction,end=start+delay/slotDuration
      pulse=value=>value<start?.5*cubicBezierProgress(.5+.5*value/Math.max(.001,start),curve):value<end?.5:.5+.5*cubicBezierProgress(.5*(value-end)/Math.max(.001,1-end),curve)/.5
    }
    const flipActiveFraction=activeDuration/slotDuration
    const flipProgress=settings.value.flickerEffect==='flip'
      ? (localProgress<flipActiveFraction?cubicBezierProgress(localProgress/Math.max(.001,flipActiveFraction),curve):1)
      : 0
    const faceOffset=settings.value.flickerEffect==='flip'&&flipProgress>=.5?1:0
    const asset=assets.value[(slotIndex+faceOffset)%assets.value.length]!,image=await loadRenderable(asset)
    const sourceWidth=image instanceof HTMLImageElement?image.naturalWidth:image.width,sourceHeight=image instanceof HTMLImageElement?image.naturalHeight:image.height
    const sourceAspect=sourceWidth/sourceHeight,canvasAspect=width/height,planeScale=Math.max(.01,settings.value.planeSize/100)
    let drawWidth:number,drawHeight:number
    if(settings.value.fit==='contain'){
      if(sourceAspect>canvasAspect){drawWidth=width;drawHeight=width/sourceAspect}else{drawHeight=height;drawWidth=height*sourceAspect}
    }else if(sourceAspect>canvasAspect){drawHeight=height;drawWidth=height*sourceAspect}else{drawWidth=width;drawHeight=width/sourceAspect}
    const effectProgress=Math.max(0,Math.min(1,pulse(localProgress))),amount=settings.value.scaleAmount/100
    if(settings.value.flickerEffect==='scale'){
      const from=settings.value.scaleDirection==='forward'?1-amount/2:1+amount/2,to=settings.value.scaleDirection==='forward'?1+amount/2:1-amount/2
      const scale=from+(to-from)*effectProgress;drawWidth*=planeScale*scale;drawHeight*=planeScale*scale
    }else{
      drawWidth*=planeScale;drawHeight*=planeScale
      if(settings.value.flickerEffect==='flip'){
        const edgeAmount=Math.sin(Math.PI*flipProgress)
        drawWidth*=Math.max(.001,Math.abs(Math.cos(Math.PI*flipProgress)))
        drawHeight*=1-edgeAmount*.06
      }
    }
    let driftX=0,driftY=0
    if(settings.value.flickerEffect==='drift'){
      const drift=(effectProgress-.5)*settings.value.driftAmount/100
      if(settings.value.driftDirection==='left')driftX=-drift*width
      else if(settings.value.driftDirection==='right')driftX=drift*width
      else if(settings.value.driftDirection==='up')driftY=-drift*height
      else driftY=drift*height
    }
    const centerX=width/2+settings.value.offsetX*width/100+driftX,centerY=height/2+settings.value.offsetY*height/100+driftY
    context.save();if(settings.value.cornerRadius>0){const radius=Math.min(settings.value.cornerRadius,drawWidth/2,drawHeight/2);context.beginPath();context.roundRect(centerX-drawWidth/2,centerY-drawHeight/2,drawWidth,drawHeight,radius);context.clip()}
    context.drawImage(image,centerX-drawWidth/2,centerY-drawHeight/2,drawWidth,drawHeight)
    if(settings.value.flickerEffect==='flip'){
      context.fillStyle=`rgb(0 0 0 / ${Math.sin(Math.PI*flipProgress)*.18})`
      context.fillRect(centerX-drawWidth/2,centerY-drawHeight/2,drawWidth,drawHeight)
    }
    context.restore()
    if(revision!==renderRevision||target!==canvas.value)return
    const visibleContext=target.getContext('2d');if(!visibleContext)return
    visibleContext.clearRect(0,0,width,height);visibleContext.drawImage(frame,0,0);feedback.value=''
  }
  const drawTestFlip = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||assets.value.length<2)return
    const templateId=template.value.id
    const isCurrent=()=>revision===renderRevision&&target===canvas.value&&template.value.id===templateId&&template.value.collection==='test'
    const THREE=await import('three');if(!isCurrent())return
    const {width,height}=sizeCanvas(target,false)
    if(!threeRenderer||threeRenderer.domElement!==target){disposeRenderer();threeRenderer=new THREE.WebGLRenderer({canvas:target,antialias:true,alpha:runtimeOptions.transparentBackground===true,preserveDrawingBuffer:runtimeOptions.preserveDrawingBuffer===true});threeRenderer.setPixelRatio(1)}
    const renderer=threeRenderer
    if(target.width!==width||target.height!==height)renderer.setSize(width,height,false)
    if(runtimeOptions.transparentBackground)renderer.setClearColor(0x000000,0)
    else renderer.setClearColor(settings.value.backgroundColor,1)
    const count=Math.max(2,Math.min(30,Math.round(settings.value.visibleCount),assets.value.length))
    const duration=Math.max(.1,settings.value.secondsPerSlide),slotDuration=duration/count
    const delay=Math.min(slotDuration*.95,Math.max(0,settings.value.delaySeconds)),activeDuration=Math.max(.001,slotDuration-delay)
    const columns=Math.max(1,Math.min(6,Math.round(settings.value.flipGridColumns))),rows=Math.max(1,Math.min(6,Math.round(settings.value.flipGridRows))),gridCount=columns*rows
    const assetOrder=Array.from({length:count},(_,index)=>index)
    if(settings.value.flipShuffle){
      let seed=assets.value.slice(0,count).reduce((value,asset)=>{for(let index=0;index<asset.id.length;index++)value=Math.imul(value^asset.id.charCodeAt(index),16777619);return value},gridCount|0)>>>0
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
      for(let index=assetOrder.length-1;index>0;index--){const target=Math.floor(random()*(index+1));[assetOrder[index],assetOrder[target]]=[assetOrder[target]!,assetOrder[index]!]}
    }
    const assetAt=(sequenceIndex:number)=>assets.value[assetOrder[((sequenceIndex%count)+count)%count]!]!
    const textureFor=async(asset:AssetMasonryItem) => {
      const key=`test-flip:${asset.id}:${settings.value.fit}:${settings.value.cornerRadius}`
      const cached=textures.get(key) as import('three').Texture|undefined;if(cached)return cached
      const source=await loadRenderable(asset);if(!isCurrent())return
      const sourceWidth=source instanceof HTMLImageElement?source.naturalWidth:source.width,sourceHeight=source instanceof HTMLImageElement?source.naturalHeight:source.height
      const maxSide=1024,targetAspect=width*rows/(height*columns)
      let canvasWidth:number,canvasHeight:number,sourceX=0,sourceY=0,cropWidth=sourceWidth,cropHeight=sourceHeight
      if(settings.value.fit==='cover'){
        if(sourceWidth/sourceHeight>targetAspect){cropWidth=sourceHeight*targetAspect;sourceX=(sourceWidth-cropWidth)/2}else{cropHeight=sourceWidth/targetAspect;sourceY=(sourceHeight-cropHeight)/2}
        canvasWidth=Math.round(maxSide*Math.min(1,targetAspect));canvasHeight=Math.round(canvasWidth/targetAspect)
      }else{
        const scale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight));canvasWidth=Math.max(1,Math.round(sourceWidth*scale));canvasHeight=Math.max(1,Math.round(sourceHeight*scale))
      }
      const textureCanvas=document.createElement('canvas');textureCanvas.width=Math.max(1,canvasWidth);textureCanvas.height=Math.max(1,canvasHeight)
      const context=textureCanvas.getContext('2d')
      if(context){const radius=Math.min(textureCanvas.width,textureCanvas.height)/2;const scaledRadius=Math.min(radius,textureCanvas.width*settings.value.cornerRadius/Math.max(1,settings.value.planeSize));context.beginPath();context.roundRect(0,0,textureCanvas.width,textureCanvas.height,scaledRadius);context.clip();context.drawImage(source,sourceX,sourceY,cropWidth,cropHeight,0,0,textureCanvas.width,textureCanvas.height)}
      const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;textures.set(key,texture);return texture
    }
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(Math.max(18,Math.min(70,36/(Math.max(50,settings.value.perspective)/100))),width/height,.1,100);camera.position.z=5
    if(settings.value.flipMaterial==='lit'){
      const intensity=Math.max(0,settings.value.flipLightIntensity)/100
      scene.add(new THREE.HemisphereLight(0xffffff,0x555555,1.05*intensity));const keyLight=new THREE.DirectionalLight(0xffffff,1.2*intensity);keyLight.position.set(-3,4,5);scene.add(keyLight)
    }
    const viewportHeight=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),viewportWidth=viewportHeight*camera.aspect
    const totalWidth=viewportWidth*.82*settings.value.planeSize/100,totalHeight=viewportHeight*.82*settings.value.planeSize/100
    const gap=Math.min(totalWidth/Math.max(1,columns),totalHeight/Math.max(1,rows))*settings.value.flipGridGap/100
    const maxWidth=Math.max(.001,(totalWidth-gap*(columns-1))/columns),maxHeight=Math.max(.001,(totalHeight-gap*(rows-1))/rows)
    const planeSize=(texture:import('three').Texture)=>{const image=texture.image as HTMLCanvasElement,aspect=image.width/Math.max(1,image.height);return aspect>maxWidth/maxHeight?{width:maxWidth,height:maxWidth/aspect}:{width:maxHeight*aspect,height:maxHeight}}
    const makeFace=(group:import('three').Group,texture:import('three').Texture,isBack:boolean)=>{const size=planeSize(texture),geometry=new THREE.PlaneGeometry(size.width,size.height);const material=settings.value.flipMaterial==='lit'?new THREE.MeshStandardMaterial({map:texture,side:THREE.FrontSide,roughness:Math.max(0,Math.min(1,settings.value.flipRoughness/100)),metalness:0,transparent:true}):new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide,transparent:true});const mesh=new THREE.Mesh(geometry,material);if(isBack){if(settings.value.direction==='up'||settings.value.direction==='down')mesh.rotation.x=Math.PI;else mesh.rotation.y=Math.PI}mesh.position.z=isBack?-.001:.001;group.add(mesh);return mesh}
    const meshes:import('three').Mesh[]=[]
    await Promise.all(Array.from({length:gridCount},async(_,cellIndex)=>{
      const sequencePosition=time/slotDuration-cellIndex*settings.value.flipStagger/slotDuration
      const step=Math.floor(sequencePosition),local=sequencePosition-step,slotTime=local*slotDuration
      const rawProgress=Math.min(1,slotTime/activeDuration),flipProgress=cubicBezierProgress(rawProgress,easingCurves[settings.value.easing])
      const sequenceIndex=step*gridCount+cellIndex
      const [frontTexture,backTexture]=await Promise.all([textureFor(assetAt(sequenceIndex)),textureFor(assetAt(sequenceIndex+gridCount))])
      if(!frontTexture||!backTexture||!isCurrent())return
      const column=cellIndex%columns,row=Math.floor(cellIndex/columns),group=new THREE.Group()
      group.position.set((column-(columns-1)/2)*(maxWidth+gap)+settings.value.offsetX/100*viewportWidth,((rows-1)/2-row)*(maxHeight+gap)+settings.value.offsetY/100*viewportHeight,0)
      const rotation=flipProgress*Math.PI
      if(settings.value.direction==='up')group.rotation.x=-rotation
      else if(settings.value.direction==='down')group.rotation.x=rotation
      else if(settings.value.direction==='right')group.rotation.y=-rotation
      else group.rotation.y=rotation
      scene.add(group);meshes.push(makeFace(group,frontTexture,false),makeFace(group,backTexture,true))
    }))
    if(!isCurrent()||renderer!==threeRenderer)return
    renderer.render(scene,camera);meshes.forEach(mesh=>{mesh.geometry.dispose();(mesh.material as import('three').Material).dispose()});feedback.value=''
  }
  const drawStories = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const {width,height}=sizeCanvas(target),frame=document.createElement('canvas');frame.width=width;frame.height=height
    const context=frame.getContext('2d');if(!context)return
    const [formatWidth]=dimensions.value,previewScale=width/formatWidth
    paintBackground(context,width,height)
    const count=Math.max(3,Math.min(12,Math.round(settings.value.visibleCount||8))),duration=Math.max(.5,settings.value.secondsPerSlide||13.3)
    const slotDuration=duration/count,delay=Math.min(slotDuration*.95,Math.max(0,settings.value.delaySeconds)),activeDuration=slotDuration-delay
    const shiftedTime=(((time+activeDuration)/duration)%1+1)%1*duration,currentIndex=Math.min(count-1,Math.floor(shiftedTime/slotDuration))
    const slotTime=shiftedTime-currentIndex*slotDuration,rawProgress=activeDuration>0?Math.max(0,Math.min(1,slotTime/activeDuration)):1
    const holding=slotTime>=activeDuration,curve=template.value.bezier||[.76,0,.24,1] as const,eased=holding?1:cubicBezierProgress(rawProgress,curve)
    let breakpoint=.5,lastSlope=0,slopeChanged=false
    for(let step=1;step<200;step++){
      const parameter=step/200,inverse=1-parameter
      const slopeX=3*inverse*inverse*curve[0]+6*inverse*parameter*(curve[2]-curve[0])+3*parameter*parameter*(1-curve[2])
      const slopeY=3*inverse*inverse*curve[1]+6*inverse*parameter*(curve[3]-curve[1])+3*parameter*parameter*(1-curve[3])
      if(slopeX<.000001)continue
      const slope=slopeY/slopeX
      if(lastSlope>0&&Math.abs(slope-lastSlope)>.01)slopeChanged=true
      if(slope>lastSlope+.01){
        lastSlope=slope
        breakpoint=3*inverse*inverse*parameter*curve[0]+3*inverse*parameter*parameter*curve[2]+parameter*parameter*parameter
      }else if(lastSlope===0)lastSlope=slope
    }
    breakpoint=slopeChanged?Math.max(.05,Math.min(.95,breakpoint)):.5
    const previousIndex=(currentIndex-1+count)%count,activeIndex=(holding||rawProgress>=breakpoint?currentIndex:previousIndex)%assets.value.length
    const images=await Promise.all(Array.from({length:count},(_,index)=>loadRenderable(assets.value[index%assets.value.length]!)))
    if(revision!==renderRevision||target!==canvas.value)return
    const activeImage=images[activeIndex]!,sourceWidth=activeImage instanceof HTMLImageElement?activeImage.naturalWidth:activeImage.width,sourceHeight=activeImage instanceof HTMLImageElement?activeImage.naturalHeight:activeImage.height
    const coverScale=Math.max(width/sourceWidth,height/sourceHeight)*Math.max(.5,settings.value.storiesBigScale/100)
    const bigWidth=sourceWidth*coverScale,bigHeight=sourceHeight*coverScale,direction=settings.value.direction
    const vertical=direction==='down'||direction==='up',reverse=direction==='left'||direction==='up',directionSign=reverse?-1:1
    const switchOffset=breakpoint*activeDuration
    const timeSinceSwitch=holding||rawProgress>=breakpoint?slotTime-switchOffset:slotDuration-switchOffset+slotTime
    const backgroundProgress=Math.max(0,Math.min(1,timeSinceSwitch/slotDuration))
    const enterEnd=(1-breakpoint)*activeDuration/slotDuration,holdEnd=enterEnd+delay/slotDuration
    const easedBreakpoint=cubicBezierProgress(breakpoint,curve)
    let driftProgress:number
    if(backgroundProgress<enterEnd){
      const input=breakpoint+(1-breakpoint)*(enterEnd>0?backgroundProgress/enterEnd:0)
      driftProgress=.5*Math.max(0,Math.min(1,(cubicBezierProgress(input,curve)-easedBreakpoint)/Math.max(.001,1-easedBreakpoint)))
    }else if(backgroundProgress<holdEnd)driftProgress=.5
    else{
      const input=breakpoint*((backgroundProgress-holdEnd)/Math.max(.001,1-holdEnd))
      driftProgress=.5+.5*Math.max(0,Math.min(1,cubicBezierProgress(input,curve)/Math.max(.001,easedBreakpoint)))
    }
    const drift=(driftProgress-.5)*settings.value.storiesBigDrift*previewScale*directionSign
    context.drawImage(activeImage,(width-bigWidth)/2+(vertical?0:drift),(height-bigHeight)/2+(vertical?drift:0),bigWidth,bigHeight)
    const thumbSize=Math.max(5,settings.value.storiesThumbSize*previewScale),thumbAspect=settings.value.storiesThumbAspect
    const thumbWidth=thumbAspect==='4:3'?thumbSize*4/3:thumbSize,thumbHeight=thumbAspect==='3:4'?thumbSize*4/3:thumbSize
    const gap=thumbSize*14/85,padding=thumbSize*10/85,selectorInset=thumbSize*10/85
    const itemPrimary=vertical?thumbHeight:thumbWidth,itemCross=vertical?thumbWidth:thumbHeight
    const containerPrimary=padding*2+count*itemPrimary+(count-1)*gap,containerCross=selectorInset*2+itemCross
    const containerWidth=vertical?containerCross:containerPrimary,containerHeight=vertical?containerPrimary:containerCross
    const offsetX=settings.value.offsetX*width/100,offsetY=settings.value.offsetY*height/100
    const cornerRadius=settings.value.cornerRadius*previewScale
    const containerX=width/2+offsetX-containerWidth/2,containerY=height/2+offsetY-containerHeight/2,containerRadius=cornerRadius+2*previewScale
    const blur=Math.max(0,settings.value.storiesContainerBlur*previewScale)
    if(blur>0){const blurred=document.createElement('canvas');blurred.width=width;blurred.height=height;blurred.getContext('2d')?.drawImage(frame,0,0);context.save();context.beginPath();context.roundRect(containerX,containerY,containerWidth,containerHeight,containerRadius);context.clip();context.filter=`blur(${blur}px)`;context.drawImage(blurred,0,0);context.restore()}
    context.save();context.fillStyle=`rgb(53 53 53 / ${Math.max(0,Math.min(1,settings.value.storiesContainerOpacity/100))})`;context.beginPath();context.roundRect(containerX,containerY,containerWidth,containerHeight,containerRadius);context.fill();context.restore()
    const startPrimary=(vertical?containerY:containerX)+padding+itemPrimary/2
    const positionFor=(index:number)=>{const sequenceIndex=reverse?count-1-index:index,primary=startPrimary+sequenceIndex*(itemPrimary+gap);return vertical?{x:width/2+offsetX,y:primary}:{x:primary,y:height/2+offsetY}}
    for(let index=0;index<count;index++){
      const image=images[index]!,imageWidth=image instanceof HTMLImageElement?image.naturalWidth:image.width,imageHeight=image instanceof HTMLImageElement?image.naturalHeight:image.height
      const position=positionFor(index),left=position.x-thumbWidth/2,top=position.y-thumbHeight/2,radius=Math.min(cornerRadius,thumbWidth/2,thumbHeight/2)
      context.save();context.beginPath();context.roundRect(left,top,thumbWidth,thumbHeight,radius);context.clip()
      const imageAspect=imageWidth/imageHeight,targetAspect=thumbWidth/thumbHeight
      let cropX=0,cropY=0,cropWidth=imageWidth,cropHeight=imageHeight
      if(imageAspect>targetAspect){cropWidth=imageHeight*targetAspect;cropX=(imageWidth-cropWidth)/2}else{cropHeight=imageWidth/targetAspect;cropY=(imageHeight-cropHeight)/2}
      context.drawImage(image,cropX,cropY,cropWidth,cropHeight,left,top,thumbWidth,thumbHeight);context.restore()
      const dim=index===currentIndex?settings.value.storiesDimAmount/100*(1-eased):index===previousIndex?settings.value.storiesDimAmount/100*eased:settings.value.storiesDimAmount/100
      if(dim>0){context.save();context.fillStyle=`rgb(0 0 0 / ${dim})`;context.beginPath();context.roundRect(left,top,thumbWidth,thumbHeight,radius);context.fill();context.restore()}
    }
    if(settings.value.storiesSelectorStroke>0){
      const from=positionFor(previousIndex),to=positionFor(currentIndex),selectorX=from.x+(to.x-from.x)*eased,selectorY=from.y+(to.y-from.y)*eased
      const selectorPad=settings.value.storiesSelectorPad*previewScale
      const selectorWidth=thumbWidth+2*selectorPad,selectorHeight=thumbHeight+2*selectorPad
      context.save();context.strokeStyle='#fff';context.lineWidth=settings.value.storiesSelectorStroke*previewScale;context.beginPath();context.roundRect(selectorX-selectorWidth/2,selectorY-selectorHeight/2,selectorWidth,selectorHeight,Math.min(containerRadius,selectorWidth/2,selectorHeight/2));context.stroke();context.restore()
    }
    const visibleContext=target.getContext('2d');if(!visibleContext)return
    visibleContext.clearRect(0,0,width,height);visibleContext.drawImage(frame,0,0);feedback.value=''
  }
  const drawWebgl = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const templateId=template.value.id
    const isCurrent=()=>revision===renderRevision&&target===canvas.value&&template.value.id===templateId&&template.value.renderer==='webgl'
    const THREE=await import('three')
    if(!isCurrent())return
    const {width,height}=sizeCanvas(target,false)
    if(!threeRenderer||threeRenderer.domElement!==target){disposeRenderer();threeRenderer=new THREE.WebGLRenderer({canvas:target,antialias:true,alpha:runtimeOptions.transparentBackground===true,preserveDrawingBuffer:runtimeOptions.preserveDrawingBuffer===true});threeRenderer.setPixelRatio(1)}
    const renderer=threeRenderer
    if(target.width!==width||target.height!==height)renderer.setSize(width,height,false)
    if(runtimeOptions.transparentBackground)threeRenderer.setClearColor(0x000000,0)
    else threeRenderer.setClearColor(settings.value.backgroundColor,1)
    const isCarousel3d=template.value.collection==='carousel-3d'
    const isGrid=template.value.collection==='grid'
    const isOrbit=template.value.collection==='orbit'
    const isGlobe=template.value.collection==='globe'
    const isScale=template.value.collection==='scale'
    const isSwipeDepth=template.value.collection==='swipe-depth'
    const usesPlaneCount=isCarousel3d||isGrid||isOrbit||isGlobe||isScale||isSwipeDepth
    const configuredGridColumns=Math.max(1,Math.round(settings.value.flipGridColumns))
    const configuredGridRows=Math.max(1,Math.round(settings.value.flipGridRows))
    // Render one recycling row beyond each vertical edge. These repeated assets
    // keep the canvas covered while a complete row advances upward.
    const requestedPlaneCount=isGrid?Math.min(60,configuredGridColumns*(configuredGridRows+2)):settings.value.visibleCount
    const planeCount=usesPlaneCount?Math.max(1,Math.round(requestedPlaneCount)):assets.value.length
    const shuffledGlobeIndices=()=>{
      const assetCount=assets.value.length,indices=Array.from({length:planeCount},(_,index)=>index%assetCount)
      let seed=assets.value.reduce((value,asset)=>{for(let index=0;index<asset.id.length;index++)value=Math.imul(value^asset.id.charCodeAt(index),16777619);return value},planeCount|0)>>>0
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
      for(let index=indices.length-1;index>0;index--){const target=Math.floor(random()*(index+1));[indices[index],indices[target]]=[indices[target]!,indices[index]!]}
      if(assetCount>1)for(let index=1;index<indices.length;index++)if(indices[index]===indices[index-1]){
        const swapIndex=indices.findIndex((value,candidate)=>candidate>index&&value!==indices[index-1]&&value!==indices[index+1])
        if(swapIndex>index)[indices[index],indices[swapIndex]]=[indices[swapIndex]!,indices[index]!]
      }
      return indices
    }
    const globeIndices=isGlobe&&settings.value.globeShuffle?shuffledGlobeIndices():undefined
    const sceneAssets=usesPlaneCount
      ? Array.from({length:planeCount},(_,index)=>assets.value[globeIndices?.[index]??((isOrbit&&settings.value.reverse?(planeCount-index)%planeCount:index)%assets.value.length)]!)
      : assets.value
    const orbitSceneUnit=Math.min(width,height)/1080
    const orbitCameraDistance=1200*orbitSceneUnit/Math.max(.001,settings.value.perspective/100)
    const cameraFov=isOrbit
      ? THREE.MathUtils.radToDeg(2*Math.atan(height/2/orbitCameraDistance))
      : isCarousel3d||isGlobe?THREE.MathUtils.radToDeg(2*Math.atan(1.125/Math.max(.01,settings.value.perspective/100))):36
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(cameraFov,width/height,.1,isOrbit?500000:100);camera.position.z=isOrbit?orbitCameraDistance:8
    if(isGrid)gridWrapMeshes.forEach(mesh=>mesh.removeFromParent())
    if(isCarousel3d&&settings.value.flipMaterial==='lit'){
      const intensity=Math.max(0,settings.value.flipLightIntensity)/100
      scene.add(new THREE.HemisphereLight(0xffffff,0x555555,1.05*intensity))
      const keyLight=new THREE.DirectionalLight(0xffffff,1.2*intensity)
      keyLight.position.set(-3,4,5);scene.add(keyLight)
    }
    if(isOrbit&&(settings.value.offsetX||settings.value.offsetY))camera.setViewOffset(width,height,-settings.value.offsetX/100*width,-settings.value.offsetY/100*height,width,height)
    const carouselRotator=new THREE.Group(),carouselRing=new THREE.Group()
    if(isCarousel3d||isOrbit){carouselRotator.rotation.order=isCarousel3d?'ZYX':'XYZ';carouselRotator.rotation.set(THREE.MathUtils.degToRad(settings.value.rotationX)*(isOrbit?-1:1),THREE.MathUtils.degToRad(settings.value.rotationY),THREE.MathUtils.degToRad(settings.value.rotationZ)*(isOrbit?-1:1));carouselRotator.position.set(isOrbit?0:settings.value.offsetX/100,isOrbit?0:settings.value.offsetY/100,0);carouselRotator.add(carouselRing);scene.add(carouselRotator)}
    const globeRotator=new THREE.Group(),globeGroup=new THREE.Group()
    if(isGlobe){globeRotator.rotation.order='XYZ';globeRotator.rotation.set(THREE.MathUtils.degToRad(settings.value.rotationX),THREE.MathUtils.degToRad(settings.value.rotationY),THREE.MathUtils.degToRad(settings.value.rotationZ));globeRotator.position.set(settings.value.offsetX/100,settings.value.offsetY/100,0);globeRotator.add(globeGroup);scene.add(globeRotator)}
    const delayedTime=Math.max(0,time-(isGlobe?settings.value.delaySeconds:settings.value.delayFrames/30))
    const rawCycle=delayedTime/settings.value.secondsPerSlide*(isCarousel3d||isOrbit||isGlobe?1:isSwipeDepth?planeCount*settings.value.cycles:settings.value.cycles),direction=settings.value.direction
    const wholeCycle=Math.floor(rawCycle),rawPhase=rawCycle-wholeCycle
    const easedPhase=cubicBezierProgress(rawPhase,template.value.bezier||easingCurves[settings.value.easing])
    const cycle=wholeCycle+easedPhase
    const orbitStepCount=Math.max(1,settings.value.cycles*Math.max(1,planeCount))
    const orbitStepDuration=Math.max(.5,settings.value.secondsPerSlide)/orbitStepCount,orbitDelay=Math.max(0,settings.value.delaySeconds),orbitStepSpan=orbitStepDuration+orbitDelay
    const orbitStep=Math.floor(time/orbitStepSpan),orbitStepTime=time-orbitStep*orbitStepSpan
    const orbitPhase=cubicBezierProgress(Math.min(1,Math.max(0,orbitStepTime/orbitStepDuration)),template.value.bezier||easingCurves[settings.value.easing])
    const orbitCycle=(orbitStep+orbitPhase)/Math.max(1,planeCount)
    const vertical=direction==='up'||direction==='down'
    const viewportHeight=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))
    const viewportWidth=viewportHeight*camera.aspect
    const gridColumns=configuredGridColumns,gridRows=Math.max(1,Math.ceil(planeCount/gridColumns))
    const gridVisibleColumns=camera.aspect<.8?3:5
    const requestedGridCellWidth=viewportWidth/gridVisibleColumns*settings.value.planeSize/100
    const gridCellWidth=Math.max(requestedGridCellWidth,viewportWidth/gridColumns,viewportHeight*3/(4*gridRows))
    const gridCellHeight=gridCellWidth*4/3
    const planeScale=settings.value.planeSize/(isScale?100:600)
    const maxPlaneWidth=Math.min(3.4,viewportWidth*.78)*planeScale,maxPlaneHeight=Math.min(2.35,viewportHeight*.68)*planeScale
    const largestAssetSide=Math.max(1,...sceneAssets.map(asset=>Math.max(asset.width,asset.height)))
    const planeSizes=sceneAssets.map(asset=>{
      const aspect=Math.max(.01,asset.width/Math.max(1,asset.height))
      if(isOrbit){
        return {width:settings.value.planeSize*orbitSceneUnit,height:settings.value.planeSize/aspect*orbitSceneUnit}
      }
      if(isCarousel3d||isGlobe){
        return {width:maxPlaneWidth,height:maxPlaneWidth/aspect}
      }
      if(isGrid){
        return {width:gridCellWidth,height:gridCellHeight}
      }
      if(isScale){
        const scale=Math.min(3.4,viewportWidth*.78)*planeScale/largestAssetSide
        return {width:Math.max(.01,asset.width*scale),height:Math.max(.01,asset.height*scale)}
      }
      if(aspect>maxPlaneWidth/maxPlaneHeight)return {width:maxPlaneWidth,height:maxPlaneWidth/aspect}
      return {width:maxPlaneHeight*aspect,height:maxPlaneHeight}
    })
    const carouselPlaneUnit=isOrbit
      ? orbitSceneUnit
      : isCarousel3d||isGlobe ? Math.max(.0001,maxPlaneWidth)/Math.max(1,settings.value.planeSize)
      : 0
    const carouselRadius=settings.value.orbitRadius*carouselPlaneUnit
    if(isCarousel3d){camera.position.z=-settings.value.distance*carouselPlaneUnit;camera.lookAt(0,0,0)}
    if(isGlobe){camera.position.z=settings.value.distance*carouselPlaneUnit;camera.lookAt(0,0,0)}
    const sceneUnit=Math.min(Math.min(3.4,viewportWidth*.78),Math.min(2.35,viewportHeight*.68))/600
    const gap=Math.max(0,settings.value.gap)*sceneUnit,distance=settings.value.distance/100
    const extents=planeSizes.map(size=>vertical?size.height:size.width)
    const centers:number[]=[]
    extents.forEach((extent,index)=>{centers[index]=index===0?0:centers[index-1]!+(extents[index-1]!/2+gap+extent/2)*distance})
    const lastIndex=sceneAssets.length-1
    const circumference=(centers[lastIndex]||0)+((extents[lastIndex]||0)/2+(extents[0]||0)/2+gap)*distance
    const carousel3dAngles:number[]=[]
    if(isCarousel3d&&sceneAssets.length){
      // Distribute the planes by their side edges instead of their centers. This
      // preserves each asset's real dimensions without making wide cards collide
      // or leaving oversized gaps around narrow cards.
      const angularWidths=planeSizes.map(size=>2*Math.atan(size.width/Math.max(.0001,carouselRadius*2)))
      const angularSteps=angularWidths.map((width,index)=>(width+angularWidths[(index+1)%angularWidths.length]!)/2)
      const totalAngularStep=angularSteps.reduce((sum,value)=>sum+value,0)||1
      let accumulatedAngle=0
      angularSteps.forEach((step,index)=>{
        carousel3dAngles[index]=accumulatedAngle/totalAngularStep*Math.PI*2
        accumulatedAngle+=step
      })
    }
    const baseIndex=Math.floor(cycle)%sceneAssets.length,phase=cycle-Math.floor(cycle)
    const nextIndex=(baseIndex+1)%sceneAssets.length
    const baseCenter=centers[baseIndex]||0
    const nextCenter=nextIndex===0?circumference:(centers[nextIndex]||0)
    const focusCenter=sceneAssets.length===1?0:THREE.MathUtils.lerp(baseCenter,nextCenter,phase)
    const averagePitch=circumference/Math.max(1,sceneAssets.length)
    const carouselTravel=(isOrbit?Math.PI*2*orbitCycle:THREE.MathUtils.degToRad(settings.value.cycleDegrees)*cycle)*(settings.value.reverse?-1:1)
    if(isCarousel3d)carouselRing.rotation.y=carouselTravel
    if(isOrbit)carouselRing.rotation.x=-carouselTravel
    if(isGlobe&&settings.value.globeMotion!=='stepped')globeGroup.rotation[settings.value.globeAxis]=carouselTravel
    const gridGap=gridCellWidth*Math.max(0,settings.value.flipGridGap)/100
    const gridPitchX=gridCellWidth+gridGap,gridPitchY=gridCellHeight+gridGap
    const gridPoint=(index:number)=>({x:(index%gridColumns-(gridColumns-1)/2)*gridPitchX,y:((gridRows-1)/2-Math.floor(index/gridColumns))*gridPitchY})
    const gridStepSpan=Math.max(.01,settings.value.secondsPerSlide+settings.value.delaySeconds)
    const gridStep=Math.floor(time/gridStepSpan),gridStepTime=time-gridStep*gridStepSpan
    const gridFocusColumn=Math.floor((gridColumns-1)/2)
    const gridSequenceStep=gridStep
    // Hold belongs after a completed focus, not before the next move. Starting
    // the step at zero removes the dead beat before the first cards respond.
    const gridRawTravelProgress=THREE.MathUtils.clamp(gridStepTime/Math.max(.01,settings.value.secondsPerSlide),0,1)
    // Grid exposes easing as an editable setting, so it must take precedence
    // over the preset's initial curve after the user selects another option.
    const gridEasing=easingCurves[settings.value.easing]||template.value.bezier
    // The reference has three connected beats: zoom out, move, then zoom in.
    // Cards settle on the focus point before zooming so the selected card stays
    // locked to the canvas center for the entire close-up.
    const gridMotionEnd=.7
    const gridMotionProgress=cubicBezierProgress(THREE.MathUtils.clamp(gridRawTravelProgress/gridMotionEnd,0,1),gridEasing)
    const gridTravelProgress=gridMotionProgress
    const gridStaggerWindow=Math.min(.45,settings.value.driftAmount/100*1.125)
    // Express distance in complete row pitches: card height plus row gap.
    const gridMoveRowsMagnitude=Math.max(0,(settings.value.gridMoveDistance??300)/100)
    // Direction names describe the visible grid motion. Keep every preset on a
    // diagonal while allowing distinct routes without giving cards their own X.
    const gridMovesUp=settings.value.driftDirection==='up'||settings.value.driftDirection==='left'
    const gridMovesLeft=settings.value.driftDirection==='left'||settings.value.driftDirection==='down'
    const gridMoveRows=gridMoveRowsMagnitude*(gridMovesUp?1:-1)
    const gridColumnStep=gridMovesLeft?2:-2
    const gridCompletedRowShift=gridSequenceStep*gridMoveRows
    const gridStepMoveRows=gridMoveRows
    const gridRawCardProgress=sceneAssets.map((_,itemIndex)=>{
      // Every plane participates in a diagonal 2D wave. Cosine keeps the phase
      // continuous across both wrapped grid edges while row and column jointly
      // determine when each card begins moving.
      const column=itemIndex%gridColumns,row=Math.floor(itemIndex/gridColumns)
      const wavePhase=row/Math.max(1,gridRows)+column/Math.max(1,gridColumns)
      const linearDelay=.5-.5*Math.cos(wavePhase*Math.PI*2)
      const staggerCurve=easingCurves[settings.value.gridStaggerCurve]||easingCurves.linear
      const delayDistribution=cubicBezierProgress(linearDelay,staggerCurve)
      const cardDelay=delayDistribution*gridStaggerWindow
      return cubicBezierProgress(THREE.MathUtils.clamp((gridRawTravelProgress-cardDelay)/Math.max(.01,gridMotionEnd-cardDelay),0,1),gridEasing)
    })
    // Solve the wrapped vertical spacing exactly. A lower card may trail freely,
    // but it cannot advance far enough to consume the gap above it. Repeating
    // the relaxation for every row also enforces the last-to-first tile seam.
    const gridCardProgressValues=[...gridRawCardProgress]
    const gridProgressAllowance=Math.abs(gridStepMoveRows)>0?gridGap*.9/(Math.abs(gridStepMoveRows)*gridPitchY):1
    if(gridProgressAllowance<=.0001)gridCardProgressValues.fill(gridTravelProgress)
    else{
      const constraintSoftness=Math.min(.06,gridProgressAllowance*.75)
      const smoothMinimum=(left:number,right:number)=>{
        const blend=Math.max(constraintSoftness-Math.abs(left-right),0)/constraintSoftness
        return Math.min(left,right)-blend*blend*constraintSoftness*.25
      }
      for(let pass=0;pass<gridRows;pass++)for(let column=0;column<gridColumns;column++)for(let row=0;row<gridRows;row++){
        const itemIndex=row*gridColumns+column
        const upperIndex=((row-1+gridRows)%gridRows)*gridColumns+column
        if(itemIndex>=gridCardProgressValues.length||upperIndex>=gridCardProgressValues.length)continue
        const movingIndex=gridStepMoveRows>=0?itemIndex:upperIndex
        const leadingIndex=gridStepMoveRows>=0?upperIndex:itemIndex
        gridCardProgressValues[movingIndex]=smoothMinimum(gridCardProgressValues[movingIndex]!,gridCardProgressValues[leadingIndex]!+gridProgressAllowance)
      }
    }
    const gridCardProgress=(itemIndex:number)=>gridCardProgressValues[itemIndex]??gridTravelProgress
    const gridPointAtShift=(itemIndex:number,rowShift:number)=>{
      const column=itemIndex%gridColumns,row=Math.floor(itemIndex/gridColumns)
      return {x:(column-(gridColumns-1)/2)*gridPitchX,y:((gridRows-1)/2-row+rowShift)*gridPitchY}
    }
    const gridAnimatedPoint=(itemIndex:number)=>{
      const point=gridPointAtShift(itemIndex,gridCompletedRowShift)
      const cardProgress=gridCardProgress(itemIndex)
      return {
        x:point.x,
        y:point.y+cardProgress*gridStepMoveRows*gridPitchY
      }
    }
    // The camera remains fixed. Horizontal travel belongs to the grid as one
    // rigid lattice, while the staggered cards provide only the vertical leg.
    // Anchor travel on a real cell center. With an even row/column count, zero
    // lies in a gutter, so the half-pitch correction is required.
    const gridFocusRow=Math.floor((gridRows-1)/2)
    const gridOriginFocusX=(gridFocusColumn-(gridColumns-1)/2)*gridPitchX
    const gridCurrentTargetRow=Math.round(gridFocusRow+gridSequenceStep*gridMoveRows)
    const gridNextTargetRow=Math.round(gridFocusRow+(gridSequenceStep+1)*gridMoveRows)
    // Resolve focus Y from the actual row selected at each stop. The residual
    // compensates fractional move distances instead of leaving the closest card
    // above or below center.
    const gridCurrentFocusY=((gridRows-1)/2-gridCurrentTargetRow+gridSequenceStep*gridMoveRows)*gridPitchY
    const gridNextFocusY=((gridRows-1)/2-gridNextTargetRow+(gridSequenceStep+1)*gridMoveRows)*gridPitchY
    const gridCurrentPoint={x:gridOriginFocusX+gridSequenceStep*gridPitchX*gridColumnStep,y:gridCurrentFocusY}
    const gridNextPoint={x:gridOriginFocusX+(gridSequenceStep+1)*gridPitchX*gridColumnStep,y:gridNextFocusY}
    // Follow the card that will occupy the center at the end of this step.
    // Using its delayed Y progress for the shared X translation makes that
    // card travel along one diagonal instead of moving right and then down.
    const gridDestinationColumn=((gridFocusColumn+(gridSequenceStep+1)*gridColumnStep)%gridColumns+gridColumns)%gridColumns
    const gridDestinationRow=((gridNextTargetRow%gridRows)+gridRows)%gridRows
    const gridDestinationProgress=gridCardProgress(gridDestinationRow*gridColumns+gridDestinationColumn)
    const gridZoomOutProgress=cubicBezierProgress(THREE.MathUtils.clamp(gridRawTravelProgress/.2,0,1),gridEasing)
    const gridZoomInStart=gridMotionEnd
    // A pronounced ease-out responds immediately at the handoff from travel;
    // unlike the scene curve, it does not create a perceived pause before zoom.
    const gridZoomInProgress=cubicBezierProgress(THREE.MathUtils.clamp((gridRawTravelProgress-gridZoomInStart)/(1-gridZoomInStart),0,1),[.16,1,.3,1])
    const gridWideZoom=THREE.MathUtils.lerp(settings.value.centerScale,1,gridZoomOutProgress)
    const gridZoom=THREE.MathUtils.lerp(gridWideZoom,settings.value.centerScale,gridZoomInProgress)
    const desiredGridFocusX=THREE.MathUtils.lerp(gridCurrentPoint.x,gridNextPoint.x,gridDestinationProgress)
    const desiredGridFocusY=THREE.MathUtils.lerp(gridCurrentPoint.y,gridNextPoint.y,gridDestinationProgress)
    // Focus cells are selected from the buffered interior, so they can be
    // centered directly without exposing an empty grid edge.
    const gridFocusX=desiredGridFocusX,gridFocusY=desiredGridFocusY
    let rendered=0
    const carouselMeshes: import('three').Mesh[]=[]
    const globeMeshes: Array<import('three').Mesh|undefined>=[]
    const globeDirections: Array<import('three').Vector3|undefined>=[]
    // Flat carousels only need nearby cards. Cull before loading images, decoding
    // videos, or touching textures; large boards otherwise process every asset.
    const renderEntries=sceneAssets.map((asset,index)=>({asset,index})).filter(({index})=>{
      if(isCarousel3d||isGrid||isOrbit||isGlobe||isScale||isSwipeDepth)return true
      let offset=(centers[index]||0)-focusCenter
      if(sceneAssets.length>1){
        if(offset>circumference/2)offset-=circumference
        if(offset < -circumference/2)offset+=circumference
      }
      const centered=offset/Math.max(.01,averagePitch)+(index-baseIndex)*settings.value.staggerFrames/Math.max(1,30*settings.value.secondsPerSlide)
      const visibleRadius=settings.value.solo?.5:Math.max(.5,(settings.value.visibleCount-1)/2)
      return Math.abs(centered)<=visibleRadius
    })
    await Promise.all(renderEntries.map(async({asset,index})=>{
      const isVideo=asset.mime_type?.startsWith('video/')===true
      const textureKey=isVideo?`${asset.id}:video:${isGrid?`grid:${settings.value.fit}`:'plane'}`:`${asset.id}:${settings.value.cornerRadius}:${settings.value.planeSize}:${isGrid?`grid:${settings.value.fit}`:'plane'}`
      let texture=textures.get(textureKey) as import('three').Texture|undefined
      if(!texture){
        if(isVideo){
          const video=await loadVideo(asset)
          if(!isCurrent())return
          const videoCanvas=document.createElement('canvas'),maxSide=1024
          const sourceWidth=video.videoWidth||asset.width,sourceHeight=video.videoHeight||asset.height
          const textureScale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight))
          videoCanvas.width=isGrid?768:Math.max(1,Math.round(sourceWidth*textureScale));videoCanvas.height=isGrid?1024:Math.max(1,Math.round(sourceHeight*textureScale))
          texture=new THREE.CanvasTexture(videoCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;textures.set(textureKey,texture)
        }else{
          const source:HTMLImageElement|HTMLCanvasElement=isGrid?await loadRenderable(asset):(cachedImageFor(asset)||missingAssetSource(asset))
          if(!isGrid&&source instanceof HTMLCanvasElement){
            void loadImage(asset).then(scheduleWebglTextureRefresh).catch(()=>{})
          }
          if(!isCurrent())return
          const sourceWidth=source instanceof HTMLImageElement?source.naturalWidth:source.width
          const sourceHeight=source instanceof HTMLImageElement?source.naturalHeight:source.height
          const rounded=document.createElement('canvas'),maxSide=1024,textureScale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight))
          rounded.width=isGrid?768:Math.max(1,Math.round(sourceWidth*textureScale));rounded.height=isGrid?1024:Math.max(1,Math.round(sourceHeight*textureScale))
          const roundedContext=rounded.getContext('2d')
          if(roundedContext){
            const radius=Math.min(rounded.width,rounded.height)/2,scaledRadius=Math.min(radius,rounded.width*settings.value.cornerRadius/Math.max(1,settings.value.planeSize))
            roundedContext.beginPath();roundedContext.roundRect(0,0,rounded.width,rounded.height,scaledRadius);roundedContext.clip()
            if(isGrid&&settings.value.fit==='cover'){
              const targetAspect=rounded.width/rounded.height,sourceAspect=sourceWidth/sourceHeight
              const cropWidth=sourceAspect>targetAspect?sourceHeight*targetAspect:sourceWidth,cropHeight=sourceAspect>targetAspect?sourceHeight:sourceWidth/targetAspect
              roundedContext.drawImage(source,(sourceWidth-cropWidth)/2,(sourceHeight-cropHeight)/2,cropWidth,cropHeight,0,0,rounded.width,rounded.height)
            }else if(isGrid){
              const scale=Math.min(rounded.width/sourceWidth,rounded.height/sourceHeight),drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale
              roundedContext.drawImage(source,(rounded.width-drawWidth)/2,(rounded.height-drawHeight)/2,drawWidth,drawHeight)
            }else roundedContext.drawImage(source,0,0,rounded.width,rounded.height)
          }
          texture=new THREE.CanvasTexture(rounded);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;textures.set(textureKey,texture)
        }
      }
      if(!isCurrent())return
      if(isVideo){
        const video=videos.get(asset.id)
        const videoCanvas=texture.image as HTMLCanvasElement
        if(video?.duration&&Number.isFinite(video.duration)){
          const videoTime=time%video.duration
          // Let a playing video advance naturally. Repeated currentTime writes
          // force expensive decoder seeks; explicit draws still synchronize it.
          if(!playing.value&&Math.abs(video.currentTime-videoTime)>.12)video.currentTime=videoTime
          if(playing.value&&video.paused)void video.play().catch(()=>{})
          const videoContext=videoCanvas.getContext('2d')
          if(videoContext){
            videoContext.clearRect(0,0,videoCanvas.width,videoCanvas.height);videoContext.save()
            const radius=Math.min(videoCanvas.width,videoCanvas.height)/2
            const scaledRadius=Math.min(radius,videoCanvas.width*settings.value.cornerRadius/Math.max(1,settings.value.planeSize))
            videoContext.beginPath();videoContext.roundRect(0,0,videoCanvas.width,videoCanvas.height,scaledRadius);videoContext.clip()
            if(isGrid&&settings.value.fit==='cover'){
              const targetAspect=videoCanvas.width/videoCanvas.height,sourceAspect=(video.videoWidth||videoCanvas.width)/(video.videoHeight||videoCanvas.height)
              const sourceWidth=video.videoWidth||videoCanvas.width,sourceHeight=video.videoHeight||videoCanvas.height
              const cropWidth=sourceAspect>targetAspect?sourceHeight*targetAspect:sourceWidth,cropHeight=sourceAspect>targetAspect?sourceHeight:sourceWidth/targetAspect
              videoContext.drawImage(video,(sourceWidth-cropWidth)/2,(sourceHeight-cropHeight)/2,cropWidth,cropHeight,0,0,videoCanvas.width,videoCanvas.height)
            }else if(isGrid){
              const sourceWidth=video.videoWidth||videoCanvas.width,sourceHeight=video.videoHeight||videoCanvas.height,scale=Math.min(videoCanvas.width/sourceWidth,videoCanvas.height/sourceHeight)
              const drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale
              videoContext.drawImage(video,(videoCanvas.width-drawWidth)/2,(videoCanvas.height-drawHeight)/2,drawWidth,drawHeight)
            }else videoContext.drawImage(video,0,0,videoCanvas.width,videoCanvas.height)
            videoContext.restore();texture.needsUpdate=true
          }
        }
      }
      let offset=(centers[index]||0)-focusCenter
      if(sceneAssets.length>1){
        if(offset>circumference/2)offset-=circumference
        if(offset < -circumference/2)offset+=circumference
      }
      let centered=offset/Math.max(.01,averagePitch)
      centered+=(index-baseIndex)*settings.value.staggerFrames/Math.max(1,30*settings.value.secondsPerSlide)
      const visibleRadius=settings.value.solo?.5:Math.max(.5,(settings.value.visibleCount-1)/2)
      if(!isCarousel3d&&!isGrid&&!isOrbit&&!isGlobe&&!isScale&&!isSwipeDepth&&Math.abs(centered)>visibleRadius)return
      const {width:planeWidth,height:planeHeight}=planeSizes[index]!
      const side=THREE.DoubleSide
      const materialMode=isCarousel3d?settings.value.flipMaterial:'flat'
      const meshKey=`${template.value.collection}:${index}:${textureKey}:${planeWidth.toFixed(5)}:${planeHeight.toFixed(5)}:${side}:${materialMode}`
      let mesh=webglMeshes.get(meshKey)
      if(!mesh){
        const meshMaterial=materialMode==='lit'
          ? new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,side,roughness:Math.max(0,Math.min(1,settings.value.flipRoughness/100)),metalness:0})
          : new THREE.MeshBasicMaterial({map:texture,transparent:!isGlobe,depthWrite:!isCarousel3d&&!isGrid,depthTest:!isGrid,alphaTest:isGlobe?.5:isGrid?.001:0,side})
        mesh=new THREE.Mesh(new THREE.PlaneGeometry(planeWidth,planeHeight),meshMaterial)
        webglMeshes.set(meshKey,mesh)
      }else mesh.removeFromParent()
      if(isGrid){mesh.renderOrder=index;mesh.frustumCulled=false;mesh.visible=true}
      const material=mesh.material as import('three').MeshBasicMaterial|import('three').MeshStandardMaterial
      if(isGrid&&material instanceof THREE.MeshBasicMaterial&&material.alphaTest!==.001){material.alphaTest=.001;material.needsUpdate=true}
      if(material instanceof THREE.MeshStandardMaterial)material.roughness=Math.max(0,Math.min(1,settings.value.flipRoughness/100))
      mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);material.opacity=1
      if(isScale){
        const start=index*settings.value.staggerSeconds
        const local=Math.max(0,Math.min(1,(delayedTime-start)/Math.max(.01,settings.value.secondsPerSlide)))
        const eased=cubicBezierProgress(local,template.value.bezier||easingCurves[settings.value.easing])
        const scale=settings.value.scaleStyle==='recede'?1-eased:eased
        const spreadAngle=index*Math.PI*2/Math.max(1,sceneAssets.length)
        mesh.position.set(Math.cos(spreadAngle)*settings.value.spread/100,Math.sin(spreadAngle)*settings.value.spread/100,0)
        mesh.position.z=index*.002
        if(settings.value.growFrom==='bottom')mesh.position.y-=(1-scale)*planeHeight/2
        mesh.rotation.z=THREE.MathUtils.degToRad(settings.value.spin)*(1-eased)
        mesh.scale.setScalar(Math.max(.001,scale))
        material.opacity=settings.value.fade?Math.max(0,Math.min(1,scale/(settings.value.fade/100))):1
      }else if(isGlobe){
        const count=Math.max(1,sceneAssets.length),fraction=(index+.5)/count
        const polar=Math.acos(1-2*fraction),azimuth=Math.PI*(3-Math.sqrt(5))*index
        const normal=new THREE.Vector3(Math.sin(polar)*Math.cos(azimuth),Math.cos(polar),Math.sin(polar)*Math.sin(azimuth))
        mesh.position.copy(normal).multiplyScalar(carouselRadius)
        if(!settings.value.globeFaceCamera)mesh.lookAt(mesh.position.clone().multiplyScalar(2))
        if(settings.value.globeFlipImage)mesh.scale.x=-1
        globeGroup.add(mesh);globeMeshes[index]=mesh;globeDirections[index]=normal
      }else if(isGrid){
        // Advance the grid by one complete row on every focus transition. The
        // base row advances with the step, so completed moves remain continuous;
        // the row leaving above the oversized field is recycled below it.
        const point=gridAnimatedPoint(index)
        const wrapWidth=gridColumns*gridPitchX*gridZoom,wrapHeight=gridRows*gridPitchY*gridZoom
        const wrapCoordinate=(value:number,span:number)=>((value+span/2)%span+span)%span-span/2
        const relativeX=wrapCoordinate((point.x-gridFocusX)*gridZoom,wrapWidth)
        const relativeY=wrapCoordinate((point.y-gridFocusY)*gridZoom,wrapHeight)
        mesh.position.set(relativeX+settings.value.offsetX/100,relativeY+settings.value.offsetY/100,0)
        mesh.scale.setScalar(gridZoom)
        const halfPlaneWidth=planeWidth*gridZoom/2,halfPlaneHeight=planeHeight*gridZoom/2
        const halfViewportWidth=viewportWidth/2,halfViewportHeight=viewportHeight/2
        const intersectsViewport=(x:number,y:number)=>x+halfPlaneWidth>=-halfViewportWidth&&x-halfPlaneWidth<=halfViewportWidth&&y+halfPlaneHeight>=-halfViewportHeight&&y-halfPlaneHeight<=halfViewportHeight
        mesh.visible=intersectsViewport(mesh.position.x,mesh.position.y)
        // Reuse wrapped copies and attach only those intersecting the viewport.
        // Most cards now produce no copies instead of eight allocations/draws
        // per frame, while edge cards still cover every lattice seam.
        for(let wrapX=-1;wrapX<=1;wrapX++)for(let wrapY=-1;wrapY<=1;wrapY++){
          if(wrapX===0&&wrapY===0)continue
          const wrappedX=mesh.position.x+wrapX*wrapWidth,wrappedY=mesh.position.y+wrapY*wrapHeight
          if(!intersectsViewport(wrappedX,wrappedY))continue
          const wrapKey=`${meshKey}:wrap:${wrapX}:${wrapY}`
          let wrappedMesh=gridWrapMeshes.get(wrapKey)
          if(!wrappedMesh){wrappedMesh=mesh.clone();gridWrapMeshes.set(wrapKey,wrappedMesh)}
          wrappedMesh.position.set(wrappedX,wrappedY,mesh.position.z)
          wrappedMesh.quaternion.copy(mesh.quaternion);wrappedMesh.scale.copy(mesh.scale);wrappedMesh.visible=true
          wrappedMesh.renderOrder=mesh.renderOrder;wrappedMesh.frustumCulled=false
          scene.add(wrappedMesh)
        }
      }else if(isSwipeDepth){
        const count=Math.max(1,sceneAssets.length)
        const slot=(index-baseIndex+count)%count
        const depthSlot=slot===0?0:slot-easedPhase
        const depthRatio=depthSlot/Math.max(1,count-1)
        const depthGap=Math.max(0,settings.value.gap/600)
        const depthStep=Math.max(.08,settings.value.distance/100)
        const exitX=viewportWidth/2+planeWidth
        const exitY=viewportHeight/2+planeHeight
        const firstSwipeSign=vertical
          ? direction==='up'?1:-1
          : direction==='left'?-1:1
        const swipeSign=firstSwipeSign*(settings.value.swipeAlternating!==false&&baseIndex%2!==0?-1:1)
        if(slot===0){
          if(vertical)mesh.position.y=swipeSign*easedPhase*exitY
          else mesh.position.x=swipeSign*easedPhase*exitX
          mesh.rotation.z=swipeSign*easedPhase*THREE.MathUtils.degToRad(settings.value.tilt)
        }else{
          mesh.position.x=depthSlot*depthGap
          mesh.position.y=-depthSlot*depthGap*.28
          mesh.position.z=-depthSlot*depthStep
        }
        mesh.position.x+=settings.value.offsetX/100
        mesh.position.y+=settings.value.offsetY/100
        const depthScale=THREE.MathUtils.lerp(1,.68,depthRatio)
        mesh.scale.setScalar(depthScale)
        const recycleFade=slot===0
          ? 1-THREE.MathUtils.smoothstep(easedPhase,.82,1)
          : 1-THREE.MathUtils.smoothstep(depthRatio,.82,1)
        material.opacity=Math.max(0,1-depthRatio*(settings.value.fade/100))*recycleFade
      }else if(isCarousel3d){
        const slotAngle=carousel3dAngles[index]||0
        const slotDegrees=THREE.MathUtils.radToDeg(slotAngle)
        const facingRotation=((180-slotDegrees)%180+180)%180
        const facingRadians=THREE.MathUtils.degToRad(facingRotation)
        mesh.rotation.y=facingRadians
        // Anchor whichever vertical side faces inward to the orbit. The folded
        // card rotation swaps local left/right around the ring, so using a fixed
        // local side makes half the cards extend inward. A radial offset keeps
        // every card extending outward while its inner side traces the orbit.
        const radialX=Math.cos(slotAngle)
        const radialZ=Math.sin(slotAngle)
        const planeRotationRadians=THREE.MathUtils.degToRad(settings.value.planeRotation)
        const radialHalfExtent=(Math.abs(Math.cos(planeRotationRadians))*planeWidth+Math.abs(Math.sin(planeRotationRadians))*planeHeight)/2
        const anchoredRadius=carouselRadius+radialHalfExtent
        mesh.position.set(radialX*anchoredRadius,0,radialZ*anchoredRadius)
      }else if(isOrbit){
        const angle=index/Math.max(1,sceneAssets.length)*Math.PI*2
        mesh.position.set(0,-Math.sin(angle)*carouselRadius,Math.cos(angle)*carouselRadius)
        mesh.rotation.x=angle
      }else{
        const sign=direction==='left'||direction==='up'?-1:1
        if(vertical)mesh.position.y=offset*sign
        else mesh.position.x=offset*sign
        const rotation=settings.value.tiltMode==='off'?0
          :settings.value.tiltMode==='alternate'?(index%2?1:-1)
            :settings.value.tiltMode==='uniform'?1:THREE.MathUtils.clamp(centered,-1,1)
        mesh.rotation.z=rotation*(settings.value.tilt/100)
        mesh.position.z=-Math.abs(centered)*.48
      }
      if(!isCarousel3d&&!isOrbit&&!isGlobe&&!isSwipeDepth){mesh.position.x+=settings.value.offsetX/100;mesh.position.y+=settings.value.offsetY/100}
      if(!isCarousel3d&&!isOrbit&&!isSwipeDepth&&settings.value.scaleCenter){
        const focus=Math.max(0,1-Math.abs(centered)),scale=1+(settings.value.centerScale-1)*focus
        mesh.scale.setScalar(scale)
        if(settings.value.scaleFocus!=='center'){
          const anchorDirection=settings.value.scaleFocus==='start'?-1:1
          if(vertical)mesh.position.y+=anchorDirection*(scale-1)*planeHeight/2
          else mesh.position.x+=anchorDirection*(scale-1)*planeWidth/2
        }
      }
      if(!isScale&&!isGrid&&!isGlobe&&!isSwipeDepth){
        const isRadialRing=isCarousel3d||isOrbit
        const depthPosition=isRadialRing?mesh.position.clone().applyEuler(carouselRing.rotation).applyEuler(carouselRotator.rotation).add(carouselRotator.position):mesh.position
        const depth=isRadialRing?Math.max(0,Math.min(1,(depthPosition.z+carouselRadius)/Math.max(.01,carouselRadius*2))):Math.abs(centered)
        material.opacity=isOrbit?1:Math.max(0,1-depth*(settings.value.fade/100))
      }
      if(isCarousel3d||isOrbit){carouselRing.add(mesh);carouselMeshes.push(mesh)}else if(!isGlobe){scene.add(mesh);rendered++}
    }))
    if(!isCurrent())return
    if(!rendered&&!carouselMeshes.length&&!globeMeshes.some(Boolean))throw new Error('No previews could be loaded')
    if(isCarousel3d&&settings.value.planeRotation){
      scene.updateMatrixWorld(true)
      const cameraPosition=new THREE.Vector3(),meshPosition=new THREE.Vector3(),worldQuaternion=new THREE.Quaternion(),worldNormal=new THREE.Vector3(),viewDirection=new THREE.Vector3()
      camera.getWorldPosition(cameraPosition)
      carouselMeshes.forEach(mesh=>{
        mesh.getWorldPosition(meshPosition)
        mesh.getWorldQuaternion(worldQuaternion)
        worldNormal.set(0,0,1).applyQuaternion(worldQuaternion)
        viewDirection.copy(cameraPosition).sub(meshPosition)
        const visibleFaceDirection=worldNormal.dot(viewDirection)<0?-1:1
        mesh.rotateZ(THREE.MathUtils.degToRad(settings.value.planeRotation*visibleFaceDirection))
      })
    }
    if(isOrbit){
      scene.updateMatrixWorld(true)
      const parentWorldQuaternion=new THREE.Quaternion(),cameraFacingQuaternion=new THREE.Quaternion()
      carouselRing.getWorldQuaternion(parentWorldQuaternion)
      cameraFacingQuaternion.copy(parentWorldQuaternion).invert().multiply(camera.quaternion)
      carouselMeshes.forEach(mesh=>mesh.quaternion.copy(cameraFacingQuaternion))
    }
    if(isOrbit&&settings.value.fade>0){
      scene.updateMatrixWorld(true)
      const fadeAmount=Math.max(0,Math.min(1,settings.value.fade/100)),fadeRangeMultiplier=1+fadeAmount*fadeAmount*20
      const worldPosition=new THREE.Vector3(),depths=carouselMeshes.map(mesh=>{mesh.getWorldPosition(worldPosition);return Math.abs(camera.position.z-worldPosition.z)})
      const minDepth=Math.min(...depths),maxDepth=Math.max(...depths),depthRange=Math.max(1,maxDepth-minDepth)
      carouselMeshes.forEach((mesh,index)=>{const material=mesh.material as import('three').MeshBasicMaterial;const normalizedDepth=(depths[index]!-minDepth)/depthRange;material.opacity=Math.max(0,Math.min(1,1-Math.min(normalizedDepth*fadeRangeMultiplier,1)*fadeAmount))})
    }
    if(isCarousel3d){
      scene.updateMatrixWorld(true)
      const worldPosition=new THREE.Vector3(),worldQuaternion=new THREE.Quaternion()
      const worldNormal=new THREE.Vector3(),toCamera=new THREE.Vector3()
      carouselMeshes.forEach(mesh=>{
        mesh.getWorldPosition(worldPosition)
        mesh.getWorldQuaternion(worldQuaternion)
        worldNormal.set(0,0,1).applyQuaternion(worldQuaternion)
        toCamera.copy(camera.position).sub(worldPosition)
        if(worldNormal.dot(toCamera)<0)mesh.rotateY(Math.PI)
      })
    }
    if(isGlobe){
      if(settings.value.globeMotion==='stepped'){
        const cardCount=Math.max(1,globeDirections.length)
        const stopCount=Math.max(1,Math.min(cardCount,Math.round(settings.value.globeStops)))
        const totalSteps=Math.max(1,Math.round(settings.value.cycles*stopCount))
        const transitionDuration=Math.max(.0001,settings.value.secondsPerSlide/totalSteps)
        const delay=Math.max(0,settings.value.delaySeconds),stepSpan=transitionDuration+delay
        const step=Math.floor(time/stepSpan),stepTime=time-step*stepSpan
        const rawProgress=stepTime<=delay?0:THREE.MathUtils.clamp((stepTime-delay)/transitionDuration,0,1)
        const easedProgress=cubicBezierProgress(rawProgress,template.value.bezier||easingCurves[settings.value.easing])
        const gcd=(left:number,right:number)=>{let a=Math.abs(left),b=Math.abs(right);while(b){const remainder=a%b;a=b;b=remainder}return a}
        const goldenStep=(count:number)=>{if(count<=2)return 1;const preferred=Math.max(1,Math.round(count*.618033988749895));for(let offset=0;offset<count;offset++){for(const candidate of[preferred-offset,preferred+offset])if(candidate>=1&&candidate<count&&gcd(candidate,count)===1)return candidate}return 1}
        const cardAt=(value:number)=>((value*goldenStep(cardCount))%cardCount+cardCount)%cardCount
        const frontQuaternion=(direction:import('three').Vector3,target:import('three').Quaternion)=>{
          const axisZ=direction.clone(),axisX=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),axisZ)
          if(axisX.lengthSq()<1e-8)axisX.crossVectors(new THREE.Vector3(0,0,1),axisZ)
          axisX.normalize()
          const axisY=new THREE.Vector3().crossVectors(axisZ,axisX)
          const basis=new THREE.Matrix4().makeBasis(axisX,axisY,axisZ)
          target.setFromRotationMatrix(basis).invert()
          if(camera.position.length()<carouselRadius)target.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI))
          return target
        }
        // A stepped cycle is a closed tour of `stopCount` positions. Wrapping
        // by the card count left the final pose on a different card whenever
        // stops and cards differed, producing a visible jump at the loop seam.
        const sequenceStep=((step%stopCount)+stopCount)%stopCount
        const directionSign=settings.value.reverse?-1:1
        const directionAt=(position:number)=>globeDirections[cardAt(position*directionSign)]
        const currentDirection=directionAt(sequenceStep),nextDirection=directionAt((sequenceStep+1)%stopCount)
        if(currentDirection&&nextDirection){
          const currentQuaternion=frontQuaternion(currentDirection,new THREE.Quaternion())
          const nextQuaternion=frontQuaternion(nextDirection,new THREE.Quaternion())
          globeGroup.quaternion.copy(currentQuaternion).slerp(nextQuaternion,easedProgress)
        }
      }
      scene.updateMatrixWorld(true)
      const worldPosition=new THREE.Vector3(),depthPosition=new THREE.Vector3()
      const parentWorldQuaternion=new THREE.Quaternion(),cameraFacingQuaternion=new THREE.Quaternion()
      globeGroup.getWorldQuaternion(parentWorldQuaternion)
      cameraFacingQuaternion.copy(parentWorldQuaternion).invert().multiply(camera.quaternion)
      const perspectiveDistance=1000/Math.max(.001,settings.value.perspective/100)*carouselPlaneUnit
      const hideRadialBackfaces=!settings.value.globeShowBackfaces&&!settings.value.globeFaceCamera
      const horizonThreshold=hideRadialBackfaces?carouselRadius/Math.max(.001,perspectiveDistance+camera.position.z):Number.NEGATIVE_INFINITY
      globeMeshes.forEach(mesh=>{
        if(!mesh)return
        mesh.getWorldPosition(worldPosition)
        if(settings.value.globeFaceCamera)mesh.quaternion.copy(cameraFacingQuaternion)
        depthPosition.copy(worldPosition)
        const normalizedDepth=depthPosition.z/Math.max(.001,carouselRadius)
        if(hideRadialBackfaces&&normalizedDepth<=horizonThreshold){mesh.visible=false;return}
        mesh.visible=true
        const depth=THREE.MathUtils.clamp((depthPosition.z+carouselRadius)/(carouselRadius*2),0,1)
        const depthScale=THREE.MathUtils.lerp(settings.value.globeMinScale/100,settings.value.globeMaxScale/100,depth)
        const perspectiveScale=Math.max(carouselPlaneUnit,camera.position.z-depthPosition.z)/Math.max(.001,perspectiveDistance)
        const scale=depthScale*perspectiveScale
        const flip=settings.value.globeFlipImage?-1:1
        mesh.scale.set(scale*flip,scale,scale)
        ;(mesh.material as import('three').MeshBasicMaterial).opacity=Math.max(0,1-(1-depth)*(settings.value.fade/100))
      })
    }
    if(!isCurrent()||renderer!==threeRenderer)return
    feedback.value=''
    renderer.render(scene,camera)
  }
  const drawAt=async(time:number)=>{
    const revision=++renderRevision
    try {
      if(template.value.collection==='scale')await drawScale(time,revision)
      else if(template.value.collection==='test')await drawTestFlip(time,revision)
      else if(template.value.collection==='flicker')await drawFlicker(time,revision)
      else if(template.value.collection==='stories')await drawStories(time,revision)
      else if(template.value.renderer==='webgl')await drawWebgl(time,revision)
      else await draw2d(time,revision)
    } catch {
      if(revision===renderRevision)feedback.value='Preview unavailable. Check that this board still has accessible image previews.'
    }
  }
  const stop=()=>{playing.value=false;lastPreviewFrameAt=0;cancelAnimationFrame(animationFrame);videos.forEach(video=>video.pause())}
  const tick=(frameTime:number)=>{
    if(!playing.value)return
    const frameInterval=1000/Math.max(1,settings.value.fps)
    if(lastPreviewFrameAt&&frameTime-lastPreviewFrameAt<frameInterval){animationFrame=requestAnimationFrame(tick);return}
    lastPreviewFrameAt=frameTime
    const duration=totalDuration.value
    const elapsed=(performance.now()-playbackStartedAt)/1000
    const continuousGridLoop=template.value.collection==='grid'&&settings.value.loop
    if(continuousGridLoop)gridPlaybackTime=elapsed
    progress.value=continuousGridLoop?elapsed%duration:elapsed
    if(progress.value>=duration){
      if(settings.value.loop){
        progress.value=progress.value%duration
        playbackStartedAt=performance.now()-progress.value*1000
      }else{
        progress.value=0;stop();void drawAt(0);return
      }
    }
    void drawAt(continuousGridLoop?gridPlaybackTime:progress.value).finally(()=>{if(playing.value)animationFrame=requestAnimationFrame(tick)})
  }
  const startPlayback=()=>{if(playing.value)return;const startTime=template.value.collection==='grid'&&settings.value.loop?gridPlaybackTime:progress.value;playbackStartedAt=performance.now()-startTime*1000;lastPreviewFrameAt=0;playing.value=true;videos.forEach(video=>void video.play().catch(()=>{}));animationFrame=requestAnimationFrame(tick)}
  const togglePlayback=()=>{if(playing.value){stop();void drawAt(progress.value);return}startPlayback()}
  const seek=(value:number)=>{progress.value=value;if(template.value.collection==='grid')gridPlaybackTime=value;if(playing.value)playbackStartedAt=performance.now()-value*1000;void drawAt(value)}
  const setCanvas=(value:HTMLCanvasElement)=>{canvas.value=value;void drawAt(progress.value)}
  const waitForReplacementCanvas=(previousCanvas:HTMLCanvasElement|undefined,changeRevision:number)=>new Promise<void>(resolve=>{
    let attempts=0
    const check=()=>{
      if(changeRevision!==templateChangeRevision||canvas.value!==previousCanvas||attempts>=12){resolve();return}
      attempts+=1
      requestAnimationFrame(check)
    }
    check()
  })
  const supportedMimeType=()=>['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||''
  const renderVideo=async()=>{
    const target=canvas.value,mimeType=supportedMimeType();if(!target||!mimeType||!('captureStream'in target)){feedback.value='Local video export is not supported by this browser.';return}
    stop();exporting.value=true;feedback.value='Rendering locally…';progress.value=0
    try{
      const useMotionBlur=settings.value.exportMotionBlur
      const exportCanvas=useMotionBlur?document.createElement('canvas'):target
      if(useMotionBlur){exportCanvas.width=target.width;exportCanvas.height=target.height}
      const exportContext=useMotionBlur?exportCanvas.getContext('2d'):null
      if(useMotionBlur&&!exportContext)throw new Error('Motion blur canvas unavailable')
      await Promise.all(assets.value.map(asset=>asset.mime_type?.startsWith('video/')?loadVideo(asset):loadRenderable(asset)))
      await drawAt(0)
      if(exportContext){
        exportContext.clearRect(0,0,exportCanvas.width,exportCanvas.height)
        exportContext.drawImage(target,0,0)
      }
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      let stream=exportCanvas.captureStream(useMotionBlur?0:settings.value.fps)
      let captureTrack=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack|undefined
      if(useMotionBlur&&typeof captureTrack?.requestFrame!=='function'){
        stream.getTracks().forEach(track=>track.stop())
        stream=exportCanvas.captureStream(settings.value.fps)
        captureTrack=undefined
      }
      const chunks:BlobPart[]=[]
      const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8_000_000})
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      const done=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error())})
      recorder.start(250)
      const started=performance.now(),sampleCount=useMotionBlur?(window.matchMedia('(pointer: coarse)').matches?3:5):1
      await new Promise<void>(resolve=>{
        const frame=async()=>{
          progress.value=Math.min(totalDuration.value,(performance.now()-started)/1000)
          if(exportContext){
            exportContext.clearRect(0,0,exportCanvas.width,exportCanvas.height)
            const shutter=1/Math.max(1,settings.value.fps)
            for(let sample=0;sample<sampleCount;sample++){
              const offset=sampleCount===1?0:(sample/(sampleCount-1)-.5)*shutter
              const rawTime=progress.value+offset
              const sampleTime=settings.value.loop
                ? ((rawTime%totalDuration.value)+totalDuration.value)%totalDuration.value
                : Math.max(0,Math.min(totalDuration.value-.001,rawTime))
              await drawAt(sampleTime)
              exportContext.globalCompositeOperation=sample===0?'copy':'source-over'
              exportContext.globalAlpha=sample===0?1:1/(sample+1)
              exportContext.drawImage(target,0,0)
            }
            exportContext.globalAlpha=1;exportContext.globalCompositeOperation='source-over'
            captureTrack?.requestFrame()
          }else await drawAt(Math.min(progress.value,totalDuration.value-.001))
          if(progress.value<totalDuration.value)requestAnimationFrame(frame);else resolve()
        }
        requestAnimationFrame(frame)
      })
      recorder.stop();await done;stream.getTracks().forEach(track=>track.stop())
      const blob=new Blob(chunks,{type:mimeType}),url=URL.createObjectURL(blob),link=document.createElement('a')
      link.href=url;link.download=`${boardTitle.value.trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'board'}.${mimeType.includes('mp4')?'mp4':'webm'}`;link.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.value='Video exported.'
    }catch{feedback.value='Video export failed. Try another browser or a smaller board.'}finally{exporting.value=false;progress.value=0;void drawAt(0)}
  }
  watch(()=>settings.value.templateId,(templateId,previousTemplateId)=>{
    const changeRevision=++templateChangeRevision
    const previousCanvas=canvas.value
    stop()
    const previousRenderer=videoTemplates.find(item=>item.id===previousTemplateId)?.renderer
    const rendererChanged=previousRenderer!==template.value.renderer
    if(!rendererChanged)disposeTextures()
    else disposeRenderer()
    progress.value=0;gridPlaybackTime=0
    if(template.value.preset)Object.assign(settings.value,template.value.preset)
    if(template.value.collection!=='grid')settings.value.visibleCount=countForAssets()
    void nextTick(async()=>{
      if(rendererChanged)await waitForReplacementCanvas(previousCanvas,changeRevision)
      if(changeRevision!==templateChangeRevision)return
      // Warm the remaining Flicker images without blocking the renderer switch.
      // Waiting for every preview here can leave mobile on a single frame for
      // several seconds when moving from a WebGL preset to the 2D canvas.
      if(template.value.collection==='flicker')void preloadFlickerAssets()
      if(changeRevision!==templateChangeRevision)return
      await drawAt(0)
      if(changeRevision!==templateChangeRevision)return
      if(template.value.renderer==='webgl'||template.value.collection==='flicker'||template.value.collection==='stories')startPlayback()
    })
  })
  watch(
    ()=>[settings.value.format,settings.value.fit,settings.value.transition,settings.value.secondsPerSlide,settings.value.showTitles,settings.value.direction,settings.value.gap,settings.value.tilt,settings.value.scaleCenter,settings.value.tiltMode,settings.value.easing,settings.value.cornerRadius,settings.value.distance,settings.value.centerScale,settings.value.fade,settings.value.offsetX,settings.value.offsetY,settings.value.scaleFocus,settings.value.solo,settings.value.visibleCount,settings.value.planeSize,settings.value.planeRotation,settings.value.cycles,settings.value.loop,settings.value.staggerFrames,settings.value.delayFrames,settings.value.cycleDegrees,settings.value.orbitRadius,settings.value.perspective,settings.value.rotationX,settings.value.rotationY,settings.value.rotationZ,settings.value.reverse,settings.value.spin,settings.value.spread,settings.value.staggerSeconds,settings.value.scaleStyle,settings.value.growFrom,settings.value.imageFit,settings.value.flickerEffect,settings.value.flipMaterial,settings.value.flipLightIntensity,settings.value.flipRoughness,settings.value.flickerPacing,settings.value.scaleDirection,settings.value.driftDirection,settings.value.scaleAmount,settings.value.driftAmount,settings.value.gridMoveDistance,settings.value.gridStaggerCurve,settings.value.delaySeconds,settings.value.backgroundColor,settings.value.globeMinScale,settings.value.globeMaxScale,settings.value.globeAxis,settings.value.globeMotion,settings.value.globeStops,settings.value.globeShuffle,settings.value.globeFaceCamera,settings.value.globeShowBackfaces,settings.value.globeFlipImage,settings.value.storiesBigScale,settings.value.storiesBigDrift,settings.value.storiesThumbSize,settings.value.storiesThumbAspect,settings.value.storiesContainerOpacity,settings.value.storiesContainerBlur,settings.value.storiesSelectorPad,settings.value.storiesSelectorStroke,settings.value.storiesDimAmount,settings.value.swipeAlternating],
    ()=>{if(!playing.value)void nextTick(()=>drawAt(progress.value))}
  )
  watch(()=>[settings.value.cornerRadius,settings.value.planeSize],disposeTextures)
  watch(
    ()=>[settings.value.flipGridColumns,settings.value.flipGridRows,settings.value.flipGridGap,settings.value.flipStagger,settings.value.flipShuffle],
    ()=>{if(!playing.value)void nextTick(()=>drawAt(progress.value))}
  )
  watch(assets,()=>{images.clear();videos.forEach(video=>{video.pause();video.removeAttribute('src');video.load()});videos.clear();disposeTextures();progress.value=0;gridPlaybackTime=0;void nextTick(async()=>{if(template.value.collection==='flicker')await preloadFlickerAssets();await drawAt(0)})},{immediate:true})
  onBeforeUnmount(()=>{stop();cancelAnimationFrame(textureRefreshFrame);disposeRenderer();videos.forEach(video=>{video.removeAttribute('src');video.load()})})
  return {settings,template,canvas,playing,exporting,progress,feedback,totalDuration,setCanvas,togglePlayback,seek,renderVideo,drawAt,stop}
}
