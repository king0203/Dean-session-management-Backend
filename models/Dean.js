const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // Import uuidv4 from the uuid package

const deanSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    index: true,
  },
  universityId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  sessions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
    },
  ],
});

const Dean = mongoose.model('Dean', deanSchema);

module.exports = Dean;
