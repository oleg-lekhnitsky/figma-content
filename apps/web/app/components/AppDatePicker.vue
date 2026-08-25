<script setup lang="ts">
import { Calendar, ChevronLeft, ChevronRight } from 'reicon-vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  label: string
  min?: string
  max?: string
  surface?: 'line' | 'field'
  precision?: 'day' | 'month'
  clearable?: boolean
}>(), {
  modelValue: '',
  min: '',
  max: '',
  surface: 'line',
  precision: 'day',
  clearable: true
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
const calendar = ref<HTMLElement>()

const parseDate = (value: string) => {
  const match = props.precision === 'month'
    ? /^(\d{4})-(\d{2})$/.exec(value)
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1))
  return Number.isNaN(date.getTime()) ? undefined : date
}

const toDayValue = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')
].join('-')
const toMonthValue = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0')
].join('-')
const toValue = (date: Date) => props.precision === 'month' ? toMonthValue(date) : toDayValue(date)

const selectedDate = computed(() => parseDate(props.modelValue))
const minDate = computed(() => parseDate(props.min))
const maxDate = computed(() => parseDate(props.max))
const viewDate = ref(new Date())

const dateFormatter = { format: (date: Date) => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}` }
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const monthNameFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const weekdays = Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(2024, 0, index + 1)).replace('.', ''))
const displayValue = computed(() => selectedDate.value
  ? props.precision === 'month' ? monthFormatter.format(selectedDate.value) : dateFormatter.format(selectedDate.value)
  : '')

const sameDay = (first?: Date, second?: Date) => Boolean(first && second && toDayValue(first) === toDayValue(second))
const today = new Date()
const isDisabled = (date: Date) => Boolean(
  (minDate.value && date < minDate.value) ||
  (maxDate.value && date > maxDate.value)
)

const days = computed(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      value: toDayValue(date),
      inMonth: date.getMonth() === month,
      selected: sameDay(date, selectedDate.value),
      today: sameDay(date, today),
      disabled: isDisabled(date)
    }
  })
})

const months = computed(() => Array.from({ length: 12 }, (_, month) => {
  const date = new Date(viewDate.value.getFullYear(), month, 1)
  return {
    date,
    value: toMonthValue(date),
    label: monthNameFormatter.format(date),
    selected: selectedDate.value?.getFullYear() === date.getFullYear() && selectedDate.value?.getMonth() === month,
    current: today.getFullYear() === date.getFullYear() && today.getMonth() === month,
    disabled: isDisabled(date)
  }
}))

const initialTabDate = computed(() => {
  const selected = days.value.find(day => day.selected && !day.disabled)
  if (selected) return selected.value
  const current = days.value.find(day => day.today && day.inMonth && !day.disabled)
  if (current) return current.value
  return days.value.find(day => day.inMonth && !day.disabled)?.value
})
const initialTabMonth = computed(() => {
  const selected = months.value.find(month => month.selected && !month.disabled)
  if (selected) return selected.value
  const current = months.value.find(month => month.current && !month.disabled)
  if (current) return current.value
  return months.value.find(month => !month.disabled)?.value
})

const canShowMonth = (offset: number) => {
  const monthStart = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + offset, 1)
  const monthEnd = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + offset + 1, 0)
  return !(minDate.value && monthEnd < minDate.value) && !(maxDate.value && monthStart > maxDate.value)
}

const showMonth = (offset: number) => {
  if (!canShowMonth(offset)) return
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + offset, 1)
}

const canShowYear = (offset: number) => {
  const year = viewDate.value.getFullYear() + offset
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  return !(minDate.value && yearEnd < minDate.value) && !(maxDate.value && yearStart > maxDate.value)
}

const showYear = (offset: number) => {
  if (!canShowYear(offset)) return
  viewDate.value = new Date(viewDate.value.getFullYear() + offset, viewDate.value.getMonth(), 1)
}

const select = (date: Date) => {
  if (isDisabled(date)) return
  emit('update:modelValue', toValue(date))
  open.value = false
  nextTick(() => trigger.value?.focus())
}

const focusDate = async (date: Date) => {
  if (isDisabled(date)) return
  if (date.getMonth() !== viewDate.value.getMonth() || date.getFullYear() !== viewDate.value.getFullYear()) {
    viewDate.value = new Date(date.getFullYear(), date.getMonth(), 1)
    await nextTick()
  }
  calendar.value?.querySelector<HTMLElement>(`[data-calendar-date="${toDayValue(date)}"]`)?.focus()
}

const focusMonth = async (date: Date) => {
  if (isDisabled(date)) return
  if (date.getFullYear() !== viewDate.value.getFullYear()) {
    viewDate.value = new Date(date.getFullYear(), date.getMonth(), 1)
    await nextTick()
  }
  calendar.value?.querySelector<HTMLElement>(`[data-calendar-month="${toMonthValue(date)}"]`)?.focus()
}

const handleDayKeydown = (event: KeyboardEvent, date: Date) => {
  let next: Date | undefined
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : 7
    next = new Date(date)
    next.setDate(date.getDate() + offset)
  } else if (event.key === 'Home' || event.key === 'End') {
    const weekday = (date.getDay() + 6) % 7
    next = new Date(date)
    next.setDate(date.getDate() + (event.key === 'Home' ? -weekday : 6 - weekday))
  } else if (event.key === 'PageUp' || event.key === 'PageDown') {
    next = new Date(date)
    next.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1))
  }
  if (!next) return
  event.preventDefault()
  focusDate(next)
}

const handleMonthKeydown = (event: KeyboardEvent, date: Date) => {
  let offset: number | undefined
  if (event.key === 'ArrowLeft') offset = -1
  else if (event.key === 'ArrowRight') offset = 1
  else if (event.key === 'ArrowUp') offset = -3
  else if (event.key === 'ArrowDown') offset = 3
  else if (event.key === 'Home') offset = -date.getMonth()
  else if (event.key === 'End') offset = 11 - date.getMonth()
  else if (event.key === 'PageUp') offset = -12
  else if (event.key === 'PageDown') offset = 12
  if (offset === undefined) return
  event.preventDefault()
  focusMonth(new Date(date.getFullYear(), date.getMonth() + offset, 1))
}

const setOpen = (value: boolean) => {
  open.value = value
  if (!value) return
  const initialDate = selectedDate.value ?? today
  viewDate.value = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  nextTick(() => props.precision === 'month' ? focusMonth(initialDate) : focusDate(initialDate))
}

const clear = () => {
  emit('update:modelValue', '')
  open.value = false
  nextTick(() => trigger.value?.focus())
}
</script>

<template>
  <div class="date-field app-date-picker" :class="`app-date-picker--${surface}`">
    <AppPopover :open="open" :width="320" align="start" haspopup="dialog" @update:open="setOpen">
      <template #trigger="{ triggerProps }">
        <button ref="trigger" v-bind="triggerProps" class="app-date-picker-trigger" type="button" :aria-label="`${label}: ${displayValue || 'No date selected'}`">
          <span class="app-date-picker-trigger-copy" :class="{ 'has-value': displayValue }">
            <span class="app-date-picker-trigger-label">{{ label }}</span>
            <span v-if="displayValue" class="app-date-picker-trigger-value">{{ displayValue }}</span>
          </span>
          <Calendar :size="16" weight="Outline" :stroke-width="2" aria-hidden="true" />
        </button>
      </template>
      <template #default>
        <section ref="calendar" class="app-calendar" role="dialog" :aria-label="`${label} ${precision}`">
          <header class="app-calendar-header">
            <strong aria-live="polite">{{ precision === 'month' ? viewDate.getFullYear() : monthFormatter.format(viewDate) }}</strong>
            <div class="app-calendar-nav">
              <button type="button" :disabled="precision === 'month' ? !canShowYear(-1) : !canShowMonth(-1)" :aria-label="precision === 'month' ? 'Previous year' : 'Previous month'" @click="precision === 'month' ? showYear(-1) : showMonth(-1)"><ChevronLeft :size="20" :stroke-width="2" aria-hidden="true" /></button>
              <button type="button" :disabled="precision === 'month' ? !canShowYear(1) : !canShowMonth(1)" :aria-label="precision === 'month' ? 'Next year' : 'Next month'" @click="precision === 'month' ? showYear(1) : showMonth(1)"><ChevronRight :size="20" :stroke-width="2" aria-hidden="true" /></button>
            </div>
          </header>
          <div v-if="precision === 'month'" class="app-calendar-month-grid" role="grid" :aria-label="String(viewDate.getFullYear())">
            <button
              v-for="month in months"
              :key="month.value"
              type="button"
              role="gridcell"
              :data-calendar-month="month.value"
              :tabindex="month.value === initialTabMonth ? 0 : -1"
              :disabled="month.disabled"
              :aria-selected="month.selected"
              :aria-current="month.current ? 'date' : undefined"
              :class="{ 'is-selected': month.selected, 'is-today': month.current }"
              @click="select(month.date)"
              @keydown="handleMonthKeydown($event, month.date)"
            >{{ month.label }}</button>
          </div>
          <div v-else class="app-calendar-grid" role="grid" :aria-label="monthFormatter.format(viewDate)">
            <span v-for="weekday in weekdays" :key="weekday" class="app-calendar-weekday" role="columnheader">{{ weekday }}</span>
            <button
              v-for="day in days"
              :key="day.value"
              type="button"
              role="gridcell"
              :data-calendar-date="day.value"
              :tabindex="day.value === initialTabDate ? 0 : -1"
              :disabled="day.disabled"
              :aria-selected="day.selected"
              :aria-current="day.today ? 'date' : undefined"
              :class="{ 'is-outside': !day.inMonth, 'is-selected': day.selected, 'is-today': day.today }"
              @click="select(day.date)"
              @keydown="handleDayKeydown($event, day.date)"
            >{{ day.date.getDate() }}</button>
          </div>
          <footer class="app-calendar-footer">
            <button v-if="clearable" type="button" :disabled="!modelValue" @click="clear">Clear</button>
            <span v-else />
            <button type="button" :disabled="isDisabled(today)" @click="select(today)">{{ precision === 'month' ? 'This month' : 'Today' }}</button>
          </footer>
        </section>
      </template>
    </AppPopover>
  </div>
</template>

<style scoped>
.app-date-picker {
  min-width: 0;
  display: grid;
  gap: var(--space);
}
.app-date-picker-trigger {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--filter-control-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  padding: 0;
  border: 0;
  border-bottom: var(--filter-hairline) solid var(--filter-overlay-border-color);
  border-radius: 0;
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font: inherit;
  font-size: var(--filter-control-font-size);
  font-weight: 500;
  text-align: start;
}
.app-date-picker-trigger-copy {
  min-width: 0;
  display: grid;
  align-content: center;
  line-height: 1.05;
}
.app-date-picker-trigger-label {
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
}
.app-date-picker-trigger-copy.has-value {
  gap: 2px;
}
.app-date-picker-trigger-copy.has-value .app-date-picker-trigger-label {
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-caption-size);
}
.app-date-picker-trigger-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-date-picker-trigger:focus-visible,
.app-calendar button:focus-visible {
  outline: var(--filter-focus-width) solid var(--color-accent);
  outline-offset: var(--filter-focus-width);
}
.app-date-picker--field .app-date-picker-trigger {
  min-height: var(--filter-action-height);
  padding-inline: var(--filter-option-padding);
  border: 0;
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}
.app-calendar {
  box-sizing: border-box;
  width: 100%;
  display: grid;
  gap: var(--space);
  padding: var(--filter-action-padding);
  border-radius: calc(var(--radius) * 1.5);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-nested-background);
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.app-calendar-header,
.app-calendar-footer,
.app-calendar-nav { display: flex; align-items: center; }
.app-calendar-header { justify-content: space-between; gap: var(--space); }
.app-calendar-header strong { font-size: var(--filter-action-font-size); }
.app-calendar-nav { gap: var(--filter-option-gap); }
.app-calendar-nav button,
.app-calendar-grid button,
.app-calendar-month-grid button {
  width: var(--filter-option-height);
  min-width: var(--filter-option-height);
  height: var(--filter-option-height);
  min-height: var(--filter-option-height);
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
}
.app-calendar button:disabled { color: var(--filter-overlay-muted-color); }
.app-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--filter-option-gap);
}
.app-calendar-month-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--filter-option-gap);
}
.app-calendar-month-grid button {
  width: 100%;
  min-width: 0;
  border-radius: var(--filter-pill-radius);
}
.app-calendar-weekday {
  display: grid;
  place-items: center;
  min-height: var(--filter-option-height);
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-caption-size);
  font-weight: 700;
}
.app-calendar-grid button {
  width: 100%;
  min-width: 0;
  height: auto;
  min-height: 0;
  aspect-ratio: 1;
}
.app-calendar-grid button.is-outside { color: var(--filter-overlay-muted-color); }
.app-calendar-grid button.is-today { box-shadow: inset 0 0 0 var(--filter-hairline) var(--filter-overlay-border-color); }
.app-calendar-month-grid button.is-today { box-shadow: inset 0 0 0 var(--filter-hairline) var(--filter-overlay-border-color); }
.app-calendar-grid button.is-selected,
.app-calendar-month-grid button.is-selected {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  box-shadow: none;
}
.app-calendar-footer { justify-content: space-between; }
.app-calendar-footer button {
  min-height: var(--filter-option-height);
  padding-inline: var(--filter-option-padding);
  border: 0;
  border-radius: var(--filter-pill-radius);
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
  font-weight: 700;
}
.app-calendar button:not(:disabled):active { scale: .96; }
@media (hover: hover) {
  .app-calendar button:not(:disabled):hover { background: var(--filter-overlay-control-hover-background); }
  .app-calendar-grid button.is-selected:hover { background: var(--filter-overlay-primary-background); }
  .app-calendar-month-grid button.is-selected:hover { background: var(--filter-overlay-primary-background); }
}
@media (max-width: 520px) {
  .app-calendar { padding: var(--filter-sheet-inline-padding-mobile); border-radius: calc(var(--radius-mobile) * 1.5); }
  .app-calendar-nav button { min-height: var(--range-control-height-mobile); height: var(--range-control-height-mobile); }
}
</style>
