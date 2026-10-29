/**
 * @typedef {Object} Passage
 * @property {string} id Stable identity, independent of catalog order.
 * @property {'short'|'medium'|'long'} category Length group, not difficulty.
 * @property {string} text The exact reference text; derive character counts from it.
 */

export const INITIAL_PASSAGE_ID = 'steady-progress'

/** @type {Passage[]} */
export const PASSAGES = [
  {
    id: 'steady-progress',
    category: 'short',
    text:
      'Small steps build steady progress. '
      + 'Take a breath, find your rhythm, and let each careful keystroke bring the next word into focus.',
  },
  {
    id: 'morning-window',
    category: 'short',
    text:
      'Morning light reaches the window as the street begins to wake. '
      + 'A warm cup rests on the table, and the day feels open to small possibilities.',
  },
  {
    id: 'quiet-kitchen',
    category: 'short',
    text:
      'A pot of soup simmers in the quiet kitchen. '
      + 'Someone sets out bowls, folds a clean towel, and opens the window to let the evening air inside.',
  },
  {
    id: 'park-path',
    category: 'short',
    text:
      'The path curves past a wooden bench and a row of young trees. '
      + 'Walk a little slower, notice the changing light, and enjoy the space around you.',
  },
  {
    id: 'market-walk',
    category: 'medium',
    text:
      'At the market, empty baskets slowly fill with apples, bread, and fresh herbs. '
      + 'A shopkeeper arranges flowers beside the doorway while two neighbors stop to talk. '
      + 'There is no need to hurry; the walk home leaves plenty of time to plan a simple lunch.',
  },
  {
    id: 'rainy-afternoon',
    category: 'medium',
    text:
      'Rain taps against the glass while a book lies open on the desk. '
      + 'Across the room, a lamp casts a warm circle of light over a half-finished drawing. '
      + 'The afternoon is quiet enough to hear each page turn, and a small task finally gets the attention it needs.',
  },
  {
    id: 'shared-garden',
    category: 'medium',
    text:
      'The shared garden looks different each week. '
      + 'New leaves unfold beside the fence, and a narrow trail leads between the beds. '
      + 'Before leaving, the volunteers put their tools away and water the youngest plants. '
      + 'Small, regular efforts give everyone something to enjoy.',
  },
  {
    id: 'train-window',
    category: 'medium',
    text:
      'Beyond the train window, fields give way to houses and busy streets. '
      + 'A traveler closes a notebook as the next station comes into view. '
      + 'There is still time to check the platform number, gather a jacket, and take one last look at the landscape passing by.',
  },
  {
    id: 'library-visit',
    category: 'long',
    text:
      'The library opens just as the morning rain begins. '
      + 'Inside, a visitor shakes water from a coat and follows the signs toward a quiet reading room. '
      + 'A stack of books waits beside a comfortable chair, but there is no rush to choose one. '
      + 'Near the window, someone sketches the shape of a nearby roof. '
      + 'By the time the rain stops, a few pages have become a whole chapter, and an ordinary morning has turned into a welcome break from a busy week.',
  },
  {
    id: 'weekend-workshop',
    category: 'long',
    text:
      'On Saturday, a small group gathers around a workbench to repair an old wooden shelf. '
      + 'They begin by sorting screws into shallow trays and checking which tools they need. '
      + 'One person measures the boards while another smooths a rough edge. '
      + 'The work moves slowly at first, then becomes easier as everyone finds a useful task. '
      + 'When the shelf stands level again, they clear the table and share a pot of tea. '
      + 'Finishing together feels as satisfying as the repair itself.',
  },
  {
    id: 'coastal-path',
    category: 'long',
    text:
      'A narrow path follows the coast between low grass and pale stones. '
      + 'The wind carries the sound of waves, and a fishing boat moves slowly across the water. '
      + 'Two walkers pause to look at a map before continuing toward a distant shelter. '
      + 'They have brought enough food for lunch and enough time to stop whenever the view changes. '
      + 'By late afternoon, the return journey feels familiar, but the shifting light makes each bend in the path look a little different.',
  },
  {
    id: 'neighborhood-evening',
    category: 'long',
    text:
      'As evening settles over the neighborhood, people begin to drift outside. '
      + 'A bicycle leans against a gate, and someone carries a folding chair onto the front step. '
      + 'Across the road, a family waters a line of plants before sitting down to eat. '
      + 'The sounds of conversation mix with the soft rattle of dishes through an open window. '
      + 'Nothing unusual happens, yet the street feels full of small connections. '
      + 'A short walk becomes a chance to slow down and notice the people who share this place.',
  },
]
