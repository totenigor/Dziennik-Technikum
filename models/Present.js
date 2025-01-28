const mongoose = require('mongoose');

// Define User Schema and Model
const presentSchema = new mongoose.Schema({
    email: { type: String, required: true, },
    przedmiot: { type: String, required: true },
    data: {type: String, required: true},
    lekcja: {type: String, required: true},
    typ: {type: String, required:true},
});

const Present = mongoose.model('Present', presentSchema);

module.exports = Present;