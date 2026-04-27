import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvas = document.getElementById('hero-canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100)

scene.add(new THREE.AmbientLight(0xffffff, 1.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 4)
dirLight.position.set(5, 5, 5)
scene.add(dirLight)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.enableZoom = false
controls.enablePan = false
controls.autoRotate = true
controls.autoRotateSpeed = 0.9

let isUserInteracting = false
const HORIZONTAL_POLAR = Math.PI / 2 - 0.3
controls.addEventListener('start', () => { isUserInteracting = true })
controls.addEventListener('end', () => { isUserInteracting = false })

new ResizeObserver(() => {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  camera.aspect = canvas.clientWidth / canvas.clientHeight
  camera.updateProjectionMatrix()
}).observe(canvas)

const manager = new THREE.LoadingManager()
let modelReady = false

manager.onLoad = () => {
  modelReady = true
  // force texture upload & shader warmup once everything is loaded
  renderer.compile(scene, camera)
  renderer.render(scene, camera)
}

manager.onError = (url) => {
  console.error('Failed to load asset:', url)
}

const dracoLoader = new DRACOLoader(manager)
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
dracoLoader.preload()

const loader = new GLTFLoader(manager)
loader.setDRACOLoader(dracoLoader)

function touchTexture(tex, color = false) {
  if (!tex) return
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  tex.needsUpdate = true
}

function fixMaterial(material) {
  if (!material) return

  touchTexture(material.map, true)
  touchTexture(material.emissiveMap, true)

  touchTexture(material.normalMap, false)
  touchTexture(material.roughnessMap, false)
  touchTexture(material.metalnessMap, false)
  touchTexture(material.aoMap, false)

  material.needsUpdate = true
}

loader.load(
  '/models/computer_terminal.glb',
  (gltf) => {
    const model = gltf.scene

    model.traverse((obj) => {
      if (!obj.isMesh) return
      if (Array.isArray(obj.material)) obj.material.forEach(fixMaterial)
      else fixMaterial(obj.material)
    })

    scene.add(model)

    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    model.position.y = 0.5
    camera.position.set(center.x, center.y, center.z + maxDim * 2.3)
    controls.target.copy(center)
    controls.update()
  },
  undefined,
  (err) => {
    console.error('GLTF load error:', err)
  }
)

let lastTime = performance.now()
let acc = 0
const FPS = 70
const STEP = 1 / FPS

function animate() {
  requestAnimationFrame(animate)

  // skip until all assets are fully ready (prevents bad first frame)
  if (!modelReady) return

  const now = performance.now()
  const delta = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  acc += delta
  if (acc < STEP) return
  acc = 0

  if (!isUserInteracting) {
    const current = controls.getPolarAngle()
    if (Math.abs(current - HORIZONTAL_POLAR) > 0.001) {
      const t = 1 - Math.pow(0.94, delta * 60)
      const locked = THREE.MathUtils.lerp(current, HORIZONTAL_POLAR, t)
      controls.minPolarAngle = locked
      controls.maxPolarAngle = locked
    } else {
      controls.minPolarAngle = HORIZONTAL_POLAR
      controls.maxPolarAngle = HORIZONTAL_POLAR
    }
  } else {
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
  }

  controls.update()
  renderer.render(scene, camera)
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') lastTime = performance.now()
})

animate()
