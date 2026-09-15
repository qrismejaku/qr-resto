import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://qr-resto.birobusines.workers.dev'

export default function PublicMenu({ slug, tableNumber }) {
  const [restaurant, setRestaurant] = useState(null)
  const [categories, setCategories] = useState([])
  const [menus, setMenus] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [successOrderId, setSuccessOrderId] = useState('')
  const [successOrderTotal, setSuccessOrderTotal] = useState(0)
  const [paymentUrl, setPaymentUrl] = useState('')

  useEffect(() => {
    loadMenu()
  }, [slug])

  const loadMenu = async () => {
    setLoading(true)
    setError('')

    const { data: restaurantData, error: restaurantError } =
      await supabase
        .from('restaurants')
        .select('id, name, slug, description, phone, address')
        .eq('slug', slug)
        .maybeSingle()

    if (restaurantError) {
      setError(restaurantError.message)
      setLoading(false)
      return
    }

    if (!restaurantData) {
      setError('Restoran tidak ditemukan.')
      setLoading(false)
      return
    }

    const { data: categoryData, error: categoryError } =
      await supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', restaurantData.id)
        .order('name')

    if (categoryError) {
      setError(categoryError.message)
      setLoading(false)
      return
    }

    const { data: menuData, error: menuError } =
      await supabase
        .from('menus')
        .select('id, name, description, price, category_id, is_available')
        .eq('restaurant_id', restaurantData.id)
        .eq('is_available', true)
        .order('name')

    if (menuError) {
      setError(menuError.message)
      setLoading(false)
      return
    }

    setRestaurant(restaurantData)
    setCategories(categoryData || [])
    setMenus(menuData || [])
    setLoading(false)
  }

  const addToCart = (menu) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === menu.id)

      if (existing) {
        return current.map((item) =>
          item.id === menu.id
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      }

      return [...current, { ...menu, qty: 1 }]
    })
  }

  const changeQty = (id, amount) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, qty: item.qty + amount }
            : item
        )
        .filter((item) => item.qty > 0)
    )
  }

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)

  const totalPrice = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.qty,
    0
  )

  const formatPrice = (price) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(price)

  const checkout = async () => {
    if (cart.length === 0) return

    setCheckoutLoading(true)
    setCheckoutMessage('')
    setPaymentUrl('')

    try {
      let tableId = null

      if (tableNumber) {
        const { data: tableData, error: tableError } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('table_number', tableNumber)
          .eq('is_active', true)
          .maybeSingle()

        if (tableError) throw tableError
        if (!tableData) {
          throw new Error('Meja tidak ditemukan atau tidak aktif.')
        }

        tableId = tableData.id
      }

      const items = cart.map((item) => ({
        menu_id: item.id,
        quantity: item.qty
      }))

      const { data: orderId, error: orderError } =
        await supabase.rpc('create_public_order', {
          p_restaurant_id: restaurant.id,
          p_table_id: tableId,
          p_customer_name: customerName,
          p_customer_phone: customerPhone,
          p_items: items
        })

      if (orderError) throw orderError

      setCheckoutMessage('Pesanan berhasil dibuat.')
      setCheckoutSuccess(true)
      setSuccessOrderId(orderId)
      setSuccessOrderTotal(totalPrice)
      setCustomerName('')
      setCustomerPhone('')
    } catch (err) {
      console.error(err)
      setCheckoutMessage(
        err.message || 'Pesanan gagal dibuat.'
      )
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="public-menu-page">
        <div className="public-menu-loading">
          Memuat menu...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-menu-page">
        <div className="public-menu-error">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="public-menu-page">
      <header className="public-menu-header">
        <div>
          <h1>{restaurant.name}</h1>

          {restaurant.description && (
            <p>{restaurant.description}</p>
          )}

          {restaurant.address && (
            <small>{restaurant.address}</small>
          )}
        </div>
      </header>

      <main className="public-menu-content">
        {categories.map((category) => {
          const categoryMenus = menus.filter(
            (menu) => menu.category_id === category.id
          )

          if (categoryMenus.length === 0) return null

          return (
            <section
              className="public-menu-category"
              key={category.id}
            >
              <h2>{category.name}</h2>

              <div className="public-menu-grid">
                {categoryMenus.map((menu) => (
                  <article
                    className="public-menu-item"
                    key={menu.id}
                  >
                    <div className="public-menu-item-info">
                      <h3>{menu.name}</h3>

                      {menu.description && (
                        <p>{menu.description}</p>
                      )}

                      <strong>
                        {formatPrice(menu.price)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(menu)}
                    >
                      + Tambah
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )
        })}

        {menus.filter((menu) => !menu.category_id).length > 0 && (
          <section className="public-menu-category">
            <h2>Menu Lainnya</h2>

            <div className="public-menu-grid">
              {menus
                .filter((menu) => !menu.category_id)
                .map((menu) => (
                  <article
                    className="public-menu-item"
                    key={menu.id}
                  >
                    <div className="public-menu-item-info">
                      <h3>{menu.name}</h3>

                      {menu.description && (
                        <p>{menu.description}</p>
                      )}

                      <strong>
                        {formatPrice(menu.price)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(menu)}
                    >
                      + Tambah
                    </button>
                  </article>
                ))}
            </div>
          </section>
        )}
      </main>

      {cart.length > 0 && (
        <div className="public-cart">
          <div className="public-cart-title">
            <strong>Keranjang</strong>
            <span>{totalItems} item</span>
          </div>

          <div className="public-cart-items">
            {cart.map((item) => (
              <div
                className="public-cart-item"
                key={item.id}
              >
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {formatPrice(item.price)}
                  </small>
                </div>

                <div className="public-cart-qty">
                  <button
                    type="button"
                    onClick={() => changeQty(item.id, -1)}
                  >
                    âˆ’
                  </button>

                  <span>{item.qty}</span>

                  <button
                    type="button"
                    onClick={() => changeQty(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="public-cart-total">
            <span>Total</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>

          <button
            type="button"
            className="public-checkout-button"
            onClick={() => {
              setCheckoutMessage('')
              setCheckoutSuccess(false)
              setSuccessOrderId('')
              setSuccessOrderTotal(0)
              setCheckoutOpen(true)
            }}
          >
            Lanjut Pesan
          </button>
        </div>
      )}

      {checkoutOpen && (
        <div className="checkout-overlay">
          <div className="checkout-modal">
            <button
              type="button"
              className="checkout-close"
              onClick={() => {
                setCheckoutOpen(false)
                if (checkoutSuccess) {
                  setCart([])
                  setCheckoutMessage('')
                  setCheckoutSuccess(false)
                }
              }}
            >
              Ã—
            </button>

            <span className="section-label">CHECKOUT</span>
            <h2>Konfirmasi Pesanan</h2>

            {tableNumber && (
              <div className="checkout-table">
                Meja {tableNumber}
              </div>
            )}

            <label>Nama Pelanggan</label>
            <input
              type="text"
              placeholder="Nama Anda"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />

            <label>Nomor HP</label>
            <input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />

            <div className="checkout-summary">
              <span>Total Pesanan</span>
              <strong>{formatPrice(totalPrice)}</strong>
            </div>

            {checkoutMessage && (
              <div className="checkout-message">
                {checkoutSuccess ? (
                  <>
                    <strong>âœ“ Pesanan berhasil dibuat</strong>
                    <div>ID Pesanan: {successOrderId}</div>
                    <div>Total: {formatPrice(successOrderTotal)}</div>
                    <div>{checkoutMessage}</div>
                  </>
                ) : (
                  checkoutMessage
                )}
              </div>
            )}

            {!checkoutSuccess && (
              <button
                type="button"
                className="checkout-confirm-button"
                onClick={checkout}
                disabled={checkoutLoading}
              >
                {checkoutLoading
                  ? 'Memproses...'
                  : 'Kirim Pesanan'}
              </button>
            )}

            {checkoutSuccess && paymentUrl && (
              <button
                type="button"
                className="checkout-confirm-button"
                onClick={() => {
                  window.location.href = paymentUrl
                }}
              >
                Bayar Sekarang
              </button>
            )}
            {checkoutSuccess && (
              <button
                type="button"
                className="checkout-confirm-button"
                onClick={() => {
                  setCheckoutOpen(false)
                  setCart([])
                  setCheckoutMessage('')
                  setCheckoutSuccess(false)
                  setSuccessOrderId('')
                  setSuccessOrderTotal(0)
                  setPaymentUrl('')
                }}
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
