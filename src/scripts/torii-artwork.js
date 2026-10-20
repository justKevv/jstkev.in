// Raw WebGL2 port of the torii artwork module (no Three.js).
// Move your existing GLSL strings, UNCHANGED, into ./torii-shaders.js and export them:
//   waterFragmentShader, godRaySourceFragmentShader, godRayCastFragmentShader,
//   gaussianBlurFragmentShader, combineFragmentShader
// (The vertex shader is replaced below. Three prepended `precision highp float;`
// to fragment shaders; we do that in makeProgram.)
import {
  waterFragmentShader,
  godRaySourceFragmentShader,
  godRayCastFragmentShader,
  gaussianBlurFragmentShader,
  combineFragmentShader,
} from './torii-shaders.js'

const DEFAULT_ARTWORK_URL = '/torii/materials/tori.webp'
const WATER_MASK_URL = '/torii/materials/masks/waterripple_mask_18b8bfc2.webp'
const RIPPLE_NORMAL_URL = '/torii/materials/effects/waterripplenormal.webp'

const CLICK_RIPPLE_STRENGTH = 2.5
const CLICK_RIPPLE_BASE_DISPLACEMENT = 0.0022
const CLICK_RIPPLE_LIFETIME = 2.2
const CLICK_RIPPLE_SPEED = 0.26
const IMPACT_DURATION = 0.35
const FADE_IN = 1.0
const RIPPLES = 3
const HIT_THRESHOLD = 0.18

// Camera constants from the Three version, kept so the parallax matches.
const CAM_Z = 5
const FOV = 35 * Math.PI / 180
const ASPECT = 16 / 9
const MAX_YAW = 0.6 * Math.PI / 180
const MAX_PITCH = 0.35 * Math.PI / 180
const DEADZONE = 0.10
const STIFFNESS = 55
const DAMPING = 12

// Final pass: replaces the Three plane + perspective camera.
// The 0.6deg tilt is tiny, so it's a UV shift instead of a real rotation.
// Also does the linear -> sRGB encode that Three's outputColorSpace did.
const outputFragmentShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uViewHalf;   // half size of the visible area at z=0, world units
  uniform vec2 uPlane;      // artwork plane size, world units
  uniform vec2 uCenter;     // uv at screen center (0.5 + parallax)
  uniform float uOpacity;
  varying vec2 vUv;

  vec3 toSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec2 uv = uCenter + (vUv * 2.0 - 1.0) * uViewHalf / uPlane;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec4 c = texture2D(uTex, uv);
    float a = c.a * uOpacity;
    gl_FragColor = vec4(toSrgb(c.rgb) * a, a); // premultiplied, canvas default
  }
