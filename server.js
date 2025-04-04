require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticate, successResponse } = require('./auth');
const { User, Category, Drink, Score, Product } = require('./models');
const OpenAI = require('openai');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path =  require("path");
const multer = require("multer");
const fs = require("fs");
const { url } = require('inspector');



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });


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
    // if (!user || !user.comparePassword(req.body.password)) {
    //   return res.status(401).json({ success: false, message: 'Invalid credentials' });
    // }
    
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    console.log({ 
      success: true, 
      token, 
      name: user.name, 
      email: user.email, 
      profile_image: user.profile_image, 
      scores: user.scores,
  })
  res.status(200).json({ 
      success: true, 
      token, 
      name: user.name, 
      email: user.email, 
      profile_image: user.profile_image, 
      scores: user.scores,
  });
  
  } catch (err) {
    console.log(err)
    res.status(200).json({ success: false, message: 'Server error' });
  }
});

app.post('/signup', [
  body('email').isEmail(),
  body('password').exists(),
  body('name').exists(),
  body('phone').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(200).json({ status: 'failed',message: errors.array().join(",") });

  try {
    if (await User.findOne({ email: req.body.email })) {
      return res.status(200).json({ status: 'failed', message: 'User already exists' });
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
    res.status(200).json({ status: 'failed', message: 'Server error' });
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
    const response = categories.map(e => ({
      id : e.id,
      name: e.name,
      url: e.imageUrl
    }));
    res.json(successResponse(response));
  } catch (err) {
    res.status(500).json({ status: 'failed' });
  }
});

app.get('/getdrinks', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    const favoriteDrinkIds = user.favorites.map(fav => fav.id.toString());
    const drinks = await Drink.find().populate('category');
     const response = drinks.map(e => ({
      id : e.id,
      name: e.name,
      url: e.imageUrl,
      category : e.category.name,
      details : { 
        ...e.details,
        image: e.imageUrl 
      },
      isFavorite: favoriteDrinkIds.includes(e.id),
      ingredients : e.ingredients
    }));
    console.log(response)
    res.json(successResponse(response));
  } catch (err) {
     console.log(err)
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
    const product = await Drink.findById(req.params.productId);
    console.log(product)
     const response = {
      id : product.id,
      name: product.name,
      url: product.imageUrl,
      category : product.category.name,
      details : { 
        ...product.details,
        image: product.imageUrl 
      },
      ingredients : product.ingredients
    };
    res.json(successResponse(response));
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
     const favorites = user.favorites.map(fav => ({
        id: fav.id,
        name: fav.name,
        url: fav.imageUrl,
        liked: user.liked.includes(fav.id),
        favorite: true
      }));
    console.log({ favorites })
    res.json(successResponse(favorites));
  } catch (err) {
    console.log(err);
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



app.get('/score', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.scores) {
      return res.status(404).json({ status: 'failed', message: 'Scores not found' });
    }
    res.json({ status: 'success', scores: user.scores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

app.post('/score', authenticate, async (req, res) => {
  try {
    const { scores } = req.body;

    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({ status: 'failed', message: 'Invalid scores data' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ status: 'failed', message: 'User not found' });
    }

    user.scores = scores;
    await user.save();

    res.json({ status: 'success', message: 'Scores updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});



app.post("/update-profile", authenticate , upload.single("profile_picture"), async (req, res) => {
  try {

    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profileImage = req.file ? req.file.path : null; // Store the file path if an image is uploaded

    user.profile_image = profileImage;

    await user.save();
    res.json({ message: "Profile Updated successfully", profile_image: user.profile_image });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.post('/addfavorite', authenticate, async (req, res) => {
  try {
    const { drinkId } = req.body;

    if (!drinkId) {
      return res.json({ status: 'failed', message: 'Drink ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.json({ status: 'failed', message: 'User not found' });
    }

    if (user.favorites.includes(drinkId)) {
      return res.json({ status: 'failed', message: 'Drink is already in favorites' });
    }

    user.favorites.push(drinkId);
    await user.save();

    res.json({ status: 'success', message: 'Drink added to favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

app.post('/like', authenticate, async (req, res) => {
  try {
    const { drinkId } = req.body;

    if (!drinkId) {
      return res.status(400).json({ status: 'failed', message: 'Drink ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ status: 'failed', message: 'User not found' });
    }

    if (user.liked.includes(drinkId)) {
      return res.status(400).json({ status: 'failed', message: 'Drink is already in liked list' });
    }

    user.liked.push(drinkId);
    await user.save();

    res.json({ status: 'success', message: 'Drink added to liked list' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

app.post('/dislike', authenticate, async (req, res) => {
  try {
    const { drinkId } = req.body;

    if (!drinkId) {
      return res.status(400).json({ status: 'failed', message: 'Drink ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ status: 'failed', message: 'User not found' });
    }

    if (user.disliked.includes(drinkId)) {
      return res.status(400).json({ status: 'failed', message: 'Drink is already in disliked list' });
    }

    user.disliked.push(drinkId);
    await user.save();

    res.json({ status: 'success', message: 'Drink added to disliked list' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));