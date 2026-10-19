import * as THREE from 'three'

const DEBUG_WATER_MASK = import.meta.env.DEV && false
const DEBUG_GOD_RAYS = import.meta.env.DEV && false
const DEBUG_GOD_RAY_SOURCE = import.meta.env.DEV && false
const DEBUG_CLICK_RIPPLE = import.meta.env.DEV && false

const ARTWORK_URL = '/torii/materials/tori.webp'
const WATER_MASK_URL = '/torii/materials/masks/waterripple_mask_18b8bfc2.webp'
const RIPPLE_NORMAL_URL = '/torii/materials/effects/waterripplenormal.webp'

const CLICK_RIPPLE_STRENGTH = 2.5
const CLICK_RIPPLE_BASE_DISPLACEMENT = 0.0022
const CLICK_RIPPLE_LIFETIME = 2.2
const CLICK_RIPPLE_SPEED = 0.26
const IMPACT_DURATION = 0.35
const ARTWORK_FADE_IN_DURATION = 1.0

const CLICK_RIPPLE = {
  count: 3,
  hitThreshold: 0.18,
}

const PARALLAX = {
  maxYaw: THREE.MathUtils.degToRad(0.6),
  maxPitch: THREE.MathUtils.degToRad(0.35),
  deadzone: 0.10,
  springStiffness: 55,
  springDamping: 12,
}

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const waterFragmentShader = /* glsl */ `
  uniform sampler2D uArtwork;
  uniform sampler2D uRippleNormal;
  uniform sampler2D uRippleMask;
  uniform float uTime;
  uniform float uStrength;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uRatio;
  uniform float uImageAspect;
  uniform float uDebugWaterMask;
  uniform vec2 uClickRipplePositions[3];
  uniform float uClickRippleAges[3];
  uniform float uClickRippleStrength;
  uniform float uClickRippleLifetime;
  uniform float uClickRippleSpeed;
  uniform float uImpactDuration;

  varying vec2 vUv;

  void main() {
    float animationOffset = uTime * uSpeed * uSpeed;
    vec2 uv1 = (vUv + vec2(animationOffset)) * uScale;
    vec2 uv2 = (vUv * 1.333 - vec2(animationOffset)) * uScale;
    uv1 *= vec2(uImageAspect, uRatio);
    uv2 *= vec2(uImageAspect, uRatio);

    vec3 normal1 = texture2D(uRippleNormal, uv1).xyz * 2.0 - 1.0;
    vec3 normal2 = texture2D(uRippleNormal, uv2).xyz * 2.0 - 1.0;
    vec3 normal = normalize(vec3(normal1.xy + normal2.xy, normal1.z));
    float mask = texture2D(uRippleMask, vUv).r;

    vec2 clickRippleOffset = vec2(0.0);
    for (int i = 0; i < 3; i++) {
      float age = uClickRippleAges[i];
      if (age >= 0.0) {
        vec2 deltaUv = vUv - uClickRipplePositions[i];
        vec2 aspectDelta = deltaUv * vec2(uImageAspect, 1.0);
        float distanceFromClick = max(length(aspectDelta), 0.00001);
        float radius = 0.01 + age * uClickRippleSpeed;
        float firstRing = exp(-pow((distanceFromClick - radius) / 0.022, 2.0));
        float secondRing = exp(-pow((distanceFromClick - radius + 0.065) / 0.022, 2.0));
        float thirdRing = exp(-pow((distanceFromClick - radius + 0.13) / 0.022, 2.0));
        float ringWave = firstRing - secondRing * 0.55 + thirdRing * 0.30;
        float ageFade = exp(-age * 0.75) * (1.0 - smoothstep(uClickRippleLifetime * 0.68, uClickRippleLifetime, age));
        float impactFade = 1.0 - smoothstep(uImpactDuration * 0.45, uImpactDuration, age);
        float impactBand = exp(-pow((distanceFromClick - 0.012) / 0.022, 2.0));
        float impact = -impactBand * impactFade * 0.85;
        vec2 radialDirection = aspectDelta / distanceFromClick;
        vec2 radialUv = radialDirection * vec2(1.0 / uImageAspect, 1.0);
        clickRippleOffset += radialUv * (ringWave * ageFade + impact) * uClickRippleStrength;
      }
    }

    if (uDebugWaterMask > 0.5) {
      gl_FragColor = vec4(vec3(mask), 1.0);
    } else {
      vec2 distortedUv = vUv + normal.xy * uStrength * uStrength * mask + clickRippleOffset * mask;
      gl_FragColor = texture2D(uArtwork, distortedUv);
    }
  }
`

