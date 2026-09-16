// Web Animations API — no gsap dependency. Per-keyframe `easing` (applies to
// the segment leading INTO that keyframe) is what lets a single animate()
// call carry two different eases, the same way a gsap timeline chained two
// separate tweens. The cubic-beziers below are visual approximations of
// gsap's power2/power3 curves, not exact ports — there's no official
// CSS equivalent for gsap's power eases.
export const EASE_POWER2_IN = 'cubic-bezier(0.55, 0, 1, 0.45)'
export const EASE_POWER2_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const EASE_POWER3_IN = 'cubic-bezier(0.7, 0, 0.84, 0)'
export const EASE_POWER3_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Limit break execution flash
export const animateLimitBreakExecute = (container: HTMLElement) => {
  // Create flash overlay
  const flash = document.createElement('div')
  flash.style.position = 'absolute'
  flash.style.inset = '0'
  flash.style.backgroundColor = 'white'
  flash.style.pointerEvents = 'none'
  container.appendChild(flash)

  const animation = flash.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 0.8, offset: 0.25, easing: EASE_POWER2_IN }, // 0.1s of the 0.4s total
      { opacity: 0, offset: 1, easing: EASE_POWER2_OUT }, // 0.3s of the 0.4s total
    ],
    { duration: 400, fill: 'forwards' },
  )

  animation.finished.then(() => flash.remove()).catch(() => flash.remove())

  return animation
}

// Initial load animation for the entire overlay
export const animateOverlayEntrance = (container: HTMLElement) => {
  const animations: Animation[] = []

  // Find different sections
  const limitbreak = container.querySelector('[data-limitbreak]')
  const timeline = container.querySelector('[data-timeline]')
  const music = container.querySelector('[data-music]')

  // Stagger the entrance of each section — delays mirror the gsap
  // timeline's absolute start offsets (0, 0.1s, 0.2s), not a sequential chain.
  if (limitbreak) {
    animations.push(
      limitbreak.animate(
        [
          { transform: 'translateY(-20px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 600, easing: EASE_POWER3_OUT, fill: 'backwards' },
      ),
    )
  }

  if (timeline) {
    animations.push(
      timeline.animate(
        [
          { transform: 'translateX(-30px)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration: 600, delay: 100, easing: EASE_POWER3_OUT, fill: 'backwards' },
      ),
    )
  }

  if (music) {
    animations.push(
      music.animate(
        [
          { transform: 'translateY(20px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 600, delay: 200, easing: EASE_POWER3_OUT, fill: 'backwards' },
      ),
    )
  }

  return animations
}
