// formatDate.js

// Fungsi untuk mengubah objek Date menjadi string format tertentu
function formatDate(date) {
    // Cek jika input bukan objek Date, kembalikan null
    if (!(date instanceof Date)) return null;

    // Ambil komponen tanggal, bulan, dan tahun dari objek Date
    const day = padZero(date.getDate());
    const month = padZero(date.getMonth() + 1); // Bulan dimulai dari 0 (Januari = 0)
    const year = date.getFullYear();

    // Mengembalikan string format "YYYY-MM-DD"
    return `${year}-${month}-${day}`;
}

// Fungsi untuk menambahkan leading zero jika nilai kurang dari 10
function padZero(num) {
    return (num < 10 ? '0' : '') + num;
}

// Ekspor fungsi formatDate agar dapat digunakan di file lain
module.exports = formatDate;
