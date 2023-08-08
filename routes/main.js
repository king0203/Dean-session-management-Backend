const express = require("express");
const User = require("../models/User");
const Session = require("../models/Session");
const bcrypt = require("bcrypt");

const router = express.Router();

const { validate: uuidValidate } = require("uuid");

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization;

  // Check if the token is a valid UUID
  if (!token || !uuidValidate(token)) {
    return res.sendStatus(401); // Unauthorized
  }

  next();
};


router.post("/register", async (req, res) => {
    const { universityId, password, isDean } = req.body;
  
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const user = await User.create({
        universityId,
        password: hashedPassword,
        isDean,
      });
  
      res.json(user);
    } catch (error) {
      res.json({ message: error.message });
    }
  });

router.post("/login", async (req, res) => {
    const { universityId, password } = req.body;
    try {
      const user = await User.findOne({ universityId });
  
      if (user) {
        // Check the password using bcrypt.compare
        const isPasswordMatch = await bcrypt.compare(password, user.password);
  
        if (isPasswordMatch) {
          req.headers.token = user.id;
          res.json({ token: user.id });
        } else {
          res.json({ message: "Invalid password" });
        }
      } else {
        res.json({ message: "Invalid university ID" });
      }
    } catch (error) {
      res.json({ message: error.message });
    }
  });
  
  const { addMonths, startOfDay, endOfDay } = require("date-fns");

// Helper function to get all Thursdays and Fridays within the specified range
function getThursdaysAndFridaysInRange(startDate, endDate) {
  const thursdaysAndFridays = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 4 /* Thursday */ || dayOfWeek === 5 /* Friday */) {
      thursdaysAndFridays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return thursdaysAndFridays;
}

// // Route to get all free sessions from today to the next one month
// router.get("/freeSessions", authenticateToken, async (req, res) => {
//   const token = req.headers.authorization;
//   const today = startOfDay(new Date());
//   const nextMonth = addMonths(today, 1);
//   const thursdaysAndFridays = getThursdaysAndFridaysInRange(today, nextMonth);

//   try {
//     const user = await User.findOne({ id: token });

//     if (user) {
//       const users = await User.find({ isDean: true });

//       const availability = [];
//       for (const dean of users) {
//         const deanData = {
//           dean: dean.universityId,
//           booked: [],
//           available: [],
//         };

//         for (const date of thursdaysAndFridays) {
//           const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
//           const isAvailable = await Session.exists({
//             dean: dean._id,
//             startTime: date,
//           });

//           if (isAvailable) {
//             deanData.available.push(formattedDate);
//           } else {
//             const bookedSessions = await Session.find({
//               dean: dean._id,
//               startTime: date,
//             });
//             deanData.booked.push({
//               date: formattedDate,
//               sessions: bookedSessions.map((session) => session._id),
//             });
//           }
//         }

//         availability.push(deanData);
//       }

//       res.json(availability);
//     } else {
//       res.json({ message: "Invalid token" });
//     }
//   } catch (error) {
//     res.json({ message: error.message });
//   }
// });

// Route to get all free sessions from today to the next one month
router.get("/freeSessions", authenticateToken, async (req, res) => {
  const token = req.headers.authorization;
  const today = startOfDay(new Date());
  const nextMonth = addMonths(today, 1);
  const thursdaysAndFridays = getThursdaysAndFridaysInRange(today, nextMonth);
  
  try {
    const user = await User.findOne({ id: token });

    if (user) {
      const users = await User.find({ isDean: true });

      const availability = [];
      for (const dean of users) {
        const deanData = {
          dean: dean.universityId,
          booked: [],
          available: [],
        };

        for (const date of thursdaysAndFridays) {
          const startOfDayDate = startOfDay(date);
          const endOfDayDate = endOfDay(date);

          // Check if a session exists for the dean and date
          const session = await Session.findOne({
            dean: dean._id,
            startTime: { $gte: startOfDayDate, $lt: endOfDayDate },
          });

          const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
          
          if (session) {
            deanData.booked.push({
              date: formattedDate,
              sessions: [session._id],
            });
          } else {
            deanData.available.push(formattedDate);
          }
        }

        availability.push(deanData);
      }

      res.json(availability);
    } else {
      res.json({ message: "Invalid token" });
    }
  } catch (error) {
    res.json({ message: error.message });
  }
});




router.post("/bookSession", authenticateToken, async (req, res) => {
    const token = req.headers.authorization;
    const { date, universityId } = req.body;
    try {
      // Find the user by the provided token
      const user = await User.findOne({ id: token });
  
      if (user && user.isDean === false) {
        // Check if the dean exists in the database
        const dean = await User.findOne({ universityId: universityId, isDean: true });
        if (!dean) {
          return res.json({ message: "Dean not found" });
        }
  
        // Parse the date string into a Date object using the desired format "DD-MM-YYYY"
        const parts = date.split("-");
        const selectedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  
        // Check if the selected date is a Thursday (dayOfWeek 4) or Friday (dayOfWeek 5)
        if (selectedDate.getDay() !== 4 && selectedDate.getDay() !== 5) {
          return res.json({
            message: "You can only book sessions for Thursdays or Fridays.",
          });
        }
  
        // Set the session start time to 10 am and end time to 11 am
        selectedDate.setHours(10, 0, 0, 0);
        const endTime = new Date(selectedDate);
        endTime.setHours(endTime.getHours() + 1); // Set end time to 11 am
  
        // Check if the dean already has a session booked for the selected date and time
        const existingSession = await Session.findOne({
          dean: dean._id,
          startTime: selectedDate,
        });
  
        if (existingSession) {
          return res.json({
            message:
              "The dean already has a session booked for this Thursday or Friday.",
          });
        }
  
        // Create a new session in the database
        const session = await Session.create({
          startTime: selectedDate,
          endTime: endTime,
          student: user._id,
          dean: dean._id,
        });
  
        res.json(session);
      } else {
        res.json({ message: "Invalid token or you are not authorized" });
      }
    } catch (error) {
      res.json({ message: error.message });
    }
  });
  
// Route for user (student or dean) to see pending sessions
router.get("/pendingSessions", authenticateToken, async (req, res) => {
  const token = req.headers.authorization;

  try {
    const user = await User.findOne({ id: token });

    if (!user) {
      return res.json({ message: "Invalid token" });
    }

    const currentTime = new Date();
    const pendingSessions = await Session.find({
      $or: [{ student: user._id }, { dean: user._id }],
      startTime: { $gte: currentTime },
    }).select("startTime"); // Select only the startTime field

    res.json(pendingSessions);
  } catch (error) {
    res.json({ message: error.message });
  }
});


  module.exports = router;
