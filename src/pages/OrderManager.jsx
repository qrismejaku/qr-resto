import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function OrderManager({ restaurant, onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadOrders = async () => {
    setLoading(true)
    setMessage('')

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error(ordersError)
      setMessage(ordersError.message)
      setLoading(false)
      return
    }

    if (!ordersData || ordersData.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    const orderIds = ordersData.map((order) => order.id)

    const tableIds = [
      ...new Set(
        ordersData
          .map((order) => order.table_id)
          .filter(Boolean)
      )
    ]

    let tablesData = []

    if (tableIds.length > 0) {
      const { data, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('id, table_number')
        .eq('restaurant_id', restaurant.id)
        .in('id', tableIds)

      if (tablesError) {
        console.error(tablesError)
        setMessage(tablesError.message)
        setLoading(false)
        return
      }

      tablesData = data || []
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)

    if (itemsError) {
      console.error(itemsError)
      setMessage(itemsError.message)
      setLoading(false)
      return
    }

    const combined = ordersData.map((order) => ({
      ...order,
      table_number:
        (tablesData || []).find(
          (table) => table.id === order.table_id
        )?.table_number || null,
      items: (itemsData || []).filter(
        (item) => item.order_id === order.id
      )
    }))

    setOrders(combined)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [restaurant.id])

  const updateStatus = async (orderId, status) => {
    setMessage('')

    const { error } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('restaurant_id', restaurant.id)

    if (error) {
      console.error(error)
      setMessage(error.message)
      return
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status,
              updated_at: new Date().toISOString()
            }
          : order
      )
    )
  }

  const formatPrice = (price) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(price)

  const formatDate = (value) =>
    new Date(value).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

  const statusLabel = {
    pending: 'PENDING',
    confirmed: 'DITERIMA',
    preparing: 'DIPROSES',
    ready: 'SIAP DIAMBIL',
    completed: 'SELESAI',
    cancelled: 'DIBATALKAN'
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          Memuat pesanan...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="brand-icon">QR</span>
          <strong>QR Resto</strong>
        </div>

        <button className="dashboard-logout" onClick={onBack}>
          ← Kembali
        </button>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <span className="section-label">PESANAN</span>
          <h1>Pesanan {restaurant.name}</h1>
          <p>
            Lihat dan kelola pesanan pelanggan dari meja restoran.
          </p>
        </div>

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}

        {orders.length === 0 ? (
          <section className="restaurant-setup-card order-empty">
            <div className="setup-heading">
              <span className="setup-icon">📦</span>
              <div>
                <h2>Belum ada pesanan</h2>
                <p>
                  Pesanan pelanggan akan muncul di sini setelah mereka
                  melakukan pemesanan.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <span className="order-number">
                      #{order.order_number}
                    </span>

                    <span className={`order-status status-${order.status}`}>
                      {statusLabel[order.status] || order.status}
                    </span>
                  </div>

                  <small>{formatDate(order.created_at)}</small>
                </div>

                <div className="order-customer">
                  <strong>
                    {order.customer_name || 'Pelanggan'}
                  </strong>

                  {order.customer_phone && (
                    <span>{order.customer_phone}</span>
                  )}
                </div>

                <div className="order-table">
                  Meja{' '}
                  {order.table_number
                    ? order.table_number
                    : 'Tanpa meja'}
                </div>

                <div className="order-items">
                  {order.items.map((item) => (
                    <div className="order-item" key={item.id}>
                      <div>
                        <strong>{item.menu_name}</strong>
                        <span>
                          {item.quantity} × {formatPrice(item.price)}
                        </span>
                      </div>

                      <strong>
                        {formatPrice(item.subtotal)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="order-total">
                  <span>Total</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>

                <div className="order-actions">
                  {order.status === 'pending' && (
                    <>
                      <button
                        className="order-button order-process"
                        onClick={() =>
                          updateStatus(order.id, 'confirmed')
                        }
                      >
                        Terima Pesanan
                      </button>

                      <button
                        className="order-button order-cancel"
                        onClick={() =>
                          updateStatus(order.id, 'cancelled')
                        }
                      >
                        Tolak
                      </button>
                    </>
                  )}

                  {order.status === 'confirmed' && (
                    <button
                      className="order-button order-process"
                      onClick={() =>
                        updateStatus(order.id, 'preparing')
                      }
                    >
                      Mulai Diproses
                    </button>
                  )}

                  {order.status === 'preparing' && (
                    <>
                      <div className="order-completed">
                        ✓ Pesanan sedang diproses
                      </div>

                      <button
                        className="order-button order-process"
                        onClick={() =>
                          updateStatus(order.id, 'ready')
                        }
                      >
                        Pesanan Siap
                      </button>
                    </>
                  )}

                  {order.status === 'ready' && (
                    <>
                      <div className="order-completed">
                        ✓ Pesanan siap diambil
                      </div>

                      <button
                        className="order-button order-complete"
                        onClick={() =>
                          updateStatus(order.id, 'completed')
                        }
                      >
                        Selesaikan Pesanan
                      </button>
                    </>
                  )}

                  {order.status === 'completed' && (
                    <div className="order-completed">
                      ✓ Pesanan selesai
                    </div>
                  )}

                  {order.status === 'cancelled' && (
                    <div className="order-cancelled">
                      Pesanan dibatalkan
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

export default OrderManager