const godRaySourceFragmentShader = /* glsl */ `
  uniform sampler2D uWaterArtwork;
  uniform float uTime;
  uniform float uNoiseAmount;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uNoiseSmoothness;
  uniform float uThreshold;

  varying vec2 vUv;

  float hashNoise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hashNoise(cell);
    float b = hashNoise(cell + vec2(1.0, 0.0));
    float c = hashNoise(cell + vec2(0.0, 1.0));
    float d = hashNoise(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float cloudNoise(vec2 p) {
    // Wallpaper Engine's built-in util/clouds_256 texture is not included in this export.
    return valueNoise(p * 6.0);
  }

  void main() {
    vec4 source = texture2D(uWaterArtwork, vUv);
    vec3 premultipliedSource = source.rgb * source.a;
    float brightness = dot(premultipliedSource, vec3(0.11, 0.59, 0.3));
    float thresholded = step(uThreshold, brightness);

    vec2 noiseUv1 = (vUv + vec2(uTime * uNoiseSpeed)) * uNoiseScale;
    vec2 noiseUv2 = (
      vec2(-vUv.x, vUv.y) * 0.633 +
      vec2(uTime, -uTime) * 0.5 * uNoiseSpeed
    ) * uNoiseScale;
    float noiseSample = cloudNoise(noiseUv1) * cloudNoise(noiseUv2);
    noiseSample = mix(1.0, noiseSample, uNoiseAmount);

    float noiseAlpha = smoothstep(
      0.5 - uNoiseSmoothness,
      0.5 + uNoiseSmoothness,
      noiseSample
    );
    gl_FragColor = vec4(premultipliedSource * thresholded, thresholded * noiseAlpha);
  }
`

const godRayCastFragmentShader = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uLightUv;
  uniform float uRayLength;
  uniform float uRayIntensity;

  varying vec2 vUv;

  void main() {
    vec2 direction = uLightUv - vUv;
    float distanceToLight = length(direction);
    direction /= max(distanceToLight, 0.00001);
    distanceToLight *= uRayLength;

    vec2 sampleUv = vUv + direction * distanceToLight;
    vec2 sampleStep = direction * distanceToLight / 29.0;
    vec4 accumulated = vec4(0.0);

    for (int i = 0; i < 30; i++) {
      vec4 sampleColor = texture2D(uSource, sampleUv);
      sampleUv -= sampleStep;
      accumulated += sampleColor * (float(i) / 29.0);
    }

    float sampleIntensity = 0.1;
    gl_FragColor = vec4(
      uRayIntensity * sampleIntensity * accumulated.rgb,
      clamp(uRayIntensity * sampleIntensity * accumulated.a, 0.0, 1.0)
    );
  }
`

const gaussianBlurFragmentShader = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uTexelStep;

  varying vec2 vUv;

  void main() {
    // Four bilinear samples reproduce Wallpaper Engine's optimized 7-tap blur kernel.
    vec2 offset1 = 2.3515644035 * uTexelStep;
    vec2 offset2 = 0.4694337797 * uTexelStep;
    vec2 offset3 = 1.4091998771 * uTexelStep;
    vec2 offset4 = 3.0 * uTexelStep;
    vec4 color = texture2D(uSource, vUv + offset1) * 0.2028175528;
    color += texture2D(uSource, vUv + offset2) * 0.4044856615;
    color += texture2D(uSource, vUv - offset3) * 0.3213933537;
    color += texture2D(uSource, vUv - offset4) * 0.0713034320;
    gl_FragColor = color;
  }
`

