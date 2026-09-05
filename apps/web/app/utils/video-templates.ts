import type { VideoComposerSettings, VideoTemplate } from '~/types/video-composer'

const carouselDefaults: Partial<VideoComposerSettings> = { direction:'up',scaleCenter:false,scaleFocus:'center',centerScale:1.4,tiltMode:'off',tilt:0,solo:false,visibleCount:6,planeSize:600,gap:40,distance:100,cornerRadius:0,offsetX:0,offsetY:0,fade:0,cycles:1,loop:true,secondsPerSlide:1.6,staggerFrames:2,delayFrames:0,easing:'glide' }
const preset = (overrides: Partial<VideoComposerSettings>) => ({ ...carouselDefaults, ...overrides })
const verticalThumb = 'linear-gradient(90deg,transparent 28%,#d8d8d8 28% 72%,transparent 72%),#090909'
const horizontalThumb = 'linear-gradient(0deg,transparent 28%,#d8d8d8 28% 72%,transparent 72%),#090909'
const fadedVerticalThumb = 'linear-gradient(180deg,transparent 4%,#d8d8d8 28% 66%,transparent 94%),#090909'
const fadedHorizontalThumb = 'linear-gradient(90deg,transparent 4%,#d8d8d8 28% 66%,transparent 94%),#090909'

const carouselPresetDefinitions: Array<readonly [string, string, Partial<VideoComposerSettings>]> = [
  ['01',verticalThumb,{}],
  ['02',horizontalThumb,{ direction:'left',planeSize:546 }],
  ['03',fadedVerticalThumb,{ gap:235,planeSize:568,scaleCenter:true,centerScale:1.45,fade:40 }],
  ['04',fadedHorizontalThumb,{ direction:'left',gap:190,planeSize:440,scaleCenter:true,centerScale:1.45,fade:40 }],
  ['05',verticalThumb,{ gap:80,planeSize:730,secondsPerSlide:2.3,staggerFrames:0,easing:'linear' }],
  ['06',horizontalThumb,{ direction:'left',gap:80,planeSize:540,secondsPerSlide:2.3,staggerFrames:0,easing:'linear' }],
  ['07',verticalThumb,{ gap:500,planeSize:850,easing:'smooth' }],
  ['08',horizontalThumb,{ direction:'left',gap:500,planeSize:642,easing:'smooth' }],
  ['09',verticalThumb,{ gap:332,planeSize:600,solo:true,scaleCenter:true,secondsPerSlide:1.5,staggerFrames:0,delayFrames:15,easing:'smooth' }],
  ['10',horizontalThumb,{ direction:'left',gap:332,planeSize:454,solo:true,scaleCenter:true,secondsPerSlide:1.5,staggerFrames:0,delayFrames:15,easing:'smooth' }],
  ['11',verticalThumb,{ gap:235,planeSize:568,scaleCenter:true,scaleFocus:'start',centerScale:1.65 }],
  ['12',horizontalThumb,{ direction:'left',gap:140,planeSize:466,scaleCenter:true,scaleFocus:'start',centerScale:1.75 }],
  ['13',verticalThumb,{ direction:'down',gap:500,planeSize:850,scaleCenter:true,scaleFocus:'end',centerScale:2,easing:'smooth' }],
  ['14',horizontalThumb,{ direction:'right',gap:500,planeSize:639,scaleCenter:true,scaleFocus:'end',centerScale:2,easing:'smooth' }],
  ['15',verticalThumb,{ gap:0,planeSize:614,scaleCenter:true,scaleFocus:'start',centerScale:1.8,staggerFrames:0,easing:'sweep' }],
  ['16',horizontalThumb,{ direction:'left',gap:0,planeSize:473,scaleCenter:true,scaleFocus:'start',centerScale:1.8,staggerFrames:0,easing:'sweep' }],
  ['17',verticalThumb,{ gap:273,planeSize:748,tiltMode:'alternate',tilt:-25,staggerFrames:0,easing:'sweep' }],
  ['18',horizontalThumb,{ direction:'left',gap:273,planeSize:657,tiltMode:'alternate',tilt:-25,staggerFrames:0,easing:'sweep' }]
]
const carouselPresets: VideoTemplate[] = carouselPresetDefinitions.map(([number,thumbnail,settings]) => ({ id:`carousel-${number}`,name:`Carousel ${number}`,description:'Editable carousel preset.',renderer:'webgl',collection:'carousel',thumbnail,preset:preset(settings) }))

