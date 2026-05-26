import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let activeCleanup = null
let shaderPrecisionPatched = false

function ensureShaderPrecisionFallback() {
  if (shaderPrecisionPatched || typeof window === 'undefined') return
  const patch = (Context) => {
    if (!Context?.prototype) return
    if (Context.prototype.getShaderPrecisionFormat) {
      const original = Context.prototype.getShaderPrecisionFormat
      Context.prototype.getShaderPrecisionFormat = function (...args) {
        const result = original.call(this, ...args)
        if (!result) return { precision: 0, rangeMin: 0, rangeMax: 0 }
        return result
      }
    }
    if (Context.prototype.getParameter) {
      const originalGetParameter = Context.prototype.getParameter
      Context.prototype.getParameter = function (parameter) {
        const result = originalGetParameter.call(this, parameter)
        if (result == null) {
          if (parameter === this.VERSION || parameter === this.SHADING_LANGUAGE_VERSION) {
            return ''
          }
          if (parameter === this.SCISSOR_BOX || parameter === this.VIEWPORT) {
            return new Int32Array(4)
          }
        }
        return result
      }
    }
  }
  patch(window.WebGLRenderingContext)
  patch(window.WebGL2RenderingContext)
  shaderPrecisionPatched = true
}

function setupAttributes(geometry) {
  const vectors = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
  const position = geometry.attributes.position
  const centers = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    vectors[i % 3].toArray(centers, i * 3)
  }
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3))
}

function disposeScene(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose())
    } else {
      child.material?.dispose?.()
    }
  })
}

function initHeroScene() {
  if (activeCleanup) {
    activeCleanup()
    activeCleanup = null
  }

  const canvas = document.getElementById('hero-canvas')
  if (!canvas) return
  if (!isCanvasReady(canvas)) return

  ensureShaderPrecisionFallback()

  let rafId = 0
  let isAnimating = false
  let isVisible = true
  let isDisposed = false
  let modelReady = false
  let loadedModel = null

  const contextAttributes = {
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  }
  const testCanvas = document.createElement('canvas')
  const testContext =
    testCanvas.getContext('webgl2', contextAttributes) ||
    testCanvas.getContext('webgl', contextAttributes)
  if (!testContext) {
    console.error('WebGL not supported')
    return
  }

  const getPrecision = (shaderType, precisionType) =>
    testContext.getShaderPrecisionFormat?.(shaderType, precisionType)
  const highpVertex = getPrecision(testContext.VERTEX_SHADER, testContext.HIGH_FLOAT)
  const highpFragment = getPrecision(testContext.FRAGMENT_SHADER, testContext.HIGH_FLOAT)
  const mediumpVertex = getPrecision(testContext.VERTEX_SHADER, testContext.MEDIUM_FLOAT)
  const mediumpFragment = getPrecision(testContext.FRAGMENT_SHADER, testContext.MEDIUM_FLOAT)

  let precision = 'highp'
  if (
    !highpVertex ||
    !highpFragment ||
    highpVertex.precision === 0 ||
    highpFragment.precision === 0
  ) {
    precision = 'mediump'
  }

  if (
    precision === 'mediump' &&
    mediumpVertex &&
    mediumpFragment &&
    (mediumpVertex.precision === 0 || mediumpFragment.precision === 0)
  ) {
    precision = 'lowp'
  }

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision,
    })
  } catch (error) {
    console.error('Failed to create WebGL renderer:', error)
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0xffffff, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.enableZoom = false
  controls.enablePan = false
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.9
  controls.minPolarAngle = controls.maxPolarAngle = Math.PI / 2 - 0.3

  const resizeObserver = new ResizeObserver(() => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(canvas)

  function startRenderLoop() {
    if (isAnimating || isDisposed) return
    isAnimating = true
    render()
  }

  function stopRenderLoop() {
    isAnimating = false
    if (rafId) cancelAnimationFrame(rafId)
  }

  function render() {
    if (!isAnimating || !isVisible || isDisposed) return
    rafId = requestAnimationFrame(render)
    if (!modelReady) return
    controls.update()
    renderer.render(scene, camera)
  }

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true
    if (isVisible) startRenderLoop()
    else stopRenderLoop()
  }, { threshold: 0.1 })

  visibilityObserver.observe(canvas)

  const handleVisibilityChange = () => {
    if (document.hidden) stopRenderLoop()
    else if (isVisible) startRenderLoop()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  const wireMaterial = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: 1 } },
    vertexShader: `
      attribute vec3 center;
      varying vec3 vCenter;
      void main() {
        vCenter = center;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float thickness;
      varying vec3 vCenter;
      void main() {
        vec3 afwidth = fwidth(vCenter.xyz);
        vec3 edge3 = smoothstep((thickness - 1.0) * afwidth, thickness * afwidth, vCenter.xyz);
        float edge = 1.0 - min(min(edge3.x, edge3.y), edge3.z);
        gl_FragColor.rgb = vec3(0.0, 0.0, 0.0);
        gl_FragColor.a = edge;
      }
    `,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    transparent: true,
  })

  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  loader.load('/models/computer.glb', ({ scene: model }) => {
    if (isDisposed) return
    loadedModel = model
    model.traverse((child) => {
      if (!child.isMesh) return
      child.geometry = child.geometry.toNonIndexed()
      child.geometry.deleteAttribute('normal')
      setupAttributes(child.geometry)
      child.material = wireMaterial.clone()
    })

    scene.add(model)
    model.scale.multiplyScalar(1.5)
    model.position.y = 0.5
    model.rotation.y = -Math.PI / 1.6

    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    camera.position.set(center.x, center.y, center.z + Math.max(size.x, size.y, size.z) * 2)
    controls.target.copy(center)
    controls.update()

    modelReady = true
    startRenderLoop()
  }, undefined, console.error)

  startRenderLoop()

  activeCleanup = () => {
    isDisposed = true
    stopRenderLoop()
    resizeObserver.disconnect()
    visibilityObserver.disconnect()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    controls.dispose()
    if (loadedModel) scene.remove(loadedModel)
    disposeScene(scene)
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

let pendingInit = 0

function isCanvasReady(canvas) {
  if (!canvas) return false
  const styles = window.getComputedStyle(canvas)
  if (styles.display === 'none') return false
  return canvas.clientWidth > 0 && canvas.clientHeight > 0
}

function waitForCanvasReady() {
  const token = ++pendingInit
  const check = () => {
    if (token !== pendingInit) return
    const canvas = document.getElementById('hero-canvas')
    if (!canvas) return
    if (isCanvasReady(canvas)) {
      initHeroScene()
      return
    }
    requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

function handlePageLoad() {
  const canvas = document.getElementById('hero-canvas')
  if (canvas) {
    waitForCanvasReady()
  } else if (activeCleanup) {
    activeCleanup()
    activeCleanup = null
  }
}

document.addEventListener('astro:page-load', handlePageLoad)
document.addEventListener('astro:before-swap', () => {
  if (activeCleanup) {
    activeCleanup()
    activeCleanup = null
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handlePageLoad, { once: true })
} else {
  handlePageLoad()
}
