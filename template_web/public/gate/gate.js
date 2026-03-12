const form = document.getElementById('gate-form')
const passwordInput = document.getElementById('password')
const submitButton = document.getElementById('submit-button')
const errorNode = document.getElementById('gate-error')
const raysContainer = document.querySelector('.gate-rays')
const GATE_STORAGE_KEY = 'appbox_gate_access'
const GATE_COOKIE_NAME = 'appbox_gate_access'
const GATE_ACCESS_VALUE = 'granted'
const GATE_COOKIE_MAX_AGE = 60 * 60 * 12
const LOCAL_PASSWORD_HASH = '96f93461f4956829eee4907b2c7272e5ba7167e36648fd7eb3f69387a2dd23d3'
const submitButtonText =
  submitButton instanceof HTMLButtonElement ? submitButton.textContent || 'GO' : 'GO'

function initLightRays(container) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  let width = 0
  let height = 0
  let animationFrameId = 0
  let pointerX = 0.5
  let targetPointerX = 0.5
  let targetPointerY = 0.2

  const beams = [
    { offset: -0.28, widthRatio: 0.2, alpha: 0.15, speed: 0.00042, sway: 0.018 },
    { offset: -0.12, widthRatio: 0.16, alpha: 0.12, speed: 0.0005, sway: 0.022 },
    { offset: 0, widthRatio: 0.14, alpha: 0.13, speed: 0.00036, sway: 0.016 },
    { offset: 0.12, widthRatio: 0.16, alpha: 0.11, speed: 0.00046, sway: 0.02 },
    { offset: 0.28, widthRatio: 0.2, alpha: 0.15, speed: 0.0004, sway: 0.018 },
  ]

  canvas.setAttribute('aria-hidden', 'true')
  container.appendChild(canvas)

  function resizeCanvas() {
    const rect = container.getBoundingClientRect()
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    width = rect.width
    height = rect.height
    canvas.width = Math.max(1, Math.round(width * devicePixelRatio))
    canvas.height = Math.max(1, Math.round(height * devicePixelRatio))
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  }

  function drawBeam(originX, originY, angle, beamWidth, beamLength, alpha) {
    context.save()
    context.translate(originX, originY)
    context.rotate(angle)
    context.filter = 'blur(18px)'

    const gradient = context.createLinearGradient(0, 0, 0, beamLength)
    gradient.addColorStop(0, `rgba(229, 229, 229, ${alpha + 0.18})`)
    gradient.addColorStop(0.12, `rgba(236, 236, 236, ${alpha})`)
    gradient.addColorStop(0.4, `rgba(247, 247, 247, ${alpha * 0.45})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient

    context.beginPath()
    context.moveTo(-beamWidth * 0.18, 0)
    context.lineTo(beamWidth * 0.18, 0)
    context.lineTo(beamWidth * 1.32, beamLength)
    context.lineTo(-beamWidth * 1.32, beamLength)
    context.closePath()
    context.fill()
    context.restore()
  }

  function render(time) {
    pointerX += (targetPointerX - pointerX) * 0.04

    context.clearRect(0, 0, width, height)

    const originX = width * (0.5 + (pointerX - 0.5) * 0.08)
    const originY = -height * 0.08
    const beamLength = height * 1.05

    const glowGradient = context.createRadialGradient(originX, originY, 0, originX, originY, width * 0.42)
    glowGradient.addColorStop(0, 'rgba(239, 239, 239, 0.9)')
    glowGradient.addColorStop(0.22, 'rgba(244, 244, 244, 0.42)')
    glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = glowGradient
    context.fillRect(0, 0, width, height)

    for (const beam of beams) {
      const angle = beam.offset + Math.sin(time * beam.speed) * beam.sway + (pointerX - 0.5) * 0.08
      drawBeam(originX, originY, angle, width * beam.widthRatio, beamLength, beam.alpha)
    }

    const lowerGlow = context.createRadialGradient(
      width * 0.5,
      height * (0.18 + targetPointerY * 0.08),
      0,
      width * 0.5,
      height * 0.22,
      width * 0.5,
    )
    lowerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
    lowerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = lowerGlow
    context.fillRect(0, 0, width, height)

    animationFrameId = window.requestAnimationFrame(render)
  }

  function handlePointerMove(event) {
    targetPointerX = event.clientX / window.innerWidth
    targetPointerY = event.clientY / window.innerHeight
  }

  resizeCanvas()
  animationFrameId = window.requestAnimationFrame(render)

  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('pointermove', handlePointerMove)

  return () => {
    window.cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', resizeCanvas)
    window.removeEventListener('pointermove', handlePointerMove)
    canvas.remove()
  }
}

function setClientGateAccess() {
  window.localStorage.setItem(GATE_STORAGE_KEY, GATE_ACCESS_VALUE)
  document.cookie =
    `${GATE_COOKIE_NAME}=${GATE_ACCESS_VALUE}; Max-Age=${GATE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
}

function hasClientGateAccess() {
  const hasLocalAccess = window.localStorage.getItem(GATE_STORAGE_KEY) === GATE_ACCESS_VALUE
  const hasCookieAccess = document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${GATE_COOKIE_NAME}=${GATE_ACCESS_VALUE}`)

  return hasLocalAccess || hasCookieAccess
}

async function sha256(text) {
  const payload = new TextEncoder().encode(text)
  const digest = await window.crypto.subtle.digest('SHA-256', payload)

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

async function canUseLocalPassword(password) {
  const passwordHash = await sha256(password)
  return passwordHash === LOCAL_PASSWORD_HASH
}

function resolveNextPath() {
  const next = new URL(window.location.href).searchParams.get('next') || '/'
  if (!next.startsWith('/')) {
    return '/'
  }

  if (next.startsWith('/gate')) {
    return '/'
  }

  return next
}

async function loginByLocalPassword(password) {
  if (!(await canUseLocalPassword(password))) {
    throw new Error('访问口令错误')
  }

  setClientGateAccess()
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const password = passwordInput instanceof HTMLInputElement ? passwordInput.value.trim() : ''
  if (!password) {
    if (errorNode) {
      errorNode.textContent = '请输入访问口令'
    }
    return
  }

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true
    submitButton.textContent = '...'
  }
  if (errorNode) {
    errorNode.textContent = ''
  }

  try {
    let shouldFallbackToLocal = false
    let response

    try {
      response = await fetch('/gate/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-AppBox-Password': password,
        },
      })
    } catch {
      shouldFallbackToLocal = true
    }

    if (response) {
      if (response.ok) {
        setClientGateAccess()
      } else if (response.status === 404 || response.status === 405) {
        shouldFallbackToLocal = true
      } else {
        throw new Error(response.status === 403 ? '访问口令错误' : '登录失败，请稍后重试')
      }
    }

    if (shouldFallbackToLocal) {
      await loginByLocalPassword(password)
    }

    window.location.replace(resolveNextPath())
  } catch (error) {
    if (errorNode) {
      errorNode.textContent = error instanceof Error ? error.message : '登录失败，请稍后重试'
    }
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false
      submitButton.textContent = submitButtonText
    }
  }
})

if (passwordInput instanceof HTMLInputElement) {
  window.requestAnimationFrame(() => {
    if (hasClientGateAccess()) {
      window.location.replace(resolveNextPath())
      return
    }

    passwordInput.focus()
  })
}

if (raysContainer instanceof HTMLDivElement) {
  initLightRays(raysContainer)
}
