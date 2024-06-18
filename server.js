const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const session = require('express-session');
const formatDate = require('./formatDate');

const app = express();
const port = 4000;

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

// Set EJS as the templating engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Initialize session middleware
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Rute utama, arahkan ke halaman beranda
app.get('/', (req, res) => {
    res.render('index'); // Ganti 'index' dengan nama file atau template halaman beranda Anda
});

// Register route
app.get('/register', (req, res) => {
    res.render('register', { errorMessage: null });
});

app.post('/register', (req, res) => {
    const { fullname, email, password, 'confirm-password': confirm_password } = req.body;

    console.log('Received registration data:', { fullname, email, password, confirm_password });

    // Check if password and confirm password match
    if (password !== confirm_password) {
        console.log('Passwords do not match');
        res.render('register', { errorMessage: 'Password dan konfirmasi password tidak cocok!' });
    } else {
        // Encrypt password
        const hashedPassword = bcrypt.hashSync(password, 10);
        console.log('Hashed password:', hashedPassword);

        // Check if email is already registered
        const query = 'SELECT * FROM user WHERE email = ?';
        connection.query(query, [email], (err, results) => {
            if (err) {
                console.error('Error checking email:', err);
                throw err;
            }

            if (results.length > 0) {
                console.log('Email already registered');
                res.render('register', { errorMessage: 'Email sudah terdaftar!' });
            } else {
                // Insert new user into the database
                const insertQuery = 'INSERT INTO user (email, password, fullname) VALUES (?, ?, ?)';
                connection.query(insertQuery, [email, hashedPassword, fullname], (err, results) => {
                    if (err) {
                        console.error('Error inserting user:', err);
                        throw err;
                    }
                    console.log('User successfully registered');
                    res.redirect('/login');
                });
            }
        });
    }
});


// Login route
app.get('/login', (req, res) => {
    res.render('login', { errorMessage: null });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check if email is registered
    const query = 'SELECT * FROM user WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            // Check if password is correct
            if (bcrypt.compareSync(password, user.password)) {
                // Password correct, login successful
                req.session.email = user.email;
                req.session.fullname = user.fullname;
                res.redirect('/menus');
            } else {
                res.render('login', { errorMessage: 'Email atau password salah!' });
            }
        } else {
            res.render('login', { errorMessage: 'Email atau password salah!' });
        }
    });
});

// Rute Menus
app.get('/menus', (req, res) => {
    // Periksa apakah pengguna sudah login
    if (!req.session.email) {
        res.redirect('/');
    } else {
        // Query untuk mendapatkan data ruangan dari tabel room
        const queryRooms = 'SELECT * FROM room';
        connection.query(queryRooms, (err, results) => {
            if (err) {
                console.error('Error fetching rooms:', err);
                res.status(500).send('Internal Server Error');
                return;
            }
            
            // Render halaman menus dengan data ruangan
            res.render('menus', { fullname: req.session.fullname, rooms: results });
        });
    }
});
app.post('/submit-reservation', (req, res) => {
    const { fullname, nohp, checkin, checkout, id_room } = req.body;

    // Debugging: Log id_room untuk memastikan nilai yang diterima
    console.log('Received id_room:', id_room);

    // Pastikan id_room ada dan valid
    if (!id_room || isNaN(id_room)) {
        console.log('Invalid id_room:', id_room);
        return res.status(400).send('Invalid room ID');
    }

    // Query untuk memeriksa apakah kamar tersedia
    const checkRoomQuery = 'SELECT * FROM room WHERE id_room = ? AND status = "available"';
    connection.query(checkRoomQuery, [id_room], (err, results) => {
        if (err) {
            console.error('Error checking room availability:', err);
            return res.status(500).send('Error checking room availability');
        }

        // Pastikan kamar tersedia
        if (results.length === 0) {
            return res.status(400).send('Room not available');
        }

        // Query untuk menyimpan data reservasi ke dalam tabel reservasi
        const insertQuery = `INSERT INTO reservasi (fullname, noHP, tgl_checkin, tgl_checkout, id_room) VALUES (?, ?, ?, ?, ?)`;
        connection.query(insertQuery, [fullname, nohp, checkin, checkout, id_room], (err, results) => {
            if (err) {
                console.error('Error saving reservation:', err);
                return res.status(500).send('Error saving reservation');
            }

            // Update status kamar menjadi 'booked' setelah reservasi berhasil disimpan
            const updateQuery = `UPDATE room SET status = 'booked' WHERE id_room = ?`;
            connection.query(updateQuery, [id_room], (err, results) => {
                if (err) {
                    console.error('Error updating room status:', err);
                    return res.status(500).send('Error updating room status');
                }

                // Jika penyimpanan dan update berhasil, arahkan kembali ke halaman menus.ejs
                res.redirect('/menus?reservationSuccess=true');
            });
        });
    });
});

