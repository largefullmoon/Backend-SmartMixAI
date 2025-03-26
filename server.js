require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticate } = require('./auth');
const { User, Category, Drink, Score, Product } = require('./models');
const OpenAI = require('openai');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// Authentication Routes
app.post('/signin', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !user.comparePassword(req.body.password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/signup', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').exists(),
  body('phone').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    if (await User.findOne({ email: req.body.email })) {
      return res.status(400).json({ status: 'failed', message: 'User already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(req.body.password, 10);
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword
    });
    
    await user.save();
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    res.json({ status: 'success', token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

// Protected Routes
app.post('/savescore', async (req, res) => {
  try {
    console.log(req.body);
    const score = new Score({
      user: req.body.email,
      scores: req.body.scores
    });
    await score.save();
    res.json({ status: 'success' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getcategories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getdrinks', async (req, res) => {
  try {
    const drinks = await Drink.find().populate('category');
    res.json(drinks);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getsuggestions', authenticate, async (req, res) => {
  try {
    // Implement your suggestion logic here
    res.json({ suggestions: [] });
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getscore', authenticate, async (req, res) => {
  try {
    const scores = await Score.find({ user: req.user._id });
    res.json(scores);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getproduct/:productId', async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    res.json(product);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getingredients', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json(user.favorites.ingredients || []);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getfavorites', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/gethistories', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('history.drink');
    res.json(user.history);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getprofile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.post('/getresponse', authenticate, async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: req.body.query }]
    });
    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.post('/trainmodel', authenticate, async (req, res) => {
  try {
    // Implement your model training logic here
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));