const carousel3dDefaults: Partial<VideoComposerSettings> = { visibleCount:12,cycles:1,loop:true,cycleDegrees:360,distance:1300,secondsPerSlide:8,reverse:false,planeSize:400,planeRotation:0,rotationX:30,rotationY:38,rotationZ:0,orbitRadius:280,perspective:140,cornerRadius:0,fade:0,offsetX:0,offsetY:0,easing:'linear',flipMaterial:'lit',flipLightIntensity:200,lightX:-3,lightY:4,lightZ:5,flipRoughness:72 }
const carousel3dThumb = 'linear-gradient(145deg,transparent 20%,#d8d8d8 21% 47%,transparent 48% 55%,#aaa 56% 78%,transparent 79%),#090909'
const carousel3dPresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>]> = [
  ['01',{}],
  ['02',{ visibleCount:9,cycles:6,cycleDegrees:60,distance:990,secondsPerSlide:1.5,reverse:true,rotationX:6,rotationY:18,rotationZ:-17,orbitRadius:330,perspective:100,fade:30,easing:'sweep' }],
  ['03',{ cycles:2,cycleDegrees:180,distance:1870,secondsPerSlide:4,reverse:true,rotationX:0,rotationY:-17,orbitRadius:330,perspective:210,fade:20,easing:'sweep' }],
  ['04',{ visibleCount:9,cycles:6,cycleDegrees:60,distance:1250,secondsPerSlide:2,reverse:true,planeSize:410,rotationX:0,rotationY:0,orbitRadius:210,perspective:300,fade:20,offsetX:50.5,easing:'sweep' }],
  ['05',{ visibleCount:33,distance:1370,secondsPerSlide:20,reverse:true,planeSize:250,rotationX:22,rotationY:0,orbitRadius:480,perspective:160,offsetY:-6 }],
    ['06',{ visibleCount:33,distance:660,secondsPerSlide:5,reverse:false,planeSize:250,planeRotation:90,rotationX:90,rotationY:-90,orbitRadius:0,perspective:160,offsetY:-6 }],
  ['07',{ planeSize:380,planeRotation:-30,orbitRadius:0,distance:1020,perspective:160,rotationX:6,rotationY:18,rotationZ:-17,flipMaterial:'lit',flipLightIntensity:200,flipRoughness:63,cornerRadius:0,fade:100,offsetX:0,offsetY:0,cycles:1,cycleDegrees:360,secondsPerSlide:2.5,easing:'sweep' }]
]
const carousel3dPresets: VideoTemplate[] = carousel3dPresetDefinitions.map(([number,settings]) => {
  const values={...carousel3dDefaults,...settings}
  return { id:`carousel-3d-${number}`,name:`Carousel 3D ${number}`,description:'Editable 3D carousel preset.',renderer:'webgl',collection:'carousel-3d',thumbnail:carousel3dThumb,preset:values }
})

