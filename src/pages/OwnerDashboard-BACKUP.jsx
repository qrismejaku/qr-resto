import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MenuManager from './MenuManager'
import TableManager from './TableManager'

function OwnerDashboard({ onLogout }) {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [page, setPage] = useState('dashboard')
  const [menuCount, setMenuCount] = useState(0)
  const [tableCount, setTableCount] = useState(0)

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    phone: '',
    email: '',
    address: ''
  })

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      onLogout()
      return
    }

    setUser(user)

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!error && data) {
      setRestaurant(data)

      const { count: menusCount } = await supabase
        .from('menus')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', data.id)

      const { count: tablesCount } = await supabase
        .from('restaurant_tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', data.id)

      setMenuCount(menusCount || 0)
      setTableCount(tablesCount || 0)
    }

    setLoading(false)
  }

  const createRestaurant = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!form.name.trim()) {
      setMessage('Nama restoran wajib diisi.')
      return
    }

    if (!form.slug.trim()) {
      setMessage('Slug restoran wajib diisi.')
      return
    }

    setSaving(true)

    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim()
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setRestaurant(data)
    setMessage('Restoran berhasil dibuat!')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const makeSlug = (value) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
  }

  if (page === 'menu' && restaurant) {
    return <MenuManager restaurant={restaurant} onBack={() => setPage('dashboard')} />
  }

  if (page === 'tables' && restaurant) {
    return <TableManager restaurant={restaurant} onBack={() => setPage('dashboard')} />
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          Memuat dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-brand">
            <span className="brand-icon">QR</span>
            <strong>QR Resto</strong>
          </div>
        </div>

        <button className="dashboard-logout" onClick={logout}>
          Keluar
        </button>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <span className="section-label">DASHBOARD OWNER</span>
          <h1>Selamat datang, {user?.user_metadata?.full_name || 'Owner'}!</h1>
          <p>
            Kelola restoran, menu, meja, pesanan, dan pembayaran dari sini.
          </p>
        </div>

        {!restaurant ? (
          <section className="restaurant-setup-card">
            <div className="setup-heading">
              <span className="setup-icon">+</span>
              <div>
                <h2>Buat Restoran Anda</h2>
                <p>
                  Lengkapi informasi dasar restoran sebelum mulai membuat menu.
                </p>
              </div>
            </div>

            <form className="restaurant-form" onSubmit={createRestaurant}>
              <div className="form-row">
                <div>
                  <label>Nama Restoran *</label>
                  <input
                    type="text"
                    placeholder="Contoh: Warung Nusantara"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setForm({
                        ...form,
                        name,
                        slug: makeSlug(name)
                      })
                    }}
                    required
                  />
                </div>

                <div>
                  <label>Slug Restoran *</label>
                  <input
                    type="text"
                    placeholder="warung-nusantara"
                    value={form.slug}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: makeSlug(e.target.value)
                      })
                    }
                    required
                  />
                  <small>
                    URL menu: /r/{form.slug || 'nama-restoran'}
                  </small>
                </div>
              </div>

              <label>Deskripsi</label>
              <textarea
                placeholder="Ceritakan sedikit tentang restoran Anda..."
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value
                  })
                }
                rows="4"
              />

              <div className="form-row">
                <div>
                  <label>Nomor HP Restoran</label>
                  <input
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value
                      })
                    }
                  />
                </div>

                <div>
                  <label>Email Restoran</label>
                  <input
                    type="email"
                    placeholder="restoran@email.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <label>Alamat</label>
              <textarea
                placeholder="Alamat lengkap restoran"
                value={form.address}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: e.target.value
                  })
                }
                rows="3"
              />

              {message && (
                <div className="dashboard-message">
                  {message}
                </div>
              )}

              <button
                className="dashboard-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : 'Buat Restoran'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="restaurant-overview">
              <div>
                <span className="status-badge">AKTIF</span>
                <h2>{restaurant.name}</h2>
                <p>{restaurant.description || 'Belum ada deskripsi restoran.'}</p>
                <small>
                  URL menu: /r/{restaurant.slug}
                </small>
              </div>

              <div className="overview-actions">
                <button onClick={() => setPage('menu')}>Kelola Menu</button>                <button onClick={() => setPage('tables')}>Kelola Meja</button>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="dashboard-card">
                <span>MENU</span>
                <strong>0</strong>
                <p>Kelola makanan & minuman</p>
              </div>

              <div className="dashboard-card">
                <span>MEJA</span>
                <strong>0</strong>
                <p>Atur meja & QR</p>
              </div>

              <div className="dashboard-card">
                <span>PESANAN</span>
                <strong>0</strong>
                <p>Pesanan hari ini</p>
              </div>

              <div className="dashboard-card">
                <span>PEMBAYARAN</span>
                <strong>Rp0</strong>
                <p>Transaksi hari ini</p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default OwnerDashboard







