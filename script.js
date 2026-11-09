// ================================================================
// 1. KONFIGURASI FIREBASE
// ================================================================
const firebaseConfig = {
    apiKey: "API_KEY_KAMU",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================================================================
// 2. VARIABEL GLOBAL
// ================================================================
let currentUser = null;        // 'Deryll' atau 'Jasmine'
let jobs = [];
let filterStatus = 'semua';
const STATUSES = ['Dilamar', 'Interview', 'Diterima', 'Ditolak'];
let unsubscribeListener = null; // untuk real-time listener

// ================================================================
// 3. FUNGSI TANGGAL
// ================================================================
function getToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTanggal(tgl) {
    if (!tgl) return '-';
    const parts = tgl.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return tgl;
}

// ================================================================
// 4. FUNGSI LOGIN / LOGOUT / SWITCH USER
// ================================================================
function loginUser(userName) {
    currentUser = userName;
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('page-main').classList.add('active');

    applyTheme(userName);
    updateUserSwitchButtons(userName);
    document.getElementById('greetingUser').textContent = userName;

    // Mulai listen ke Firestore untuk user ini
    startRealtimeListener(userName);
    pindahKe('page-home');
}

function switchUser(userName) {
    if (userName === currentUser) return;
    currentUser = userName;
    applyTheme(userName);
    updateUserSwitchButtons(userName);
    document.getElementById('greetingUser').textContent = userName;

    // Hentikan listener lama, mulai yang baru
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    startRealtimeListener(userName);
}

function applyTheme(userName) {
    const main = document.getElementById('page-main');
    main.classList.remove('theme-deryll', 'theme-jasmine');
    if (userName === 'Deryll') {
        main.classList.add('theme-deryll');
    } else if (userName === 'Jasmine') {
        main.classList.add('theme-jasmine');
    }
}

function updateUserSwitchButtons(activeUser) {
    document.querySelectorAll('.user-switch-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.user === activeUser) {
            btn.classList.add('active');
        }
    });
}

function logout() {
    if (confirm('Yakin ingin keluar?')) {
        // Hentikan listener
        if (unsubscribeListener) {
            unsubscribeListener();
            unsubscribeListener = null;
        }
        currentUser = null;
        jobs = [];
        document.getElementById('page-main').classList.remove('active');
        document.getElementById('page-main').classList.remove('theme-deryll', 'theme-jasmine');
        document.getElementById('page-login').classList.add('active');
        document.getElementById('jobTableBody').innerHTML = '';
        filterStatus = 'semua';
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'semua') btn.classList.add('active');
        });
        updateStats();
    }
}

// ================================================================
// 5. FIRESTORE - REAL-TIME LISTENER
// ================================================================
function startRealtimeListener(userName) {
    if (!userName) return;

    // Hentikan listener lama jika ada
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }

    // Query data berdasarkan user
    const userRef = db.collection('lamaran')
        .where('userId', '==', userName)
        .orderBy('tanggal', 'desc');

    unsubscribeListener = userRef.onSnapshot((snapshot) => {
        jobs = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            jobs.push({
                id: doc.id,        // pakai Firestore document ID
                posisi: data.posisi || '',
                perusahaan: data.perusahaan || '',
                status: data.status || 'Dilamar',
                tanggal: data.tanggal || getToday(),
                userId: data.userId || userName
            });
        });
        render();
    }, (error) => {
        console.error('Error listening to Firestore:', error);
        alert('Gagal terhubung ke database. Periksa koneksi internet Anda.');
    });
}

// ================================================================
// 6. CRUD - TAMBAH, UBAH, HAPUS
// ================================================================
function simpanLamaran() {
    const posisi = document.getElementById('inputPosisi').value.trim();
    const perusahaan = document.getElementById('inputPerusahaan').value.trim();
    const tanggal = document.getElementById('inputTanggal').value;

    if (posisi === '') {
        alert('Masukkan posisi lamaran!');
        document.getElementById('inputPosisi').focus();
        return;
    }
    if (perusahaan === '') {
        alert('Masukkan nama perusahaan!');
        document.getElementById('inputPerusahaan').focus();
        return;
    }
    if (tanggal === '') {
        alert('Pilih tanggal apply!');
        document.getElementById('inputTanggal').focus();
        return;
    }

    // Simpan ke Firestore
    db.collection('lamaran').add({
        userId: currentUser,
        posisi: posisi,
        perusahaan: perusahaan,
        status: 'Dilamar',
        tanggal: tanggal,
        createdAt: new Date()
    })
    .then(() => {
        tutupModalTambah();
        // Data akan otomatis update via listener
    })
    .catch((error) => {
        console.error('Error saving data:', error);
        alert('Gagal menyimpan data. Coba lagi.');
    });
}