const gridDefaults: Partial<VideoComposerSettings> = { gridBuildUp:false, visibleCount:35,flipGridColumns:7,flipGridRows:5,flipGridGap:24,planeSize:100,centerScale:2.1,secondsPerSlide:2.4,delaySeconds:.8,cycles:6,loop:true,cornerRadius:8,offsetX:0,offsetY:0,easing:'smooth',fit:'cover',driftDirection:'left',driftAmount:16,gridMoveDistance:300,gridStaggerCurve:'linear',gridLayout:'flat',gridTubeBend:'outside',gridTubeMotion:'continuous',gridTubeStepRotation:20,gridTubeEmphasisStyle:'stable',gridCameraZoom:100,gridTubeStagger:0,gridScatter:0,gridRotationVariance:0,gridScaleVariance:0,gridEmphasis:'none',gridEmphasisAmount:0,gridEmphasisCurve:'smooth' }
const gridThumb = 'linear-gradient(90deg,transparent 0 7%,#d8d8d8 8% 29%,transparent 30% 35%,#aaa 36% 63%,transparent 64% 69%,#777 70% 92%,transparent 93%),linear-gradient(0deg,transparent 0 7%,#777 8% 29%,transparent 30% 35%,#d8d8d8 36% 63%,transparent 64% 69%,#aaa 70% 92%,transparent 93%),#090909'
const gridPresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01',{},[.76,0,.24,1]],
  ['02',{ flipGridColumns:8,flipGridRows:5,flipGridGap:12,planeSize:82,centerScale:2.4,secondsPerSlide:1.8,delaySeconds:.45,driftDirection:'up',driftAmount:20 },[.86,.14,.14,.86]],
  ['03',{ flipGridColumns:6,flipGridRows:6,flipGridGap:38,planeSize:115,centerScale:1.8,secondsPerSlide:3.5,delaySeconds:1.2,driftDirection:'right',driftAmount:12 },[.25,.25,.75,.75]],
  ['04',{ gridLayout:'tube',gridTubeBend:'outside',flipGridColumns:18,flipGridRows:13,flipGridGap:24,planeSize:108,secondsPerSlide:6,cycles:2,driftDirection:'left' },[.25,.25,.75,.75]],
  ['05',{ gridLayout:'tube',gridTubeBend:'inside',flipGridColumns:18,flipGridRows:13,flipGridGap:30,planeSize:112,secondsPerSlide:7,cycles:2,driftDirection:'right' },[.25,.25,.75,.75]],
  ['06',{ gridLayout:'tube',gridTubeBend:'outside',flipGridColumns:14,flipGridRows:11,flipGridGap:18,planeSize:105,secondsPerSlide:5,cycles:2,driftDirection:'up' },[.25,.25,.75,.75]],
  ['07',{ gridLayout:'tube',gridTubeBend:'inside',flipGridColumns:16,flipGridRows:12,flipGridGap:34,planeSize:115,secondsPerSlide:6.5,cycles:2,driftDirection:'down' },[.25,.25,.75,.75]],
  ['08',{ gridBuildUp:true,flipGridColumns:12,flipGridRows:20,flipGridGap:16,planeSize:30,centerScale:4,secondsPerSlide:8,delaySeconds:0,cycles:1,loop:true,driftDirection:'up',gridMoveDistance:500,gridScatter:100,gridScaleVariance:80,gridRotationVariance:0,fit:'contain',backgroundType:'solid',backgroundColor:'#000000' },[.25,.25,.75,.75]]
]
const gridPresets: VideoTemplate[] = gridPresetDefinitions.map(([number,settings,bezier]) => {
  const curved=settings.gridLayout==='tube'
  return { id:`grid-${number}`,name:`Grid ${number}`,description:settings.gridBuildUp?'Scattered images build up, drift, and finish with a strong zoom.':curved?'Continuously curved image grid.':'Oversized WebGL grid with periodic image focus.',renderer:'webgl',collection:'grid',thumbnail:gridThumb,bezier,preset:{...gridDefaults,...settings} }
})

