const express = require('express');
const session = require('express-session');
const app = express();
require('dotenv').config();
const cnctString = process.env.DATABASE_CONNECTION;
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const ePass = process.env.APP_PASSWORD;
const port = 3000;

// Connect to MongoDB
mongoose.connect(cnctString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("Connected to MongoDB!")).catch((err) => console.error('MongoDB connection error: ', err));

// Define User Schema and Model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

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

app.get('/weryfikacja.html', (req,res)=>{
  res.sendFile(path.join(__dirname, 'views', 'weryfikacja.html'));
})

app.get('/main.html',isAuthenticated, (req,res)=>{
    res.sendFile(path.join(__dirname, 'views', 'main.html'));
})

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
        const existingUser = await User.findOne({ email });
        if (existingUser) {
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

        //generate a 6 digit random verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); 


        // Hash the password (use a valid salt round, e.g., 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the user to the database
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();

        // Send a success response
        res.status(201).send('User registered successfully!');
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const user = await  User.findOne({ email });
        if(user) {
            const match = await bcrypt.compare(password, user.password);
            if(match) {
                req.session.user = {
                    ...user.toObject(),
                    unhashedPassword: password
                };
                return res.redirect('/main.html');
            }else {
                return res.send(` 
                    <html>
                    <head>
                      <script>
                        alert("Podano zle haslo");
                        window.location.href = '/rejestracja.html';
                      </script>
                    </head>
                    <body></body>
                  </html>
                  `);
            }
        }else {
            return res.send(`
                <html>
                <head>
                  <script>
                    alert("Podano zlego emaila");
                    window.location.href = '/rejestracja.html';
                  </script>
                </head>
                <body></body>
              </html>`);
        }
    } catch (err) {
        console.error('Error in /login route:', err);
        return res.status(500).send('Server error');
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