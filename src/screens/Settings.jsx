import { useState, useEffect } from 'react'
import { PageTransition } from '../components/layout/PageTransition'
import { db } from '../lib/db'
import { DEFAULT_CATEGORIES, saveCategory, renameCategory, deleteCategoryAndReassign } from '../lib/categories'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/layout/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportJson, importJson, exportCsv, exportEncryptedJson, importEncryptedJson, getBackupReminderStatus } from '../lib/backup'
import { formatDate } from '../lib/format'
import { CURRENCY_PRESETS } from '../lib/constants'
import { CurrencyPickerSheet } from '../components/CurrencyPickerSheet'
import { useTheme } from '../hooks/useTheme'
import { Chip } from '../components/ui/Chip'
import { validatePin, createPinRecord } from '../lib/pinAuth'
import { EditIcon, TrashIcon } from '../components/icons'

export function Settings() {
  const settingsArr = useLiveQuery(() => db.settings.toArray())
  const expenses = useLiveQuery(() => db.expenses.toArray())

  // --- categories ---
  const [categories, setCategories] = useState([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('✨')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reassignTo, setReassignTo] = useState('other')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)

  // --- profile ---
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('₹')
  const [customCurrency, setCustomCurrency] = useState('')
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState(false)
  const [cycleDay, setCycleDay] = useState(22)
  const [theme, setTheme] = useTheme()

  // --- preferences ---
  const [lowBalanceStr, setLowBalanceStr] = useState('')
  const [openingSavingsStr, setOpeningSavingsStr] = useState('')

  // --- PIN ---
  const [currentPin, setCurrentPin] = useState('') // what's stored
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMode, setPinMode] = useState('view') // 'view' | 'set' | 'change'

  // --- backup ---
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [encExportPass, setEncExportPass] = useState('')
  const [encExportConfirm, setEncExportConfirm] = useState('')
  const [isEncExportOpen, setIsEncExportOpen] = useState(false)
  const [isEncImportOpen, setIsEncImportOpen] = useState(false)
  const [encImportPass, setEncImportPass] = useState('')
  const [isEncImportConfirmOpen, setIsEncImportConfirmOpen] = useState(false)

  useEffect(() => {
    if (settingsArr) {
      const catSetting = settingsArr.find(s => s.key === 'categories')
      setCategories(catSetting?.value || DEFAULT_CATEGORIES)

      const lbSetting = settingsArr.find(s => s.key === 'lowBalanceWarning')
      setLowBalanceStr(lbSetting?.value ? (lbSetting.value / 100).toString() : '')

      const pinSett = settingsArr.find(s => s.key === 'pin')
      setCurrentPin(pinSett?.value || '')

      const nameSett = settingsArr.find(s => s.key === 'name')
      setName(nameSett?.value || '')

      const currSett = settingsArr.find(s => s.key === 'currency')
      const curr = currSett?.value || '₹'
      if (CURRENCY_PRESETS.includes(curr)) {
        setCurrency(curr)
        setCustomCurrency('')
      } else {
        setCurrency('')
        setCustomCurrency(curr)
      }

      const cdSett = settingsArr.find(s => s.key === 'cycleDay')
      setCycleDay(cdSett?.value ?? 22)

      const osSett = settingsArr.find(s => s.key === 'openingSavings')
      setOpeningSavingsStr(osSett?.value ? (osSett.value / 100).toString() : '')
    }
  }, [settingsArr])

  // ---------- Profile ----------
  const handleSaveName = async () => {
    await db.settings.put({ key: 'name', value: name.trim() })
  }
  const handleSaveCurrency = async (val) => {
    await db.settings.put({ key: 'currency', value: val })
  }
  const handleSaveCycleDay = async (newValue) => {
    const val = newValue === 'last' ? 'last' : parseInt(newValue)
    if (val !== 'last' && (isNaN(val) || val < 1 || val > 31)) {
      alert('Pay day must be 1–31 or "Last day".')
      return
    }
    await db.settings.put({ key: 'cycleDay', value: val })
  }

  // ---------- Categories ----------
  const handleOpenAdd = () => {
    setEditTarget(null); setEditName(''); setEditEmoji('✨'); setIsEditOpen(true)
  }
  const handleOpenEdit = (cat) => {
    if (cat.id === 'other') return
    setEditTarget(cat); setEditName(cat.name); setEditEmoji(cat.emoji); setIsEditOpen(true)
  }
  const handleSaveCategory = async () => {
    try {
      if (editTarget) {
        const newCats = renameCategory(editTarget.id, editName, editEmoji, categories)
        await db.settings.put({ key: 'categories', value: newCats })
      } else {
        const result = saveCategory(editName, editEmoji, categories)
        if (result.updatedCategories !== categories) {
          await db.settings.put({ key: 'categories', value: result.updatedCategories })
        }
      }
      setIsEditOpen(false)
    } catch (e) { alert(e.message) }
  }
  const handleDeleteRequest = (cat) => {
    if (cat.id === 'other') return
    setDeleteTarget(cat); setReassignTo('other'); setIsDeleteOpen(true)
  }
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    const hasExpenses = expenses?.some(e => e.categoryId === id)
    let finalCategories = categories
    if (hasExpenses) {
      const result = deleteCategoryAndReassign(id, reassignTo, categories, expenses)
      finalCategories = result.updatedCategories
      const modified = result.updatedExpenses.filter((e, i) => e !== expenses[i])
      if (modified.length > 0) await db.expenses.bulkPut(modified)
    } else {
      finalCategories = categories.filter(c => c.id !== id)
    }
    await db.settings.put({ key: 'categories', value: finalCategories })
    setIsDeleteOpen(false); setDeleteTarget(null)
  }

  // ---------- Low Balance ----------
  const handleSaveLowBalance = async () => {
    if (!lowBalanceStr) { await db.settings.put({ key: 'lowBalanceWarning', value: null }); return }
    const val = parseFloat(lowBalanceStr)
    if (isNaN(val) || val < 0) return
    await db.settings.put({ key: 'lowBalanceWarning', value: Math.round(val * 100) })
  }

  // ---------- Opening Savings ----------
  const handleSaveOpeningSavings = async () => {
    if (!openingSavingsStr || openingSavingsStr === '0') {
      await db.settings.put({ key: 'openingSavings', value: 0 })
      return
    }
    const val = parseFloat(openingSavingsStr)
    if (isNaN(val) || val < 0) { alert('Opening savings must be a non-negative number.'); return }
    await db.settings.put({ key: 'openingSavings', value: Math.round(val * 100) })
  }

  // ---------- PIN ----------
  const handleSavePin = async () => {
    if (!validatePin(newPin)) { alert('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin) { alert('PINs do not match.'); return }
    // Store a PBKDF2-hashed record — never the plain PIN
    const record = await createPinRecord(newPin)
    await db.settings.put({ key: 'pin', value: record })
    setNewPin(''); setConfirmPin(''); setPinMode('view')
  }
  const handleRemovePin = async () => {
    await db.settings.put({ key: 'pin', value: null })
    setNewPin(''); setConfirmPin(''); setPinMode('view')
  }

  // ---------- Backup ----------
  const handleExportJson = async () => {
    try {
      const blob = await exportJson()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `paylo-backup-${formatDate(new Date().toISOString())}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) }
  }

  const handleExportEncrypted = async () => {
    if (!encExportPass) { alert('Please enter a password.'); return }
    if (encExportPass !== encExportConfirm) { alert('Passwords do not match.'); return }
    try {
      const blob = await exportEncryptedJson(encExportPass)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `paylo-encrypted-backup-${formatDate(new Date().toISOString())}.bin`
      a.click()
      URL.revokeObjectURL(url)
      setEncExportPass(''); setEncExportConfirm(''); setIsEncExportOpen(false)
    } catch (e) { alert('Encryption failed: ' + e.message) }
  }

  const handleImportJson = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importJson(file)
      alert('Import successful!')
      setIsImportOpen(false)
    } catch (e) { alert('Import failed: ' + e.message) }
    finally { e.target.value = '' }
  }

  const handleImportEncrypted = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importEncryptedJson(file, encImportPass)
      alert('Encrypted backup imported successfully!')
      setIsEncImportOpen(false)
      setEncImportPass('')
    } catch (e) { alert('Import failed: ' + e.message) }
    finally { e.target.value = '' }
  }

  const handleConfirmReset = async () => {
    await Promise.all([db.settings.clear(), db.cycles.clear(), db.expenses.clear()])
    localStorage.removeItem('theme')
    localStorage.removeItem('last-backup')
  }

  if (!settingsArr) return null

  const hasPin = !!currentPin
  const displayCurrency = customCurrency || currency

  return (
    <PageTransition className="pb-[calc(7rem+env(safe-area-inset-bottom))] p-6">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-navy dark:text-gold mb-2">Settings</h1>
      </header>

      {/* ── Profile ─────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-serif text-xl text-navy dark:text-cream mb-4">Profile</h2>
        <div className="bg-cream-surface dark:bg-navy-surface p-4 rounded-xl border border-navy/5 dark:border-gold/5 flex flex-col gap-6">

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">Your Name</label>
            <Input
              placeholder="e.g. Riddhi"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
            />
          </div>

          {/* Currency */}
          <div className="pt-4 border-t border-navy/10 dark:border-gold/10">
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">Currency Symbol</label>
            <p className="text-xs text-navy/60 dark:text-silver-muted mb-2">
              Changes the symbol displayed. <span className="font-medium text-terracotta">Existing amounts are NOT converted.</span>
            </p>
            <button
              className="w-full bg-transparent border-b border-gold/30 dark:border-gold/30 focus:border-gold dark:focus:border-gold py-2 text-left font-sans text-lg text-navy dark:text-cream focus:outline-none transition-colors"
              onClick={() => setIsCurrencyPickerOpen(true)}
            >
              {displayCurrency}
            </button>
          </div>

          {/* Pay Day */}
          <div className="pt-4 border-t border-navy/10 dark:border-gold/10">
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">Pay Day</label>
            <p className="text-xs text-navy/60 dark:text-silver-muted mb-2">The day each new cycle starts.</p>
            <select
              value={cycleDay}
              onChange={e => {
                setCycleDay(e.target.value)
                handleSaveCycleDay(e.target.value)
              }}
              className="w-full bg-transparent border-b border-gold/30 dark:border-gold/30 focus:border-gold dark:focus:border-gold py-2 font-sans text-lg text-navy dark:text-cream focus:outline-none transition-colors"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
              <option value="last">Last day of month</option>
            </select>
          </div>

          {/* Theme */}
          <div className="pt-4 border-t border-navy/10 dark:border-gold/10">
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-2">Appearance</label>
            <div className="flex gap-2 flex-wrap">
              <Chip label="System" selected={theme === 'system'} onClick={() => setTheme('system')} />
              <Chip label="Light" selected={theme === 'light'} onClick={() => setTheme('light')} />
              <Chip label="Dark" selected={theme === 'dark'} onClick={() => setTheme('dark')} />
            </div>
            <p className="text-xs text-navy/50 dark:text-silver-muted mt-2">System follows your device setting.</p>
          </div>
        </div>
      </section>

      {/* ── Categories ──────────────────────────────── */}
      <section className="mb-10 pt-8 border-t border-navy/10 dark:border-gold/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-navy dark:text-cream">Categories</h2>
          <button
            onClick={handleOpenAdd}
            className="text-sm font-medium text-navy/60 dark:text-gold/80 hover:text-navy dark:hover:text-gold transition-colors"
          >
            + Add New
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="flex justify-between items-center bg-cream-surface dark:bg-navy-surface p-4 rounded-xl border border-navy/5 dark:border-gold/5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.emoji}</span>
                <span className="font-medium text-navy dark:text-cream">{cat.name}</span>
              </div>
              {cat.id !== 'other' && (
                <div className="flex -mr-2">
                  <button onClick={() => handleOpenEdit(cat)} className="w-11 h-11 flex items-center justify-center text-navy/60 hover:text-navy dark:text-silver-muted dark:hover:text-gold" aria-label="Edit category"><EditIcon className="w-5 h-5" /></button>
                  <button onClick={() => handleDeleteRequest(cat)} className="w-11 h-11 flex items-center justify-center text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200" aria-label="Delete category"><TrashIcon className="w-5 h-5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Data & Backup ───────────────────────────── */}
      <section className="mb-10 pt-8 border-t border-navy/10 dark:border-gold/10">
        <h2 className="font-serif text-xl text-navy dark:text-cream mb-4">Data &amp; Backup</h2>

        <div className="mb-4 text-sm text-navy/70 dark:text-silver-muted">
          <p className="font-medium text-navy dark:text-cream mb-1">Your data stays strictly on this device.</p>
          <p className="mb-2">There are no accounts, no cloud backend, and no analytics. To prevent data loss (e.g. if you clear browser data), please export backups regularly.</p>
          <p>
            {(() => {
              const lbSetting = settingsArr.find(s => s.key === 'lastBackup')
              const status = getBackupReminderStatus(lbSetting?.value ?? null)
              if (status === 'never') return "You haven't backed up your data yet. We recommend exporting a backup."
              if (status === 'today') return 'Last backup: Today'
              if (status === 'yesterday') return 'Last backup: Yesterday'
              if (status === 'overdue') return <span className="text-terracotta font-medium">Last backup: {status}. It's been a while — back up soon!</span>
              return `Last backup: ${status}`
            })()}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Plain JSON export */}
          <Button
            variant="ghost"
            className="w-full justify-start bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5"
            onClick={handleExportJson}
          >
            Export Backup (JSON, unencrypted)
          </Button>

          {/* Encrypted export */}
          <Button
            variant="ghost"
            className="w-full justify-start bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5"
            onClick={() => setIsEncExportOpen(true)}
          >
            Export Encrypted Backup (AES-GCM)
          </Button>

          {/* Plain import */}
          <Button
            variant="ghost"
            className="w-full justify-start bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5"
            onClick={() => setIsImportOpen(true)}
          >
            Import Backup (JSON)
          </Button>

          {/* Encrypted import */}
          <Button
            variant="ghost"
            className="w-full justify-start bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5"
            onClick={() => setIsEncImportOpen(true)}
          >
            Import Encrypted Backup
          </Button>

          {/* CSV */}
          <Button
            variant="ghost"
            className="w-full justify-start bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/5"
            onClick={async () => {
              try {
                const blob = await exportCsv()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `paylo-expenses-${formatDate(new Date().toISOString())}.csv`
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) { alert(e.message) }
            }}
          >
            Export Expenses (CSV)
          </Button>
        </div>
      </section>

      {/* ── Preferences ─────────────────────────────── */}
      <section className="mb-10 pt-8 border-t border-navy/10 dark:border-gold/10">
        <h2 className="font-serif text-xl text-navy dark:text-cream mb-4">Preferences</h2>
        <div className="bg-cream-surface dark:bg-navy-surface p-4 rounded-xl border border-navy/5 dark:border-gold/5 flex flex-col gap-6">

          {/* Low Balance Warning */}
          <div>
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">Low Balance Warning</label>
            <p className="text-xs text-navy/60 dark:text-silver-muted mb-2">Show a warning on Home when remaining budget falls below this amount.</p>
            <Input type="number" placeholder="0" value={lowBalanceStr} onChange={e => setLowBalanceStr(e.target.value)} onBlur={handleSaveLowBalance} />
          </div>

          {/* Opening Savings */}
          <div className="pt-4 border-t border-navy/10 dark:border-gold/10">
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">Opening Savings</label>
            <p className="text-xs text-navy/60 dark:text-silver-muted mb-2">
              Money you had saved <span className="font-medium">before</span> you started using this app. Added to your savings total from the beginning.
            </p>
            <Input type="number" placeholder="0" value={openingSavingsStr} onChange={e => setOpeningSavingsStr(e.target.value)} onBlur={handleSaveOpeningSavings} />
          </div>


          <div className="pt-4 border-t border-navy/10 dark:border-gold/10">
            <label className="text-sm font-medium text-navy/80 dark:text-cream block mb-1">App PIN Lock</label>
            <p className="text-xs text-navy/60 dark:text-silver-muted mb-3">
              Require a 4-digit PIN to open the app.{' '}
              <span className="font-medium text-terracotta">This only hides the screen — it does NOT encrypt your data.</span>
            </p>

            {pinMode === 'view' && (
              <div className="flex gap-2 flex-wrap">
                {hasPin ? (
                  <>
                    <Button variant="ghost" className="bg-cream dark:bg-navy border border-navy/10 dark:border-gold/10" onClick={() => setPinMode('change')}>
                      Change PIN
                    </Button>
                    <Button variant="danger" onClick={handleRemovePin}>
                      Remove PIN
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setPinMode('set')}>Set PIN</Button>
                )}
              </div>
            )}

            {(pinMode === 'set' || pinMode === 'change') && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="New PIN"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                  />
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="Confirm"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setPinMode('view'); setNewPin(''); setConfirmPin('') }}>Cancel</Button>
                  <Button onClick={handleSavePin} disabled={newPin.length !== 4 || confirmPin.length !== 4}>Save PIN</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Danger Zone ─────────────────────────────── */}
      <section className="mb-10 pt-8 border-t border-terracotta/20 dark:border-terracotta/10">
        <h2 className="font-serif text-xl text-terracotta mb-4">Danger Zone</h2>
        <div className="bg-terracotta/5 dark:bg-terracotta/10 rounded-xl p-4 border border-terracotta/20">
          <p className="text-sm text-navy/70 dark:text-silver-muted mb-4">
            Resetting all data will permanently delete everything on this device. Export a backup first.
          </p>
          <Button variant="danger" className="w-full" onClick={() => setIsResetOpen(true)}>
            Reset all data
          </Button>
        </div>
      </section>

      {/* ── Sheets & Dialogs ────────────────────────── */}

      {/* Category edit sheet */}
      <BottomSheet isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-6">
          {editTarget ? 'Edit Category' : 'New Category'}
        </h3>
        <div className="flex flex-col gap-6">
          <div className="flex gap-2">
            <div className="w-20">
              <Input label="Emoji" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} maxLength={2} />
            </div>
            <div className="flex-1">
              <Input label="Name" value={editName} onChange={e => setEditName(e.target.value)} maxLength={24} />
            </div>
          </div>
          <Button onClick={handleSaveCategory}>Save Category</Button>
        </div>
      </BottomSheet>

      {/* Category delete sheet */}
      <BottomSheet isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-4">Remove Category</h3>
        {deleteTarget && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-navy/70 dark:text-silver-muted">
              Removing "{deleteTarget.name}". Existing expenses will be moved.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-navy/70 dark:text-silver-muted">Move expenses to...</label>
              <select
                value={reassignTo}
                onChange={e => setReassignTo(e.target.value)}
                className="w-full bg-cream-surface dark:bg-navy-surface border border-navy/20 dark:border-gold/30 rounded-xl px-4 py-3 font-sans text-lg text-navy dark:text-cream focus:outline-none"
              >
                {categories.filter(c => c.id !== deleteTarget.id).map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleConfirmDelete}>Remove &amp; Move Expenses</Button>
          </div>
        )}
      </BottomSheet>

      {/* Encrypted Export sheet */}
      <BottomSheet isOpen={isEncExportOpen} onClose={() => { setIsEncExportOpen(false); setEncExportPass(''); setEncExportConfirm('') }}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-2">Encrypted Backup</h3>
        <p className="text-xs text-navy/60 dark:text-silver-muted mb-1">Uses AES-256-GCM encryption.</p>
        <div className="bg-terracotta/10 border border-terracotta/20 rounded-xl p-3 mb-5 text-xs text-terracotta">
          ⚠️ If you forget this password, your backup cannot be recovered. There is no reset option.
        </div>
        <div className="flex flex-col gap-5">
          <Input
            label="Password"
            type="password"
            placeholder="Enter a strong password"
            value={encExportPass}
            onChange={e => setEncExportPass(e.target.value)}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={encExportConfirm}
            onChange={e => setEncExportConfirm(e.target.value)}
          />
          <Button
            disabled={!encExportPass || encExportPass !== encExportConfirm}
            onClick={handleExportEncrypted}
          >
            Download Encrypted Backup
          </Button>
        </div>
      </BottomSheet>

      {/* Encrypted Import sheet */}
      <BottomSheet isOpen={isEncImportOpen} onClose={() => { setIsEncImportOpen(false); setEncImportPass('') }}>
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-2">Import Encrypted Backup</h3>
        <p className="text-xs text-navy/60 dark:text-silver-muted mb-5">
          Enter the password you used when exporting. This will replace all current data.
        </p>
        <div className="flex flex-col gap-5">
          <Input
            label="Backup Password"
            type="password"
            placeholder="Password used during export"
            value={encImportPass}
            onChange={e => setEncImportPass(e.target.value)}
          />
          <Button
            disabled={!encImportPass}
            onClick={() => { setIsEncImportOpen(false); setIsEncImportConfirmOpen(true) }}
          >
            Continue to File Picker
          </Button>
        </div>
      </BottomSheet>

      {/* Currency picker */}
      <CurrencyPickerSheet
        isOpen={isCurrencyPickerOpen}
        onClose={() => setIsCurrencyPickerOpen(false)}
        onSelect={(val) => {
          if (CURRENCY_PRESETS.includes(val)) {
            setCurrency(val); setCustomCurrency('')
          } else {
            setCurrency(''); setCustomCurrency(val)
          }
          handleSaveCurrency(val)
        }}
      />

      {/* Reset confirm */}
      <ConfirmDialog
        isOpen={isResetOpen}
        title="Reset all data?"
        description="All your expenses, cycles, categories, and settings will be permanently deleted from this device. Export a backup first."
        confirmText="Yes, delete everything"
        cancelText="Cancel"
        danger={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetOpen(false)}
      />

      {/* Plain import confirm */}
      <ConfirmDialog
        isOpen={isImportOpen}
        title="Replace all data?"
        description="Importing a backup will permanently replace all your current expenses, cycles, and settings. Are you sure?"
        confirmText="Yes, choose file"
        cancelText="Cancel"
        danger={true}
        onConfirm={() => document.getElementById('import-file-input').click()}
        onCancel={() => setIsImportOpen(false)}
      />

      {/* Encrypted import confirm */}
      <ConfirmDialog
        isOpen={isEncImportConfirmOpen}
        title="Replace all data?"
        description="Importing will permanently replace all current data. This action cannot be undone."
        confirmText="Yes, choose file"
        cancelText="Cancel"
        danger={true}
        onConfirm={() => document.getElementById('enc-import-file-input').click()}
        onCancel={() => setIsEncImportConfirmOpen(false)}
      />

      <input type="file" id="import-file-input" accept=".json" className="hidden" onChange={handleImportJson} />
      <input type="file" id="enc-import-file-input" accept=".bin" className="hidden" onChange={handleImportEncrypted} />
    </PageTransition>
  )
}