const orbitDefaults: Partial<VideoComposerSettings> = { visibleCount:7,cycles:1,loop:true,cycleDegrees:360,secondsPerSlide:8,delaySeconds:0,reverse:false,planeSize:370,rotationX:0,rotationY:0,rotationZ:0,orbitRadius:420,perspective:100,cornerRadius:0,fade:0,offsetX:0,offsetY:0,easing:'sweep' }
const orbitPresetDefinitions: Array<readonly [string, string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01','Orbit 01',{},[.86,.14,.14,.86]],
  ['02','Orbit 02',{ planeSize:370,rotationZ:270,orbitRadius:450 },[.86,.14,.14,.86]],
  ['03','Orbit 03',{ planeSize:230,orbitRadius:485,perspective:140,fade:45 },[.86,.14,.14,.86]],
  ['04-alt','Orbit 04',{ planeSize:205,rotationZ:270,orbitRadius:515,perspective:140,fade:45 },[.86,.14,.14,.86]],
  ['04','Orbit 04',{ planeSize:512,orbitRadius:216 },[.86,.14,.14,.86]],
  ['05','Orbit 05',{ planeSize:512,rotationZ:90,orbitRadius:216 },[.86,.14,.14,.86]],
  ['07','Orbit 07',{ planeSize:257,rotationZ:306,orbitRadius:518 },[.86,.14,.14,.86]],
  ['08','Orbit 08',{ planeSize:257,rotationZ:234,orbitRadius:518,reverse:true },[.86,.14,.14,.86]],
  ['09','Orbit 09',{ secondsPerSlide:16,planeSize:235,rotationX:90,orbitRadius:511,easing:'linear' },[.25,.25,.75,.75]],
  ['10','Orbit 10',{ planeSize:512,orbitRadius:216 },[.86,.14,.14,.86]],
  ['11','Orbit 11',{ planeSize:512,rotationZ:270,orbitRadius:216 },[.86,.14,.14,.86]],
  ['12','Orbit 12',{ visibleCount:20,secondsPerSlide:14,planeSize:372,rotationZ:90,orbitRadius:407,fade:40 },[.86,.14,.14,.86]],
  ['13','Orbit 13',{ visibleCount:20,secondsPerSlide:14,planeSize:372,orbitRadius:407,fade:40 },[.86,.14,.14,.86]],
  ['15','Orbit 15',{ visibleCount:20,secondsPerSlide:14,planeSize:372,orbitRadius:407,fade:40 },[.86,.14,.14,.86]]
]
const orbitPresets: VideoTemplate[] = orbitPresetDefinitions.map(([id,name,settings,bezier]) => ({ id:`orbit-${id}`,name,description:'Editable radial orbit preset.',renderer:'webgl',collection:'orbit',thumbnail:'radial-gradient(ellipse at 50% 50%,transparent 0 30%,#aaa 31% 37%,transparent 38%),#090909',bezier,preset:{...orbitDefaults,...settings} }))