const combineFragmentShader = /* glsl */ `
  uniform sampler2D uWaterArtwork;
  uniform sampler2D uRays;

  varying vec2 vUv;

  void main() {
    vec4 base = texture2D(uWaterArtwork, vUv);
    vec4 rays = texture2D(uRays, vUv);
    // common_blending.h is engine-provided; its default mode 9 is approximated by screen blending.
    vec3 screenBlend = 1.0 - (1.0 - base.rgb) * (1.0 - rays.rgb);
    vec3 combined = mix(base.rgb, screenBlend, clamp(rays.a, 0.0, 1.0));
    gl_FragColor = vec4(combined, base.a);
  }
`

let cleanupCurrentArtwork = null

function createRenderTarget(width = 1, height = 1) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.colorSpace = THREE.NoColorSpace
  target.texture.generateMipmaps = false
  target.texture.wrapS = THREE.ClampToEdgeWrapping
  target.texture.wrapT = THREE.ClampToEdgeWrapping
  return target
}

function makeFullscreenMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

function cacheWaterMaskPixels(image) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) return null

  const scratchCanvas = document.createElement('canvas')
  scratchCanvas.width = width
  scratchCanvas.height = height
  const context = scratchCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  try {
    context.drawImage(image, 0, 0, width, height)
    const rgba = context.getImageData(0, 0, width, height).data
    const red = new Uint8Array(width * height)
    for (let pixel = 0; pixel < red.length; pixel++) red[pixel] = rgba[pixel * 4]
    scratchCanvas.width = 0
    scratchCanvas.height = 0
    return { width, height, red }
  } catch {
    scratchCanvas.width = 0
    scratchCanvas.height = 0
    return null
  }
}

function sampleWaterMask(mask, uv) {
  if (!mask) return 0
  const x = THREE.MathUtils.clamp(uv.x, 0, 1) * (mask.width - 1)
  const y = (1 - THREE.MathUtils.clamp(uv.y, 0, 1)) * (mask.height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, mask.width - 1)
  const y1 = Math.min(y0 + 1, mask.height - 1)
  const tx = x - x0
  const ty = y - y0
  const top = THREE.MathUtils.lerp(mask.red[y0 * mask.width + x0], mask.red[y0 * mask.width + x1], tx)
  const bottom = THREE.MathUtils.lerp(mask.red[y1 * mask.width + x0], mask.red[y1 * mask.width + x1], tx)
  return THREE.MathUtils.lerp(top, bottom, ty) / 255
}

