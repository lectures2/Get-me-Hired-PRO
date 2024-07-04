const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse incoming JSON requests
app.use(bodyParser.json());

// SQLite database setup
const db = new sqlite3.Database('users.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the users database.');
        // Create users table if not exists
        db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
    }
});

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
                const userId = req.body.userId || ''; // Updated to use req.body.userId
        cb(null, `cv_${userId}_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Signup endpoint
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    // Insert user data into the database
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        // Get the last inserted user ID
        const userId = this.lastID;

        // Create a user-specific CVs table
        const cvsTableName = `cvs_${userId}`;
        db.run(`CREATE TABLE IF NOT EXISTS ${cvsTableName} (
            id INTEGER PRIMARY KEY,
            title TEXT,
            content TEXT
        )`);

        res.json({ success: true, message: 'Signup successful', userId });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check if the username and password match a user in the database
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        } else if (!row) {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        } else {
            // Redirect to the dashboard after successful login
            res.json({ success: true, message: 'Login successful', redirect: `/dashboard.html?userId=${row.id}` });
        }
    });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    // Implement any necessary logic for logout
    // For example, clearing session data
    res.json({ success: true, message: 'Logout successful' });
});

// Save CV endpoint
app.post('/save-cv', (req, res) => {
    const { userId, title, content } = req.body;

    console.log('Save CV - UserId:', userId);

    // Check if the user-specific CVs table exists
    const cvsTableName = `cvs_${userId}`;
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [cvsTableName], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        if (!row) {
            // If the table does not exist, create it
            db.run(`CREATE TABLE IF NOT EXISTS ${cvsTableName} (
                id INTEGER PRIMARY KEY,
                title TEXT,
                content TEXT
            )`, (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).json({ success: false, message: 'Internal Server Error' });
                }

                // Insert CV data into the user-specific CVs table
                db.run(`INSERT INTO ${cvsTableName} (title, content) VALUES (?, ?)`, [title, content], (err) => {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }

                    res.json({ success: true, message: 'CV saved successfully' });
                });
            });
        } else {
            // If the table already exists, just insert the CV data
            db.run(`INSERT INTO ${cvsTableName} (title, content) VALUES (?, ?)`, [title, content], (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).json({ success: false, message: 'Internal Server Error' });
                }

                res.json({ success: true, message: 'CV saved successfully' });
            });
        }
    });
});

// Get CVs endpoint
app.get('/get-cvs/:userId', (req, res) => {
    const userId = req.params.userId;

    // Retrieve CVs from the user-specific CVs table
    const cvsTableName = `cvs_${userId}`;
    db.all(`SELECT * FROM ${cvsTableName}`, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        res.json({ success: true, cvs: rows });
    });
});

// Delete CV endpoint
app.delete('/delete-cv/:userId/:cvId', (req, res) => {
    const userId = req.params.userId;
    const cvId = req.params.cvId;

    // Delete the CV from the user-specific CVs table
    const cvsTableName = `cvs_${userId}`;
    db.run(`DELETE FROM ${cvsTableName} WHERE id = ?`, [cvId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        res.json({ success: true, message: 'CV deleted successfully' });
    });
});

// Upload CV endpoint
app.post('/upload-cv', upload.single('cvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.body.userId;
    const title = req.body.title || '';
    const content = req.body.content || '';
    const filename = req.file.filename;

    // Insert the uploaded CV file information into the user-specific CVs table
    const cvsTableName = `cvs_${userId}`;
    db.run(`INSERT INTO ${cvsTableName} (title, content) VALUES (?, ?)`, [title, content], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        res.json({ success: true, message: 'CV uploaded successfully' });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});