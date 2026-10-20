export const waterFragmentShader = /* glsl */ `
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

export const godRaySourceFragmentShader = /* glsl */ `
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

export const godRayCastFragmentShader = /* glsl */ `
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

export const gaussianBlurFragmentShader = /* glsl */ `
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

export const combineFragmentShader = /* glsl */ `
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