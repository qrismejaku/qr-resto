import { useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import OwnerDashboard from './pages/OwnerDashboard'
import PublicMenu from './pages/PublicMenu'

function App() {
  const [page, setPage] = useState('home')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [register, setRegister] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [login, setLogin] = useState({
    email: '',
    password: ''
  })

  const publicMatch = window.location.pathname.match(/^\/r\/([^/]+)$/)

  if (publicMatch) {
    return <PublicMenu slug={publicMatch[1]} />
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setMessage('')

    if (register.password !== register.confirmPassword) {
      setMessage('Konfirmasi password tidak sama.')
      return
    }

    if (register.password.length < 6) {
      setMessage('Password minimal 6 karakter.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: register.email,
      password: register.password,
      options: {
        data: {
          full_name: register.fullName,
          phone: register.phone
        }
      }
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(
      'Pendaftaran berhasil. Silakan cek email untuk konfirmasi akun jika diminta.'
    )

    setRegister({
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: login.email,
      password: login.password
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setPage('dashboard')
  }

  if (page === 'register') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <button className="auth-back" onClick={() => setPage('home')}>
            ← Kembali
          </button>

          <div className="auth-logo">QR</div>

          <h1>Daftar Restoran</h1>
          <p className="auth-subtitle">
            Buat akun pemilik restoran untuk mulai menggunakan QR Resto.
          </p>

          <form onSubmit={handleRegister}>
            <label>Nama Lengkap</label>
            <input
              type="text"
              placeholder="Nama pemilik"
              value={register.fullName}
              onChange={(e) =>
                setRegister({ ...register, fullName: e.target.value })
              }
              required
            />

            <label>Nomor HP</label>
            <input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={register.phone}
              onChange={(e) =>
                setRegister({ ...register, phone: e.target.value })
              }
              required
            />

            <label>Email</label>
            <input
              type="email"
              placeholder="nama@email.com"
              value={register.email}
              onChange={(e) =>
                setRegister({ ...register, email: e.target.value })
              }
              required
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Minimal 6 karakter"
              value={register.password}
              onChange={(e) =>
                setRegister({ ...register, password: e.target.value })
              }
              required
            />

            <label>Konfirmasi Password</label>
            <input
              type="password"
              placeholder="Ulangi password"
              value={register.confirmPassword}
              onChange={(e) =>
                setRegister({
                  ...register,
                  confirmPassword: e.target.value
                })
              }
              required
            />

            {message && <div className="auth-message">{message}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p className="auth-switch">
            Sudah punya akun?{' '}
            <button onClick={() => {
              setMessage('')
              setPage('login')
            }}>
              Masuk
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (page === 'dashboard') {
    return <OwnerDashboard onLogout={() => setPage('home')} />
  }

  if (page === 'login') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <button className="auth-back" onClick={() => setPage('home')}>
            ← Kembali
          </button>

          <div className="auth-logo">QR</div>

          <h1>Masuk ke QR Resto</h1>
          <p className="auth-subtitle">
            Kelola restoran, menu, meja, pesanan, dan pembayaran.
          </p>

          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              placeholder="nama@email.com"
              value={login.email}
              onChange={(e) =>
                setLogin({ ...login, email: e.target.value })
              }
              required
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Password"
              value={login.password}
              onChange={(e) =>
                setLogin({ ...login, password: e.target.value })
              }
              required
            />

            {message && <div className="auth-message">{message}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="auth-switch">
            Belum punya akun?{' '}
            <button onClick={() => {
              setMessage('')
              setPage('register')
            }}>
              Daftar Restoran
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <span className="brand-icon">QR</span>
            <span>Resto</span>
          </a>

          <nav className="nav-links">
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#fitur">Fitur</a>
            <a href="#untuk-resto">Untuk Restoran</a>
          </nav>

          <div className="nav-actions">
            <button
              className="btn btn-outline"
              onClick={() => setPage('login')}
            >
              Masuk
            </button>

            <button
              className="btn btn-primary"
              onClick={() => setPage('register')}
            >
              Daftar Restoran
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-content">
              <div className="badge">
                <span>•</span> Menu digital untuk restoran
              </div>

              <h1>
                Satu QR untuk
                <span> menu, pesanan & pembayaran.</span>
              </h1>

              <p className="hero-description">
                Platform sederhana untuk restoran membuat menu digital,
                menerima pesanan dari meja, dan menyediakan pembayaran
                langsung untuk pelanggan.
              </p>

              <div className="hero-actions">
                <button
                  className="btn btn-primary btn-large"
                  onClick={() => setPage('register')}
                >
                  Daftar Restoran →
                </button>

                <a href="#cara-kerja" className="btn btn-light btn-large">
                  Lihat Cara Kerja
                </a>
              </div>

              <div className="hero-note">
                <span>✓</span> Pelanggan cukup scan QR tanpa perlu aplikasi
              </div>
            </div>

            <div className="hero-visual">
              <div className="phone">
                <div className="phone-top">
                  <span>9:41</span>
                  <span>•••</span>
                </div>

                <div className="restaurant-logo">QR</div>

                <h3>Warung Nusantara</h3>
                <p className="table-text">Meja 08</p>

                <div className="menu-card">
                  <div className="food-image">🍽️</div>
                  <div className="food-info">
                    <strong>Nasi Goreng Spesial</strong>
                    <span>Rp18.000</span>
                  </div>
                  <button>+</button>
                </div>

                <div className="menu-card">
                  <div className="food-image">🍜</div>
                  <div className="food-info">
                    <strong>Mie Ayam</strong>
                    <span>Rp15.000</span>
                  </div>
                  <button>+</button>
                </div>

                <div className="menu-card">
                  <div className="food-image">🥤</div>
                  <div className="food-info">
                    <strong>Es Teh</strong>
                    <span>Rp5.000</span>
                  </div>
                  <button>+</button>
                </div>

                <div className="cart-button">
                  🛒 Lihat Pesanan
                  <span>Rp38.000</span>
                </div>
              </div>

              <div className="floating-card floating-card-one">
                <span className="floating-icon">✓</span>
                <div>
                  <strong>Pembayaran</strong>
                  <small>Berhasil</small>
                </div>
              </div>

              <div className="floating-card floating-card-two">
                <span className="floating-icon">📦</span>
                <div>
                  <strong>Pesanan baru</strong>
                  <small>Meja 08</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="features-section">
          <div className="container">
            <div className="section-heading">
              <span className="section-label">FITUR</span>
              <h2>Semua kebutuhan restoran dalam satu platform</h2>
              <p>
                Pemilik restoran mengelola semuanya dari dashboard.
                Pelanggan cukup scan QR dan pesan.
              </p>
            </div>

            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>QR Menu</h3>
                <p>Setiap meja memiliki QR unik yang langsung membuka menu restoran.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🍽️</div>
                <h3>Menu Digital</h3>
                <p>Kelola makanan, kategori, harga, foto, dan ketersediaan menu.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📦</div>
                <h3>Pesanan</h3>
                <p>Pesanan pelanggan masuk ke dashboard restoran secara langsung.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">💳</div>
                <h3>Pembayaran</h3>
                <p>Pelanggan dapat melakukan pembayaran langsung melalui sistem.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="steps-section">
          <div className="container">
            <div className="section-heading">
              <span className="section-label">CARA KERJA</span>
              <h2>Mulai dalam beberapa langkah</h2>
            </div>

            <div className="steps-grid">
              <div className="step">
                <div className="step-number">01</div>
                <h3>Restoran daftar</h3>
                <p>Pemilik restoran membuat akun dan mendaftarkan restorannya.</p>
              </div>

              <div className="step">
                <div className="step-number">02</div>
                <h3>Buat menu</h3>
                <p>Tambahkan kategori, makanan, harga, foto, dan meja restoran.</p>
              </div>

              <div className="step">
                <div className="step-number">03</div>
                <h3>Pasang QR</h3>
                <p>Generate QR untuk setiap meja kemudian cetak dan pasang.</p>
              </div>

              <div className="step">
                <div className="step-number">04</div>
                <h3>Pelanggan scan</h3>
                <p>Pelanggan scan QR, memilih makanan, memesan, dan membayar.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="untuk-resto" className="cta-section">
          <div className="container">
            <div className="cta-box">
              <div>
                <span className="section-label">UNTUK PEMILIK RESTORAN</span>
                <h2>Siap membuat restoran lebih praktis?</h2>
                <p>
                  Daftarkan restoran Anda dan mulai kelola menu digital,
                  pesanan, meja, dan pembayaran dari satu dashboard.
                </p>
              </div>

              <button
                className="btn btn-white btn-large"
                onClick={() => setPage('register')}
              >
                Daftar Restoran →
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <a href="/" className="brand footer-brand">
              <span className="brand-icon">QR</span>
              <span>Resto</span>
            </a>
            <p>Platform menu digital dan pemesanan restoran.</p>
          </div>

          <div className="footer-copy">
            © 2026 QR Resto. Semua hak dilindungi.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App



