type ValidatableField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const FIELD_SELECTOR = 'input, textarea, select'
const ERROR_CLASS = 'is-input-error'
const SHAKE_CLASS = 'is-input-shaking'
const MOTION_CLASS = 'input-error-motion'
const NATIVE_ERROR_ATTRIBUTE = 'data-native-input-error'

function isValidatableField(target: EventTarget | Node | null): target is ValidatableField {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

function errorWrapper(field: ValidatableField) {
  return field.closest<HTMLElement>('.input-error-wrap')
}

function restartShake(field: ValidatableField) {
  field.classList.remove(SHAKE_CLASS)
  void field.offsetWidth
  field.classList.add(SHAKE_CLASS)
}

function showError(field: ValidatableField, restart = true) {
  field.classList.add(MOTION_CLASS, ERROR_CLASS)
  errorWrapper(field)?.classList.add(ERROR_CLASS)
  if (restart) restartShake(field)
}

function clearError(field: ValidatableField) {
  field.classList.remove(ERROR_CLASS, SHAKE_CLASS)
  errorWrapper(field)?.classList.remove(ERROR_CLASS)
}

export default defineNuxtPlugin(() => {
  const onInvalid = (event: Event) => {
    if (!isValidatableField(event.target)) return

    const field = event.target
    if (field.getAttribute('aria-invalid') !== 'true') {
      field.setAttribute(NATIVE_ERROR_ATTRIBUTE, '')
      field.setAttribute('aria-invalid', 'true')
    }
    showError(field)
  }

  const onInput = (event: Event) => {
    if (!isValidatableField(event.target)) return

    const field = event.target
    field.classList.remove(SHAKE_CLASS)
    if (!field.hasAttribute(NATIVE_ERROR_ATTRIBUTE)) return

    field.removeAttribute(NATIVE_ERROR_ATTRIBUTE)
    field.removeAttribute('aria-invalid')
    clearError(field)
  }

  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName !== 'input-error-shake' || !isValidatableField(event.target)) return
    event.target.classList.remove(SHAKE_CLASS)
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'aria-invalid') continue
      if (!isValidatableField(mutation.target)) continue

      const field = mutation.target
      if (field.getAttribute('aria-invalid') === 'true') {
        showError(field, !field.classList.contains(ERROR_CLASS))
      } else {
        clearError(field)
      }
    }
  })

  document.addEventListener('invalid', onInvalid, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('change', onInput, true)
  document.addEventListener('animationend', onAnimationEnd, true)
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-invalid'],
    subtree: true,
  })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      document.removeEventListener('invalid', onInvalid, true)
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('change', onInput, true)
      document.removeEventListener('animationend', onAnimationEnd, true)
      observer.disconnect()
    })
  }
})
