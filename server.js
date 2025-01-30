const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const User = require("./models/user");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Secret key for JWT (In production, store this securely!)
const SECRET_KEY = process.env.SECRET_KEY;

const CONN_STRING = process.env.CONNECTION_STRING


mongoose.connect(CONN_STRING).then(() => {
  console.log("Connected to Database");
}).catch(error => {
  console.log("Error connecting to Database", error);

})


// In-memory data for demonstration
let users = [];
let movies = [
  {
    id: "1",
    title: "The Action Movie",
    genre: "Action",
    description: "High-octane action film.",
    trailerUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "2",
    title: "Romantic Getaway",
    genre: "Romance",
    description: "A heartfelt romantic story.",
    trailerUrl: "https://www.w3schools.com/html/movie.mp4",
  },
  {
    id: "3",
    title: "Comedy Night",
    genre: "Comedy",
    description: "A hilarious comedy special.",
    trailerUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
];

// Utility function to verify token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Server running" });
});

// ======================= AUTH ROUTES =======================

// Register
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;
  console.log("Here in regster", email, password)

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Create user
  const newUser = new User({ email, password });
  await newUser.save();

  return res.status(201).json({ message: "User registered successfully" });
});

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Here ==>", email, password);

  const user = await User.findOne({ email: email, password: password });
  if (!user) {
    console.log("Invalid credentials");

    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, {
    expiresIn: "1h",
  });
  return res.json({ token });
});

// Profile
app.get("/auth/profile", authenticateToken, (req, res) => {
  // Return user info based on token
  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ id: user.id, email: user.email });
});

// ======================= MOVIE ROUTES =======================

// Get all movies
app.get("/movies", (req, res) => {
  return res.json(movies);
});

// Get movie by ID
app.get("/movies/:id", (req, res) => {
  const { id } = req.params;
  const movie = movies.find((m) => m.id === id);
  if (!movie) {
    return res.status(404).json({ message: "Movie not found" });
  }
  return res.json(movie);
});

// Search movies (simple partial match on title)
app.get("/movies/search", (req, res) => {
  const { q } = req.query;
  if (!q) return res.json(movies);
  const results = movies.filter((m) =>
    m.title.toLowerCase().includes(q.toLowerCase())
  );
  return res.json(results);
});

// Get trailer for a movie
app.get("/movies/:id/trailer", (req, res) => {
  const { id } = req.params;
  const movie = movies.find((m) => m.id === id);
  if (!movie) {
    return res.status(404).json({ message: "Movie not found" });
  }
  return res.json({ trailerUrl: movie.trailerUrl });
});

// Get recommendations (simple: same genre, different id)
app.get("/movies/:id/recommendations", (req, res) => {
  const { id } = req.params;
  const movie = movies.find((m) => m.id === id);
  if (!movie) {
    return res.status(404).json({ message: "Movie not found" });
  }
  const recommended = movies.filter(
    (m) => m.genre === movie.genre && m.id !== movie.id
  );
  return res.json(recommended);
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
