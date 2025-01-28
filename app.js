const express = require('express');
const session = require('express-session');
const app = express();
require('dotenv').config();
const cnctString = process.env.DATABASE_CONNECTION;
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');
const Teacher = require('./models/Teachers');
const Student = require('./models/Students');
const Grade = require('./models/Grades');
const Note = require('./models/Notes');
const Present = require('./models/Present');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const ePass = process.env.APP_PASSWORD;
const port = 3000;

// Connect to MongoDB
mongoose.connect(cnctString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("Connected to MongoDB!")).catch((err) => console.error('MongoDB connection error: ', err));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      maxAge: null // Cookie expires when the browser is closed
    }
  }));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user:'techdziennik@gmail.com',
        pass: ePass
    }
});
// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/rejestracja.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'rejestracja.html'));
});

app.get('/main.html',isAuthenticated, (req,res)=>{
    res.sendFile(path.join(__dirname, 'views', 'main.html'));
})

app.get('/dodajocene.html',isAuthenticated, ensureTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'nauczyciel','dodajocene.html'));
})

app.get('/dodajuwage.html',isAuthenticated, ensureTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'nauczyciel','dodajuwage.html'));
})

app.get('/oceny.html', isAuthenticated, ensureStudent, async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'uczen','oceny.html'));
  const email = req.session.user.email; // Get the email from the session

  try {
      const grades = await Grade.find({ email }); // Fetch grades for the logged-in student
      res.json(grades); // Send the grades as a JSON response
  } catch (err) {
      console.error('Error fetching grades:', err);
      res.status(500).send('Internal server error');
  }
});

app.get('/uwagi.html', isAuthenticated, ensureStudent, async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'uczen','uwagi.html'));
  const email = req.session.user.email; // Get the email from the session

  try {
      const notes = await Note.find({ email }); // Fetch notes for the logged-in student
      res.json(notes); // Send the notes as a JSON response
  } catch (err) {
      console.error('Error fetching notes:', err);
      res.status(500).send('Internal server error');
  }
});



// POST route for handling form submission
app.post('/register', async (req, res) => {
  const { email, password, repeat_password } = req.body;

  // Validate passwords match
  if (password !== repeat_password) {
      return res.send(`
          <html>
          <head>
            <script>
              alert("Hasła się nie zgadzają");
              window.location.href = '/rejestracja.html';
            </script>
          </head>
          <body></body>
          </html>
        `);
  }

  // Validate the input
  if (!email || !password) {
      return res.send(`
          <html>
          <head>
            <script>
              alert("Nie podano potrzebnych informacji");
              window.location.href = '/rejestracja.html';
            </script>
          </head>
          <body></body>
          </html>
        `);
  }

  try {
      // Check if the user already exists
      const existingUser  = await User.findOne({ email });
      if (existingUser ) {
          return res.send(`
              <html>
              <head>
                <script>
                  alert("Podany email jest juz zarejestrowany");
                  window.location.href = '/rejestracja.html';
                </script>
              </head>
              <body></body>
              </html>
            `);
      }

      // Generate a 6 digit random verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); 

      // Save the code and user info in session
      req.session.verificationCode = verificationCode; 
      req.session.userData = { email, password }; 
      req.session.verificationCodeExpires = Date.now() + 120000; // Set expiration time for 2 minutes

      // Send verification email
      const mailOptions = {
          from: 'techdziennik@gmail.com',
          to: email,
          subject: 'Verification Code',
          text: `Your verification code is: ${verificationCode}` 
      };

      transporter.sendMail(mailOptions, (error, info) => { 
          if (error) {
              console.error('Error sending email:', error); // Log the error details 
              return res.status(500).send('Error sending email');
          }
          // Redirect to verification page
          res.redirect('/weryfikacja.html'); 
      });

  } catch (err) {
      console.error('Error during registration:', err);
      res.status(500).send('Internal server error');
  }
});

app.get('/weryfikacja.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'weryfikacja.html'));
});

// Route for verification form submission
app.post('/weryfikacja', async (req, res) => {
  try {
      const { code } = req.body;
      const { verificationCode, userData, verificationCodeExpires } = req.session;

      if (!verificationCode || !userData) {
          return res.status(400).send('Session data missing. Please try registering again.');
      }

      if (Date.now() > verificationCodeExpires) {
          return res.status(400).send('Verification code expired');
      }

      if (code === verificationCode) {
          // Check if the email contains 'nauczyciel'
          let newUser ;
          if (userData.email.indexOf('nauczyciel') > -1) {
              // Save as Teacher
              newUser  = new Teacher(userData);
          } else {
              // Save as Student
              newUser  = new Student(userData);
          }

          // Save user to the database
          await newUser .save();

          // Clear session data
          req.session.destroy((err) => {
              if (err) {
                  console.error('Error destroying session:', err); 
              }
          });

          // Redirect to login page
          res.redirect('/index.html'); 
      } else {
          res.status(400).send('Invalid verification code');
      }
  } catch (err) {
      console.error('Error in /weryfikacja route:', err);
      res.status(500).send('Something went wrong!');
  }
});

