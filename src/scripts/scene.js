import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvas = document.getElementById('hero-canvas')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
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

new ResizeObserver(() => {
  const w = canvas.clientWidth, h = canvas.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}).observe(canvas)

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

function setupAttributes(geometry) {
  const vectors = [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)]
  const position = geometry.attributes.position
  const centers = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    vectors[i % 3].toArray(centers, i * 3)
  }
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3))
}

const draco = new DRACOLoader()
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
const loader = new GLTFLoader()
loader.setDRACOLoader(draco)

let modelReady = false
loader.load('/models/computer.glb', ({ scene: model }) => {
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
}, undefined, console.error)

function animate() {
  requestAnimationFrame(animate)
  if (!modelReady) return
  controls.update()
  renderer.render(scene, camera)
}
animate()
