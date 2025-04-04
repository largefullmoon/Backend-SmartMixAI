const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  phone: String,
  name: String,
  profile_image: {  type: String, default: 'https://www.gravatar.com/avatar/' },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Drink' }],
  history: [{ 
    drink: { type: mongoose.Schema.Types.ObjectId, ref: 'Drink' },
    date: { type: Date, default: Date.now }
  }]
});

UserSchema.methods.comparePassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

const CategorySchema = new mongoose.Schema({
  name: String
});

const DrinkSchema = new mongoose.Schema({
  name: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  details: Object,
  ingredients: [String]
});

const ScoreSchema = new mongoose.Schema({
  user: String,
  scores: Object,
  date: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  ingredients: [String]
});

exports.User = mongoose.model('User', UserSchema);
exports.Category = mongoose.model('Category', CategorySchema);
exports.Drink = mongoose.model('Drink', DrinkSchema);
exports.Score = mongoose.model('Score', ScoreSchema);
exports.Product = mongoose.model('Product', ProductSchema);