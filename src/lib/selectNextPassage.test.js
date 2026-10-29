import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectNextPassage } from './selectNextPassage.js'

// Short fixture texts separate candidate selection from catalog content rules.
const catalog = [
  { id: 'short-a', category: 'short', text: 'First short passage.' },
  { id: 'medium-a', category: 'medium', text: 'A medium passage.' },
  { id: 'short-b', category: 'short', text: 'Second short passage.' },
  { id: 'long-a', category: 'long', text: 'A long passage.' },
  { id: 'short-c', category: 'short', text: 'Third short passage.' },
  { id: 'short-d', category: 'short', text: 'Fourth short passage.' },
]

afterEach(() => vi.restoreAllMocks())

describe('selectNextPassage', () => {
  it.each([
    ['medium', 'short-a', 0, 'medium-a'],
    ['long', 'short-a', 0.99, 'long-a'],
    ['short', 'medium-a', 0, 'short-a'],
  ])('selects only from %s when the current passage is %s', (category, currentId, randomValue, id) => {
    expect(selectNextPassage(catalog, category, currentId, randomValue).id).toBe(id)
  })

  it.each([
    [0, 'short-b'],
    [1 / 3 - Number.EPSILON, 'short-b'],
    [1 / 3, 'short-c'],
    [2 / 3 - Number.EPSILON, 'short-c'],
    [2 / 3, 'short-d'],
    [1 - Number.EPSILON, 'short-d'],
  ])('maps %s into equal intervals after excluding the current passage', (randomValue, id) => {
    expect(selectNextPassage(catalog, 'short', 'short-a', randomValue).id).toBe(id)
  })

  it.each([
    [0, 'short-a'],
    [0.25 - Number.EPSILON, 'short-a'],
    [0.25, 'short-b'],
    [0.5 - Number.EPSILON, 'short-b'],
    [0.5, 'short-c'],
    [0.75 - Number.EPSILON, 'short-c'],
    [0.75, 'short-d'],
    [1 - Number.EPSILON, 'short-d'],
  ])('uses the whole category when %s is supplied and the current ID is absent', (randomValue, id) => {
    expect(selectNextPassage(catalog, 'short', 'not-in-catalog', randomValue).id).toBe(id)
  })

  it.each(['short-b', 'short-c', 'short-d'])('excludes %s wherever it appears in the catalog', currentId => {
    const choices = [0, 0.5, 1 - Number.EPSILON]
      .map(randomValue => selectNextPassage(catalog, 'short', currentId, randomValue).id)

    expect(choices).not.toContain(currentId)
    expect(new Set(choices).size).toBe(3)
  })

  it('accepts no current passage and returns an eligible catalog record', () => {
    const selected = selectNextPassage(catalog, 'short', null, 0)

    expect(selected).toBe(catalog[0])
  })

  it('can return an earlier passage after another passage has intervened', () => {
    const next = selectNextPassage(catalog, 'short', 'short-a', 0)
    const following = selectNextPassage(catalog, 'short', next.id, 0)

    expect(next.id).toBe('short-b')
    expect(following.id).toBe('short-a')
  })

  it('produces the same result for the same inputs without drawing random values', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Selection must use the supplied random value.')
    })
    const first = selectNextPassage(catalog, 'short', 'short-a', 0.5)
    const second = selectNextPassage(catalog, 'short', 'short-a', 0.5)

    expect(first.id).toBe('short-c')
    expect(second).toBe(first)
    expect(random).not.toHaveBeenCalled()
  })

  it('does not mutate or reorder the catalog or its records', () => {
    const frozen = Object.freeze(catalog.map(passage => Object.freeze({ ...passage })))
    const original = structuredClone(frozen)

    selectNextPassage(frozen, 'short', 'short-a', 0.99)
    selectNextPassage(frozen, 'medium', 'short-a', 0)

    expect(frozen).toEqual(original)
  })

  it.each([undefined, null, '0.5', NaN, Infinity, -Infinity, -0.01, 1, 2])(
    'rejects an invalid random value instead of returning an undefined choice: %s',
    randomValue => {
      expect(() => selectNextPassage(catalog, 'short', 'short-a', randomValue))
        .toThrow(RangeError)
    },
  )

  it.each([
    [[], 'short', null],
    [catalog, 'missing-category', 'short-a'],
    [catalog, 'medium', 'medium-a'],
  ])('rejects a request with no different eligible passage: %j', (passages, category, currentId) => {
    expect(() => selectNextPassage(passages, category, currentId, 0))
      .toThrow('No different passage is available in the requested category.')
  })
})
