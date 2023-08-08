const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
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
    ref: 'User',
    index: true,
  },
  dean: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
});

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
