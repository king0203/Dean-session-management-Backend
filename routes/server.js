const express = require("express");
const Student = require("../models/Student");
const Dean = require("../models/Dean");
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

// route for testing
router.get("/", async (req, res) => {
  res.send("Home ");
});

router.post("/register", async (req, res) => {
  const { universityId, password, role } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (role.toLowerCase() === "student") {
      const student = await Student.create({
        universityId,
        password: hashedPassword,
      });
      res.json(student);
    } else if (role.toLowerCase() === "dean") {
      const dean = await Dean.create({
        universityId,
        password: hashedPassword,
      });
      res.json(dean);
    } else {
      res.json({ message: "Invalid role" });
    }
  } catch (error) {
    res.json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { universityId, password } = req.body;
  try {
    const student = await Student.findOne({ universityId });
    const dean = await Dean.findOne({ universityId });

    if (student || dean) {
      // Check the password using bcrypt.compare
      const isPasswordMatch = await bcrypt.compare(
        password,
        (student || dean).password
      );

      if (isPasswordMatch) {
        req.headers.token = (student || dean).id;
        res.json({ token: (student || dean).id });
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

const { addMonths, startOfDay, startOfHour } = require("date-fns");

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


// Route to get all free sessions from today to the next one month
router.get("/freeSessions", authenticateToken, async (req, res) => {
  const token = req.headers.authorization;
  const today = startOfDay(new Date());
  const nextMonth = addMonths(today, 1);
  const thursdaysAndFridays = getThursdaysAndFridaysInRange(today, nextMonth);

  try {
    // Assuming you have a field named "authorization" in your Student model to store the token.
    const student = await Student.findOne({ id: token });

    if (student) {
      const deans = await Dean.find({}).populate("sessions");

      // Function to check if a dean has a booked session on a specific date
      function hasBookedSession(dean, date) {
        const dateString = startOfDay(date).toISOString();
        return dean.sessions.some(
          (session) =>
            startOfDay(session.startTime).toISOString() === dateString
        );
      }

      // Generate the availability for each dean on each Thursday and Friday
      const availability = [];
      for (const dean of deans) {
        const deanData = {
          dean: dean.universityId,
          booked: [],
          available: [],
        };

        thursdaysAndFridays.forEach((date) => {
          const formattedDate = `${date.getDate()}-${
            date.getMonth() + 1
          }-${date.getFullYear()}`;
          const isAvailable = !hasBookedSession(dean, date);
          if (isAvailable) {
            deanData.available.push(formattedDate);
          } else {
            const bookedSessions = dean.sessions
              .filter(
                (session) =>
                  startOfDay(session.startTime).toISOString() ===
                  startOfDay(date).toISOString()
              )
              .map((session) => session._id);
            deanData.booked.push({
              date: formattedDate,
              sessions: bookedSessions,
            });
          }
        });

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
    // Find the student by the provided token
    const student = await Student.findOne({ id: token });

    if (student) {
      // Check if the dean exists in the database
      const dean = await Dean.findOne({ universityId: universityId });
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
        student: student._id,
        dean: dean._id,
      });

      // Add the session to the student's and dean's sessions array
      student.sessions.push(session._id);
      await student.save();

      dean.sessions.push(session._id);
      await dean.save();

      res.json(session);
    } else {
      res.json({ message: "Invalid token" });
    }
  } catch (error) {
    res.json({ message: error.message });
  }
});


// Route for dean to see pending sessions
router.get("/pendingSessions", authenticateToken, async (req, res) => {
  const token = req.headers.authorization;

  try {
    const dean = await Dean.findOne({ id: token });

    if (!dean) {
      return res.json({ message: "Invalid token" });
    }

    const currentTime = new Date();
    const pendingSessions = await Session.find({
      dean: dean._id,
      startTime: { $gte: currentTime },
    }).select("startTime"); // Select only the startTime field

    res.json(pendingSessions);
  } catch (error) {
    res.json({ message: error.message });
  }
});

module.exports = router;
