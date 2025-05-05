<template>
  <canvas ref="canvas" class="webgl-background" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  MeshBasicMaterial,
  TextureLoader,
  type Material
} from 'three'

interface Props {
  coverUrl: string
  settings: {
    lyricsBackground: 'blur' | 'dynamic' | boolean
    blurIntensity?: number
    rotationSpeed?: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  settings: () => ({
    lyricsBackground: 'blur',
    blurIntensity: 50,
    rotationSpeed: 0.5
  })
})

const canvas = ref<HTMLCanvasElement | null>(null)
let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: OrthographicCamera | null = null
let material: Material | null = null
let animationFrameId: number | null = null

// 着色器代码
const shaderCode = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uBlurRadius;
    uniform float uRotationSpeed;
    varying vec2 vUv;

    // RGB转HSV
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
        vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);
        
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), 
                  d / (q.x + e), 
                  q.x);
    }

    // HSV转RGB
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 center = vec2(0.5);
        float angle = uTime * uRotationSpeed;
        vec2 rotatedUV = vec2(
            cos(angle) * (vUv.x - center.x) + sin(angle) * (vUv.y - center.y) + center.x,
            -sin(angle) * (vUv.x - center.x) + cos(angle) * (vUv.y - center.y) + center.y
        );
        
        vec4 color = vec4(0.0);
        float total = 0.0;
        float sigma = uBlurRadius / 2.0;
        
        for (float i = -5.0; i <= 5.0; i += 1.0) {
            for (float j = -5.0; j <= 5.0; j += 1.0) {
                float weight = exp(-(i*i + j*j) / (2.0 * sigma * sigma));
                vec2 offset = vec2(i, j) * 0.0015;
                color += texture2D(uTexture, rotatedUV + offset) * weight;
                total += weight;
            }
        }
        
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.y *= 1.2; // 饱和度增强
        hsv.z *= 0.9; // 明度降低
        color.rgb = hsv2rgb(hsv);
        
        gl_FragColor = color / total * 0.7;
    }
  `
}

// 初始化WebGL
const initWebGL = async () => {
  if (!canvas.value) return

  // 1. 初始化Three.js核心对象
  scene = new Scene()
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // 2. 创建渲染器
  renderer = new WebGLRenderer({
    canvas: canvas.value,
    alpha: true,
    antialias: true
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  // 3. 加载纹理
  const textureLoader = new TextureLoader()
  const texture = await textureLoader.loadAsync(props.coverUrl)

  // 4. 创建着色器材质
  const uniforms = {
    uTexture: { value: texture },
    uTime: { value: 0 },
    uBlurRadius: { value: props.settings.blurIntensity },
    uRotationSpeed: { value: props.settings.rotationSpeed }
  }

  material = new MeshBasicMaterial()
  material.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ...uniforms }
    shader.vertexShader = shaderCode.vertex
    shader.fragmentShader = shaderCode.fragment
  }

  // 5. 创建网格对象
  const geometry = new PlaneGeometry(2, 2)
  const mesh = new Mesh(geometry, material)
  scene.add(mesh)

  // 6. 启动动画循环
  animate()
}

// 动画循环
const animate = () => {
  if (!renderer || !scene || !camera) return

  animationFrameId = requestAnimationFrame(animate)
  if (material && material.uniforms) {
    material.uniforms.uTime.value += 0.01
  }
  renderer.render(scene, camera)
}

// 窗口尺寸变化处理
const handleResize = () => {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
}

// 清理资源
const cleanup = () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', handleResize)

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
}

// 生命周期
onMounted(() => {
  if (props.settings.lyricsBackground !== 'blur' && props.settings.lyricsBackground !== 'dynamic')
    return

  initWebGL()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cleanup()
})

// 响应式更新设置
watchEffect(() => {
  if (material?.uniforms) {
    material.uniforms.uBlurRadius.value = props.settings.blurIntensity
    material.uniforms.uRotationSpeed.value = props.settings.rotationSpeed
  }
})
</script>

<style scoped>
.webgl-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}
</style>