app.post('/login', async(req, res) => {
  const { email, password } = req.body;
  try {
      // Check if the user is a Teacher
      let user = await Teacher.findOne({ email });
      if (user) {
          const match = await bcrypt.compare(password, user.password);
          if (match) {
              req.session.user = {
                  ...user.toObject(),
                  role: 'teacher', // Set role for teacher
                  unhashedPassword: password
              };
              return res.redirect('/main.html');      
          }
      }

      // Check if the user is a Student
      user = await Student.findOne({ email });
      if (user) {
          const match = await bcrypt.compare(password, user.password);
          if (match) {
              req.session.user = {
                  ...user.toObject(),
                  role: 'student', // Set role for student
                  unhashedPassword: password
              };
              return res.redirect('/main.html');      
          }
      }

      // If no user found or password doesn't match
      return res.send(`
          <html>
          <head>
            <script>
              alert("Podano zle haslo lub email");
              window.location.href = '/rejestracja.html';
            </script>
          </head>
          <body></body>
        </html>`);
  } catch (err) {
      console.error('Error in /login route:', err);
      return res.status(500).send('Server error');
  }

});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/main.html');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/index.html');
  });
});

app.post('/addgrade', async (req, res) => {
  // Destructure the data from the request body
  const { emailucznia, przedmiot, ocena } = req.body;

  // Create a new student document
  const newGrade = new Grade({
      email: emailucznia, // Use the email from the form
      przedmiot: przedmiot,
      ocena: ocena,
  });

  try {
      // Save the new student document to the database
      await newGrade.save();
      // Redirect or send a success response
      return res.send(`
        <html>
        <head>
          <script>
            alert("Dodano ocene!");
            window.location.href = '/dodajocene.html';
          </script>
        </head>
        <body></body>
      </html>`);
  } catch (error) {
      // Handle errors (e.g., duplicate email)
      console.error(error);
      res.status(500).send('Error adding grade: ' + error.message);
  }
});

app.post('/addnote', async (req, res) => {
    // Destructure the data from the request body
    const { emailucznia, przedmiot, uwaga, posneg } = req.body;

    // Create a new note document
    const newNote = new Note({ // Use 'Notes' here
        email: emailucznia, // Use the email from the form
        przedmiot: przedmiot,
        uwaga: uwaga,
        typ: posneg,
    });

    try {
        // Save the new note document to the database
        await newNote.save();
        // Redirect or send a success response
        return res.send(`
          <html>
          <head>
            <script>
              alert("Dodano uwage!");
              window.location.href = '/dodajuwage.html';
            </script>
          </head>
          <body></body>
        </html>`);
    } catch (error) {
        // Handle errors (e.g., duplicate email)
        console.error(error);
        res.status(500).send('Error adding note: ' + error.message);
    }
});

app.post('/addpresent', async (req, res) => {
  // Destructure the data from the request body
  const { emailucznia, przedmiot, data, ktrlekcja,posneg } = req.body;

  // Create a new note document
  const newNote = new Note({ // Use 'Notes' here
      email: emailucznia, // Use the email from the form
      przedmiot: przedmiot,
      data: data,
      lekcja: ktrlekcja,
      typ: posneg,
  });

  try {
      // Save the new note document to the database
      await newNote.save();
      // Redirect or send a success response
      return res.send(`
        <html>
        <head>
          <script>
            alert("Dodano uwage!");
            window.location.href = '/dodajuwage.html';
          </script>
        </head>
        <body></body>
      </html>`);
  } catch (error) {
      // Handle errors (e.g., duplicate email)
      console.error(error);
      res.status(500).send('Error adding note: ' + error.message);
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

// Handle server errors
app.on('error', (error) => {
    console.error('Server error: ', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    app.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    app.close(() => {
        process.exit(0);
    });
});

// Handle error 404
app.use((req, res, next) => {
    res.status(404).send('Route to the page was not found.');
});

// Handle error 500
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(500).send('Something went wrong!');
    }
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
      return next();
    } else {
      return res.redirect('/index.html');
    }
  }

  function ensureTeacher(req, res, next) {
    if (req.session.user && req.session.user.role === 'teacher') {
        return next(); // User is a teacher, proceed to the next middleware/route
    }
    return res.status(403).send('Access denied. Teachers only.');
}

function ensureStudent(req, res, next) {
    if (req.session.user && req.session.user.role === 'student') {
        return next(); // User is a student, proceed to the next middleware/route
    }
    return res.status(403).send('Access denied. Students only.');
}