function mountArtwork() {
  cleanupCurrentArtwork?.()
  cleanupCurrentArtwork = null

  const host = document.querySelector('[data-torii-artwork]')
  const canvas = host?.querySelector('[data-torii-canvas]')
  if (!host || !canvas) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarsePointer = window.matchMedia('(pointer: coarse)')
  const scene = new THREE.Scene()
  scene.background = null

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0x000000, 0)

  const artworkGeometry = new THREE.PlaneGeometry(16 / 9, 1)
  const fullscreenGeometry = new THREE.PlaneGeometry(2, 2)
  const fullscreenScene = new THREE.Scene()
  const fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const fullscreenQuad = new THREE.Mesh(fullscreenGeometry, null)
  fullscreenQuad.frustumCulled = false
  fullscreenScene.add(fullscreenQuad)

  const waterTarget = createRenderTarget()
  const sourceTarget = createRenderTarget()
  const castTarget = createRenderTarget()
  const blurHorizontalTarget = createRenderTarget()
  const blurVerticalTarget = createRenderTarget()
  const combinedTarget = createRenderTarget()

  let artwork = null
  let outputMaterial = null
  let fadeTime = 0
  let artworkTexture = null
  let rippleMaskTexture = null
  let rippleNormalTexture = null
  let waterMaterial = null
  let sourceMaterial = null
  let castMaterial = null
  let blurMaterial = null
  let combineMaterial = null
  let frame = 0
  let loading = false
  let loaded = false
  let pipelineReady = false
  let disposed = false
  let isIntersecting = false
  let visible = false
  let animationTime = 0
  let lastFrameTime = null
  let targetWidth = 1
  let targetHeight = 1
  const loadedTextureKinds = new Set()

  const drawingBufferSize = new THREE.Vector2()
  const blurStep = new THREE.Vector2()
  const originalQuaternion = camera.quaternion.clone()
  const currentQuaternion = originalQuaternion.clone()
  const pointerRotation = new THREE.Quaternion()
  const pointerEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  const springPosition = new THREE.Vector2()
  const springVelocity = new THREE.Vector2()
  const springTarget = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const ripplePositions = Array.from({ length: CLICK_RIPPLE.count }, () => new THREE.Vector2(-1, -1))
  const rippleAges = new Float32Array(CLICK_RIPPLE.count)
  rippleAges.fill(-1)
  const clickRipples = ripplePositions.map((position) => ({ position, age: -1 }))
  let rippleMaskPixels = null
  let nextRippleIndex = 0
  const lightUv = new THREE.Vector2(0.5, 0.5)
  const rayResolution = new THREE.Vector2(1, 1)

  const updateRenderTargetSizes = () => {
    renderer.getDrawingBufferSize(drawingBufferSize)
    const fittedWidth = Math.min(drawingBufferSize.x, drawingBufferSize.y * (16 / 9))
    const fittedHeight = fittedWidth / (16 / 9)
    targetWidth = Math.max(1, Math.floor(fittedWidth))
    targetHeight = Math.max(1, Math.floor(fittedHeight))
    const halfWidth = Math.max(1, Math.ceil(targetWidth * 0.5))
    const halfHeight = Math.max(1, Math.ceil(targetHeight * 0.5))

    waterTarget.setSize(targetWidth, targetHeight)
    combinedTarget.setSize(targetWidth, targetHeight)
    for (const target of [sourceTarget, castTarget, blurHorizontalTarget, blurVerticalTarget]) {
      target.setSize(halfWidth, halfHeight)
    }

    rayResolution.set(halfWidth, halfHeight)
    if (blurMaterial) {
      blurStep.set(1 / halfWidth, 0)
      blurMaterial.uniforms.uTexelStep.value.copy(blurStep)
    }
  }

  const easePointer = (value) => {
    const magnitude = Math.abs(value)
    if (magnitude <= PARALLAX.deadzone) return 0
    const progress = (magnitude - PARALLAX.deadzone) / (1 - PARALLAX.deadzone)
    return Math.sign(value) * progress * progress * (3 - 2 * progress)
  }

  const advanceSpring = (axis, target, delta) => {
    const position = springPosition.getComponent(axis)
    const velocity = springVelocity.getComponent(axis)
    const error = position - target
    const halfDamping = PARALLAX.springDamping * 0.5
    const discriminant = PARALLAX.springStiffness - halfDamping * halfDamping
    let nextError
    let nextVelocity

    if (discriminant > 0.0001) {
      const dampedFrequency = Math.sqrt(discriminant)
      const decay = Math.exp(-halfDamping * delta)
      const cosine = Math.cos(dampedFrequency * delta)
      const sine = Math.sin(dampedFrequency * delta)
      const sineCoefficient = (velocity + halfDamping * error) / dampedFrequency
      nextError = decay * (error * cosine + sineCoefficient * sine)
      nextVelocity = decay * (
        -halfDamping * (error * cosine + sineCoefficient * sine) +
        dampedFrequency * (-error * sine + sineCoefficient * cosine)
      )
    } else if (discriminant >= -0.0001) {
      const decay = Math.exp(-halfDamping * delta)
      const coefficient = velocity + halfDamping * error
      nextError = (error + coefficient * delta) * decay
      nextVelocity = (velocity - halfDamping * coefficient * delta) * decay
    } else {
      const root = Math.sqrt(-discriminant)
      const firstRoot = -halfDamping + root
      const secondRoot = -halfDamping - root
      const firstCoefficient = (velocity - secondRoot * error) / (firstRoot - secondRoot)
      const secondCoefficient = (firstRoot * error - velocity) / (firstRoot - secondRoot)
      const firstTerm = firstCoefficient * Math.exp(firstRoot * delta)
      const secondTerm = secondCoefficient * Math.exp(secondRoot * delta)
      nextError = firstTerm + secondTerm
      nextVelocity = firstRoot * firstTerm + secondRoot * secondTerm
    }

    springPosition.setComponent(axis, target + nextError)
    springVelocity.setComponent(axis, nextVelocity)
  }

  const updateParallax = (delta) => {
    advanceSpring(0, springTarget.x, delta)
    advanceSpring(1, springTarget.y, delta)

    if (Math.abs(springTarget.x - springPosition.x) < 0.00001 && Math.abs(springVelocity.x) < 0.0001) {
      springPosition.x = springTarget.x
      springVelocity.x = 0
    }
    if (Math.abs(springTarget.y - springPosition.y) < 0.00001 && Math.abs(springVelocity.y) < 0.0001) {
      springPosition.y = springTarget.y
      springVelocity.y = 0
    }

    pointerEuler.set(
      springPosition.y * PARALLAX.maxPitch,
      -springPosition.x * PARALLAX.maxYaw,
      0,
      'YXZ',
    )
    pointerRotation.setFromEuler(pointerEuler)
    currentQuaternion.copy(pointerRotation).multiply(originalQuaternion)
    camera.quaternion.copy(currentQuaternion)
  }

  const isParallaxMoving = () => (
    Math.abs(springTarget.x - springPosition.x) >= 0.00001 ||
    Math.abs(springTarget.y - springPosition.y) >= 0.00001 ||
    Math.abs(springVelocity.x) >= 0.0001 ||
    Math.abs(springVelocity.y) >= 0.0001
  )

  const resetParallax = () => {
    springTarget.set(0, 0)
    springPosition.set(0, 0)
    springVelocity.set(0, 0)
    currentQuaternion.copy(originalQuaternion)
    camera.quaternion.copy(originalQuaternion)
  }

  const renderToTarget = (material, target) => {
    fullscreenQuad.material = material
    renderer.setRenderTarget(target)
    renderer.render(fullscreenScene, fullscreenCamera)
  }

  const renderPipeline = () => {
    waterMaterial.uniforms.uTime.value = animationTime
    renderToTarget(waterMaterial, waterTarget)
    if (DEBUG_WATER_MASK) return

    sourceMaterial.uniforms.uTime.value = animationTime
    renderToTarget(sourceMaterial, sourceTarget)

    castMaterial.uniforms.uSource.value = sourceTarget.texture
    renderToTarget(castMaterial, castTarget)

    blurMaterial.uniforms.uSource.value = castTarget.texture
    blurStep.set(1 / rayResolution.x, 0)
    blurMaterial.uniforms.uTexelStep.value.copy(blurStep)
    renderToTarget(blurMaterial, blurHorizontalTarget)

    blurMaterial.uniforms.uSource.value = blurHorizontalTarget.texture
    blurStep.set(0, 1 / rayResolution.y)
    blurMaterial.uniforms.uTexelStep.value.copy(blurStep)
    renderToTarget(blurMaterial, blurVerticalTarget)

    combineMaterial.uniforms.uWaterArtwork.value = waterTarget.texture
    combineMaterial.uniforms.uRays.value = blurVerticalTarget.texture
    renderToTarget(combineMaterial, combinedTarget)
  }

  const updateClickRipples = (delta) => {
    for (let index = 0; index < clickRipples.length; index++) {
      const ripple = clickRipples[index]
      if (ripple.age < 0) continue
      ripple.age += delta
      if (ripple.age >= CLICK_RIPPLE_LIFETIME) {
        ripple.age = -1
        rippleAges[index] = -1
      } else {
        rippleAges[index] = ripple.age
      }
    }
  }

  const renderFrame = (timestamp) => {
    frame = 0
    if (disposed || !visible || !loaded) return

    const animate = !reduceMotion.matches && !DEBUG_WATER_MASK
    const delta = lastFrameTime === null
      ? 0
      : Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp
    if (animate) animationTime += delta
    if (animate) updateClickRipples(delta)
    if (!reduceMotion.matches) updateParallax(delta)

    if (pipelineReady) renderPipeline()
    if (!reduceMotion.matches && fadeTime < ARTWORK_FADE_IN_DURATION) {
      fadeTime = Math.min(fadeTime + delta, ARTWORK_FADE_IN_DURATION)
    }
    const fadeProgress = reduceMotion.matches ? 1 : fadeTime / ARTWORK_FADE_IN_DURATION
    outputMaterial.opacity = 1 - (1 - fadeProgress) ** 3

    renderer.setRenderTarget(null)
    renderer.render(scene, camera)

    const fading = !reduceMotion.matches && fadeTime < ARTWORK_FADE_IN_DURATION
    const parallaxIsMoving = !reduceMotion.matches && isParallaxMoving()
    if (visible && ((animate && pipelineReady) || parallaxIsMoving || fading)) {
      frame = requestAnimationFrame(renderFrame)
    } else {
      lastFrameTime = null
    }
  }

  const requestRender = () => {
    if (visible && loaded && !disposed && frame === 0) {
      frame = requestAnimationFrame(renderFrame)
    }
  }

  const resize = () => {
    const rect = host.getBoundingClientRect()
    const nextWidth = Math.floor(rect.width)
    const nextHeight = Math.floor(rect.height)
    if (!nextWidth || !nextHeight) return

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(nextWidth, nextHeight, false)
    camera.aspect = nextWidth / nextHeight
    camera.updateProjectionMatrix()
    updateRenderTargetSizes()

    if (artwork) {
      const viewHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const viewWidth = viewHeight * camera.aspect
      const fitHeight = Math.min(viewHeight, viewWidth / (16 / 9))
      artwork.scale.setScalar(fitHeight * 1.2)
    }
    requestRender()
  }

  const setupPipeline = () => {
    if (
      pipelineReady ||
      !loadedTextureKinds.has('artwork') ||
      !loadedTextureKinds.has('rippleMask') ||
      !loadedTextureKinds.has('rippleNormal') ||
      !artwork
    ) return

    const artworkWidth = artworkTexture.image.naturalWidth || artworkTexture.image.width
    const artworkHeight = artworkTexture.image.naturalHeight || artworkTexture.image.height
    waterMaterial = makeFullscreenMaterial(waterFragmentShader, {
      uArtwork: { value: artworkTexture },
      uRippleNormal: { value: rippleNormalTexture },
      uRippleMask: { value: rippleMaskTexture },
      uTime: { value: 0 },
      uStrength: { value: 0.079999998 },
      uSpeed: { value: 0.13 },
      uScale: { value: 1.04 },
      uRatio: { value: 1.0 },
      uImageAspect: { value: artworkWidth / artworkHeight },
      uDebugWaterMask: { value: DEBUG_WATER_MASK ? 1 : 0 },
      uClickRipplePositions: { value: ripplePositions },
      uClickRippleAges: { value: rippleAges },
      uClickRippleStrength: {
        value: CLICK_RIPPLE_BASE_DISPLACEMENT * CLICK_RIPPLE_STRENGTH * (DEBUG_CLICK_RIPPLE ? 6 : 1),
      },
      uClickRippleLifetime: { value: CLICK_RIPPLE_LIFETIME },
      uClickRippleSpeed: { value: CLICK_RIPPLE_SPEED },
      uImpactDuration: { value: IMPACT_DURATION },
    })
    sourceMaterial = makeFullscreenMaterial(godRaySourceFragmentShader, {
      uWaterArtwork: { value: waterTarget.texture },
      uTime: { value: 0 },
      uNoiseAmount: { value: 0.40000001 },
      uNoiseScale: { value: 3.0 },
      uNoiseSpeed: { value: 0.15000001 },
      uNoiseSmoothness: { value: 0.2 },
      uThreshold: { value: 0.5 },
    })
    castMaterial = makeFullscreenMaterial(godRayCastFragmentShader, {
      uSource: { value: sourceTarget.texture },
      uLightUv: { value: lightUv },
      uRayLength: { value: 1.0 },
      uRayIntensity: { value: 0.5 },
    })
    blurMaterial = makeFullscreenMaterial(gaussianBlurFragmentShader, {
      uSource: { value: castTarget.texture },
      uTexelStep: { value: blurStep },
    })
    combineMaterial = makeFullscreenMaterial(combineFragmentShader, {
      uWaterArtwork: { value: waterTarget.texture },
      uRays: { value: blurVerticalTarget.texture },
    })

    outputMaterial.map = DEBUG_WATER_MASK
      ? waterTarget.texture
      : DEBUG_GOD_RAY_SOURCE
      ? sourceTarget.texture
      : DEBUG_GOD_RAYS
        ? blurVerticalTarget.texture
        : combinedTarget.texture
    outputMaterial.needsUpdate = true
    pipelineReady = true
    requestRender()
  }

  const textureLoader = new THREE.TextureLoader()
  const configureTexture = (texture, kind) => {
    if (kind === 'artwork') {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
    } else {
      texture.colorSpace = THREE.NoColorSpace
      texture.generateMipmaps = false
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      if (kind === 'rippleNormal') {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
      } else {
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
      }
    }
  }

  const loadTexture = (kind, url, onLoad) => {
    const texture = textureLoader.load(url, (loadedTexture) => {
      if (disposed) return
      configureTexture(loadedTexture, kind)
      loadedTextureKinds.add(kind)
      if (import.meta.env.DEV) console.info(`Loaded torii ${kind}: ${url}`)
      onLoad(loadedTexture)
    }, undefined, (error) => {
      if (!disposed) console.warn(`Could not load torii ${kind} (${url}):`, error)
    })
    configureTexture(texture, kind)
    return texture
  }

  const loadArtwork = () => {
    if (loading || loaded || disposed) return
    loading = true

    artworkTexture = loadTexture('artwork', ARTWORK_URL, (texture) => {
      artworkTexture = texture
      outputMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, opacity: 0 })
      artwork = new THREE.Mesh(artworkGeometry, outputMaterial)
      scene.add(artwork)
      loaded = true
      resize()
      if (rippleMaskTexture?.image && rippleNormalTexture?.image) setupPipeline()
      requestRender()
    })
    rippleMaskTexture = loadTexture('rippleMask', WATER_MASK_URL, (texture) => {
      rippleMaskTexture = texture
      rippleMaskPixels = cacheWaterMaskPixels(texture.image)
      setupPipeline()
    })
    rippleNormalTexture = loadTexture('rippleNormal', RIPPLE_NORMAL_URL, (texture) => {
      rippleNormalTexture = texture
      setupPipeline()
    })

  }

  const handlePointerMove = (event) => {
    if (reduceMotion.matches || coarsePointer.matches || event.pointerType === 'touch') return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const normalizedX = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    const normalizedY = THREE.MathUtils.clamp(1 - ((event.clientY - rect.top) / rect.height) * 2, -1, 1)
    springTarget.set(easePointer(normalizedX), easePointer(normalizedY))
    requestRender()
  }

  const handlePointerDown = (event) => {
    if (
      reduceMotion.matches ||
      !pipelineReady ||
      !artwork ||
      !rippleMaskPixels ||
      (event.pointerType !== 'touch' && event.button !== 0)
    ) return

    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return

    pointerNdc.set(x * 2 - 1, 1 - y * 2)
    raycaster.setFromCamera(pointerNdc, camera)
    const intersection = raycaster.intersectObject(artwork, false)[0]
    if (!intersection?.uv || sampleWaterMask(rippleMaskPixels, intersection.uv) < CLICK_RIPPLE.hitThreshold) return

    let rippleIndex = nextRippleIndex
    for (let offset = 0; offset < clickRipples.length; offset++) {
      const candidate = (nextRippleIndex + offset) % clickRipples.length
      if (clickRipples[candidate].age < 0) {
        rippleIndex = candidate
        break
      }
    }

    const ripple = clickRipples[rippleIndex]
    ripple.position.copy(intersection.uv)
    ripple.age = 0
    rippleAges[rippleIndex] = 0
    nextRippleIndex = (rippleIndex + 1) % clickRipples.length
    requestRender()
  }

  const handlePointerLeave = () => {
    springTarget.set(0, 0)
    requestRender()
  }

  const updateVisibility = () => {
    const wasVisible = visible
    visible = isIntersecting && !document.hidden
    if (visible) {
      if (!wasVisible) lastFrameTime = null
      if (!loaded) loadArtwork()
      else requestRender()
    } else {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      lastFrameTime = null
    }
  }

  const handleMotionPreferenceChange = () => {
    if (reduceMotion.matches) {
      resetParallax()
      lastFrameTime = null
    } else if (coarsePointer.matches) {
      springTarget.set(0, 0)
    }
    requestRender()
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  host.addEventListener('pointermove', handlePointerMove)
  host.addEventListener('pointerdown', handlePointerDown)
  host.addEventListener('pointerleave', handlePointerLeave)
  document.addEventListener('visibilitychange', updateVisibility)
  reduceMotion.addEventListener('change', handleMotionPreferenceChange)
  coarsePointer.addEventListener('change', handleMotionPreferenceChange)

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isIntersecting = Boolean(entry?.isIntersecting)
    updateVisibility()
  }, { threshold: 0.01 })
  intersectionObserver.observe(host)
  resize()

  cleanupCurrentArtwork = () => {
    if (disposed) return
    disposed = true
    if (frame) cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    host.removeEventListener('pointermove', handlePointerMove)
    host.removeEventListener('pointerdown', handlePointerDown)
    host.removeEventListener('pointerleave', handlePointerLeave)
    document.removeEventListener('visibilitychange', updateVisibility)
    reduceMotion.removeEventListener('change', handleMotionPreferenceChange)
    coarsePointer.removeEventListener('change', handleMotionPreferenceChange)

    if (artwork) scene.remove(artwork)
    artworkGeometry.dispose()
    fullscreenGeometry.dispose()
    outputMaterial?.dispose()
    waterMaterial?.dispose()
    sourceMaterial?.dispose()
    castMaterial?.dispose()
    blurMaterial?.dispose()
    combineMaterial?.dispose()
    const textures = new Set([
      artworkTexture,
      rippleMaskTexture,
      rippleNormalTexture,
    ])
    for (const texture of textures) texture?.dispose()
    rippleMaskPixels = null
    rippleAges.fill(-1)
    for (const target of [waterTarget, sourceTarget, castTarget, blurHorizontalTarget, blurVerticalTarget, combinedTarget]) {
      target.dispose()
    }
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

const cleanupArtwork = () => {
  cleanupCurrentArtwork?.()
  cleanupCurrentArtwork = null
}

document.addEventListener('astro:page-load', mountArtwork)
document.addEventListener('astro:before-swap', cleanupArtwork)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountArtwork, { once: true })
} else {
  mountArtwork()
}