const globeDefaults: Partial<VideoComposerSettings> = { visibleCount:40,orbitRadius:355,globeMinScale:10,globeMaxScale:20,distance:1000,perspective:100,fade:0,cornerRadius:0,offsetX:0,offsetY:0,rotationX:0,rotationY:0,rotationZ:0,cycles:1,loop:true,secondsPerSlide:7,cycleDegrees:360,delaySeconds:0,globeStops:8,reverse:false,globeAxis:'y',globeMotion:'continuous',globeShuffle:false,globeFaceCamera:true,globeShowBackfaces:true,globeFlipImage:false,planeSize:1000,easing:'linear' }
const globeThumb = 'radial-gradient(circle at 50% 50%,transparent 0 17%,#d8d8d8 18% 22%,transparent 23% 31%,#aaa 32% 36%,transparent 37%),#090909'
const globePresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01',{},[.25,.25,.75,.75]],
  ['02',{ globeAxis:'x',cycles:6,cycleDegrees:60,orbitRadius:300,secondsPerSlide:1,globeMaxScale:22 },[.8,.27,.2,.75]],
  ['03',{ globeAxis:'z',orbitRadius:890,distance:900,secondsPerSlide:15,globeMaxScale:22,globeMinScale:3,perspective:150 },[.25,.25,.75,.75]],
  ['04',{ fade:23,orbitRadius:480,distance:750,secondsPerSlide:10,globeMaxScale:6,globeMinScale:2,reverse:true,perspective:135 },[.25,.25,.75,.75]],
  ['05',{ visibleCount:60,fade:40,orbitRadius:480,distance:1250,secondsPerSlide:10,globeMaxScale:10.5,globeMinScale:6,reverse:true,perspective:110,globeFaceCamera:false },[.25,.25,.75,.75]],
  ['06',{ visibleCount:60,orbitRadius:505,distance:0,secondsPerSlide:15,globeMaxScale:12,globeMinScale:7,reverse:true,perspective:145,globeFaceCamera:false,globeFlipImage:true },[.25,.25,.75,.75]],
  ['07',{ visibleCount:60,fade:44,orbitRadius:800,distance:4450,secondsPerSlide:15,globeMaxScale:15.46,globeMinScale:.01,perspective:35,globeFaceCamera:false,globeShowBackfaces:false },[.25,.25,.75,.75]],
  ['08',{ visibleCount:60,fade:15,cycles:2,cycleDegrees:180,orbitRadius:480,distance:650,secondsPerSlide:5,globeMaxScale:6,globeMinScale:1.5,perspective:150 },[.86,.14,.14,.86]],
  ['09',{ cycles:2,orbitRadius:580,distance:2000,secondsPerSlide:5,globeMaxScale:51.5,globeMinScale:14,reverse:true,perspective:135,globeShowBackfaces:false },[.7,.101,.3,.899]],
  ['10',{ visibleCount:10,cycles:6,cycleDegrees:60,orbitRadius:480,distance:650,secondsPerSlide:1.5,globeMaxScale:20,globeMinScale:5,reverse:true,perspective:150 },[.8,.27,.2,.75]],
  ['11',{ globeMotion:'stepped',globeStops:8,orbitRadius:595,distance:1000,secondsPerSlide:15,globeMaxScale:33.09,globeMinScale:.01,reverse:true,perspective:90,globeFaceCamera:false },[.33,0,0,1]],
  ['12',{ visibleCount:30,globeAxis:'x',fade:26,globeMotion:'stepped',globeStops:6,orbitRadius:595,distance:1000,secondsPerSlide:15,globeMaxScale:33.09,globeMinScale:.01,perspective:90 },[.87,0,.13,1]],
  ['13',{ visibleCount:16,globeAxis:'x',fade:26,globeMotion:'stepped',globeStops:6,orbitRadius:595,distance:1000,secondsPerSlide:15,globeMaxScale:44.79,globeMinScale:4.4,perspective:85 },[.87,0,.13,1]],
  ['14',{ visibleCount:41,globeMotion:'stepped',globeStops:6,orbitRadius:905,distance:150,secondsPerSlide:15,globeMaxScale:66.06,globeMinScale:19.59,perspective:105 },[.87,0,.13,1]],
  ['15',{ visibleCount:60,globeMotion:'stepped',globeStops:6,orbitRadius:165,distance:150,secondsPerSlide:12,globeMaxScale:23.99,globeMinScale:6.73,perspective:160 },[.76,0,.24,1]],
  ['16',{ fade:23,globeMotion:'continuous',globeStops:8,orbitRadius:480,distance:750,secondsPerSlide:10,globeMaxScale:13.77,globeMinScale:1.19,reverse:true,rotationZ:33,perspective:135 },[.25,.25,.75,.75]]
]
const globePresets: VideoTemplate[] = globePresetDefinitions.map(([number,settings,bezier]) => ({ id:`globe-${number}`,name:`Globe ${number}`,description:'Editable spherical image globe.',renderer:'webgl',collection:'globe',thumbnail:globeThumb,bezier,preset:{...globeDefaults,...settings} }))

const scaleDefaults: Partial<VideoComposerSettings> = { visibleCount:10,loop:true,secondsPerSlide:2,planeSize:100,cornerRadius:0,spin:0,staggerSeconds:.4,scaleStyle:'bloom',growFrom:'center',imageFit:'fit',offsetX:0,offsetY:0 }
const scaleThumbs = [
  'radial-gradient(circle at 50% 50%,#d8d8d8 0 18%,#aaa 19% 31%,#777 32% 42%,transparent 43%),#090909',
  'radial-gradient(circle at 50% 50%,transparent 0 18%,#777 19% 31%,#aaa 32% 42%,#d8d8d8 43% 55%,transparent 56%),#090909',
  'conic-gradient(from -45deg at 50% 50%,transparent 0 12%,#d8d8d8 13% 37%,transparent 38% 62%,#aaa 63% 87%,transparent 88%),#090909',
  'linear-gradient(0deg,#d8d8d8 0 42%,transparent 43%),radial-gradient(circle at 50% 75%,#aaa 0 28%,transparent 29%),#090909'
]
const scalePresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01',{},[0,0,0,.99]],
  ['02',{ scaleStyle:'recede' },[0,0,0,.99]],
  ['03',{ spin:-45,scaleStyle:'bloom',planeSize:70 },[.16,1,.3,1]],
  ['04',{ staggerSeconds:.6,secondsPerSlide:4,growFrom:'bottom',scaleStyle:'bloom' },[.87,0,.13,1]]
]
const scalePresets: VideoTemplate[] = scalePresetDefinitions.map(([number,settings,bezier],index) => ({ id:`scale-${number}`,name:`Scale ${number}`,description:'Editable scale preset.',renderer:'canvas-2d',collection:'scale',thumbnail:scaleThumbs[index]!,bezier,preset:{...scaleDefaults,...settings} }))

