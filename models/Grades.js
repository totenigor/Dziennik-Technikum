const mongoose = require('mongoose');

// Define User Schema and Model
const gradeSchema = new mongoose.Schema({
    email: { type: String, required: true },
    przedmiot: { type: String, required: true },
    ocena: {type: Number, required: true},
});

const Grades = mongoose.model('Grades', gradeSchema);

module.exports = Grades;
