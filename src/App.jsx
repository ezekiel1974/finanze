import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, PlusCircle, Trash2, 
  ArrowRightLeft, Calendar, Pencil, Check, Loader2,
  Landmark, Banknote, CreditCard, Eye, EyeOff, LogOut, LogIn
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, deleteDoc, doc, 
  onSnapshot, query, orderBy, setDoc 
} from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

// =========================================================================
// 1. INSERISCI QUI I TUOI DATI FIREBASE
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCXB3e0Sm0WJwJdVMgLdaGtCZfwMHDVd48",
  authDomain: "le-mie-finanze-e8ce4.firebaseapp.com",
  projectId: "le-mie-finanze-e8ce4",
  storageBucket: "le-mie-finanze-e8ce4.firebasestorage.app",
  messagingSenderId: "365896929014",
  appId: "1:365896929014:web:057fdc598400d6990766d7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [transactions, setTransactions] = useState([]);
  const [initialBalances, setInitialBalances] = useState({ banca: 0, contante: 0, paypal: 0 });
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalances, setTempBalances] = useState({ banca: '', contante: '', paypal: '' });
  const [showBalances, setShowBalances] = useState(false);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('entrata');
  const [method, setMethod] = useState('banca');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Gestione Autenticazione
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Caricamento Dati Personali (si attiva solo se c'è un utente loggato)
  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);
    const balanceRef = doc(db, `users/${user.uid}/settings/globalBalance`);
    const unsubscribeBalance = onSnapshot(balanceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInitialBalances({
          banca: data.banca || 0,
          contante: data.contante || 0,
          paypal: data.paypal || 0
        });
      } else {
        setInitialBalances({ banca: 0, contante: 0, paypal: 0 });
      }
    });

    const q = query(collection(db, `users/${user.uid}/transactions`), orderBy('date', 'desc'));
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(transData);
      setIsLoading(false);
    });

    return () => {
      unsubscribeBalance();
      unsubscribeTransactions();
    };
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  const availableMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      const d = new Date(t.date);
      const monthYear = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
      months.add(monthYear.charAt(0).toUpperCase() + monthYear.slice(1));
    });
    return Array.from(months);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'all') return transactions;
    return transactions.filter(t => {
      const d = new Date(t.date);
      const monthYear = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
      const formattedMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      return formattedMonthYear === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const { totalIncome, totalExpense, bankBalance, cashBalance, paypalBalance, globalBalance } = useMemo(() => {
    let bankInc = 0, bankExp = 0, cashInc = 0, cashExp = 0, paypalInc = 0, paypalExp = 0;
    
    transactions.forEach(t => {
      const m = t.method || 'banca'; 
      if (t.type === 'entrata') {
        if (m === 'banca') bankInc += t.amount;
        else if (m === 'contante') cashInc += t.amount;
        else if (m === 'paypal') paypalInc += t.amount;
      } else {
        if (m === 'banca') bankExp += t.amount;
        else if (m === 'contante') cashExp += t.amount;
        else if (m === 'paypal') paypalExp += t.amount;
      }
    });

    let filteredInc = 0, filteredExp = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'entrata') filteredInc += t.amount;
      else filteredExp += t.amount;
    });

    const currentBank = initialBalances.banca + bankInc - bankExp;
    const currentCash = initialBalances.contante + cashInc - cashExp;
    const currentPaypal = initialBalances.paypal + paypalInc - paypalExp;

    return {
      totalIncome: filteredInc, totalExpense: filteredExp,
      bankBalance: currentBank, cashBalance: currentCash, paypalBalance: currentPaypal,
      globalBalance: currentBank + currentCash + currentPaypal
    };
  }, [transactions, filteredTransactions, initialBalances]);

  const handleSaveInitialBalance = async () => {
    if (!user) return;
    const b = parseFloat(tempBalances.banca);
    const c = parseFloat(tempBalances.contante);
    const p = parseFloat(tempBalances.paypal);
    
    await setDoc(doc(db, `users/${user.uid}/settings/globalBalance`), { 
      banca: !isNaN(b) ? b : 0, contante: !isNaN(c) ? c : 0, paypal: !isNaN(p) ? p : 0
    }, { merge: true });
    setIsEditingBalance(false);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!description || !amount || isNaN(amount) || Number(amount) <= 0 || !date || !user) return;

    try {
      await addDoc(collection(db, `users/${user.uid}/transactions`), {
        description: description.trim(), amount: Number(amount),
        type, method, date
      });
      setDescription(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error("Errore nell'aggiunta:", error);
    }
  };

  const handleDelete = async (id) => {
    if (user) await deleteDoc(doc(db, `users/${user.uid}/transactions`, id));
  };

  const formatCurrency = (value) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  const renderBalance = (value) => showBalances ? formatCurrency(value) : '€ ****';

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-600" />
      </div>
    );
  }

  // Schermata di Login
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Wallet size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Visaria</h1>
            <p className="text-slate-500 mt-2">Accedi per gestire il tuo portafoglio privato in totale sicurezza.</p>
          </div>
          <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 py-3 px-4 rounded-xl hover:bg-slate-50 font-medium transition-all shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
            Accedi con Google
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-lg text-white shadow-md"><Wallet size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Visaria</h1>
                <p className="text-slate-500 text-sm">Privato e Sicuro</p>
              </div>
            </div>
            
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 md:ml-4">
              <LogOut size={16} /> Esci
            </button>
          </div>
          
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
          >
            <option value="all">Tutti i periodi</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group md:col-span-1">
            <div className="flex justify-between items-center mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-500">Patrimonio Netto</p>
                <button onClick={() => setShowBalances(!showBalances)} className="text-slate-400 hover:text-slate-600">
                  {showBalances ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              
              {!isEditingBalance && (
                <button 
                  onClick={() => {
                    setTempBalances({ banca: initialBalances.banca.toString(), contante: initialBalances.contante.toString(), paypal: initialBalances.paypal.toString() });
                    setIsEditingBalance(true);
                  }}
                  className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <Pencil size={12} /> Modifica
                </button>
              )}
            </div>
            
            {isEditingBalance ? (
              <div className="space-y-2 mt-2 relative z-10">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-slate-400" />
                  <input type="number" value={tempBalances.banca} onChange={(e) => setTempBalances({...tempBalances, banca: e.target.value})} placeholder="Banca" className="w-full px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <Banknote size={16} className="text-slate-400" />
                  <input type="number" value={tempBalances.contante} onChange={(e) => setTempBalances({...tempBalances, contante: e.target.value})} placeholder="Contante" className="w-full px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-slate-400" />
                  <input type="number" value={tempBalances.paypal} onChange={(e) => setTempBalances({...tempBalances, paypal: e.target.value})} placeholder="PayPal" className="w-full px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded" />
                </div>
                <button onClick={handleSaveInitialBalance} className="w-full py-1 mt-1 bg-blue-600 text-white rounded text-sm flex justify-center items-center gap-1"><Check size={16} /> Salva</button>
              </div>
            ) : (
              <div className="relative z-10">
                <h2 className={`text-3xl font-bold mb-3 ${globalBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{renderBalance(globalBalance)}</h2>
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-1 text-slate-500"><Landmark size={14}/> Banca</span><span className="font-semibold text-slate-700">{renderBalance(bankBalance)}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-1 text-slate-500"><Banknote size={14}/> Contanti</span><span className="font-semibold text-slate-700">{renderBalance(cashBalance)}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-1 text-slate-500"><CreditCard size={14}/> PayPal</span><span className="font-semibold text-slate-700">{renderBalance(paypalBalance)}</span></div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
             <div className="absolute right-0 top-0 p-4 opacity-10 text-emerald-500"><TrendingUp size={64} /></div>
            <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-emerald-100 text-emerald-600 rounded"><TrendingUp size={16} /></div><p className="text-sm font-medium text-slate-500">{selectedMonth === 'all' ? 'Totale Entrate' : `Entrate ${selectedMonth}`}</p></div>
            <h3 className="text-2xl font-bold text-emerald-600">{renderBalance(totalIncome)}</h3>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10 text-rose-500"><TrendingDown size={64} /></div>
            <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-rose-100 text-rose-600 rounded"><TrendingDown size={16} /></div><p className="text-sm font-medium text-slate-500">{selectedMonth === 'all' ? 'Totale Uscite' : `Uscite ${selectedMonth}`}</p></div>
            <h3 className="text-2xl font-bold text-rose-600">{renderBalance(totalExpense)}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle size={20} className="text-blue-500"/> Nuova Transazione</h3>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button type="button" onClick={() => setType('entrata')} className={`flex-1 py-2 text-sm font-medium rounded-md ${type === 'entrata' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Entrata</button>
                  <button type="button" onClick={() => setType('uscita')} className={`flex-1 py-2 text-sm font-medium rounded-md ${type === 'uscita' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Uscita</button>
                </div>
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button type="button" onClick={() => setMethod('banca')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs sm:text-sm font-medium rounded-md ${method === 'banca' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Landmark size={14}/> Banca</button>
                  <button type="button" onClick={() => setMethod('contante')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs sm:text-sm font-medium rounded-md ${method === 'contante' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}><Banknote size={14}/> Contanti</button>
                  <button type="button" onClick={() => setMethod('paypal')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs sm:text-sm font-medium rounded-md ${method === 'paypal' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'}`}><CreditCard size={14}/> PayPal</button>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Importo (€)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0.01" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700" required /></div>
                <button type="submit" className="w-full mt-2 py-3 bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"><PlusCircle size={20} /> Aggiungi {type === 'entrata' ? 'Entrata' : 'Uscita'}</button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowRightLeft size={20} className="text-blue-500"/> Storico Movimenti</h3>
              {filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4"><Wallet size={48} className="text-slate-300" /></div><p className="text-lg font-medium">Nessuna transazione trovata</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((transaction) => {
                    const met = transaction.method || 'banca';
                    let MethodIcon = Landmark, methodStyle = "bg-blue-50 text-blue-600", methodLabel = "Banca";
                    if (met === 'contante') { MethodIcon = Banknote; methodStyle = "bg-orange-50 text-orange-600"; methodLabel = "Contanti"; } 
                    else if (met === 'paypal') { MethodIcon = CreditCard; methodStyle = "bg-sky-50 text-sky-600"; methodLabel = "PayPal"; }

                    return (
                      <div key={transaction.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${transaction.type === 'entrata' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {transaction.type === 'entrata' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-lg leading-tight">{transaction.description}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Calendar size={12} />{new Date(transaction.date).toLocaleDateString('it-IT')}</span>
                              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${methodStyle}`}><MethodIcon size={10}/>{methodLabel}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-bold whitespace-nowrap ${transaction.type === 'entrata' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {transaction.type === 'entrata' ? '+' : '-'} {renderBalance(transaction.amount)}
                          </span>
                          <button onClick={() => handleDelete(transaction.id)} className="p-2 text-slate-400 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-all" title="Elimina"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
