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
}

export const useVideoComposer = (assets: Ref<AssetMasonryItem[]>, boardTitle: Ref<string>, initialTemplateId='flicker-01', runtimeOptions:VideoComposerRuntimeOptions={}) => {
  const settings = ref<VideoComposerSettings>({ templateId:initialTemplateId,format:'portrait',fit:'contain',transition:'fade',secondsPerSlide:6,showTitles:false,direction:'up',gap:40,tilt:0,scaleCenter:false,tiltMode:'off',easing:'glide',cornerRadius:0,distance:100,centerScale:1.4,fade:0,offsetX:0,offsetY:0,scaleFocus:'center',solo:false,visibleCount:6,planeSize:100,cycles:1,staggerFrames:2,delayFrames:0,cycleDegrees:360,orbitRadius:280,perspective:140,rotationX:0,rotationY:0,rotationZ:0,reverse:false,spin:0,spread:0,staggerSeconds:.4,scaleStyle:'bloom',growFrom:'center',imageFit:'fit',flickerEffect:'off',flickerPacing:'equal',scaleDirection:'forward',driftDirection:'up',scaleAmount:30,driftAmount:30,delaySeconds:0,fps:30,safeArea:false,backgroundColor:'#f1efed',globeMinScale:10,globeMaxScale:20,globeAxis:'y',globeMotion:'continuous',globeStops:8,globeFaceCamera:true,globeShowBackfaces:true,globeFlipImage:false })
  const canvas = shallowRef<HTMLCanvasElement>()
  const playing = ref(false)
  const exporting = ref(false)
  const progress = ref(0)
  const feedback = ref('')
  const images = new Map<string, HTMLImageElement>()
  const videos = new Map<string, HTMLVideoElement>()
  const textures = new Map<string, unknown>()
  const webglMeshes = new Map<string, import('three').Mesh>()
  let animationFrame = 0
  let playbackStartedAt = 0
  let lastPreviewFrameAt = 0
  let renderRevision = 0
  let threeRenderer: import('three').WebGLRenderer | undefined

  const disposeWebglMeshes = () => {
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
    const maximum=template.value.collection==='globe'?60:template.value.collection==='carousel-3d'?40:template.value.collection==='flicker'?30:20
    return Math.max(minimum,Math.min(maximum,assets.value.length||minimum))
  }
  const dimensions = computed(() => videoFormatDimensions[settings.value.format])
  const totalDuration = computed(() => template.value.collection==='scale'
    ? Math.max(1,settings.value.visibleCount)*settings.value.staggerSeconds
    : template.value.collection==='carousel-3d'||template.value.collection==='globe' ? settings.value.secondsPerSlide*settings.value.cycles
    : template.value.collection==='flicker' ? settings.value.secondsPerSlide*settings.value.cycles
    : Math.max(1, assets.value.length) * settings.value.secondsPerSlide)
  const urlsFor = (asset: AssetMasonryItem) => ['preview2x','preview','original']
    .map(variant => `/api/assets/${encodeURIComponent(asset.id)}/media?variant=${variant}`)
  const loadImageUrl = (url:string) => {
    const cacheKey=url,cached=images.get(cacheKey)
    if(cached?.complete&&cached.naturalWidth)return Promise.resolve(cached)
    return new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=cached||new Image();image.decoding='async'
      image.onload=()=>{images.set(cacheKey,image);resolve(image)};image.onerror=()=>{images.delete(cacheKey);reject(new Error(`Could not load ${url}`))}
      if(!cached)image.src=url
    })
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

  const sizeCanvas = (target: HTMLCanvasElement) => {
    const [formatWidth,formatHeight]=dimensions.value
    const previewScale=runtimeOptions.maxPreviewDimension
      ? Math.min(1,runtimeOptions.maxPreviewDimension/Math.max(formatWidth,formatHeight))
      : 1
    const width=Math.max(1,Math.round(formatWidth*previewScale)),height=Math.max(1,Math.round(formatHeight*previewScale))
    if(target.width!==width||target.height!==height){target.width=width;target.height=height}
    return {width,height}
  }
  const paintImage = (context:CanvasRenderingContext2D,image:HTMLImageElement|HTMLCanvasElement,width:number,height:number,opacity=1) => {
    const sourceWidth=image instanceof HTMLImageElement?image.naturalWidth:image.width
    const sourceHeight=image instanceof HTMLImageElement?image.naturalHeight:image.height
    const scale=settings.value.fit==='cover'?Math.max(width/sourceWidth,height/sourceHeight):Math.min(width/sourceWidth,height/sourceHeight)
    const drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale
    context.save();context.globalAlpha=opacity;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);context.restore()
  }
  const draw2d = async (time:number,revision:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const {width,height}=sizeCanvas(target)
    const frame=document.createElement('canvas');frame.width=width;frame.height=height
    const context=frame.getContext('2d');if(!context)return
    context.fillStyle=settings.value.backgroundColor;context.fillRect(0,0,width,height)
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
    context.fillStyle=settings.value.backgroundColor;context.fillRect(0,0,width,height)
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
    context.fillStyle=settings.value.backgroundColor;context.fillRect(0,0,width,height)
    const count=Math.max(1,Math.min(30,Math.round(settings.value.visibleCount))),duration=Math.max(.1,settings.value.secondsPerSlide)
    const slotDuration=duration/count,delay=Math.min(slotDuration*.95,Math.max(0,settings.value.delaySeconds)),activeDuration=slotDuration-delay
    const curve=template.value.bezier||[.76,0,.24,1] as const,phase=((time/duration)%1+1)%1
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
    const asset=assets.value[slotIndex%assets.value.length]!,image=await loadRenderable(asset)
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
    }else{drawWidth*=planeScale;drawHeight*=planeScale}
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
    context.drawImage(image,centerX-drawWidth/2,centerY-drawHeight/2,drawWidth,drawHeight);context.restore()
    if(revision!==renderRevision||target!==canvas.value)return
    const visibleContext=target.getContext('2d');if(!visibleContext)return
    visibleContext.clearRect(0,0,width,height);visibleContext.drawImage(frame,0,0);feedback.value=''
  }
  const drawWebgl = async (time:number) => {
    const target=canvas.value;if(!target||!assets.value.length)return
    const THREE=await import('three'),{width,height}=sizeCanvas(target)
    if(!threeRenderer||threeRenderer.domElement!==target){disposeRenderer();threeRenderer=new THREE.WebGLRenderer({canvas:target,antialias:true,preserveDrawingBuffer:runtimeOptions.preserveDrawingBuffer===true});threeRenderer.setPixelRatio(1)}
    threeRenderer.setSize(width,height,false);threeRenderer.setClearColor(settings.value.backgroundColor,1)
    const isCarousel3d=template.value.collection==='carousel-3d'
    const isGlobe=template.value.collection==='globe'
    const isScale=template.value.collection==='scale'
    const usesPlaneCount=isCarousel3d||isGlobe||isScale
    const planeCount=usesPlaneCount?Math.max(1,Math.round(settings.value.visibleCount)):assets.value.length
    const sceneAssets=usesPlaneCount
      ? Array.from({length:planeCount},(_,index)=>assets.value[index%assets.value.length]!)
      : assets.value
    const cameraFov=isCarousel3d||isGlobe?THREE.MathUtils.radToDeg(2*Math.atan(1.125/Math.max(.01,settings.value.perspective/100))):36
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(cameraFov,width/height,.1,100);camera.position.z=8
    const carouselRotator=new THREE.Group(),carouselRing=new THREE.Group()
    if(isCarousel3d){carouselRotator.rotation.order='ZYX';carouselRotator.rotation.set(THREE.MathUtils.degToRad(settings.value.rotationX),THREE.MathUtils.degToRad(settings.value.rotationY),THREE.MathUtils.degToRad(settings.value.rotationZ));carouselRotator.position.set(settings.value.offsetX/100,settings.value.offsetY/100,0);carouselRotator.add(carouselRing);scene.add(carouselRotator)}
    const globeGroup=new THREE.Group()
    if(isGlobe){globeGroup.rotation.order='ZYX';globeGroup.rotation.set(THREE.MathUtils.degToRad(settings.value.rotationX),THREE.MathUtils.degToRad(settings.value.rotationY),THREE.MathUtils.degToRad(settings.value.rotationZ));globeGroup.position.set(settings.value.offsetX/100,settings.value.offsetY/100,0);scene.add(globeGroup)}
    const delayedTime=Math.max(0,time-(isGlobe?settings.value.delaySeconds:settings.value.delayFrames/30))
    const rawCycle=delayedTime/settings.value.secondsPerSlide*(isCarousel3d||isGlobe?1:settings.value.cycles),direction=settings.value.direction
    const wholeCycle=Math.floor(rawCycle),rawPhase=rawCycle-wholeCycle
    const easedPhase=cubicBezierProgress(rawPhase,template.value.bezier||easingCurves[settings.value.easing])
    const cycle=wholeCycle+easedPhase
    const vertical=direction==='up'||direction==='down'
    const viewportHeight=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))
    const viewportWidth=viewportHeight*camera.aspect
    const planeScale=settings.value.planeSize/(isScale?100:600)
    const maxPlaneWidth=Math.min(3.4,viewportWidth*.78)*planeScale,maxPlaneHeight=Math.min(2.35,viewportHeight*.68)*planeScale
    const largestAssetSide=Math.max(1,...sceneAssets.map(asset=>Math.max(asset.width,asset.height)))
    const planeSizes=sceneAssets.map(asset=>{
      const aspect=Math.max(.01,asset.width/Math.max(1,asset.height))
      if(isCarousel3d||isGlobe){
        return {width:maxPlaneWidth,height:maxPlaneWidth/aspect}
      }
      if(isScale){
        const scale=Math.min(3.4,viewportWidth*.78)*planeScale/largestAssetSide
        return {width:Math.max(.01,asset.width*scale),height:Math.max(.01,asset.height*scale)}
      }
      if(aspect>maxPlaneWidth/maxPlaneHeight)return {width:maxPlaneWidth,height:maxPlaneWidth/aspect}
      return {width:maxPlaneHeight*aspect,height:maxPlaneHeight}
    })
    const carouselPlaneUnit=isCarousel3d||isGlobe
      ? Math.max(.0001,maxPlaneWidth)/Math.max(1,settings.value.planeSize)
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
    const carouselTravel=THREE.MathUtils.degToRad(settings.value.cycleDegrees)*cycle*(settings.value.reverse?-1:1)
    if(isCarousel3d)carouselRing.rotation.y=carouselTravel
    if(isGlobe){
      const stepped=settings.value.globeMotion==='stepped'
      const stopCount=Math.max(2,Math.round(settings.value.globeStops))
      const travel=stepped?Math.round(cycle*stopCount)/stopCount*THREE.MathUtils.degToRad(settings.value.cycleDegrees)*(settings.value.reverse?-1:1):carouselTravel
      const baseRotation=settings.value.globeAxis==='x'?settings.value.rotationX:settings.value.globeAxis==='y'?settings.value.rotationY:settings.value.rotationZ
      globeGroup.rotation[settings.value.globeAxis]=travel+THREE.MathUtils.degToRad(baseRotation)
    }
    let rendered=0
    const carouselMeshes: import('three').Mesh[]=[]
    const globeMeshes: import('three').Mesh[]=[]
    // Flat carousels only need nearby cards. Cull before loading images, decoding
    // videos, or touching textures; large boards otherwise process every asset.
    const renderEntries=sceneAssets.map((asset,index)=>({asset,index})).filter(({index})=>{
      if(isCarousel3d||isGlobe||isScale)return true
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
      const textureKey=isVideo?`${asset.id}:video`:`${asset.id}:${settings.value.cornerRadius}:${settings.value.planeSize}`
      let texture=textures.get(textureKey) as import('three').Texture|undefined
      if(!texture){
        if(isVideo){
          const video=await loadVideo(asset)
          const videoCanvas=document.createElement('canvas'),maxSide=1024
          const sourceWidth=video.videoWidth||asset.width,sourceHeight=video.videoHeight||asset.height
          const textureScale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight))
          videoCanvas.width=Math.max(1,Math.round(sourceWidth*textureScale));videoCanvas.height=Math.max(1,Math.round(sourceHeight*textureScale))
          texture=new THREE.CanvasTexture(videoCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;textures.set(textureKey,texture)
        }else{
          let source:HTMLImageElement|HTMLCanvasElement
          try{source=await loadImage(asset)}catch{source=missingAssetSource(asset)}
          const sourceWidth=source instanceof HTMLImageElement?source.naturalWidth:source.width
          const sourceHeight=source instanceof HTMLImageElement?source.naturalHeight:source.height
          const rounded=document.createElement('canvas'),maxSide=1024,textureScale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight))
          rounded.width=Math.max(1,Math.round(sourceWidth*textureScale));rounded.height=Math.max(1,Math.round(sourceHeight*textureScale))
          const roundedContext=rounded.getContext('2d')
          if(roundedContext){const radius=Math.min(rounded.width,rounded.height)/2,scaledRadius=Math.min(radius,rounded.width*settings.value.cornerRadius/Math.max(1,settings.value.planeSize));roundedContext.beginPath();roundedContext.roundRect(0,0,rounded.width,rounded.height,scaledRadius);roundedContext.clip();roundedContext.drawImage(source,0,0,rounded.width,rounded.height)}
          texture=new THREE.CanvasTexture(rounded);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;textures.set(textureKey,texture)
        }
      }
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
            videoContext.drawImage(video,0,0,videoCanvas.width,videoCanvas.height);videoContext.restore();texture.needsUpdate=true
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
      if(!isCarousel3d&&!isScale&&Math.abs(centered)>visibleRadius)return
      const {width:planeWidth,height:planeHeight}=planeSizes[index]!
      const side=isGlobe&&!settings.value.globeShowBackfaces?THREE.FrontSide:THREE.DoubleSide
      const meshKey=`${template.value.collection}:${index}:${textureKey}:${planeWidth.toFixed(5)}:${planeHeight.toFixed(5)}:${side}`
      let mesh=webglMeshes.get(meshKey)
      if(!mesh){
        mesh=new THREE.Mesh(new THREE.PlaneGeometry(planeWidth,planeHeight),new THREE.MeshBasicMaterial({map:texture,transparent:true,side}))
        webglMeshes.set(meshKey,mesh)
      }else mesh.removeFromParent()
      const material=mesh.material as import('three').MeshBasicMaterial
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
        globeGroup.add(mesh);globeMeshes.push(mesh)
      }else if(isCarousel3d){
        const slotAngle=carousel3dAngles[index]||0
        const slotDegrees=THREE.MathUtils.radToDeg(slotAngle)
        const planeRotation=((180-slotDegrees)%180+180)%180
        mesh.rotation.y=THREE.MathUtils.degToRad(planeRotation)
        // Anchor whichever vertical side faces inward to the orbit. The folded
        // card rotation swaps local left/right around the ring, so using a fixed
        // local side makes half the cards extend inward. A radial offset keeps
        // every card extending outward while its inner side traces the orbit.
        const radialX=Math.cos(slotAngle)
        const radialZ=Math.sin(slotAngle)
        const anchoredRadius=carouselRadius+planeWidth/2
        mesh.position.set(radialX*anchoredRadius,0,radialZ*anchoredRadius)
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
      if(!isCarousel3d&&!isGlobe){mesh.position.x+=settings.value.offsetX/100;mesh.position.y+=settings.value.offsetY/100}
      if(!isCarousel3d&&settings.value.scaleCenter){
        const focus=Math.max(0,1-Math.abs(centered)),scale=1+(settings.value.centerScale-1)*focus
        mesh.scale.setScalar(scale)
        if(settings.value.scaleFocus!=='center'){
          const anchorDirection=settings.value.scaleFocus==='start'?-1:1
          if(vertical)mesh.position.y+=anchorDirection*(scale-1)*planeHeight/2
          else mesh.position.x+=anchorDirection*(scale-1)*planeWidth/2
        }
      }
      if(!isScale&&!isGlobe){
        const depthPosition=isCarousel3d?mesh.position.clone().applyEuler(carouselRing.rotation).applyEuler(carouselRotator.rotation).add(carouselRotator.position):mesh.position
        const depth=isCarousel3d?Math.max(0,Math.min(1,(depthPosition.z+carouselRadius)/Math.max(.01,carouselRadius*2))):Math.abs(centered)
        material.opacity=Math.max(0,1-depth*(settings.value.fade/100))
      }
      if(isCarousel3d){carouselRing.add(mesh);carouselMeshes.push(mesh)}else if(!isGlobe){scene.add(mesh);rendered++}
    }))
    if(!rendered&&!carouselMeshes.length&&!globeMeshes.length)throw new Error('No previews could be loaded')
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
      scene.updateMatrixWorld(true)
      const worldPosition=new THREE.Vector3(),depthPosition=new THREE.Vector3()
      globeMeshes.forEach(mesh=>{
        mesh.getWorldPosition(worldPosition)
        if(settings.value.globeFaceCamera)mesh.lookAt(globeGroup.worldToLocal(camera.position.clone()))
        depthPosition.copy(worldPosition)
        const depth=THREE.MathUtils.clamp((depthPosition.z+carouselRadius)/(carouselRadius*2),0,1)
        const depthScale=THREE.MathUtils.lerp(settings.value.globeMinScale/100,settings.value.globeMaxScale/100,depth)
        const perspectiveDistance=1000/Math.max(.001,settings.value.perspective/100)*carouselPlaneUnit
        const perspectiveScale=Math.max(carouselPlaneUnit,camera.position.z-depthPosition.z)/Math.max(.001,perspectiveDistance)
        const scale=depthScale*perspectiveScale
        const flip=settings.value.globeFlipImage?-1:1
        mesh.scale.set(scale*flip,scale,scale)
        ;(mesh.material as import('three').MeshBasicMaterial).opacity=Math.max(0,1-(1-depth)*(settings.value.fade/100))
      })
    }
    feedback.value=''
    threeRenderer.render(scene,camera)
  }
  const drawAt=async(time:number)=>{
    const revision=++renderRevision
    try {
      if(template.value.collection==='scale')await drawScale(time,revision)
      else if(template.value.collection==='flicker')await drawFlicker(time,revision)
      else if(template.value.renderer==='webgl')await drawWebgl(time)
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
    progress.value=(performance.now()-playbackStartedAt)/1000
    if(progress.value>=duration){
      if(template.value.renderer==='webgl'||template.value.collection==='flicker'){
        progress.value=progress.value%duration
        playbackStartedAt=performance.now()-progress.value*1000
      }else{
        progress.value=0;stop();void drawAt(0);return
      }
    }
    void drawAt(progress.value).finally(()=>{if(playing.value)animationFrame=requestAnimationFrame(tick)})
  }
  const togglePlayback=()=>{if(playing.value){stop();return}playbackStartedAt=performance.now()-progress.value*1000;lastPreviewFrameAt=0;playing.value=true;videos.forEach(video=>void video.play().catch(()=>{}));animationFrame=requestAnimationFrame(tick)}
  const seek=(value:number)=>{progress.value=value;if(playing.value)playbackStartedAt=performance.now()-value*1000;void drawAt(value)}
  const setCanvas=(value:HTMLCanvasElement)=>{canvas.value=value;void drawAt(progress.value)}
  const supportedMimeType=()=>['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||''
  const renderVideo=async()=>{
    const target=canvas.value,mimeType=supportedMimeType();if(!target||!mimeType||!('captureStream'in target)){feedback.value='Local video export is not supported by this browser.';return}
    stop();exporting.value=true;feedback.value='Rendering locally…';progress.value=0
    try{const stream=target.captureStream(settings.value.fps),chunks:BlobPart[]=[],recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8_000_000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error())});recorder.start(250);const started=performance.now();await new Promise<void>(resolve=>{const frame=async()=>{progress.value=Math.min(totalDuration.value,(performance.now()-started)/1000);await drawAt(Math.min(progress.value,totalDuration.value-.001));if(progress.value<totalDuration.value)requestAnimationFrame(frame);else resolve()};requestAnimationFrame(frame)});recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:mimeType}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${boardTitle.value.trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'board'}.${mimeType.includes('mp4')?'mp4':'webm'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.value='Video exported.'}catch{feedback.value='Video export failed. Try another browser or a smaller board.'}finally{exporting.value=false;progress.value=0;void drawAt(0)}
  }
  watch(()=>settings.value.templateId,(templateId,previousTemplateId)=>{
    stop()
    const previousRenderer=videoTemplates.find(item=>item.id===previousTemplateId)?.renderer
    if(previousRenderer===template.value.renderer)disposeTextures()
    else disposeRenderer()
    progress.value=0
    if(template.value.preset)Object.assign(settings.value,template.value.preset)
    settings.value.visibleCount=countForAssets()
    void nextTick(async()=>{
      if(template.value.collection==='flicker')await preloadFlickerAssets()
      await drawAt(0)
      if(template.value.renderer==='webgl'||template.value.collection==='flicker')togglePlayback()
    })
  })
  watch(
    ()=>[settings.value.format,settings.value.fit,settings.value.transition,settings.value.secondsPerSlide,settings.value.showTitles,settings.value.direction,settings.value.gap,settings.value.tilt,settings.value.scaleCenter,settings.value.tiltMode,settings.value.easing,settings.value.cornerRadius,settings.value.distance,settings.value.centerScale,settings.value.fade,settings.value.offsetX,settings.value.offsetY,settings.value.scaleFocus,settings.value.solo,settings.value.visibleCount,settings.value.planeSize,settings.value.cycles,settings.value.staggerFrames,settings.value.delayFrames,settings.value.cycleDegrees,settings.value.orbitRadius,settings.value.perspective,settings.value.rotationX,settings.value.rotationY,settings.value.rotationZ,settings.value.reverse,settings.value.spin,settings.value.spread,settings.value.staggerSeconds,settings.value.scaleStyle,settings.value.growFrom,settings.value.imageFit,settings.value.flickerEffect,settings.value.flickerPacing,settings.value.scaleDirection,settings.value.driftDirection,settings.value.scaleAmount,settings.value.driftAmount,settings.value.delaySeconds,settings.value.backgroundColor,settings.value.globeMinScale,settings.value.globeMaxScale,settings.value.globeAxis,settings.value.globeMotion,settings.value.globeStops,settings.value.globeFaceCamera,settings.value.globeShowBackfaces,settings.value.globeFlipImage],
    ()=>{if(!playing.value)void nextTick(()=>drawAt(progress.value))}
  )
  watch(()=>[settings.value.cornerRadius,settings.value.planeSize],disposeTextures)
  watch(assets,()=>{images.clear();videos.forEach(video=>{video.pause();video.removeAttribute('src');video.load()});videos.clear();disposeTextures();progress.value=0;settings.value.visibleCount=countForAssets();void nextTick(async()=>{if(template.value.collection==='flicker')await preloadFlickerAssets();await drawAt(0)})},{immediate:true})
  onBeforeUnmount(()=>{stop();disposeRenderer();videos.forEach(video=>{video.removeAttribute('src');video.load()})})
  return {settings,template,canvas,playing,exporting,progress,feedback,totalDuration,setCanvas,togglePlayback,seek,renderVideo,drawAt,stop}
}
