/**
 * Choose uniformly from the requested category, excluding the current passage.
 * Supply a random value in [0, 1); this helper never draws randomness itself.
 * The catalog is authored and validated separately, and is never modified here.
 *
 * @param {import('../data/passages.js').Passage[]} catalog
 * @param {'short'|'medium'|'long'} category
 * @param {string|null} currentId
 * @param {number} randomValue
 * @returns {import('../data/passages.js').Passage}
 * @throws {RangeError} If the random value is invalid or no candidate remains.
 */
export function selectNextPassage(catalog, category, currentId, randomValue) {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('The random value must be at least 0 and less than 1.')
  }

  const candidates = catalog.filter(passage =>
    passage.category === category && passage.id !== currentId)

  if (candidates.length === 0) {
    throw new RangeError('No different passage is available in the requested category.')
  }

  return candidates[Math.floor(randomValue * candidates.length)]
}
