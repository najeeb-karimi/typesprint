import { describe, expect, it } from 'vitest'
import { formatAccuracy, formatElapsedTime, formatWpm } from './formatAttemptMetrics.js'

describe('elapsed-time formatting', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [3_661_000, '61:01'],
  ])('formats %i ms as %s during an attempt without rounding forward', (elapsedMs, expected) => {
    expect(formatElapsedTime(elapsedMs)).toBe(expected)
  })

  it.each([
    [0, '0:00.0'],
    [49, '0:00.0'],
    [50, '0:00.1'],
    [12_345, '0:12.3'],
    [59_949, '0:59.9'],
    [59_950, '1:00.0'],
    [59_999, '1:00.0'],
    [3_599_950, '60:00.0'],
  ])('rounds final %i ms to %s, carrying into the next minute', (elapsedMs, expected) => {
    expect(formatElapsedTime(elapsedMs, { includeTenths: true })).toBe(expected)
  })

  it.each([null, undefined, NaN, Infinity, -1])('marks unavailable time as a dash: %s', value => {
    expect(formatElapsedTime(value)).toBe('—')
    expect(formatElapsedTime(value, { includeTenths: true })).toBe('—')
  })
})

describe('score formatting', () => {
  it.each([
    [0, '0'],
    [0.49, '0'],
    [51.49, '51'],
    [51.5, '52'],
    [52, '52'],
  ])('formats %s WPM as a whole number: %s', (value, expected) => {
    expect(formatWpm(value)).toBe(expected)
  })

  it.each([
    [0, '0.0%'],
    [75, '75.0%'],
    [100 * 2 / 3, '66.7%'],
    [99.96, '100.0%'],
    [100, '100.0%'],
  ])('formats %s accuracy to one decimal place: %s', (value, expected) => {
    expect(formatAccuracy(value)).toBe(expected)
  })

  it.each([null, undefined, NaN, Infinity, -1])('does not turn missing or invalid scores into zero: %s', value => {
    expect(formatWpm(value)).toBe('—')
    expect(formatAccuracy(value)).toBe('—')
  })

  it('does not display an impossible accuracy value', () => {
    expect(formatAccuracy(100.1)).toBe('—')
  })
})