// Route to serve pesanan_saya.html
app.get('/pesanan_saya', (req, res) => {
    // Query to get reservations with room details
    const mysql = `
        SELECT r.id_reservasi, r.id_room, r.fullname, r.noHP, r.tgl_checkin AS checkin, r.tgl_checkout AS checkout, k.gambar, k.harga,k.kategori
        FROM reservasi r
        INNER JOIN room k ON r.id_room = k.id_room
    `;

    connection.query(mysql, (err, results) => {
        if (err) {
            console.error('Error fetching reservations:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        // Render pesanan_saya.html and pass results data
        res.render('pesanan_saya', { reservations: results });
    });
});

// Endpoint untuk memperbarui data reservasi
app.post('/update-reservation', (req, res) => {
    const { fullName, noHP, checkInDate, checkOutDate, reservationId } = req.body;
    console.log('Received data:', { fullName, noHP, checkInDate, checkOutDate, reservationId });

    // Query untuk update data reservasi
    let sql = `
        UPDATE reservasi
        SET fullname = '${fullName}', noHP = '${noHP}', tgl_checkin = '${checkInDate}', tgl_checkout = '${checkOutDate}'
        WHERE id_reservasi = '${reservationId}';
    `;
    console.log('Query:', sql);

    connection.query(sql, (err, result) => {
        if (err) {
            // Penanganan error
            console.error('Error updating reservation:', err);
            res.status(500).send('Error updating reservation');
        } else {
            // Sukses memperbarui data reservasi
            res.redirect('/pesanan_saya?updateSuccess=true');
        }
    });
});



// Route untuk menghapus reservasi
app.delete('/delete-reservasi', (req, res) => {
    const { reservationId } = req.body;

    // Query untuk mengubah status kamar menjadi available
    const updateRoomStatusQuery = 'UPDATE room SET status = "available" WHERE id_room IN (SELECT id_room FROM reservasi WHERE id_reservasi = ?)';
    connection.query(updateRoomStatusQuery, [reservationId], (err, result) => {
        if (err) {
            console.error('Error updating room status:', err);
            return res.status(500).json({ success: false, error: 'Error updating room status' });
        }

        // Query untuk menghapus reservasi dari tabel reservasi
        const deleteReservationQuery = 'DELETE FROM reservasi WHERE id_reservasi = ?';
        connection.query(deleteReservationQuery, [reservationId], (err, result) => {
            if (err) {
                console.error('Error deleting reservation:', err);
                return res.status(500).json({ success: false, error: 'Error deleting reservation' });
            }

            // Kirim respons sukses setelah kedua operasi berhasil
            res.status(200).json({ success: true });
        });
    });
});

app.get('/cetak-resi/:reservationId', (req, res) => {
    const reservationId = req.params.reservationId;

    // Query ke database untuk mendapatkan data reservasi dan harga dari room berdasarkan ID reservasi
    const query = `
        SELECT r.*, rm.harga AS room_harga
        FROM reservasi r
        INNER JOIN room rm ON r.id_room = rm.id_room
        WHERE r.id_reservasi = ?
    `;
    connection.query(query, [reservationId], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ success: false, error: 'Error querying database' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }

        const reservasi = results[0]; // Ambil data reservasi pertama (asumsikan hanya satu hasil)

        // Buat objek PDFDocument baru
        const doc = new PDFDocument({ margin: 50 });

        // Header PDF (nama website)
        doc.fontSize(20).text('H-State', { align: 'center' }).moveDown();

        // Tambahkan logo jika ada
        // doc.image('path/to/logo.png', { fit: [100, 100], align: 'center' }).moveDown();

        // Garis pemisah
        doc.moveTo(50, 80)
           .lineTo(550, 80)
           .stroke();

        // Informasi reservasi
        doc.moveDown();
        doc.fontSize(14).text('Informasi Reservasi', { underline: true }).moveDown(0.5);
        doc.fontSize(12).text(`Full Name: ${reservasi.fullname}`);
        doc.text(`No. HP: ${reservasi.noHP}`);
        doc.text(`Check-in: ${formatDate(new Date(reservasi.tgl_checkin))}`);
        doc.text(`Check-out: ${formatDate(new Date(reservasi.tgl_checkout))}`);

        // Garis pemisah
        doc.moveDown().moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // Informasi harga dari room
        doc.moveDown().fontSize(14).text('Informasi Harga', { underline: true }).moveDown(0.5);
        doc.fontSize(12).text(`Harga: Rp ${reservasi.room_harga.toLocaleString('id-ID')}`);

        // Garis pemisah
        doc.moveDown().moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // Footer
        doc.moveDown(2).fontSize(10).text('Terima kasih telah menggunakan layanan kami.', { align: 'center' });

        // Tampatkan filename yang akan diunduh
        const fileName = `Resi_Reservasi_${reservationId}.pdf`;

        // Atur header untuk memberi tahu browser bahwa file pdf yang akan diunduh
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');

        // Memanfaatkan pdf ke respons http
        doc.pipe(res);
        doc.end();
    });
});


// Route untuk logout
app.get('/logout', (req, res) => {
    // Hapus session dan cookie
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            // Handle error, misalnya dengan menampilkan pesan error
            res.status(500).send('Error logging out');
        } else {
            // Redirect pengguna ke halaman login atau halaman lain yang sesuai
            res.redirect('/login'); // Ganti dengan halaman login yang sesuai
        }
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle 404
app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});

// Start server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
