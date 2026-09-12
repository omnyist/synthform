import { gsap } from 'gsap'

// Limit break execution flash
export const animateLimitBreakExecute = (container: HTMLElement) => {
  // Create flash overlay
  const flash = document.createElement('div')
  flash.style.position = 'absolute'
  flash.style.inset = '0'
  flash.style.backgroundColor = 'white'
  flash.style.pointerEvents = 'none'
  container.appendChild(flash)

  return gsap
    .timeline()
    .fromTo(flash, { opacity: 0 }, { opacity: 0.8, duration: 0.1, ease: 'power2.in' })
    .to(flash, { opacity: 0, duration: 0.3, ease: 'power2.out' })
    .call(() => flash.remove())
}

// Initial load animation for the entire overlay
export const animateOverlayEntrance = (container: HTMLElement) => {
  const tl = gsap.timeline()

  // Find different sections
  const limitbreak = container.querySelector('[data-limitbreak]')
  const timeline = container.querySelector('[data-timeline]')
  const music = container.querySelector('[data-music]')

  // Stagger the entrance of each section
  if (limitbreak) {
    tl.fromTo(
      limitbreak,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      0,
    )
  }

  if (timeline) {
    tl.fromTo(
      timeline,
      { x: -30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      0.1,
    )
  }

  if (music) {
    tl.fromTo(
      music,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      0.2,
    )
  }

  return tl
}

