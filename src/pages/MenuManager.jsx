import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function MenuManager({ restaurant, onBack }) {
  const [categories, setCategories] = useState([])
  const [menus, setMenus] = useState([])
  const [categoryName, setCategoryName] = useState('')
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    const { data: categoryData } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true })

    const { data: menuData } = await supabase
      .from('menus')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })

    setCategories(categoryData || [])
    setMenus(menuData || [])
    setLoading(false)
  }

  const addCategory = async (e) => {
    e.preventDefault()

    if (!categoryName.trim()) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('categories')
      .insert({
        restaurant_id: restaurant.id,
        name: categoryName.trim()
      })

    if (error) {
      setMessage(error.message)
    } else {
      setCategoryName('')
      setMessage('Kategori berhasil ditambahkan.')
      await loadData()
    }

    setSaving(false)
  }

  const addMenu = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!menuForm.name.trim()) {
      setMessage('Nama menu wajib diisi.')
      return
    }

    if (!menuForm.price || Number(menuForm.price) <= 0) {
      setMessage('Harga menu harus lebih dari 0.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('menus')
      .insert({
        restaurant_id: restaurant.id,
        category_id: menuForm.category_id || null,
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        price: Number(menuForm.price),
        is_available: true
      })

    if (error) {
      setMessage(error.message)
    } else {
      setMenuForm({
        name: '',
        description: '',
        price: '',
        category_id: ''
      })
      setMessage('Menu berhasil ditambahkan.')
      await loadData()
    }

    setSaving(false)
  }

  const deleteCategory = async (id) => {
    if (!confirm('Hapus kategori ini?')) return

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      await loadData()
    }
  }

  const deleteMenu = async (id) => {
    if (!confirm('Hapus menu ini?')) return

    const { error } = await supabase
      .from('menus')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      await loadData()
    }
  }

  const toggleMenu = async (menu) => {
    const { error } = await supabase
      .from('menus')
      .update({
        is_available: !menu.is_available
      })
      .eq('id', menu.id)

    if (!error) {
      await loadData()
    }
  }

  return (
    <div className="menu-manager-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="brand-icon">QR</span>
          <strong>QR Resto</strong>
        </div>

        <button className="dashboard-logout" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      <main className="menu-manager-main">
        <div className="menu-manager-heading">
          <span className="section-label">KELOLA MENU</span>
          <h1>{restaurant.name}</h1>
          <p>
            Kelola kategori dan makanan/minuman restoran Anda.
          </p>
        </div>

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}

        <div className="menu-manager-grid">
          <section className="manager-card">
            <h2>Kategori</h2>
            <p className="manager-description">
              Buat kategori untuk mengelompokkan menu.
            </p>

            <form onSubmit={addCategory} className="manager-form">
              <label>Nama Kategori</label>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Contoh: Makanan"
              />

              <button type="submit" disabled={saving}>
                + Tambah Kategori
              </button>
            </form>

            <div className="manager-list">
              {categories.length === 0 ? (
                <p className="empty-text">
                  Belum ada kategori.
                </p>
              ) : (
                categories.map((category) => (
                  <div className="manager-list-item" key={category.id}>
                    <strong>{category.name}</strong>
                    <button
                      onClick={() => deleteCategory(category.id)}
                    >
                      Hapus
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="manager-card">
            <h2>Tambah Menu</h2>
            <p className="manager-description">
              Masukkan makanan atau minuman baru.
            </p>

            <form onSubmit={addMenu} className="manager-form">
              <label>Nama Menu</label>
              <input
                value={menuForm.name}
                onChange={(e) =>
                  setMenuForm({
                    ...menuForm,
                    name: e.target.value
                  })
                }
                placeholder="Contoh: Nasi Goreng"
              />

              <label>Harga</label>
              <input
                type="number"
                min="0"
                value={menuForm.price}
                onChange={(e) =>
                  setMenuForm({
                    ...menuForm,
                    price: e.target.value
                  })
                }
                placeholder="18000"
              />

              <label>Kategori</label>
              <select
                value={menuForm.category_id}
                onChange={(e) =>
                  setMenuForm({
                    ...menuForm,
                    category_id: e.target.value
                  })
                }
              >
                <option value="">Tanpa kategori</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <label>Deskripsi</label>
              <textarea
                value={menuForm.description}
                onChange={(e) =>
                  setMenuForm({
                    ...menuForm,
                    description: e.target.value
                  })
                }
                placeholder="Deskripsi menu..."
                rows="3"
              />

              <button type="submit" disabled={saving}>
                + Tambah Menu
              </button>
            </form>
          </section>
        </div>

        <section className="manager-card menu-table-card">
          <div className="menu-table-heading">
            <div>
              <h2>Daftar Menu</h2>
              <p className="manager-description">
                {menus.length} menu terdaftar
              </p>
            </div>
          </div>

          {loading ? (
            <p className="empty-text">Memuat menu...</p>
          ) : menus.length === 0 ? (
            <p className="empty-text">
              Belum ada menu. Tambahkan menu pertama Anda.
            </p>
          ) : (
            <div className="menu-list">
              {menus.map((menu) => {
                const category = categories.find(
                  (item) => item.id === menu.category_id
                )

                return (
                  <div className="menu-item" key={menu.id}>
                    <div className="menu-item-info">
                      <strong>{menu.name}</strong>

                      <span>
                        Rp{Number(menu.price).toLocaleString('id-ID')}
                      </span>

                      {category && (
                        <small>{category.name}</small>
                      )}

                      {menu.description && (
                        <p>{menu.description}</p>
                      )}
                    </div>

                    <div className="menu-item-actions">
                      <button
                        className={
                          menu.is_available
                            ? 'available-button'
                            : 'unavailable-button'
                        }
                        onClick={() => toggleMenu(menu)}
                      >
                        {menu.is_available
                          ? 'Tersedia'
                          : 'Habis'}
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => deleteMenu(menu.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default MenuManager

