export function comparePassage(passage, input) {
  let mistakeCount = Math.max(0, input.length - passage.length)

  const characters = passage.split('').map((character, index) => {
    let state = 'remaining'

    if (index < input.length) {
      state = input[index] === character ? 'correct' : 'incorrect'

      if (state === 'incorrect') {
        mistakeCount += 1
      }
    }

    return { character, state, isNext: index === input.length }
  })

  return {
    characters,
    enteredCount: input.length,
    mistakeCount,
    isComplete: input === passage,
  }
}
