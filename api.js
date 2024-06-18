const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const port = 4001;

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pweb_proj'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// API route to get users
app.get('/api/users', (req, res) => {
    const query = 'SELECT * FROM user';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.json(results);
    });
});

// API route to get rooms
app.get('/api/rooms', (req, res) => {
    const query = 'SELECT * FROM room';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching rooms:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.json(results);
    });
});

// API route to get a specific room
app.get('/api/rooms/:id', (req, res) => {
    const roomId = req.params.id;
    const query = 'SELECT * FROM room WHERE id_room = ?';
    connection.query(query, [roomId], (err, results) => {
        if (err) {
            console.error('Error fetching room:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('Room not found');
            return;
        }
        res.json(results[0]);
    });
});

// API route to get all reservation
app.get('/api/reservations', (req, res) => {
    const query = 'SELECT * FROM reservasi';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching reservations:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.json(results);
    });
});

// API route to get a specific reservation
app.get('/api/reservations/:id', (req, res) => {
    const reservationId = req.params.id;
    const query = 'SELECT * FROM reservasi WHERE id_reservasi = ?';
    connection.query(query, [reservationId], (err, results) => {
        if (err) {
            console.error('Error fetching reservation:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('Reservation not found');
            return;
        }
        res.json(results[0]);
    });
});

// Handle 404 for undefined routes
app.use((req, res, next) => {
    res.status(404).send("Sorry, can't find that!");
});

// Start server
app.listen(port, () => {
    console.log(`API Server is listening on port ${port}`);
});
