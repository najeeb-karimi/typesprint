import { describe, expect, it } from 'vitest'
import { INITIAL_PASSAGE_ID, PASSAGES } from './passages.js'

const CATEGORY_BOUNDS = {
  short: [100, 180],
  medium: [220, 320],
  long: [400, 550],
}

describe('passage catalog', () => {
  it('contains twelve passages, with four in each length category', () => {
    expect(PASSAGES).toHaveLength(12)

    for (const category of Object.keys(CATEGORY_BOUNDS)) {
      expect(PASSAGES.filter(passage => passage.category === category)).toHaveLength(4)
    }
  })

  it('gives every passage a unique, nonempty ID and unique reference text', () => {
    for (const passage of PASSAGES) {
      expect(typeof passage.id).toBe('string')
      expect(passage.id.trim()).not.toBe('')
      expect(passage.id).toBe(passage.id.trim())
    }

    expect(new Set(PASSAGES.map(passage => passage.id)).size).toBe(12)
    expect(new Set(PASSAGES.map(passage => passage.text)).size).toBe(12)
  })

  it('preserves the original 130-character passage as the initial Short choice', () => {
    const initial = PASSAGES.find(passage => passage.id === INITIAL_PASSAGE_ID)

    expect(initial).toMatchObject({
      id: 'steady-progress',
      category: 'short',
      text: 'Small steps build steady progress. Take a breath, find your rhythm, and let each careful keystroke bring the next word into focus.',
    })
    expect(initial.text).toHaveLength(130)
  })

  for (const passage of PASSAGES) {
    it(`keeps ${passage.id} within its category bounds and text rules`, () => {
      const bounds = CATEGORY_BOUNDS[passage.category]
      expect(bounds).toBeDefined()
      expect(typeof passage.text).toBe('string')
      expect(passage.text.length).toBeGreaterThanOrEqual(bounds[0])
      expect(passage.text.length).toBeLessThanOrEqual(bounds[1])
      expect(passage.text).toMatch(/^[\x20-\x7e]+$/)
      expect(passage.text).toBe(passage.text.trim())
      expect(passage.text).not.toContain('  ')
    })
  }
})
