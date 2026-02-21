import { useState, useEffect } from 'react'

const WALLETS = {
  A: { address: 'G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw', name: 'Sachin Acharya', role: 'user' },
  B: { address: 'sDHAt4sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz', name: 'Hari Prasad Shah', role: 'user' },
  C: { address: '8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB', name: 'Gagan Sher Shah', role: 'admin' },
}

const NepalFlag = () => (
  <svg viewBox="0 0 25 21" className="flag-wave h-8 w-auto" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="flag-clip">
        <rect width="25" height="21" rx="2"/>
      </clipPath>
    </defs>
    <g clipPath="url(#flag-clip)">
      <rect width="25" height="21" fill="#DC2626"/>
      <path d="M12.5 2.5L14.5 8.5H20.5L15.5 12.5L17.5 18.5L12.5 14.5L7.5 18.5L9.5 12.5L4.5 8.5H10.5L12.5 2.5Z" fill="#003893"/>
      <path d="M12.5 5L13.5 8.5H16.5L14 10.5L15 14L12.5 11.5L10 14L11 10.5L8.5 8.5H11.5L12.5 5Z" fill="#003893"/>
    </g>
  </svg>
)

function App() {
  const [activeTab, setActiveTab] = useState('landing')
  const [connectedWallet, setConnectedWallet] = useState(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [parcels, setParcels] = useState([])
  const [whitelist, setWhitelist] = useState([])
  const [registrationRequests, setRegistrationRequests] = useState([])
  const [transferRequests, setTransferRequests] = useState([])
  const [stats, setStats] = useState({ totalParcels: 0, pendingWhitelist: 0, approvedWhitelist: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [txLoading, setTxLoading] = useState(null)
  const [registerForm, setRegisterForm] = useState({
    ownerName: '', district: '', municipality: '', ward: '', tole: '', bigha: '', kattha: '', dhur: ''
  })
  const [transferForm, setTransferForm] = useState({
    parcelId: '', toWallet: '', toName: ''
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchParcels = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/parcels')
      const data = await res.json()
      setParcels(data)
    } catch (err) {
      console.error('Failed to fetch parcels:', err)
    }
  }

  const searchParcels = async (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearched(false)
      setParcels([])
      return
    }
    setSearched(true)
    try {
      const res = await fetch(`http://localhost:5000/api/parcels/search?q=${query}`)
      const data = await res.json()
      setParcels(data)
    } catch (err) {
      console.error('Failed to search parcels:', err)
    }
  }

  const fetchWhitelist = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/whitelist')
      const data = await res.json()
      setWhitelist(data)
      setRegistrationRequests(data.filter(w => w.status === 'pending' && w.requestType === 'registration'))
      setTransferRequests(data.filter(w => w.status === 'pending' && w.requestType === 'transfer'))
    } catch (err) {
      console.error('Failed to fetch whitelist:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleWhitelistAction = async (id, status) => {
    setTxLoading(id)
    setTimeout(async () => {
      try {
        await fetch(`http://localhost:5000/api/whitelist/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        })
        fetchWhitelist()
        fetchStats()
      } catch (err) {
        console.error('Failed to update whitelist:', err)
      }
      setTxLoading(null)
    }, 2000)
  }

  const handleRegistration = async (e) => {
    e.preventDefault()
    setTxLoading('registering')
    setTimeout(async () => {
      try {
        await fetch('http://localhost:5000/api/whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            walletAddress: connectedWallet.address, 
            ownerName: registerForm.ownerName,
            requestType: 'registration',
            location: { district: registerForm.district, municipality: registerForm.municipality, ward: registerForm.ward, tole: registerForm.tole },
            size: { bigha: registerForm.bigha, kattha: registerForm.kattha, dhur: registerForm.dhur }
          })
        })
        fetchWhitelist()
        setShowRegisterModal(false)
        setRegisterForm({ ownerName: '', district: '', municipality: '', ward: '', tole: '', bigha: '', kattha: '', dhur: '' })
      } catch (err) {
        console.error('Failed to submit registration:', err)
      }
      setTxLoading(null)
    }, 2000)
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    setTxLoading('transferring')
    setTimeout(async () => {
      try {
        await fetch('http://localhost:5000/api/whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            walletAddress: connectedWallet.address, 
            ownerName: connectedWallet.name,
            requestType: 'transfer',
            toWallet: transferForm.toWallet,
            toName: transferForm.toName,
            parcelId: transferForm.parcelId
          })
        })
        fetchWhitelist()
        setShowTransferModal(false)
        setTransferForm({ parcelId: '', toWallet: '', toName: '' })
      } catch (err) {
        console.error('Failed to submit transfer:', err)
      }
      setTxLoading(null)
    }, 2000)
  }

  const connectWallet = (key) => {
    setConnectedWallet(WALLETS[key])
    setShowWalletModal(false)
    if (key === 'C') {
      setActiveTab('government')
      fetchWhitelist()
    } else {
      setActiveTab('parcels')
      fetchParcels()
      fetchWhitelist()
    }
  }

  const truncateHash = (hash) => hash.slice(0, 8) + '...' + hash.slice(-8)

  const formatSize = (size) => {
    const parts = []
    if (size.bigha) parts.push(`${size.bigha} Bigha`)
    if (size.kattha) parts.push(`${size.kattha} Kattha`)
    if (size.dhur) parts.push(`${size.dhur} Dhur`)
    return parts.join(', ') || '0 Dhur'
  }

  const myParcels = connectedWallet ? parcels.filter(p => p.ownerWallet === connectedWallet.address) : []
  const pendingRegistrations = whitelist.filter(w => w.requestType === 'registration' && w.status === 'pending')
  const pendingTransfers = whitelist.filter(w => w.requestType === 'transfer' && w.status === 'pending')

  const Landing = () => (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-red-700 to-red-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NepalFlag />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">JaggaChain</h1>
                <p className="text-xs text-red-100">Digital Land Registry | Government of Nepal</p>
              </div>
            </div>
            <button onClick={() => setShowWalletModal(true)} className="bg-white text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition">
              Connect Wallet
            </button>
          </div>
        </div>
      </header>

      <section className="relative py-20 bg-gradient-to-br from-red-50 via-white to-blue-50 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-red-200 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-200 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold text-slate-800 mb-6">
              <span className="text-red-600">Digital</span> Land Registry on <span className="text-blue-700">Blockchain</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Secure, transparent, and immutable land ownership records powered by Solana blockchain. 
              Transforming Nepal's land management system.
            </p>
            <button onClick={() => setShowWalletModal(true)} className="bg-red-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-red-700 transition shadow-lg hover:shadow-xl">
              Get Started
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">The Problem</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-red-500">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Fraud & Forgery</h3>
              <p className="text-slate-600">Paper-based records are vulnerable to manipulation, leading to fraudulent land deals and disputes.</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-red-500">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Time Consuming</h3>
              <p className="text-slate-600">Land verification takes weeks, requiring multiple office visits and extensive paperwork.</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-red-500">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Lack of Transparency</h3>
              <p className="text-slate-600">Public cannot easily verify land ownership, creating information asymmetry and corruption.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">Solution with JaggaChain</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔗</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Blockchain Powered</h3>
              <p className="text-sm text-slate-600">Immutable records on Solana</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">NFT</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Tokenized Land</h3>
              <p className="text-sm text-slate-600">Each parcel as unique NFT</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👥</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Three Stakeholders</h3>
              <p className="text-sm text-slate-600">Citizens, Government, Public</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Verified Transfers</h3>
              <p className="text-sm text-slate-600">Government approval required</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-800 text-slate-300 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <NepalFlag />
            <span className="font-semibold text-white">JaggaChain</span>
          </div>
          <p className="text-sm">Digital Land Registry Platform | Government of Nepal</p>
          <p className="text-xs text-slate-500 mt-2">Powered by Solana Blockchain</p>
        </div>
      </footer>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {activeTab === 'landing' && <Landing />}

      {activeTab !== 'landing' && (
        <>
          <header className="bg-gradient-to-r from-red-700 to-red-600 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveTab('landing')} className="flex items-center gap-3 hover:opacity-80 transition">
                    <NepalFlag />
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">JaggaChain</h1>
                      <p className="text-xs text-red-100">Digital Land Registry | Government of Nepal</p>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  {connectedWallet ? (
                    <div className="flex items-center gap-3 bg-red-800/50 px-4 py-2 rounded-lg">
                      <div className="text-right">
                        <p className="text-sm font-medium">{connectedWallet.name}</p>
                        <p className="text-xs text-red-200 font-mono">{truncateHash(connectedWallet.address)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${connectedWallet.role === 'admin' ? 'bg-yellow-500 text-yellow-900' : 'bg-green-500 text-white'}`}>
                        {connectedWallet.role === 'admin' ? 'Admin' : 'Citizen'}
                      </span>
                    </div>
                  ) : (
                    <button onClick={() => setShowWalletModal(true)} className="bg-white text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition">
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <nav className="bg-white shadow border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex gap-1">
                {connectedWallet?.role === 'admin' ? (
                  <button onClick={() => { setActiveTab('government'); fetchWhitelist(); }} className={`px-6 py-4 font-medium transition relative ${activeTab === 'government' ? 'text-red-700' : 'text-slate-600 hover:text-slate-900'}`}>
                    🏛️ Government
                    {activeTab === 'government' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
                  </button>
                ) : (
                  <>
                    <button onClick={() => setActiveTab('explorer')} className={`px-6 py-4 font-medium transition relative ${activeTab === 'explorer' ? 'text-red-700' : 'text-slate-600 hover:text-slate-900'}`}>
                      🔍 Explorer
                      {activeTab === 'explorer' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
                    </button>
                    <button onClick={() => { setActiveTab('parcels'); fetchParcels(); }} className={`px-6 py-4 font-medium transition relative ${activeTab === 'parcels' ? 'text-red-700' : 'text-slate-600 hover:text-slate-900'}`}>
                      📍 My Parcels
                      {activeTab === 'parcels' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 py-8">
            {activeTab === 'explorer' && (
              <div className="animate-fadeIn">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">Search Land Registry</h2>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by owner name, district, municipality, or tole..."
                      value={searchQuery}
                      onChange={(e) => searchParcels(e.target.value)}
                      className="w-full px-4 py-3 pl-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Enter a search term to view land records</p>
                </div>

                {!searched ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Search Land Records</h2>
                    <p className="text-slate-500">Enter owner name, district, municipality, or tole to search</p>
                  </div>
                ) : parcels.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">No Records Found</h2>
                    <p className="text-slate-500">No land records match your search query</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {parcels.map((parcel, idx) => (
                      <div key={parcel._id} className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fadeIn`}>
                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-semibold">Token ID: #{parcel.tokenId}</span>
                            <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">Registered</span>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="font-semibold text-lg text-slate-800 mb-3">{parcel.ownerName}</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Location:</span>
                              <span className="text-slate-700 font-medium">{parcel.location?.district}, {parcel.location?.municipality}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ward:</span>
                              <span className="text-slate-700">Ward {parcel.location?.ward}, {parcel.location?.tole}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Size:</span>
                              <span className="text-slate-700 font-medium">{formatSize(parcel.size)}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs text-slate-400 font-mono break-all">TX: {truncateHash(parcel.transactionHash)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'parcels' && connectedWallet?.role !== 'admin' && (
              <div className="animate-fadeIn">
                {!connectedWallet ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <div className="text-6xl mb-4">🔐</div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Connect Your Wallet</h2>
                    <p className="text-slate-500 mb-6">Please connect your wallet to view your parcels</p>
                    <button onClick={() => setShowWalletModal(true)} className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition">
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-800">My Parcels</h2>
                          <p className="text-slate-500">{connectedWallet.name}</p>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => setShowRegisterModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                            + Register New Land
                          </button>
                          <button onClick={() => setShowTransferModal(true)} disabled={myParcels.length === 0} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50">
                            Transfer Parcel
                          </button>
                        </div>
                      </div>
                    </div>

                    {myParcels.length === 0 ? (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <div className="text-6xl mb-4">📋</div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Parcels Found</h2>
                        <p className="text-slate-500">You don't have any registered parcels yet</p>
                        <button onClick={() => setShowRegisterModal(true)} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
                          Register Your First Land
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myParcels.map((parcel) => (
                          <div key={parcel._id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="px-3 py-1 bg-slate-800 text-white rounded-lg font-medium">Token #{parcel.tokenId}</span>
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">Active</span>
                                </div>
                                <h3 className="font-semibold text-lg text-slate-800">{parcel.ownerName}</h3>
                                <p className="text-slate-500">{parcel.location?.municipality}, Ward {parcel.location?.ward}, {parcel.location?.tole}</p>
                                <p className="text-sm text-slate-400 mt-2">Size: {formatSize(parcel.size)}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button onClick={() => { setTransferForm({ ...transferForm, parcelId: parcel._id }); setShowTransferModal(true); }} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-sm">
                                  Transfer Parcel
                                </button>
                                <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition text-sm">
                                  View Certificate
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'government' && connectedWallet?.role === 'admin' && (
              <div className="animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <span className="text-2xl">🏞️</span>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-slate-800">{stats.totalParcels}</p>
                        <p className="text-sm text-slate-500">Total Registered Lands</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-yellow-100 rounded-lg">
                        <span className="text-2xl">📝</span>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-yellow-600">{pendingRegistrations.length}</p>
                        <p className="text-sm text-slate-500">Pending Registrations</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <span className="text-2xl">🔄</span>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-blue-600">{pendingTransfers.length}</p>
                        <p className="text-sm text-slate-500">Pending Transfers</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                  <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">Registration Requests</h2>
                    <p className="text-blue-200 text-sm">Approve or reject new land registrations</p>
                  </div>
                  {pendingRegistrations.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No pending registration requests</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {pendingRegistrations.map((item) => (
                        <div key={item._id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                          <div>
                            <h3 className="font-semibold text-slate-800">{item.ownerName}</h3>
                            <p className="text-sm text-slate-500 font-mono">{truncateHash(item.walletAddress)}</p>
                            {item.location && (
                              <p className="text-sm text-slate-500">{item.location.district}, {item.location.municipality}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {txLoading === item._id ? (
                              <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg">Processing...</span>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleWhitelistAction(item._id, 'approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-sm">
                                  Approve
                                </button>
                                <button onClick={() => handleWhitelistAction(item._id, 'rejected')} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-sm">
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">Transfer Requests</h2>
                    <p className="text-red-200 text-sm">Approve or reject land transfer requests</p>
                  </div>
                  {pendingTransfers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No pending transfer requests</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {pendingTransfers.map((item) => (
                        <div key={item._id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                          <div>
                            <h3 className="font-semibold text-slate-800">{item.ownerName}</h3>
                            <p className="text-sm text-slate-500 font-mono">From: {truncateHash(item.walletAddress)}</p>
                            {item.toName && (
                              <p className="text-sm text-slate-500">To: {item.toName} ({truncateHash(item.toWallet)})</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {txLoading === item._id ? (
                              <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg">Processing...</span>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleWhitelistAction(item._id, 'approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-sm">
                                  Approve
                                </button>
                                <button onClick={() => handleWhitelistAction(item._id, 'rejected')} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-sm">
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowWalletModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Connect Wallet</h2>
            <p className="text-slate-500 mb-6">Select a wallet to connect to JaggaChain</p>
            <div className="space-y-3">
              {Object.entries(WALLETS).map(([key, wallet]) => (
                <button
                  key={key}
                  onClick={() => connectWallet(key)}
                  className="w-full p-4 border border-slate-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{wallet.name}</p>
                      <p className="text-sm text-slate-500 font-mono">{truncateHash(wallet.address)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${wallet.role === 'admin' ? 'bg-yellow-500 text-yellow-900' : 'bg-green-500 text-white'}`}>
                      {wallet.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRegisterModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Register New Land</h2>
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                <input required type="text" value={registerForm.ownerName} onChange={e => setRegisterForm({...registerForm, ownerName: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                  <input required type="text" value={registerForm.district} onChange={e => setRegisterForm({...registerForm, district: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Municipality</label>
                  <input required type="text" value={registerForm.municipality} onChange={e => setRegisterForm({...registerForm, municipality: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward No.</label>
                  <input required type="number" value={registerForm.ward} onChange={e => setRegisterForm({...registerForm, ward: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tole</label>
                  <input required type="text" value={registerForm.tole} onChange={e => setRegisterForm({...registerForm, tole: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bigha</label>
                  <input type="number" value={registerForm.bigha} onChange={e => setRegisterForm({...registerForm, bigha: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kattha</label>
                  <input type="number" value={registerForm.kattha} onChange={e => setRegisterForm({...registerForm, kattha: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dhur</label>
                  <input type="number" value={registerForm.dhur} onChange={e => setRegisterForm({...registerForm, dhur: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">NFT will be minted on Solana blockchain after government approval.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={txLoading === 'registering'} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {txLoading === 'registering' ? 'Minting NFT...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Transfer Parcel</h2>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Name</label>
                <input required type="text" value={transferForm.toName} onChange={e => setTransferForm({...transferForm, toName: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Wallet Address</label>
                <input required type="text" value={transferForm.toWallet} onChange={e => setTransferForm({...transferForm, toWallet: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-700">Transfer request requires government approval. NFT will be transferred after approval.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={txLoading === 'transferring'} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50">
                  {txLoading === 'transferring' ? 'Processing...' : 'Request Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
