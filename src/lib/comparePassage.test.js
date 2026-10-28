import { describe, expect, it } from 'vitest'
import { comparePassage } from './comparePassage.js'

describe('comparePassage', () => {
  it('starts with no entered characters, mistakes, or completion', () => {
    const result = comparePassage('Go!', '')

    expect(result.enteredCount).toBe(0)
    expect(result.mistakeCount).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.characters.map(item => item.state)).toEqual([
      'remaining', 'remaining', 'remaining',
    ])
    expect(result.characters.filter(item => item.isNext).map(item => item.character)).toEqual(['G'])
  })

  it('marks a correct prefix and the next unentered position', () => {
    const result = comparePassage('Go, go.', 'Go,')

    expect(result.enteredCount).toBe(3)
    expect(result.mistakeCount).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.characters.map(item => item.state)).toEqual([
      'correct', 'correct', 'correct', 'remaining', 'remaining', 'remaining', 'remaining',
    ])
    expect(result.characters.findIndex(item => item.isNext)).toBe(3)
  })

  it.each([
    ['letter', 'cat', 'cut', 1],
    ['expected space', 'a b', 'axb', 1],
    ['entered space', 'cat', 'c t', 1],
    ['capitalization', 'Cat', 'cat', 0],
    ['punctuation', 'go.', 'go!', 2],
    ['newline', 'a b', 'a\nb', 1],
  ])('compares a mismatching %s by position', (_label, passage, input, errorIndex) => {
    const result = comparePassage(passage, input)

    expect(result.characters[errorIndex].state).toBe('incorrect')
    expect(result.characters.filter(item => item.state === 'incorrect')).toHaveLength(1)
    expect(result.enteredCount).toBe(input.length)
    expect(result.mistakeCount).toBe(1)
    expect(result.isComplete).toBe(false)
    expect(result.characters.some(item => item.isNext)).toBe(false)
  })

  it('recalculates current mistakes after deletion and correction', () => {
    expect(comparePassage('cat', 'cxt').mistakeCount).toBe(1)

    const shortened = comparePassage('cat', 'c')
    expect(shortened.mistakeCount).toBe(0)
    expect(shortened.characters[1].state).toBe('remaining')

    const corrected = comparePassage('cat', 'cat')
    expect(corrected.mistakeCount).toBe(0)
    expect(corrected.isComplete).toBe(true)
    expect(corrected.characters.every(item => item.state === 'correct')).toBe(true)
    expect(corrected.characters.some(item => item.isNext)).toBe(false)
  })

  it('requires exact text rather than a length match or normalized text', () => {
    expect(comparePassage('Go!', 'Go?').isComplete).toBe(false)
    expect(comparePassage('Go!', 'go!').isComplete).toBe(false)
    expect(comparePassage('Go!', 'Go! ').isComplete).toBe(false)
    expect(comparePassage('Go!', 'Go! ').mistakeCount).toBe(1)
    expect(comparePassage('Go!', 'Go!').isComplete).toBe(true)
  })
})
