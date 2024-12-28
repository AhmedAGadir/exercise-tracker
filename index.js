const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(() => {
    console.error('Failed to connect to MongoDB');
  });

// Create Mongoose Models
// User schema and model
const userSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId() // Auto-generate ObjectId
  },
  username: {
    type: String,
    required: true,
    unique: true // Ensure usernames are unique
  }
});
const User = mongoose.model('Users', userSchema);

// Exercise schema and model
const exerciseSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId() // Auto-generate ObjectId
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to a User's ObjectId
    required: true
  },
  description: {
    type: String,
    required: true // Exercise description is required
  },
  duration: {
    type: Number,
    required: true // Exercise duration is required
  },
  date: {
    type: Date // Optional date; defaults will be handled later
  }
});
const Exercise = mongoose.model('Exercises', exerciseSchema);

// Middleware for parsing form and JSON data
const { json, urlencoded } = require('body-parser');
app.use(urlencoded({ extended: false })); // Parse URL-encoded data
app.use(json()); // Parse JSON data

// Enable CORS
app.use(cors())

// Serve static assets from the public folder
app.use(express.static('public'))

// Serve the index page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create a new user or return an existing one
app.post('/api/users', async (req, res) => {
  const existingUser = await User.findOne({ username: req.body.username });

  if (existingUser) {
    // If user already exists, return their details
    const { username, _id } = existingUser;
    return res.json({ username, _id });
  }

  try {
    // Create and save a new user
    const newUser = new User({ username: req.body.username });
    await newUser.save();
    return res.json({ username: newUser.username, _id: newUser._id });
  } catch (error) {
    console.error('Error saving new user:', error);
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  const allUsers = await User.find().exec();
  res.send(allUsers);
});

// Add a new exercise for a user
app.post('/api/users/:id/exercises', async (req, res) => {
  const { id } = req.params;
  const { description, duration, date } = req.body;

  const user = await User.findOne({ _id: id });

  if (!user) {
    // Handle case where the user does not exist
    console.error(`User with ID ${id} does not exist`);
  }

  // Create a new exercise
  const exercise = {
    userId: id,
    description,
    duration: parseInt(duration), // Ensure duration is a number
    date: date ? date : new Date().toISOString() // Use provided date or default to current date
  }

  const newExercise = new Exercise(exercise);
  await newExercise.save();

  // Respond with the exercise details
  const response = {
    _id: id,
    username: user.username,
    ...exercise
  };

  return res.json(response);
});

// Get a user's exercise logs with optional filters
app.get('/api/users/:id/logs', async (req, res) => {
  const { id } = req.params;

  const user = await User.findOne({ _id: id });

  if (!user) {
    // Handle case where the user does not exist
    console.error(`User with ID ${id} does not exist`);
    return res.send([]);
  }

  const { from, to, limit } = req.query;

  // Build the aggregation pipeline
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(id) } } // Match exercises for the user ID
  ];

  // Add date filtering if provided
  if (from || to) {
    const dateFilter = {};
    if (from) {
      dateFilter.$gte = new Date(from); // Start date
    }
    if (to) {
      dateFilter.$lte = new Date(to); // End date
    }
    pipeline.push({
      $match: { date: dateFilter }
    });
  }

  // Add a limit to the number of results if provided
  if (limit) {
    pipeline.push({
      $limit: Number(limit)
    });
  }

  // Execute the aggregation pipeline
  const exercises = await Exercise.aggregate(pipeline).exec();

  // Format and respond with the logs
  const response = {
    username: user.username,
    count: exercises.length,
    log: exercises.map(({ description, duration, date }) => ({
      description,
      duration,
      date: new Date(date).toDateString() // Format date
    }))
  };

  return res.json(response);
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});