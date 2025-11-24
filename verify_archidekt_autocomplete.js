const { autocomplete } = require('./commands/games/archidekt')
const { upsertUserDeckAsync, removeUserDeckAsync } = require('./utils/archidektUserDecks')

// Mock interaction object
const createMockInteraction = (focusedName, focusedValue, userId) => {
  return {
    user: { id: userId },
    options: {
      getFocused: (full) => {
        if (full) return { name: focusedName, value: focusedValue }
        return focusedValue
      },
    },
    respond: async (choices) => {
      console.log(`Response for ${focusedName}="${focusedValue}":`)
      console.log(JSON.stringify(choices, null, 2))
    },
    responded: false,
  }
}

async function runVerification() {
  const userId = 'test-user-123'

  console.log('--- Setting up test data ---')
  // Add some test decks
  await upsertUserDeckAsync(userId, 12345, 'Commander Deck', 'UserA', 'commander', true)
  await upsertUserDeckAsync(userId, 67890, 'Modern Deck', 'UserA', 'modern', false)

  console.log('\n--- Testing deck autocomplete ---')
  // Test 1: Search by ID
  await autocomplete(createMockInteraction('deck', '123', userId))

  // Test 2: Search by Name
  await autocomplete(createMockInteraction('deck', 'Modern', userId))

  // Test 3: Search by Alias
  await autocomplete(createMockInteraction('deck', 'comm', userId))

  // Test 4: No match
  await autocomplete(createMockInteraction('deck', 'xyz', userId))

  console.log('\n--- Cleaning up ---')
  await removeUserDeckAsync(userId, { deckId: 12345 })
  await removeUserDeckAsync(userId, { deckId: 67890 })
}

runVerification().catch(console.error)
