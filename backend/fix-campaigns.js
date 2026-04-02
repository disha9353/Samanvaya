const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/ecobarternplus').then(async () => {
  const Campaign = require('./src/models/Campaign');
  const docs = await Campaign.find({}).lean();
  console.log('Total campaigns:', docs.length);

  const missing = docs.filter(d => d.durationHours === undefined || d.durationHours === null);
  console.log('Missing durationHours:', missing.length);

  if (missing.length > 0) {
    const result = await Campaign.updateMany(
      { durationHours: { $exists: false } },
      { $set: { durationHours: 1, creditsPerHour: 50, totalCredits: 50 } }
    );
    console.log('Fixed durationHours on docs:', result.modifiedCount);
  }

  const missingArrays = docs.filter(d => !Array.isArray(d.attendees) || !Array.isArray(d.interestedUsers) || !Array.isArray(d.rewardedParticipants));
  console.log('Missing array fields:', missingArrays.length);

  if (missingArrays.length > 0) {
    // Fix per-doc
    for (const d of missingArrays) {
      const upd = {};
      if (!Array.isArray(d.attendees)) upd.attendees = [];
      if (!Array.isArray(d.interestedUsers)) upd.interestedUsers = [];
      if (!Array.isArray(d.rewardedParticipants)) upd.rewardedParticipants = [];
      await Campaign.updateOne({ _id: d._id }, { $set: upd });
    }
    console.log('Fixed array fields on', missingArrays.length, 'docs');
  }

  console.log('Migration complete.');
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
