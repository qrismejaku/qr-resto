import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'

export default function TableManager({ restaurant, onBack }) {
  const [tables, setTables] = useState([])
  const [tableNumber, setTableNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadTables()
  }, [])

  const loadTables = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('table_number')

    if (error) {
      setMessage(error.message)
    } else {
      setTables(data || [])
    }

    setLoading(false)
  }

  const addTable = async (e) => {
    e.preventDefault()
    setMessage('')

    const number = tableNumber.trim()

    if (!number) {
      setMessage('Nomor meja wajib diisi.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('restaurant_tables')
      .insert({
        restaurant_id: restaurant.id,
        table_number: number,
        is_active: true
      })

    if (error) {
      setMessage(error.message)
    } else {
      setTableNumber('')
      setMessage('Meja berhasil ditambahkan.')
      await loadTables()
    }

    setSaving(false)
  }

  const deleteTable = async (id) => {
    if (!confirm('Hapus meja ini?')) return

    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurant.id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Meja berhasil dihapus.')
    await loadTables()
  }

  const getTableUrl = (tableNumber) => {
    return `${window.location.origin}/r/${restaurant.slug}/t/${tableNumber}`
  }

  const downloadQR = (tableNumber) => {
    const qrCanvas = document.getElementById(`qr-${tableNumber}`)

    if (!qrCanvas) return

    const width = 800
    const height = 1000

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Border
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 6
    ctx.strokeRect(20, 20, width - 40, height - 40)

    // Text settings
    ctx.textAlign = 'center'

    // Brand
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 42px Arial'
    ctx.fillText('QR RESTO', width / 2, 95)

    // Restaurant name
    ctx.font = 'bold 34px Arial'
    ctx.fillText(restaurant.name, width / 2, 150)

    // QR
    const qrSize = 520
    const qrX = (width - qrSize) / 2
    const qrY = 205

    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    // Table number
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 58px Arial'
    ctx.fillText(`MEJA ${tableNumber}`, width / 2, 800)

    // Instruction
    ctx.fillStyle = '#374151'
    ctx.font = '28px Arial'
    ctx.fillText('Scan QR untuk melihat menu', width / 2, 860)
    ctx.fillText('dan melakukan pesanan', width / 2, 900)

    // Download
    const link = document.createElement('a')
    link.download = `${restaurant.slug}-meja-${tableNumber}-qr.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
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
          <span className="section-label">KELOLA MEJA & QR</span>
          <h1>{restaurant.name}</h1>
          <p>
            Setiap meja memiliki QR unik untuk membuka menu dan melakukan pesanan.
          </p>
        </div>

        <section className="table-manager-card">
          <h2>Tambah Meja</h2>

          <form className="table-form" onSubmit={addTable}>
            <label>Nomor Meja</label>

            <input
              type="text"
              placeholder="Contoh: 01"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />

            {message && (
              <div className="dashboard-message">
                {message}
              </div>
            )}

            <button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : '+ Tambah Meja'}
            </button>
          </form>
        </section>

        <section className="table-manager-card">
          <h2>Daftar Meja & QR</h2>

          {loading ? (
            <p>Memuat meja...</p>
          ) : tables.length === 0 ? (
            <p className="table-empty">
              Belum ada meja. Tambahkan meja pertama Anda.
            </p>
          ) : (
            <div className="table-list">
              {tables.map((table) => {
                const tableUrl = getTableUrl(table.table_number)

                return (
                  <div className="table-item table-item-qr" key={table.id}>
                    <div className="table-info">
                      <strong>Meja {table.table_number}</strong>

                      <small>
                        {tableUrl}
                      </small>

                      <span className="status-badge">
                        {table.is_active ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>

                    <div className="table-qr-box">
                      <QRCodeCanvas
                        id={`qr-${table.table_number}`}
                        value={tableUrl}
                        size={180}
                        level="H"
                        includeMargin
                      />

                      <strong>MEJA {table.table_number}</strong>

                      <button
                        type="button"
                        className="qr-download-button"
                        onClick={() => downloadQR(table.table_number)}
                      >
                        Download QR
                      </button>
                    </div>

                    <button
                      type="button"
                      className="table-delete"
                      onClick={() => deleteTable(table.id)}
                    >
                      Hapus
                    </button>
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

