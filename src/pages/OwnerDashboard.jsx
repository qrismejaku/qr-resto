import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MenuManager from './MenuManager'
import TableManager from './TableManager'
import OrderManager from './OrderManager'

function OwnerDashboard({ onLogout }) {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [page, setPage] = useState('dashboard')
  const [menuCount, setMenuCount] = useState(0)
  const [tableCount, setTableCount] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [notificationEnabled, setNotificationEnabled] = useState(false)

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

  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase.channel('dashboard-orders-' + restaurant.id).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: 'restaurant_id=eq.' + restaurant.id
    }, async (payload) => {
      loadDashboard()

      if (payload.eventType === 'INSERT' && notificationEnabled) {
        const order = payload.new || {}
        const total = Number(order.total || 0).toLocaleString('id-ID')

        let tableNumber = 'Tanpa meja'
        const customerName = order.customer_name || 'Pelanggan'

        if (order.table_id) {
          const { data: tableData } = await supabase
            .from('restaurant_tables')
            .select('table_number')
            .eq('id', order.table_id)
            .eq('restaurant_id', restaurant.id)
            .maybeSingle()

          if (tableData?.table_number) {
            tableNumber = tableData.table_number
          }
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pesanan Baru - Meja ' + tableNumber, {
            body: customerName + ' - Rp' + total
          })
        }

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext

          if (AudioContextClass) {
            const audioContext = new AudioContextClass()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = 880
            gainNode.gain.value = 0.08

            oscillator.start()
            oscillator.stop(audioContext.currentTime + 0.25)
          }
        } catch (error) {
          console.error('Gagal memainkan suara notifikasi:', error)
        }
      }
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, notificationEnabled])

  const enableNotifications = async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission()

        if (permission !== 'granted') {
          setMessage('Izin notifikasi browser belum diberikan.')
          return
        }
      }

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext

      if (AudioContextClass) {
        const audioContext = new AudioContextClass()

        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 880
        gainNode.gain.value = 0.05

        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.12)
      }

      setNotificationEnabled(true)
      setMessage('Notifikasi dan suara berhasil diaktifkan.')
    } catch (error) {
      console.error('Gagal mengaktifkan notifikasi:', error)
      setMessage('Notifikasi atau suara gagal diaktifkan.')
    }
  }

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

      const { data: menusData, error: menusError } = await supabase
        .from('menus')
        .select('id')
        .eq('restaurant_id', data.id)

      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('restaurant_id', data.id)

      if (menusError) {
        console.error('Gagal membaca menu:', menusError)
      }

      if (tablesError) {
        console.error('Gagal membaca meja:', tablesError)
      }

      setMenuCount(menusData?.length || 0)
      setTableCount(tablesData?.length || 0)

    
      const now = new Date()
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )
      const startOfTomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      )

      const { data: ordersData } = await supabase
        .from('orders')
        .select('total')
        .eq('restaurant_id', data.id)
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', startOfTomorrow.toISOString())

      const orders = ordersData || []

      setOrderCount(orders.length)

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('restaurant_id', data.id)
        .eq('status', 'paid')
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', startOfTomorrow.toISOString())

      if (paymentsError) {
        console.error('Gagal membaca pembayaran:', paymentsError)
        setPaymentTotal(0)
      } else {
        const payments = paymentsData || []

        setPaymentTotal(
          payments.reduce(
            (sum, payment) => sum + Number(payment.amount || 0),
            0
          )
        )
      }
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

  if (page === 'orders' && restaurant) {
    return <OrderManager restaurant={restaurant} onBack={() => setPage('dashboard')} />
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
                <button onClick={enableNotifications} disabled={notificationEnabled}>
                  {notificationEnabled ? 'Notifikasi Aktif' : 'Aktifkan Notifikasi & Suara'}
                </button>
                <button onClick={() => setPage('menu')}>Kelola Menu</button>
                <button onClick={() => setPage('tables')}>Kelola Meja</button>
                <button onClick={() => setPage('orders')}>Kelola Pesanan</button>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="dashboard-card">
                <span>MENU</span>
                <strong>{menuCount}</strong>
                <p>Kelola makanan & minuman</p>
              </div>

              <div className="dashboard-card">
                <span>MEJA</span>
                <strong>{tableCount}</strong>
                <p>Atur meja & QR</p>
              </div>

              <div className="dashboard-card">
                <span>PESANAN</span>
                <strong>{orderCount}</strong>
                <p>Pesanan hari ini</p>
                <button className="dashboard-card-link" onClick={() => setPage('orders')}>Lihat Pesanan ?</button>
              </div>

              <div className="dashboard-card">
                <span>PEMBAYARAN</span>
                <strong>Rp{paymentTotal.toLocaleString("id-ID")}</strong>
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








