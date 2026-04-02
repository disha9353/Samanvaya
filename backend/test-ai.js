// Test script to verify AI services
// Run with: node test-ai.js (after setting OPENAI_API_KEY in .env)

const { chatWithAI, generateBarterSuggestions, parsePickupRequest, suggestQuickReplies, detectSpam, translateMessage, analyzeEcoActivities } = require('./services/aiService');

async function testAI() {
  try {
    console.log('Testing AI chat service...');
    const chatResponse = await chatWithAI('Hello, can you help me with recycling?', {
      userInfo: {
        ecoScore: 100,
        walletCredits: 50,
        items: [],
        pickups: []
      },
      history: []
    });
    console.log('✅ AI Chat Response:', chatResponse);

    console.log('\nTesting barter suggestions...');
    const mockUserItems = [
      { title: 'Old Laptop', description: 'Working laptop from 2018', category: 'electronics', price: 200 },
      { title: 'Gardening Tools', description: 'Complete set of gardening tools', category: 'tools', price: 50 }
    ];

    const mockMarketplaceItems = [
      { title: 'Bicycle', description: 'Mountain bike in good condition', category: 'sports', price: 150, seller: { name: 'John' } },
      { title: 'Books Collection', description: 'Set of programming books', category: 'books', price: 80, seller: { name: 'Jane' } },
      { title: 'Coffee Maker', description: 'Automatic coffee maker', category: 'appliances', price: 60, seller: { name: 'Bob' } }
    ];

    const barterResponse = await generateBarterSuggestions(mockUserItems, mockMarketplaceItems, {
      ecoScore: 100,
      walletCredits: 50
    });
    console.log('✅ Barter Suggestions:', JSON.stringify(barterResponse, null, 2));

    // Note: Waste classification requires image upload, test manually with actual image
    console.log('ℹ️  Waste Classification: Requires image file upload - test via API endpoint');

    console.log('\nTesting pickup request parsing...');
    const pickupTests = [
      'Schedule pickup tomorrow for plastic',
      'I have 5kg of metal waste, pick up today',
      'How does recycling work?'
    ];

    for (const test of pickupTests) {
      const pickupResult = await parsePickupRequest(test);
      console.log(`"${test}" → ${JSON.stringify(pickupResult)}`);
    }

    console.log('\nTesting quick replies...');
    const quickReplyResponse = await suggestQuickReplies(
      [
        { role: 'user', content: 'How do I recycle plastic?' },
        { role: 'assistant', content: 'You can recycle plastic by...' }
      ],
      'What about glass?'
    );
    console.log('✅ Quick Replies:', quickReplyResponse);

    console.log('\nTesting spam detection...');
    const spamTests = [
      'Hello, how can I help with recycling?',
      'BUY NOW!!! CHEAP STUFF!!!',
      'This is a normal message about eco-friendly tips.'
    ];

    for (const test of spamTests) {
      const spamResult = await detectSpam(test, []);
      console.log(`"${test}" → Spam: ${spamResult.isSpam} (${spamResult.confidence.toFixed(2)})`);
    }

    console.log('\nTesting translation...');
    const translationResponse = await translateMessage('Hello, how can I help with recycling?', 'es');
    console.log('✅ Translation (EN→ES):', translationResponse.translatedText);

    console.log('\nTesting eco analysis...');
    const mockUserStats = {
        ecoScore: 45,
        co2SavedKg: 30,
        wasteRecycledKg: 20,
        itemsReusedCount: 3,
        credits: 150
    };
    const mockActivities = [
        { type: 'waste_pickup', description: 'Recycled 5kg of plastic', date: new Date() },
        { type: 'barter', description: 'Successfully bartered an item', date: new Date() }
    ];
    const ecoAnalysis = await analyzeEcoActivities(mockUserStats, mockActivities);
    console.log('✅ Eco Analysis:', JSON.stringify(ecoAnalysis, null, 2));

    console.log('\nTesting tracking queries...');
    // Note: Tracking requires collector locations to be set via socket
    console.log('ℹ️  Tracking: Test by connecting collectors via socket and asking "Where is my collector?"');
  } catch (error) {
    console.error('❌ AI service error:', error.message);
  }
}

testAI();