`

// Replaces fullscreenVertexShader: one oversized triangle, uv derived from position.
const vertexSource = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const lerp = (a, b, t) => a + (b - a) * t

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function cacheMask(image) {
  const width = image.naturalWidth, height = image.naturalHeight
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(image, 0, 0)
    const rgba = ctx.getImageData(0, 0, width, height).data
    const red = new Uint8Array(width * height)
    for (let i = 0; i < red.length; i++) red[i] = rgba[i * 4]
    return { width, height, red }
  } catch {
    return null
  } finally {
    c.width = c.height = 0
  }
}

function sampleMask(m, u, v) {
  if (!m) return 0
  const x = clamp(u, 0, 1) * (m.width - 1)
  const y = (1 - clamp(v, 0, 1)) * (m.height - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, m.width - 1), y1 = Math.min(y0 + 1, m.height - 1)
  const tx = x - x0, ty = y - y0
  const r = m.red, w = m.width
  const top = lerp(r[y0 * w + x0], r[y0 * w + x1], tx)
  const bottom = lerp(r[y1 * w + x0], r[y1 * w + x1], tx)
  return lerp(top, bottom, ty) / 255
}

// Same smoothstep-ish dead zone curve as before.
function easePointer(v) {
  const mag = Math.abs(v)
  if (mag <= DEADZONE) return 0
  const p = (mag - DEADZONE) / (1 - DEADZONE)
  return Math.sign(v) * p * p * (3 - 2 * p)
}

// Closed-form damped spring. With stiffness 55 / damping 12 it is always
// underdamped, so only that branch is kept.
function stepSpring(s, target, dt) {
  const e = s.pos - target
  const h = DAMPING / 2
  const w = Math.sqrt(STIFFNESS - h * h)
  const decay = Math.exp(-h * dt)
  const cos = Math.cos(w * dt), sin = Math.sin(w * dt)
  const k = (s.vel + h * e) / w
  const a = e * cos + k * sin
  s.pos = target + decay * a
  s.vel = decay * (-h * a + w * (-e * sin + k * cos))
}

let cleanupCurrent = null

function mountArtwork() {
  cleanupCurrent?.()
  cleanupCurrent = null

  const host = document.querySelector('[data-torii-artwork]')
  const canvas = host?.querySelector('[data-torii-canvas]')
  if (!host || !canvas) return

  const artworkUrl = host.dataset.toriiArtworkSrc || DEFAULT_ARTWORK_URL
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarsePointer = window.matchMedia('(pointer: coarse)')

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
  })
  if (!gl) return

  // ---------- GL helpers ----------
  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s))
    }
    return s
  }

  const makeProgram = (fragSrc) => {
    const p = gl.createProgram()
    const vs = compile(gl.VERTEX_SHADER, vertexSource)
    const fs = compile(gl.FRAGMENT_SHADER, `precision highp float;\nprecision highp int;\n${fragSrc}`)
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.bindAttribLocation(p, 0, 'position')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return { p, loc: {} }
  }

  const uloc = (prog, name) => (prog.loc[name] ??= gl.getUniformLocation(prog.p, name))

  const makeTexture = (image, { srgb = false, mipmaps = false, repeat = false } = {}) => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true) // Three flips by default
    // SRGB8_ALPHA8 = hardware sRGB decode on sample, same as Three's SRGBColorSpace textures.
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image)
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    return tex
  }

  const makeTarget = () => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fbo, w: 0, h: 0 }
  }

  const resizeTarget = (t, w, h) => {
    if (t.w === w && t.h === h) return
    t.w = w
    t.h = h
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  }

  // One fullscreen triangle.
  const vao = gl.createVertexArray()
  const quadBuffer = gl.createBuffer()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  // Draw `prog` into `target` (null = canvas), binding textures to units 0..n.
  const pass = (prog, target, textures, setUniforms) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null)
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height)
    gl.useProgram(prog.p)
    textures.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uloc(prog, name), i)
    })
    setUniforms?.((n) => uloc(prog, n))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // ---------- state ----------
  const programs = {}
  const targets = {
    water: makeTarget(),
    source: makeTarget(),
    cast: makeTarget(),
    blurH: makeTarget(),
    blurV: makeTarget(),
    combined: makeTarget(),
  }
  const textures = {}
  let maskPixels = null
  let artworkAspect = 16 / 9

  let frame = 0
  let loading = false
  let loaded = false
  let disposed = false
  let isIntersecting = false
  let visible = false
  let animationTime = 0
  let lastFrameTime = null
  let fadeTime = 0
  let halfW = 1, halfH = 1, planeW = 1, planeH = 1 // world units at z = 0

  const springX = { pos: 0, vel: 0 }
  const springY = { pos: 0, vel: 0 }
  const springTarget = { x: 0, y: 0 }
  let centerU = 0.5, centerV = 0.5

  const ripplePositions = new Float32Array(RIPPLES * 2).fill(-1)
  const rippleAges = new Float32Array(RIPPLES).fill(-1)
  let nextRipple = 0

  // ---------- parallax ----------
  const isParallaxMoving = () =>
    Math.abs(springTarget.x - springX.pos) >= 1e-5 ||
    Math.abs(springTarget.y - springY.pos) >= 1e-5 ||
    Math.abs(springX.vel) >= 1e-4 ||
    Math.abs(springY.vel) >= 1e-4

  const updateParallax = (dt) => {
    stepSpring(springX, springTarget.x, dt)
    stepSpring(springY, springTarget.y, dt)
    if (Math.abs(springTarget.x - springX.pos) < 1e-5 && Math.abs(springX.vel) < 1e-4) {
      springX.pos = springTarget.x
      springX.vel = 0
    }
    if (Math.abs(springTarget.y - springY.pos) < 1e-5 && Math.abs(springY.vel) < 1e-4) {
      springY.pos = springTarget.y
      springY.vel = 0
    }
    // Camera yaw/pitch of a few tenths of a degree at distance CAM_Z shifts
    // the view across the plane by CAM_Z * tan(angle). Flip a sign here if the
    // motion feels reversed compared to the Three version.
    centerU = 0.5 + (CAM_Z * Math.tan(springX.pos * MAX_YAW)) / planeW
    centerV = 0.5 + (CAM_Z * Math.tan(springY.pos * MAX_PITCH)) / planeH
  }

  const resetParallax = () => {
    springTarget.x = springTarget.y = 0
    springX.pos = springX.vel = springY.pos = springY.vel = 0
    centerU = centerV = 0.5
  }

  // ---------- rendering ----------
  const updateClickRipples = (dt) => {
    for (let i = 0; i < RIPPLES; i++) {
      if (rippleAges[i] < 0) continue
      rippleAges[i] += dt
      if (rippleAges[i] >= CLICK_RIPPLE_LIFETIME) rippleAges[i] = -1
    }
  }

  const renderPipeline = () => {
    const { water, source, cast, blurH, blurV, combined } = targets

    pass(programs.water, water,
      [['uArtwork', textures.artwork], ['uRippleNormal', textures.normal], ['uRippleMask', textures.mask]],
      (u) => {
        gl.uniform1f(u('uTime'), animationTime)
        gl.uniform2fv(u('uClickRipplePositions'), ripplePositions)
        gl.uniform1fv(u('uClickRippleAges'), rippleAges)
      })

    pass(programs.source, source, [['uWaterArtwork', water.tex]],
      (u) => gl.uniform1f(u('uTime'), animationTime))

    pass(programs.cast, cast, [['uSource', source.tex]])

    pass(programs.blur, blurH, [['uSource', cast.tex]],
      (u) => gl.uniform2f(u('uTexelStep'), 1 / blurH.w, 0))
    pass(programs.blur, blurV, [['uSource', blurH.tex]],
      (u) => gl.uniform2f(u('uTexelStep'), 0, 1 / blurV.h))

    pass(programs.combine, combined, [['uWaterArtwork', water.tex], ['uRays', blurV.tex]])
  }

  const renderFrame = (timestamp) => {
    frame = 0
    if (disposed || !visible || !loaded) return

    const animate = !reduceMotion.matches
    const dt = lastFrameTime === null ? 0 : Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp
    if (animate) {
      animationTime += dt
      updateClickRipples(dt)
      updateParallax(dt)
      if (fadeTime < FADE_IN) fadeTime = Math.min(fadeTime + dt, FADE_IN)
    }
    const fade = animate ? fadeTime / FADE_IN : 1

    renderPipeline()

    pass(programs.output, null, [['uTex', targets.combined.tex]], (u) => {
      gl.uniform2f(u('uViewHalf'), halfW, halfH)
      gl.uniform2f(u('uPlane'), planeW, planeH)
      gl.uniform2f(u('uCenter'), centerU, centerV)
      gl.uniform1f(u('uOpacity'), 1 - (1 - fade) ** 3)
    })

    const fading = animate && fadeTime < FADE_IN
    if (visible && (animate || fading || isParallaxMoving())) {
      frame = requestAnimationFrame(renderFrame)
    } else {
      lastFrameTime = null
    }
  }

  const requestRender = () => {
    if (visible && loaded && !disposed && frame === 0) frame = requestAnimationFrame(renderFrame)
  }

  const resize = () => {
    const rect = host.getBoundingClientRect()
    const w = Math.floor(rect.width), h = Math.floor(rect.height)
    if (!w || !h) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))

    // Visible area at z = 0 and the artwork plane (contain-fit x 1.2).
    const viewH = 2 * CAM_Z * Math.tan(FOV / 2)
    const viewW = viewH * (w / h)
    halfW = viewW / 2
    halfH = viewH / 2
    planeH = Math.min(viewH, viewW / ASPECT) * 1.2
    planeW = planeH * ASPECT

    // Same render-target sizing as before.
    const fitW = Math.min(canvas.width, canvas.height * ASPECT)
    const tw = Math.max(1, Math.floor(fitW))
    const th = Math.max(1, Math.floor(fitW / ASPECT))
    const hw = Math.max(1, Math.ceil(tw * 0.5))
    const hh = Math.max(1, Math.ceil(th * 0.5))
    resizeTarget(targets.water, tw, th)
    resizeTarget(targets.combined, tw, th)
    for (const k of ['source', 'cast', 'blurH', 'blurV']) resizeTarget(targets[k], hw, hh)

    updateParallax(0)
    requestRender()
  }

  // ---------- loading ----------
  const setupPipeline = ([artworkImg, maskImg, normalImg]) => {
    artworkAspect = artworkImg.naturalWidth / artworkImg.naturalHeight
    textures.artwork = makeTexture(artworkImg, { srgb: true, mipmaps: true })
    textures.mask = makeTexture(maskImg)
    textures.normal = makeTexture(normalImg, { repeat: true })
    maskPixels = cacheMask(maskImg)

    programs.water = makeProgram(waterFragmentShader)
    programs.source = makeProgram(godRaySourceFragmentShader)
    programs.cast = makeProgram(godRayCastFragmentShader)
    programs.blur = makeProgram(gaussianBlurFragmentShader)
    programs.combine = makeProgram(combineFragmentShader)
    programs.output = makeProgram(outputFragmentShader)

    // Constant uniforms, set once.
    const set = (prog, fn) => {
      gl.useProgram(prog.p)
      fn((n) => uloc(prog, n))
    }
    set(programs.water, (u) => {
      gl.uniform1f(u('uStrength'), 0.079999998)
      gl.uniform1f(u('uSpeed'), 0.13)
      gl.uniform1f(u('uScale'), 1.04)
      gl.uniform1f(u('uRatio'), 1.0)
      gl.uniform1f(u('uImageAspect'), artworkAspect)
      gl.uniform1f(u('uDebugWaterMask'), 0)
      gl.uniform1f(u('uClickRippleStrength'), CLICK_RIPPLE_BASE_DISPLACEMENT * CLICK_RIPPLE_STRENGTH)
      gl.uniform1f(u('uClickRippleLifetime'), CLICK_RIPPLE_LIFETIME)
      gl.uniform1f(u('uClickRippleSpeed'), CLICK_RIPPLE_SPEED)
      gl.uniform1f(u('uImpactDuration'), IMPACT_DURATION)
    })
    set(programs.source, (u) => {
      gl.uniform1f(u('uNoiseAmount'), 0.40000001)
      gl.uniform1f(u('uNoiseScale'), 3.0)
      gl.uniform1f(u('uNoiseSpeed'), 0.15000001)
      gl.uniform1f(u('uNoiseSmoothness'), 0.2)
      gl.uniform1f(u('uThreshold'), 0.5)
    })
    set(programs.cast, (u) => {
      gl.uniform2f(u('uLightUv'), 0.5, 0.5)
      gl.uniform1f(u('uRayLength'), 1.0)
      gl.uniform1f(u('uRayIntensity'), 0.5)
    })

    loaded = true
    resize()
    requestRender()
  }

  const loadArtwork = () => {
    if (loading || loaded || disposed) return
    loading = true
    Promise.all([loadImage(artworkUrl), loadImage(WATER_MASK_URL), loadImage(RIPPLE_NORMAL_URL)])
      .then((images) => { if (!disposed) setupPipeline(images) })
      .catch((err) => { if (!disposed) console.warn('Could not load torii textures:', err) })
  }

  // ---------- input ----------
  const handlePointerMove = (e) => {
    if (reduceMotion.matches || coarsePointer.matches || e.pointerType === 'touch') return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const nx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    const ny = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2, -1, 1)
    springTarget.x = easePointer(nx)
    springTarget.y = easePointer(ny)
    requestRender()
  }

  const handlePointerDown = (e) => {
    if (reduceMotion.matches || !loaded || !maskPixels) return
    if (e.pointerType !== 'touch' && e.button !== 0) return

    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return

    // Replaces the raycaster: same mapping the output shader uses.
    const u = centerU + ((x * 2 - 1) * halfW) / planeW
    const v = centerV + ((1 - y * 2) * halfH) / planeH
    if (u < 0 || u > 1 || v < 0 || v > 1) return
    if (sampleMask(maskPixels, u, v) < HIT_THRESHOLD) return

    let index = nextRipple
    for (let o = 0; o < RIPPLES; o++) {
      const c = (nextRipple + o) % RIPPLES
      if (rippleAges[c] < 0) { index = c; break }
    }
    ripplePositions[index * 2] = u
    ripplePositions[index * 2 + 1] = v
    rippleAges[index] = 0
    nextRipple = (index + 1) % RIPPLES
    requestRender()
  }

  const handlePointerLeave = () => {
    springTarget.x = springTarget.y = 0
    requestRender()
  }

  const updateVisibility = () => {
    const was = visible
    visible = isIntersecting && !document.hidden
    if (visible) {
      if (!was) lastFrameTime = null
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
      springTarget.x = springTarget.y = 0
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

  cleanupCurrent = () => {
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

    for (const t of Object.values(targets)) {
      gl.deleteTexture(t.tex)
      gl.deleteFramebuffer(t.fbo)
    }
    for (const t of Object.values(textures)) gl.deleteTexture(t)
    for (const p of Object.values(programs)) gl.deleteProgram(p.p)
    gl.deleteBuffer(quadBuffer)
    gl.deleteVertexArray(vao)
    maskPixels = null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

const cleanupArtwork = () => {
  cleanupCurrent?.()
  cleanupCurrent = null
}

document.addEventListener('astro:page-load', mountArtwork)
document.addEventListener('astro:before-swap', cleanupArtwork)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountArtwork, { once: true })
} else {
  mountArtwork()
}