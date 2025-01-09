const mongoose = require('mongoose');

// Define User Schema and Model
const noteSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    przedmiot: { type: String, required: true },
    uwaga: {type: String, required: true},
    typ: {type: String, required:true},
});

const Notes = mongoose.model('Notes', noteSchema);

module.exports = Notes;