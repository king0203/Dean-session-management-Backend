const mongoose = require('mongoose');
const { v4: uuidv4 } = require("uuid");

const sessionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    index: true,
  },
  dean: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dean',
    index: true,
  },
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