const storiesDefaults: Partial<VideoComposerSettings> = { visibleCount:8,cycles:1,loop:true,secondsPerSlide:13.3,delaySeconds:.33,direction:'right',cornerRadius:6,offsetX:0,offsetY:0,storiesBigScale:115,storiesBigDrift:40,storiesThumbSize:85,storiesThumbAspect:'1:1',storiesContainerOpacity:40,storiesContainerBlur:60,storiesSelectorPad:5,storiesSelectorStroke:2,storiesDimAmount:20,easing:'smooth' }
const storiesPresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01',{},[.76,0,.24,1]],
  ['02',{ visibleCount:7,storiesThumbSize:100,storiesThumbAspect:'3:4',storiesDimAmount:38 },[.76,0,.24,1]],
  ['03',{ visibleCount:9,delaySeconds:0,direction:'down',cornerRadius:0,storiesDimAmount:40,storiesContainerOpacity:0,storiesContainerBlur:0,storiesSelectorPad:5.5,storiesSelectorStroke:1.5 },[.76,0,.24,1]],
  ['04',{ visibleCount:5,delaySeconds:0,direction:'right',cornerRadius:0,storiesThumbAspect:'3:4',storiesDimAmount:50,storiesContainerOpacity:0,storiesContainerBlur:0,storiesSelectorPad:0,storiesSelectorStroke:0,easing:'flow' },[.33,0,0,1]]
]
const storiesPresets: VideoTemplate[] = storiesPresetDefinitions.map(([number,settings,bezier]) => ({ id:`stories-${number}`,name:`Stories ${number}`,description:'Editable stories selector preset.',renderer:'canvas-2d',collection:'stories',thumbnail:'linear-gradient(90deg,transparent 8%,#777 8% 92%,transparent 92%),linear-gradient(90deg,#d8d8d8 0 18%,transparent 18% 22%,#aaa 22% 40%,transparent 40% 44%,#777 44% 62%,transparent 62%),#090909',bezier,preset:{...storiesDefaults,...settings} }))

