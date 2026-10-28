export default function PassageDisplay({ passage, characters }) {
  return (
    <p className="passage" dir="ltr">
      {/* Keep one coherent passage available alongside the visual character feedback. */}
      <span id="practice-passage" className="sr-only">{passage}</span>
      <span className="passage-characters" aria-hidden="true">
        {characters.map(({ character, state, isNext }, index) => (
          <span
            key={index}
            className={[
              'passage-character',
              `passage-character--${state}`,
              isNext ? 'passage-character--next' : '',
              character === ' ' && state === 'incorrect' ? 'passage-character--space' : '',
            ].filter(Boolean).join(' ')}
          >
            {character}
          </span>
        ))}
      </span>
    </p>
  )
}
