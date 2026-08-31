npm run buildimport React, { useState, useEffect, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Trash2,
  ArrowRightLeft,
  Calendar,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
} from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

// =========================================================================
// 1. INSERISCI QUI I TUOI DATI FIREBASE (Sostituisci questo blocco)
// =========================================================================
const firebaseConfig = {
  apiKey: 'AIzaSyCXB3e0Sm0WJwJdVMgLdaGtCZfwMHDVd48',
  authDomain: 'le-mie-finanze-e8ce4.firebaseapp.com',
  projectId: 'il-tuo-prole-mie-finanze-e8ce4',
  storageBucket: 'le-mie-finanze-e8ce4.firebasestorage.app',
  messagingSenderId: '365896929014',
  appId: '1:365896929014:web:057fdc598400d6990766d7',
}

// Inizializzazione Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [initialBalance, setInitialBalance] = useState(0)
  const [isEditingBalance, setIsEditingBalance] = useState(false)
  const [tempBalance, setTempBalance] = useState('')

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('entrata')
  // Imposta la data di default a oggi (formato YYYY-MM-DD per l'input type="date")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const [selectedMonth, setSelectedMonth] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)

  // Autenticazione anonima e caricamento dati
  useEffect(() => {
    signInAnonymously(auth)
      .then(userCredential => {
        const currentUser = userCredential.user
        setUser(currentUser)

        // Ascolta il saldo iniziale
        const balanceRef = doc(db, 'users', currentUser.uid)
        const unsubscribeBalance = onSnapshot(balanceRef, doc => {
          if (doc.exists()) {
            setInitialBalance(doc.data().initialBalance || 0)
          }
        })

        // Ascolta le transazioni
        const q = query(collection(db, `users/${currentUser.uid}/transactions`), orderBy('date', 'desc'))
        const unsubscribeTransactions = onSnapshot(q, snapshot => {
          const transData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          setTransactions(transData)
          setIsLoading(false)
        })

        return () => {
          unsubscribeBalance()
          unsubscribeTransactions()
        }
      })
      .catch(error => {
        console.error('Errore di autenticazione:', error)
        setIsLoading(false)
      })
  }, [])

  // Calcolo dei mesi disponibili per il filtro
  const availableMonths = useMemo(() => {
    const months = new Set()
    transactions.forEach(t => {
      const d = new Date(t.date)
      const monthYear = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' })
      // Capitalizza la prima lettera del mese
      months.add(monthYear.charAt(0).toUpperCase() + monthYear.slice(1))
    })
    return Array.from(months)
  }, [transactions])

  // Filtra le transazioni per il mese selezionato
  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'all') return transactions

    return transactions.filter(t => {
      const d = new Date(t.date)
      const monthYear = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' })
      const formattedMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1)
      return formattedMonthYear === selectedMonth
    })
  }, [transactions, selectedMonth])

  // Calcolo dei totali
  const { totalIncome, totalExpense, globalBalance } = useMemo(() => {
    // Il saldo globale si calcola su TUTTE le transazioni
    let globalInc = 0
    let globalExp = 0
    transactions.forEach(t => {
      if (t.type === 'entrata') globalInc += t.amount
      else globalExp += t.amount
    })

    // Entrate e uscite visualizzate si basano su quelle FILTRATE
    let filteredInc = 0
    let filteredExp = 0
    filteredTransactions.forEach(t => {
      if (t.type === 'entrata') filteredInc += t.amount
      else filteredExp += t.amount
    })

    return {
      totalIncome: filteredInc,
      totalExpense: filteredExp,
      globalBalance: initialBalance + globalInc - globalExp,
    }
  }, [transactions, filteredTransactions, initialBalance])

  const handleSaveInitialBalance = async () => {
    const parsed = parseFloat(tempBalance)
    const newBalance = !isNaN(parsed) ? parsed : 0

    if (user) {
      await setDoc(doc(db, 'users', user.uid), { initialBalance: newBalance }, { merge: true })
    }
    setIsEditingBalance(false)
  }

  const handleAddTransaction = async e => {
    e.preventDefault()
    if (!description || !amount || isNaN(amount) || Number(amount) <= 0 || !date || !user) return

    try {
      await addDoc(collection(db, `users/${user.uid}/transactions`), {
        description: description.trim(),
        amount: Number(amount),
        type: type,
        date: date,
      })

      setDescription('')
      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
    } catch (error) {
      console.error("Errore nell'aggiunta della transazione: ", error)
    }
  }

  const handleDelete = async id => {
    if (user) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, id))
    }
  }

  const formatCurrency = value => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-600" />
        <p className="text-lg font-medium">Caricamento in corso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Intestazione e Filtro */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-lg text-white shadow-md">
              <Wallet size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Le mie Finanze</h1>
              <p className="text-slate-500">Gestisci entrate e uscite nel cloud</p>
            </div>
          </div>

          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
          >
            <option value="all">Tutti i periodi</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </header>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Saldo Attuale (Globale) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Wallet size={64} />
            </div>
            <div className="flex justify-between items-center mb-1 relative z-10">
              <p className="text-sm font-medium text-slate-500">Saldo Totale (Globale)</p>
              {!isEditingBalance && (
                <button
                  onClick={() => {
                    setTempBalance(initialBalance === 0 ? '' : initialBalance.toString())
                    setIsEditingBalance(true)
                  }}
                  className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <Pencil size={12} /> Modifica Iniziale
                </button>
              )}
            </div>
            {isEditingBalance ? (
              <div className="flex items-center gap-2 mt-2 relative z-10">
                <input
                  type="number"
                  value={tempBalance}
                  onChange={e => setTempBalance(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 text-lg font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveInitialBalance()}
                />
                <button
                  onClick={handleSaveInitialBalance}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div className="relative z-10">
                <h2 className={`text-4xl font-bold ${globalBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  {formatCurrency(globalBalance)}
                </h2>
                {initialBalance !== 0 && (
                  <p className="text-xs text-slate-500 mt-1">Include {formatCurrency(initialBalance)} di base</p>
                )}
              </div>
            )}
          </div>

          {/* Totale Entrate (Filtrato) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10 text-emerald-500">
              <TrendingUp size={64} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-emerald-100 text-emerald-600 rounded">
                <TrendingUp size={16} />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {selectedMonth === 'all' ? 'Totale Entrate' : `Entrate ${selectedMonth}`}
              </p>
            </div>
            <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</h3>
          </div>

          {/* Totale Uscite (Filtrato) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10 text-rose-500">
              <TrendingDown size={64} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-rose-100 text-rose-600 rounded">
                <TrendingDown size={16} />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {selectedMonth === 'all' ? 'Totale Uscite' : `Uscite ${selectedMonth}`}
              </p>
            </div>
            <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense)}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Modulo Inserimento */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <PlusCircle size={20} className="text-blue-500" />
                Nuova Transazione
              </h3>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setType('entrata')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      type === 'entrata' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Entrata
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('uscita')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      type === 'uscita' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Uscita
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="es. Stipendio, Spesa, Affitto..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Importo (€)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-700"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle size={20} />
                  Aggiungi {type === 'entrata' ? 'Entrata' : 'Uscita'}
                </button>
              </form>
            </div>
          </div>

          {/* Storico Transazioni */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-blue-500" />
                Storico Movimenti{' '}
                {selectedMonth !== 'all' && (
                  <span className="text-slate-400 text-sm font-normal">({selectedMonth})</span>
                )}
              </h3>

              {filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <Wallet size={48} className="text-slate-300" />
                  </div>
                  <p className="text-lg font-medium text-slate-500">Nessuna transazione trovata</p>
                  <p className="text-sm">Le tue entrate e uscite appariranno qui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map(transaction => (
                    <div
                      key={transaction.id}
                      className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-full ${
                            transaction.type === 'entrata'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-rose-100 text-rose-600'
                          }`}
                        >
                          {transaction.type === 'entrata' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-lg leading-tight">
                            {transaction.description}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <Calendar size={12} />
                            {new Date(transaction.date).toLocaleDateString('it-IT', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`font-bold whitespace-nowrap ${
                            transaction.type === 'entrata' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {transaction.type === 'entrata' ? '+' : '-'} {formatCurrency(transaction.amount)}
                        </span>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-all focus:opacity-100"
                          title="Elimina"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