const flickerDefaults: Partial<VideoComposerSettings> = { visibleCount:6,delaySeconds:0,cycles:1,loop:true,flickerEffect:'off',flickerPacing:'equal',offsetX:0,offsetY:0,driftDirection:'up',secondsPerSlide:6,scaleDirection:'forward',planeSize:100,driftAmount:30,scaleAmount:30,cornerRadius:0,fit:'cover',easing:'smooth' }
const flickerPresetDefinitions: Array<readonly [string, Partial<VideoComposerSettings>, readonly [number,number,number,number]]> = [
  ['01',{ planeSize:70,secondsPerSlide:4,fit:'contain' },[.25,.25,.75,.75]],
  ['02',{ visibleCount:12,cycles:2,flickerPacing:'eased',secondsPerSlide:4,planeSize:73 },[.7,.101,.3,.899]],
  ['03',{ flickerEffect:'scale',planeSize:118,scaleAmount:15 },[.86,.14,.14,.86]],
  ['04',{ flickerEffect:'drift',planeSize:107,driftAmount:7 },[.86,.14,.14,.86]],
  ['05',{ flickerEffect:'drift',driftDirection:'left',planeSize:107,driftAmount:7 },[.86,.14,.14,.86]],
  ['06',{ flickerEffect:'drift',secondsPerSlide:8,planeSize:63,driftAmount:80 },[.86,.14,.14,.86]],
  ['07',{ flickerEffect:'drift',driftDirection:'left',secondsPerSlide:8,planeSize:63,driftAmount:100 },[.86,.14,.14,.86]],
  ['08',{ flickerEffect:'scale',driftDirection:'left',secondsPerSlide:8,scaleDirection:'reverse',planeSize:63,driftAmount:40,scaleAmount:40 },[.86,.14,.14,.86]],
  ['09',{ flickerEffect:'scale',driftDirection:'left',secondsPerSlide:8,planeSize:63,driftAmount:40,scaleAmount:40 },[.86,.14,.14,.86]],
  ['10',{ flickerEffect:'scale',driftDirection:'left',secondsPerSlide:3,scaleDirection:'reverse',planeSize:63,driftAmount:40,scaleAmount:5 },[.86,.14,.14,.86]]
]
const flickerPresets: VideoTemplate[] = flickerPresetDefinitions.map(([number,settings,bezier]) => ({ id:`flicker-${number}`,name:`One Shot ${number}`,description:'Editable one-shot preset.',renderer:'canvas-2d',collection:'flicker',thumbnail:'linear-gradient(135deg,transparent 12%,#d8d8d8 13% 87%,transparent 88%),#090909',bezier,preset:{...flickerDefaults,...settings} }))

const testDefaults: Partial<VideoComposerSettings> = {...flickerDefaults,flickerEffect:'flip',fit:'contain',direction:'left',visibleCount:6,secondsPerSlide:6,planeSize:80,perspective:100,easing:'sweep',flipMaterial:'lit',flipLightIntensity:200,lightX:-3,lightY:4,lightZ:5,flipRoughness:72,flipGridColumns:1,flipGridRows:1,flipGridGap:4,flipStagger:0,flipShuffle:false}
const testPresets: VideoTemplate[] = [
  { id:'test-01',name:'Flip 01',description:'Experimental two-sided WebGL flip.',renderer:'webgl',collection:'test',thumbnail:'linear-gradient(90deg,transparent 18%,#d8d8d8 19% 48%,#aaa 49% 78%,transparent 79%),#090909',preset:testDefaults },
  { id:'test-02',name:'Grid Flip 01',description:'Staggered WebGL flip grid.',renderer:'webgl',collection:'test',thumbnail:'linear-gradient(90deg,transparent 7%,#d8d8d8 8% 47%,transparent 48% 52%,#aaa 53% 92%,transparent 93%),linear-gradient(0deg,transparent 49%,#090909 50% 52%,transparent 53%),#090909',preset:{...testDefaults,visibleCount:12,flipGridColumns:2,flipGridRows:2,flipGridGap:5,flipStagger:.12,easing:'sweep'} }
]

const swipeDepthDefaults: Partial<VideoComposerSettings> = { visibleCount:6,cycles:1,loop:true,direction:'left',swipeAlternating:true,secondsPerSlide:6,planeSize:520,gap:90,distance:85,perspective:100,cornerRadius:0,fade:30,tilt:7,offsetX:0,offsetY:0,easing:'sweep',scaleCenter:false,solo:false }
const swipeDepthPresets: VideoTemplate[] = [
  { id:'swipe-depth-01',name:'Swipe Depth 01',description:'WebGL depth row with sequential swipe transitions.',renderer:'webgl',collection:'swipe-depth',thumbnail:'linear-gradient(145deg,transparent 18%,#777 19% 35%,transparent 36% 40%,#aaa 41% 61%,transparent 62% 66%,#d8d8d8 67% 88%,transparent 89%),#090909',bezier:[.76,0,.24,1],preset:swipeDepthDefaults }
]

export const videoTemplates: VideoTemplate[] = [
  ...flickerPresets,
  ...carouselPresets,
  ...carousel3dPresets,
  ...gridPresets,
  ...orbitPresets,
  ...globePresets,
  ...scalePresets,
  ...storiesPresets,
  ...testPresets,
  ...swipeDepthPresets
]
