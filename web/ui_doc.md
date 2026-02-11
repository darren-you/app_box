Light Rays

Preview
Code

Contribute
Install
CLI
Manual
pnpm
npm
yarn
bun
npm install ogl
Usage
1import LightRays from './LightRays';
2
3<div style={{ width: '100%', height: '600px', position: 'relative' }}>
4  <LightRays
5    raysOrigin="top-center"
6    raysColor="#ffffff"
7    raysSpeed={1}
8    lightSpread={0.5}
9    rayLength={3}
10    followMouse={true}
11    mouseInfluence={0.1}
12    noiseAmount={0}
13    distortion={0}
14    className="custom-rays"
15    pulsating={false}
16    fadeDistance={1}
17    saturation={1}
18/>
19</div>
Code


1import { useRef, useEffect, useState } from 'react';
2import { Renderer, Program, Triangle, Mesh } from 'ogl';
3import './LightRays.css';
4
5const DEFAULT_COLOR = '#ffffff';
6
7const hexToRgb = hex => {
8  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
9  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
10};
11
12const getAnchorAndDir = (origin, w, h) => {
13  const outside = 0.2;
14  switch (origin) {
15    case 'top-left':
16      return { anchor: [0, -outside * h], dir: [0, 1] };
17    case 'top-right':
18      return { anchor: [w, -outside * h], dir: [0, 1] };
19    case 'left':
20      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
21    case 'right':
22      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
23    case 'bottom-left':
24      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
25    case 'bottom-center':
26      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
27    case 'bottom-right':
28      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
29    default: // "top-center"
30      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
31  }
32};
33
34const LightRays = ({
35  raysOrigin = 'top-center',
36  raysColor = DEFAULT_COLOR,
37  raysSpeed = 1,
38  lightSpread = 1,
39  rayLength = 2,
40  pulsating = false,
41  fadeDistance = 1.0,
42  saturation = 1.0,
43  followMouse = true,
44  mouseInfluence = 0.1,
45  noiseAmount = 0.0,
46  distortion = 0.0,
47  className = ''
48}) => {
49  const containerRef = useRef(null);
50  const uniformsRef = useRef(null);
51  const rendererRef = useRef(null);
52  const mouseRef = useRef({ x: 0.5, y: 0.5 });
53  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
54  const animationIdRef = useRef(null);
55  const meshRef = useRef(null);
56  const cleanupFunctionRef = useRef(null);
57  const [isVisible, setIsVisible] = useState(false);
58  const observerRef = useRef(null);
59
60  useEffect(() => {
61    if (!containerRef.current) return;
62
63    observerRef.current = new IntersectionObserver(
64      entries => {
65        const entry = entries[0];
66        setIsVisible(entry.isIntersecting);
67      },
68      { threshold: 0.1 }
69    );
70
71    observerRef.current.observe(containerRef.current);
72
73    return () => {
74      if (observerRef.current) {
75        observerRef.current.disconnect();
76        observerRef.current = null;
77      }
78    };
79  }, []);
80
81  useEffect(() => {
82    if (!isVisible || !containerRef.current) return;
83
84    if (cleanupFunctionRef.current) {
85      cleanupFunctionRef.current();
86      cleanupFunctionRef.current = null;
87    }
88
89    const initializeWebGL = async () => {
90      if (!containerRef.current) return;
91
92      await new Promise(resolve => setTimeout(resolve, 10));
93
94      if (!containerRef.current) return;
95
96      const renderer = new Renderer({
97        dpr: Math.min(window.devicePixelRatio, 2),
98        alpha: true
99      });
100      rendererRef.current = renderer;
101
102      const gl = renderer.gl;
103      gl.canvas.style.width = '100%';
104      gl.canvas.style.height = '100%';
105
106      while (containerRef.current.firstChild) {
107        containerRef.current.removeChild(containerRef.current.firstChild);
108      }
109      containerRef.current.appendChild(gl.canvas);
110
111      const vert = `
112attribute vec2 position;
113varying vec2 vUv;
114void main() {
115  vUv = position * 0.5 + 0.5;
116  gl_Position = vec4(position, 0.0, 1.0);
117}`;
118
119      const frag = `precision highp float;
120
121uniform float iTime;
122uniform vec2  iResolution;
123
124uniform vec2  rayPos;
125uniform vec2  rayDir;
126uniform vec3  raysColor;
127uniform float raysSpeed;
128uniform float lightSpread;
129uniform float rayLength;
130uniform float pulsating;
131uniform float fadeDistance;
132uniform float saturation;
133uniform vec2  mousePos;
134uniform float mouseInfluence;
135uniform float noiseAmount;
136uniform float distortion;
137
138varying vec2 vUv;
139
140float noise(vec2 st) {
141  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
142}
143
144float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
145                  float seedA, float seedB, float speed) {
146  vec2 sourceToCoord = coord - raySource;
147  vec2 dirNorm = normalize(sourceToCoord);
148  float cosAngle = dot(dirNorm, rayRefDirection);
149
150  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
151  
152  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
153
154  float distance = length(sourceToCoord);
155  float maxDistance = iResolution.x * rayLength;
156  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
157  
158  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
159  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
160
161  float baseStrength = clamp(
162    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
163    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
164    0.0, 1.0
165  );
166
167  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
168}
169
170void mainImage(out vec4 fragColor, in vec2 fragCoord) {
171  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
172  
173  vec2 finalRayDir = rayDir;
174  if (mouseInfluence > 0.0) {
175    vec2 mouseScreenPos = mousePos * iResolution.xy;
176    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
177    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
178  }
179
180  vec4 rays1 = vec4(1.0) *
181               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
182                           1.5 * raysSpeed);
183  vec4 rays2 = vec4(1.0) *
184               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
185                           1.1 * raysSpeed);
186
187  fragColor = rays1 * 0.5 + rays2 * 0.4;
188
189  if (noiseAmount > 0.0) {
190    float n = noise(coord * 0.01 + iTime * 0.1);
191    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
192  }
193
194  float brightness = 1.0 - (coord.y / iResolution.y);
195  fragColor.x *= 0.1 + brightness * 0.8;
196  fragColor.y *= 0.3 + brightness * 0.6;
197  fragColor.z *= 0.5 + brightness * 0.5;
198
199  if (saturation != 1.0) {
200    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
201    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
202  }
203
204  fragColor.rgb *= raysColor;
205}
206
207void main() {
208  vec4 color;
209  mainImage(color, gl_FragCoord.xy);
210  gl_FragColor  = color;
211}`;
212
213      const uniforms = {
214        iTime: { value: 0 },
215        iResolution: { value: [1, 1] },
216
217        rayPos: { value: [0, 0] },
218        rayDir: { value: [0, 1] },
219
220        raysColor: { value: hexToRgb(raysColor) },
221        raysSpeed: { value: raysSpeed },
222        lightSpread: { value: lightSpread },
223        rayLength: { value: rayLength },
224        pulsating: { value: pulsating ? 1.0 : 0.0 },
225        fadeDistance: { value: fadeDistance },
226        saturation: { value: saturation },
227        mousePos: { value: [0.5, 0.5] },
228        mouseInfluence: { value: mouseInfluence },
229        noiseAmount: { value: noiseAmount },
230        distortion: { value: distortion }
231      };
232      uniformsRef.current = uniforms;
233
234      const geometry = new Triangle(gl);
235      const program = new Program(gl, {
236        vertex: vert,
237        fragment: frag,
238        uniforms
239      });
240      const mesh = new Mesh(gl, { geometry, program });
241      meshRef.current = mesh;
242
243      const updatePlacement = () => {
244        if (!containerRef.current || !renderer) return;
245
246        renderer.dpr = Math.min(window.devicePixelRatio, 2);
247
248        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
249        renderer.setSize(wCSS, hCSS);
250
251        const dpr = renderer.dpr;
252        const w = wCSS * dpr;
253        const h = hCSS * dpr;
254
255        uniforms.iResolution.value = [w, h];
256
257        const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
258        uniforms.rayPos.value = anchor;
259        uniforms.rayDir.value = dir;
260      };
261
262      const loop = t => {
263        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) {
264          return;
265        }
266
267        uniforms.iTime.value = t * 0.001;
268
269        if (followMouse && mouseInfluence > 0.0) {
270          const smoothing = 0.92;
271
272          smoothMouseRef.current.x = smoothMouseRef.current.x * smoothing + mouseRef.current.x * (1 - smoothing);
273          smoothMouseRef.current.y = smoothMouseRef.current.y * smoothing + mouseRef.current.y * (1 - smoothing);
274
275          uniforms.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y];
276        }
277
278        try {
279          renderer.render({ scene: mesh });
280          animationIdRef.current = requestAnimationFrame(loop);
281        } catch (error) {
282          console.warn('WebGL rendering error:', error);
283          return;
284        }
285      };
286
287      window.addEventListener('resize', updatePlacement);
288      updatePlacement();
289      animationIdRef.current = requestAnimationFrame(loop);
290
291      cleanupFunctionRef.current = () => {
292        if (animationIdRef.current) {
293          cancelAnimationFrame(animationIdRef.current);
294          animationIdRef.current = null;
295        }
296
297        window.removeEventListener('resize', updatePlacement);
298
299        if (renderer) {
300          try {
301            const canvas = renderer.gl.canvas;
302            const loseContextExt = renderer.gl.getExtension('WEBGL_lose_context');
303            if (loseContextExt) {
304              loseContextExt.loseContext();
305            }
306
307            if (canvas && canvas.parentNode) {
308              canvas.parentNode.removeChild(canvas);
309            }
310          } catch (error) {
311            console.warn('Error during WebGL cleanup:', error);
312          }
313        }
314
315        rendererRef.current = null;
316        uniformsRef.current = null;
317        meshRef.current = null;
318      };
319    };
320
321    initializeWebGL();
322
323    return () => {
324      if (cleanupFunctionRef.current) {
325        cleanupFunctionRef.current();
326        cleanupFunctionRef.current = null;
327      }
328    };
329  }, [
330    isVisible,
331    raysOrigin,
332    raysColor,
333    raysSpeed,
334    lightSpread,
335    rayLength,
336    pulsating,
337    fadeDistance,
338    saturation,
339    followMouse,
340    mouseInfluence,
341    noiseAmount,
342    distortion
343  ]);
344
345  useEffect(() => {
346    if (!uniformsRef.current || !containerRef.current || !rendererRef.current) return;
347
348    const u = uniformsRef.current;
349    const renderer = rendererRef.current;
350
351    u.raysColor.value = hexToRgb(raysColor);
352    u.raysSpeed.value = raysSpeed;
353    u.lightSpread.value = lightSpread;
354    u.rayLength.value = rayLength;
355    u.pulsating.value = pulsating ? 1.0 : 0.0;
356    u.fadeDistance.value = fadeDistance;
357    u.saturation.value = saturation;
358    u.mouseInfluence.value = mouseInfluence;
359    u.noiseAmount.value = noiseAmount;
360    u.distortion.value = distortion;
361
362    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
363    const dpr = renderer.dpr;
364    const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
365    u.rayPos.value = anchor;
366    u.rayDir.value = dir;
367  }, [
368    raysColor,
369    raysSpeed,
370    lightSpread,
371    raysOrigin,
372    rayLength,
373    pulsating,
374    fadeDistance,
375    saturation,
376    mouseInfluence,
377    noiseAmount,
378    distortion
379  ]);
380
381  useEffect(() => {
382    const handleMouseMove = e => {
383      if (!containerRef.current || !rendererRef.current) return;
384      const rect = containerRef.current.getBoundingClientRect();
385      const x = (e.clientX - rect.left) / rect.width;
386      const y = (e.clientY - rect.top) / rect.height;
387      mouseRef.current = { x, y };
388    };
389
390    if (followMouse) {
391      window.addEventListener('mousemove', handleMouseMove);
392      return () => window.removeEventListener('mousemove', handleMouseMove);
393    }
394  }, [followMouse]);
395
396  return <div ref={containerRef} className={`light-rays-container ${className}`.trim()} />;
397};
398
399export default LightRays;
400
CSS
1.light-rays-container {
2  width: 100%;
3  height: 100%;
4  position: relative;
5  pointer-events: none;
6  z-index: 3;
7  overflow: hidden;
8}
9