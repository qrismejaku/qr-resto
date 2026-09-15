import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicMenu({ slug }) {
  const [restaurant, setRestaurant] = useState(null)
  const [categories, setCategories] = useState([])
  const [menus, setMenus] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
                    −
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
            onClick={() =>
              alert('Checkout akan kita sambungkan ke pesanan dan DOKU.')
            }
          >
            Lanjut Pesan
          </button>
        </div>
      )}
    </div>
  )
}