function ubahStatus(docId, newStatus) {
    db.collection('lamaran').doc(docId).update({
        status: newStatus
    })
    .catch((error) => {
        console.error('Error updating status:', error);
        alert('Gagal mengupdate status.');
    });
}

function hapusLamaran(docId) {
    if (confirm('Yakin ingin menghapus lamaran ini?')) {
        db.collection('lamaran').doc(docId).delete()
        .catch((error) => {
            console.error('Error deleting data:', error);
            alert('Gagal menghapus data.');
        });
    }
}

// ================================================================
// 7. RENDER TABEL
// ================================================================
function render() {
    if (!currentUser) return;

    const tbody = document.getElementById('jobTableBody');
    const filtered = filterStatus === 'semua' ?
        jobs :
        jobs.filter(j => j.status === filterStatus);

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <span>📭</span>
                    <p>Belum ada lamaran dengan status ini.</p>
                </div>
            </td></tr>
        `;
    } else {
        let html = '';
        filtered.forEach((job, index) => {
            const badgeClass = `badge-${job.status.toLowerCase()}`;
            const tglDisplay = formatTanggal(job.tanggal);
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(job.posisi)}</strong></td>
                    <td>${escapeHtml(job.perusahaan)}</td>
                    <td class="tanggal-cell">${tglDisplay}</td>
                    <td><span class="badge ${badgeClass}">${job.status}</span></td>
                    <td>
                        <div class="action-cell">
                            <select class="status-select" onchange="ubahStatus('${job.id}', this.value)">
                                ${STATUSES.map(s =>
                                    `<option value="${s}" ${s === job.status ? 'selected' : ''}>${s}</option>`
                                ).join('')}
                            </select>
                            <button class="delete-btn" onclick="hapusLamaran('${job.id}')" title="Hapus">✕</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    updateStats();
}

// ================================================================
// 8. STATISTIK
// ================================================================
function updateStats() {
    document.getElementById('totalLamaran').textContent = jobs.length;
    document.getElementById('totalInterview').textContent = jobs.filter(j => j.status === 'Interview').length;
    document.getElementById('totalDiterima').textContent = jobs.filter(j => j.status === 'Diterima').length;
}

// ================================================================
// 9. NAVIGASI & FILTER
// ================================================================
function pindahKe(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.page === pageId) tab.classList.add('active');
    });
}

function setFilter(status) {
    filterStatus = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === status) btn.classList.add('active');
    });
    render();
}

// ================================================================
// 10. MODAL TAMBAH
// ================================================================
function bukaModalTambah() {
    document.getElementById('inputTanggal').value = getToday();
    document.getElementById('inputPosisi').value = '';
    document.getElementById('inputPerusahaan').value = '';
    document.getElementById('modalTambah').classList.add('active');
    setTimeout(() => document.getElementById('inputPosisi').focus(), 100);
}

function tutupModalTambah() {
    document.getElementById('modalTambah').classList.remove('active');
}

// Tutup modal jika klik di luar area modal
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('modalTambah');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                tutupModalTambah();
            }
        });
    }

    // Event listener untuk filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setFilter(this.dataset.filter);
        });
    });

    // Event listener untuk nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            if (this.dataset.page) {
                pindahKe(this.dataset.page);
            }
        });
    });

    // Enter key di modal untuk submit
    document.getElementById('inputPosisi').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('inputPerusahaan').focus();
        }
    });
    document.getElementById('inputPerusahaan').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('inputTanggal').focus();
        }
    });
    document.getElementById('inputTanggal').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            simpanLamaran();
        }
    });
});

// ================================================================
// 11. UTILITY
// ================================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// 12. COBA LOGIN OTOMATIS (jika sudah login sebelumnya)
// ================================================================
// Nonaktifkan agar user selalu pilih di halaman login
// Tapi kita bisa simpan session di localStorage jika mau
// Untuk sekarang, biarkan user memilih di halaman login