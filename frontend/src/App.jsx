import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  Search,
  MapPin,
  Landmark,
  FileCheck,
  Shield,
  Zap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Mountain,
  FileWarning,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutDashboard,
  Globe,
  User,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_WALLETS || '8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB').split(',').map((w) => w.trim())

const NepalFlag = () => (
  <svg viewBox="0 0 25 21" className="flag-wave h-9 w-auto" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="flag-clip">
        <rect width="25" height="21" rx="2" />
      </clipPath>
    </defs>
    <g clipPath="url(#flag-clip)">
      <rect width="25" height="21" fill="#DC2626" />
      <path d="M12.5 2.5L14.5 8.5H20.5L15.5 12.5L17.5 18.5L12.5 14.5L7.5 18.5L9.5 12.5L4.5 8.5H10.5L12.5 2.5Z" fill="#003893" />
      <path d="M12.5 5L13.5 8.5H16.5L14 10.5L15 14L12.5 11.5L10 14L11 10.5L8.5 8.5H11.5L12.5 5Z" fill="#003893" />
    </g>
  </svg>
)

const JaggaChainLogo = ({ className = 'h-32 w-auto' }) => (
  <img
    src="/logo.png"
    alt="JaggaChain Logo"
    className={`${className} object-contain transition-transform duration-300 bg-transparent`}
  />
)

function App() {
  const { publicKey, connected, signTransaction } = useWallet()
  const walletAddress = publicKey?.toBase58() || null
  const isAdmin = useMemo(() => walletAddress && ADMIN_WALLETS.includes(walletAddress), [walletAddress])

  const [feeConfig, setFeeConfig] = useState({ citizenFeeSol: 0, adminFeeSol: 0, treasuryWallet: '', solanaConfigured: true })

  const [activeTab, setActiveTab] = useState('landing')
  const [parcels, setParcels] = useState([])
  const [whitelist, setWhitelist] = useState([])
  const [stats, setStats] = useState({ totalParcels: 0, pendingRegistrations: 0, pendingTransfers: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [txLoading, setTxLoading] = useState(null)
  const [expandedRequestId, setExpandedRequestId] = useState(null)
  const [registerForm, setRegisterForm] = useState({
    ownerName: '',
    district: '',
    municipality: '',
    ward: '',
    tole: '',
    bigha: '',
    kattha: '',
    dhur: '',
  })
  const [transferForm, setTransferForm] = useState({
    parcelId: '',
    toWallet: '',
    toName: '',
  })
  const [notification, setNotification] = useState({ message: null, type: 'success' })

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification((n) => (n.message === message ? { message: null, type: 'success' } : n)), 5000)
  }

  useEffect(() => {
    fetchStats()
    fetch(`${API_BASE}/api/fee-config`)
      .then((r) => r.json())
      .then((d) => setFeeConfig({
        citizenFeeSol: d.citizenFeeSol ?? 0.01,
        adminFeeSol: d.adminFeeSol ?? 0.005,
        treasuryWallet: d.treasuryWallet || '',
        solanaConfigured: d.solanaConfigured !== false
      }))
      .catch(() => { })
  }, [])

  /** Pay SOL fee via backend-built tx: no frontend RPC needed. User signs in wallet; backend submits. Returns signature as proof. */
  const payFeeSol = async (amountSol) => {
    if (!publicKey) throw new Error('Connect your wallet first.')
    if (!signTransaction) throw new Error('Your wallet does not support signing. Try Phantom or Solflare.')
    const toPubkey = feeConfig.treasuryWallet || publicKey.toBase58()
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
    const buildRes = await fetch(`${API_BASE}/api/solana/build-fee-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromPubkey: publicKey.toBase58(),
        toPubkey,
        lamports
      })
    })
    if (!buildRes.ok) {
      const text = await buildRes.text()
      let errMsg = 'Failed to build fee transaction'
      try {
        const data = JSON.parse(text)
        if (data.error) errMsg = data.error
      } catch (_) {
        if (text) errMsg = text.slice(0, 200)
      }
      throw new Error(errMsg)
    }
    const { transaction: txBase64 } = await buildRes.json()
    const buf = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0))
    const tx = Transaction.from(buf)
    const signed = await signTransaction(tx)
    const serialized = signed.serialize()
    const bytes = new Uint8Array(serialized)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const signedB64 = btoa(binary)
    const submitRes = await fetch(`${API_BASE}/api/solana/submit-signed-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction: signedB64 })
    })
    if (!submitRes.ok) {
      const data = await submitRes.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to submit transaction')
    }
    const { signature } = await submitRes.json()
    return signature
  }

  /** Pay registration fee and record details in one tx. Wallet will open to confirm — that's your Solana proof. */
  const payRegistrationTx = async (lamports, payload) => {
    if (!connected || !publicKey) throw new Error('Connect your wallet first.')
    const toPubkey = feeConfig.treasuryWallet || publicKey.toBase58()

    const buildRes = await fetch(`${API_BASE}/api/solana/build-registration-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromPubkey: publicKey.toBase58(),
        toPubkey,
        lamports,
        payload
      })
    })
    if (!buildRes.ok) {
      const data = await buildRes.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to build registration tx')
    }
    const { transaction: txBase64 } = await buildRes.json()

    // 2. Sign and submit
    const buf = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0))
    const tx = Transaction.from(buf)
    const signed = await signTransaction(tx)

    const serialized = signed.serialize()
    const bytes = new Uint8Array(serialized)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const signedB64 = btoa(binary)

    const submitRes = await fetch(`${API_BASE}/api/solana/submit-signed-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction: signedB64 })
    })
    if (!submitRes.ok) {
      const data = await submitRes.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to submit registration tx')
    }
    const { signature } = await submitRes.json()
    return signature
  }

  const paymentErrorMessage = (err) => err?.message || 'Action failed. Ensure you have enough SOL and try again.'

  /** Move NFT to treasury escrow. Wallet will open to confirm. */
  const payNftTransfer = async (mintAddress) => {
    if (!connected || !publicKey) throw new Error('Connect your wallet first.')
    const toPubkey = feeConfig.treasuryWallet || publicKey.toBase58()

    const buildRes = await fetch(`${API_BASE}/api/solana/build-nft-transfer-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAddress,
        fromPubkey: publicKey.toBase58(),
        toPubkey
      })
    })
    if (!buildRes.ok) {
      const data = await buildRes.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to build NFT transfer')
    }
    const { transaction: txBase64 } = await buildRes.json()

    // 2. Sign and submit
    const buf = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0))
    const tx = Transaction.from(buf)
    const signed = await signTransaction(tx)

    const serialized = signed.serialize()
    const bytes = new Uint8Array(serialized)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const signedB64 = btoa(binary)

    const submitRes = await fetch(`${API_BASE}/api/solana/submit-signed-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction: signedB64 })
    })
    if (!submitRes.ok) {
      const data = await submitRes.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to submit NFT transfer')
    }
    const { signature } = await submitRes.json()
    return signature
  }

  useEffect(() => {
    if (connected && walletAddress) {
      if (isAdmin) fetchWhitelist()
      else {
        fetchParcelsByOwner(walletAddress)
        fetchWhitelist()
      }
    }
  }, [connected, walletAddress, isAdmin])

  const fetchParcels = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/parcels`)
      const data = await res.json()
      setParcels(data)
    } catch (err) {
      console.error('Failed to fetch parcels:', err)
    }
  }

  const fetchParcelsByOwner = async (wallet) => {
    try {
      const res = await fetch(`${API_BASE}/api/parcels/owner/${encodeURIComponent(wallet)}`)
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
      const res = await fetch(`${API_BASE}/api/parcels/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setParcels(data)
    } catch (err) {
      console.error('Failed to search parcels:', err)
    }
  }

  const fetchWhitelist = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whitelist`)
      const data = await res.json()
      setWhitelist(data)
    } catch (err) {
      console.error('Failed to fetch whitelist:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleWhitelistAction = async (id, status) => {
    setTxLoading(id)
    try {
      const paymentTxSignature = await payFeeSol(feeConfig.adminFeeSol)
      const res = await fetch(`${API_BASE}/api/whitelist/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentTxSignature }),
      })
      if (res.ok) {
        await fetchWhitelist()
        await fetchStats()
        if (walletAddress && !isAdmin) fetchParcelsByOwner(walletAddress)
        showNotification(status === 'approved' ? 'Request approved. Recorded on Solana.' : 'Request rejected. Recorded on Solana.', 'success')
      } else {
        const data = await res.json().catch(() => ({}))
        showNotification(data.error || 'Action failed', 'error')
      }
    } catch (err) {
      console.error('Failed to update whitelist:', err)
      showNotification(paymentErrorMessage(err), 'error')
    }
    setTxLoading(null)
  }

  const handleRegistration = async (e) => {
    e.preventDefault()
    if (!walletAddress) return
    setTxLoading('registering')
    try {
      const payload = {
        ownerName: registerForm.ownerName,
        district: registerForm.district,
        municipality: registerForm.municipality,
        ward: registerForm.ward,
        tole: registerForm.tole,
      }

      const paymentTxSignature = await payRegistrationTx(feeConfig.citizenFeeSol * LAMPORTS_PER_SOL, payload)

      await fetch(`${API_BASE}/api/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          ownerName: registerForm.ownerName,
          requestType: 'registration',
          location: {
            district: registerForm.district,
            municipality: registerForm.municipality,
            ward: registerForm.ward,
            tole: registerForm.tole,
          },
          size: {
            bigha: registerForm.bigha,
            kattha: registerForm.kattha,
            dhur: registerForm.dhur,
          },
          paymentTxSignature,
        }),
      })
      await fetchWhitelist()
      setShowRegisterModal(false)
      setRegisterForm({ ownerName: '', district: '', municipality: '', ward: '', tole: '', bigha: '', kattha: '', dhur: '' })
      showNotification('Registration submitted. Pending government approval. You will see it in My requests and in Active once approved.', 'success')
    } catch (err) {
      console.error('Failed to submit registration:', err)
      showNotification(paymentErrorMessage(err), 'error')
    }
    setTxLoading(null)
  }
  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!walletAddress) return
    setTxLoading('transferring')
    try {
      const parcel = myParcels.find(p => p._id === transferForm.parcelId)
      if (!parcel) throw new Error('Parcel not found')

      // 1. Pay SOL fee
      const paymentTxSignature = await payFeeSol(feeConfig.citizenFeeSol)

      // 2. Move NFT to Escrow (if it has a mintAddress)
      let nftTransferSignature = null
      if (parcel.mintAddress && parcel.mintAddress !== 'undefined' && feeConfig.solanaConfigured) {
        try {
          nftTransferSignature = await payNftTransfer(parcel.mintAddress)
        } catch (err) {
          console.warn('NFT transfer to escrow failed, skipping real movement (may be dev mode):', err.message)
        }
      }

      // 3. Submit request
      await fetch(`${API_BASE}/api/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          ownerName: parcel.ownerName || '',
          requestType: 'transfer',
          toWallet: transferForm.toWallet,
          toName: transferForm.toName,
          parcelId: transferForm.parcelId,
          paymentTxSignature,
          nftTransferSignature
        }),
      })
      await fetchWhitelist()
      setShowTransferModal(false)
      setTransferForm({ parcelId: '', toWallet: '', toName: '' })
      fetchParcelsByOwner(walletAddress)
      showNotification('Transfer request submitted. Pending government approval.', 'success')
    } catch (err) {
      console.error('Failed to submit transfer:', err)
      showNotification(paymentErrorMessage(err), 'error')
    }
    setTxLoading(null)
  }

  const truncateHash = (hash) => (hash ? hash.slice(0, 8) + '...' + hash.slice(-8) : '-')

  const formatSize = (size) => {
    if (!size) return '—'
    const parts = []
    if (size.bigha) parts.push(`${size.bigha} Bigha`)
    if (size.kattha) parts.push(`${size.kattha} Kattha`)
    if (size.dhur) parts.push(`${size.dhur} Dhur`)
    return parts.length ? parts.join(', ') : '0 Dhur'
  }

  const registrationRequests = whitelist.filter((w) => w.status === 'pending' && w.requestType === 'registration')
  const transferRequests = whitelist.filter((w) => w.status === 'pending' && w.requestType === 'transfer')
  const myRequests = walletAddress
    ? whitelist.filter((w) => w.walletAddress === walletAddress)
    : []
  const myParcels = parcels

  const Landing = () => (
    <div className="min-h-screen">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-8">
            <button onClick={() => setActiveTab('landing')} className="flex items-center group cursor-pointer">
              <JaggaChainLogo />
            </button>
            <nav className="hidden md:flex items-center gap-10 text-base lg:text-lg font-semibold text-slate-700">
              <button onClick={() => setActiveTab('explorer')} className="hover:text-primary transition-colors">Explorer</button>
              <a className="hover:text-primary transition-colors" href="#pillars">Technology</a>
              <a className="hover:text-primary transition-colors" href="#how-it-works">How it Works</a>
            </nav>
            <div className="flex items-center gap-4">
              <WalletMultiButton className="!bg-primary !text-white !px-6 !py-3 !rounded-xl !text-sm lg:!text-base !font-bold hover:!bg-primary/90 !transition-all !shadow-lg !shadow-primary/20" />
            </div>
          </div>
        </div>
      </header>

      <main className="bg-hero-nepal">
        {/* Hero Section */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8 animate-fadeInUp max-w-[560px]">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-[#cccccc] text-[#444] text-[13px] font-medium tracking-wide shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                  National land trust layer on Solana
                </div>
                <h1 className="font-display font-black text-[32px] sm:text-[40px] lg:text-[52px] leading-[1.15] text-[#1a1a2e]">
                  Secure <span className="text-[#c0392b]">Land Ownership</span> on the <span className="text-primary">Blockchain</span>.
                </h1>
                <p className="subtitle text-[15px] text-[#555] leading-[1.7] max-w-[420px]">
                  Each registration, transfer request, approval, and rejection gets a Solana trail with explorer links.
                </p>
                <div className="buttons flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => setActiveTab('explorer')}
                    className="btn-primary flex items-center gap-2 rounded-lg text-[15px] font-semibold px-6 py-3.5 shadow-sm"
                    style={{ backgroundColor: '#c0392b', color: 'white' }}
                  >
                    Explore Public Records
                  </button>
                  <button
                    onClick={() => {
                      // open wallet button from navbar via click, but as fallback just focus the wallet adapter
                      const el = document.querySelector('.wallet-adapter-button');
                      if (el) el.click();
                    }}
                    type="button"
                    className="btn-secondary rounded-lg border text-[15px] font-medium px-6 py-3.5 bg-white text-[#1a1a2e] hover:bg-[#001f5c] hover:text-white transition-colors duration-200"
                    style={{ borderColor: '#cccccc' }}
                  >
                    Connect Wallet
                  </button>
                </div>
              </div>

              {/* Visual Side – Nepal typography tile */}
              <div className="relative z-10 flex justify-end animate-fadeInUp animate-delay-200">
                <div className="relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl w-[360px] sm:w-[380px] lg:w-[400px] aspect-[4/5] bg-slate-900">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-accent-crimson/20 z-10"></div>
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div
                      className="w-full h-full rounded-2xl bg-center bg-cover border border-white/10"
                      data-alt="Stylized 3D digital typography of Nepal with blockchain nodes"
                      data-location="Nepal"
                      style={{
                        backgroundImage:
                          "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBaCIriVUYqZ1AeMAwWwadXUeYCKJuq5TkmSCopViUbFpe2XrqUM1g2Z8HtdFZ-k0SAOA5f0oJn76Rz-zN_TXyLvltfJmUclpXMTdpzUsDPhNT8j1DxODb8jgnvE0SHCfev-SJPqIlqZk7NIwFqJfG1shmzcVpN9EQ2tePZLqDWnb5CIDwHsxJFJozMzDC0zNRG_Pq9PlMl80_Qu1KCV4CpppnoHJ_8cVrFDhc1Q_7e1SGGmo0XUD5GSBrNgQmloGYFKcKey66huvw')",
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section (Second Full Page) */}
        <section id="problem" className="min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="animate-fadeInUp">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-crimson mb-3">
                  Current challenge
                </p>
                <h2 className="text-[30px] sm:text-[38px] lg:text-[48px] leading-[1.15] font-black text-slate-900">
                  What is the problem with today&apos;s land registry and transfer ownership?
                </h2>
                <p className="mt-5 text-[16px] text-slate-600 leading-[1.8] max-w-[620px]">
                  Paper records, manual approvals, and disconnected offices slow down registration and ownership transfer.
                  This creates delays, fraud risk, and costly title disputes for citizens.
                </p>
                <div className="mt-8 grid sm:grid-cols-3 gap-3">
                  <div className="landing-problem-chip landing-chip-1 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                    Delayed verification
                  </div>
                  <div className="landing-problem-chip landing-chip-2 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                    Ownership conflicts
                  </div>
                  <div className="landing-problem-chip landing-chip-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                    Fraud and tampering risk
                  </div>
                </div>
              </div>
              <div className="animate-fadeInUp animate-delay-100">
                <div className="landing-problem-visual rounded-3xl border border-slate-200 p-3 shadow-xl">
                  <img
                    src="/problem-land-registry.svg"
                    alt="Illustration showing delays and disputes in traditional land registry and ownership transfer"
                    className="w-full h-auto rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section id="pillars" className="min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-2">The Web3 Advantage</h2>
              <h3 className="text-4xl font-black text-slate-900">Solana-Powered Web3 Solutions</h3>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Shield, title: 'Immutable NFT Titles', desc: 'Your land, your token. Every property is minted as a unique NFT, ensuring non-fungible security on the global ledger.' },
                { icon: CheckCircle2, title: 'Instant Verification', desc: 'Zero-knowledge proofs allow for immediate ownership validation without exposing sensitive personal data.' },
                { icon: Landmark, title: 'Transparent Audit Logs', desc: 'Every change, transfer, and lien is recorded forever on the blockchain, creating an unalterable history.' },
                { icon: Zap, title: 'High-Speed Processing', desc: 'Leveraging Solana’s 65k+ TPS architecture for near-instant settlement and minimal transaction fees.' },
              ].map((item, i) => (
                <div key={i} className={`landing-pillar-card landing-pillar-tone-${i + 1} p-8 rounded-2xl border transition-all group shadow-sm border-slate-200/60 hover:shadow-xl hover:shadow-primary/10`}>
                  <div className="w-12 h-12 rounded-xl bg-white/70 ring-1 ring-white/80 backdrop-blur-sm flex items-center justify-center mb-6 group-hover:bg-primary transition-colors text-primary group-hover:text-white">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Diagram */}
        <section id="how-it-works" className="min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl lg:text-4xl font-black mb-4">From Physical Asset to Digital Title</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">Our streamlined process ensures every property is legally validated and cryptographically secured in four simple steps.</p>
            </div>
            <div className="relative">
              <div className="grid lg:grid-cols-4 gap-8 relative z-10">
                {[
                  { icon: Globe, title: 'Upload Docs', desc: 'Deeds, surveys, and identity verification uploaded to our secure portal.', step: 1 },
                  { icon: Landmark, title: 'Legal Validation', desc: 'Automated and expert legal checks ensure documentation is valid and clear.', step: 2 },
                  { icon: Zap, title: 'Minting NFT', desc: 'Property is tokenized on the Solana blockchain as a unique asset.', step: 3 },
                  { icon: Lock, title: 'Secure Digital Vault', desc: 'Your title is delivered to your encrypted wallet for lifetime access.', step: 4 },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center text-center group">
                    <div
                      className={`w-20 h-20 rounded-full shadow-xl border-4 border-slate-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform relative ${[
                        'bg-blue-700 text-white',
                        'bg-teal-700 text-white',
                        'bg-violet-700 text-white',
                        'bg-primary text-white',
                      ][i]}`}
                    >
                      <item.icon className="w-8 h-8" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent-crimson text-white text-[10px] font-bold flex items-center justify-center">{item.step}</div>
                    </div>
                    <h5 className="font-bold text-lg mb-2">{item.title}</h5>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Live Audit Log Preview */}
        <section className="min-h-screen flex items-center bg-slate-900 text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-2">Real-Time Transparency</h2>
                <h3 className="text-4xl font-black mb-6">Immutable Audit Logs</h3>
                <p className="text-slate-400 text-lg leading-relaxed mb-8">Experience complete visibility. Every transaction is indexed and searchable, making corruption impossible and due diligence effortless.</p>
                <ul className="space-y-4">
                  {['Cryptographic Proof of Title', 'Zero-Downtime Global Access', 'Automated Compliance Checks'].map((text, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="bg-black/40 border border-white/10 rounded-xl p-1 backdrop-blur-sm">
                  <div className="bg-slate-950 rounded-lg p-6 font-mono text-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Live Solana Ledger Feed</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-4"><span className="text-primary">14:02:11</span><span className="text-accent-crimson">[MINT]</span><span className="text-slate-400">Title #NFT-882... validated</span></div>
                      <div className="flex gap-4"><span className="text-primary">13:58:45</span><span className="text-blue-400">[TRANS]</span><span className="text-slate-400">Ownership transfer request: 0x4f...</span></div>
                      <div className="flex gap-4"><span className="text-primary">13:45:02</span><span className="text-green-400">[VERIF]</span><span className="text-slate-400">Verification successful Asset ID 9922</span></div>
                      <div className="flex gap-4 opacity-50"><span className="text-primary">13:33:19</span><span className="text-accent-crimson">[MINT]</span><span className="text-slate-400">Title #NFT-881... finalized</span></div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">Tps: 64,812 | Finality: 0.4s</span>
                      <span className="text-primary font-bold animate-pulse">● NETWORK SYNCED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="min-h-screen flex items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-primary transform -skew-y-3 origin-bottom-right"></div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center text-white py-12">
            <h2 className="text-4xl font-black mb-6">Ready to Secure Your Future?</h2>
            <p className="text-white/80 text-lg mb-10">Join the thousands of property owners who have already modernized their assets with JaggaChain.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setActiveTab('parcels')}
                className="bg-accent-crimson hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-xl shadow-black/20"
              >
                Start Your Registry
              </button>
              <button onClick={() => setActiveTab('explorer')} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl font-bold transition-all">
                Explore Records
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-hero-nepal py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <button onClick={() => setActiveTab('landing')} className="flex items-center group cursor-pointer">
              <JaggaChainLogo />
            </button>
            <div className="flex gap-8 text-sm text-slate-500 font-semibold">
              <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
              <a className="hover:text-primary transition-colors" href="#">Audit Reports</a>
            </div>
            <div className="text-sm text-slate-400 font-medium">
              © 2024 JaggaChain Registry Services.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )

  const requireWallet = (tab) => {
    if (tab === 'explorer') return false
    return true
  }

  const canAccessTab = (tab) => {
    if (tab === 'explorer') return true
    if (!connected) return false
    if (tab === 'government') return isAdmin
    return true
  }

  return (
    <div className="app-shell min-h-screen bg-page-nepal">
      {notification.message && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4 px-4 py-3 rounded-xl shadow-lg flex items-center justify-between gap-4 animate-fadeIn ${notification.type === 'error' ? 'bg-accent-crimson text-white' : 'bg-emerald-600 text-white'
            }`}
          role="alert"
        >
          <span className="text-sm font-medium">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification({ message: null, type: 'success' })}
            className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition"
            aria-label="Dismiss"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
      {activeTab === 'landing' && <Landing />}

      {/* Single global navbar on all non-landing pages */}
      {activeTab !== 'landing' && (
        <>
          <header className="app-topbar sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-20 gap-6">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => setActiveTab('landing')}
                    className="flex items-center group cursor-pointer"
                  >
                    <JaggaChainLogo />
                  </button>
                  <div className="flex gap-4">
                    <button
                      onClick={() => { setActiveTab('explorer'); fetchParcels() }}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm md:text-base font-semibold transition-all relative ${activeTab === 'explorer' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Globe className="w-4 h-4" /> Public Records
                      {activeTab === 'explorer' && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                    <button
                      onClick={() => { if (!connected) setActiveTab('parcels'); else { setActiveTab('parcels'); fetchParcelsByOwner(walletAddress) } }}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm md:text-base font-semibold transition-all relative ${activeTab === 'parcels' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <LayoutDashboard className="w-4 h-4" /> PORTAL
                      {activeTab === 'parcels' && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setActiveTab('government'); fetchWhitelist() }}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm md:text-base font-semibold transition-all relative ${activeTab === 'government' ? 'text-accent-crimson' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Landmark className="w-4 h-4" /> ADMIN
                        {activeTab === 'government' && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent-crimson rounded-t-full" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connected ? (
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:block text-right">
                        <p className="text-xs md:text-sm font-mono text-slate-400">{truncateHash(walletAddress)}</p>
                        <span className={`inline-flex items-center gap-1 text-[11px] md:text-xs font-bold uppercase tracking-wider ${isAdmin ? 'text-accent-crimson' : 'text-primary'}`}>
                          {isAdmin ? <><Landmark className="w-4 h-4" /> Admin</> : <><User className="w-4 h-4" /> Citizen</>}
                        </span>
                      </span>
                      <WalletMultiButton className="!bg-slate-50 !text-slate-800 !border !border-slate-200 !rounded-full !px-5 !py-2.5 !text-sm !font-bold hover:!bg-slate-100 !transition-all" />
                    </div>
                  ) : (
                    <WalletMultiButton className="!bg-primary !text-white !rounded-full !px-6 !py-3 !text-sm md:text-base !font-bold hover:!shadow-lg !transition-all" />
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 py-8">
            {activeTab === 'explorer' && (
              <div className="animate-fadeIn">
                <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                  <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5 text-primary" />
                    Search public land records
                  </h2>
                  <p className="text-slate-500 mb-4 font-medium">No wallet required. Search by owner name, district, municipality, or tole.</p>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by owner, district, municipality, or tole..."
                      value={searchQuery}
                      onChange={(e) => searchParcels(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-primary outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {!searched ? (
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Globe className="w-10 h-10 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Public land registry</h2>
                    <p className="text-slate-500">Enter a search term to view land records. Wallet connection is optional here.</p>
                  </div>
                ) : parcels.length === 0 ? (
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                    <FileWarning className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">No records found</h2>
                    <p className="text-slate-500">No land records match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {parcels.map((parcel) => (
                      <div
                        key={parcel._id}
                        className="premium-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden card-hover animate-fadeIn"
                      >
                        <div className="bg-slate-900 px-5 py-4">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-bold tracking-tight">#{parcel.tokenId}</span>
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Registered
                            </span>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="font-semibold text-lg text-slate-800 mb-3">{parcel.ownerName}</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Location</span>
                              <span className="text-slate-700 font-medium">
                                {parcel.location?.district}, {parcel.location?.municipality}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ward</span>
                              <span className="text-slate-700">
                                Ward {parcel.location?.ward}, {parcel.location?.tole}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Size</span>
                              <span className="text-slate-700 font-medium">{formatSize(parcel.size)}</span>
                            </div>
                            {parcel.transactionHash && (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs text-slate-400 font-mono break-all">
                                  {truncateHash(parcel.transactionHash)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'parcels' && (
              <div className="animate-fadeIn">
                {!connected ? (
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                    <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-10 h-10 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Connect your wallet</h2>
                    <p className="text-slate-500 mb-6">You need to connect a Solana wallet to view your parcels and transfer requests.</p>
                    <WalletMultiButton className="!bg-red-600 !text-white !rounded-xl !px-6 !py-3 hover:!bg-red-700 !inline-flex" />
                  </div>
                ) : (
                  <div>
                    <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                            <LayoutDashboard className="w-5 h-5 text-red-600" />
                            My Portal
                          </h2>
                          <p className="text-slate-500 font-mono text-sm">{truncateHash(walletAddress)}</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowRegisterModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:translate-y-[-1px] transition-all shadow-lg shadow-primary/20 text-sm"
                          >
                            <FileCheck className="w-4 h-4" /> Register land
                          </button>
                        </div>
                      </div>
                    </div>

                    {myRequests.length > 0 && (
                      <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <FileCheck className="w-5 h-5" /> My requests
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">Click a request to see details.</p>
                        <div className="space-y-2">
                          {myRequests.map((r) => (
                            <div
                              key={r._id}
                              className="rounded-xl border border-slate-200 overflow-hidden"
                            >
                              <div
                                className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-100/50 transition cursor-pointer"
                                onClick={() => setExpandedRequestId(expandedRequestId === r._id ? null : r._id)}
                              >
                                <div className="flex items-center gap-3">
                                  {expandedRequestId === r._id ? (
                                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                                  )}
                                  <div>
                                    <span className="font-medium text-slate-800">{r.requestType === 'registration' ? 'Registration' : 'Transfer'}</span>
                                    <span
                                      className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${r.status === 'pending' ? 'bg-amber-100 text-amber-800' : r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                                    >
                                      {r.status}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-sm text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                              </div>
                              {expandedRequestId === r._id && (
                                <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/70">
                                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-3">
                                    {r.requestType === 'registration' ? (
                                      <>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                          <div><span className="text-slate-500">Owner name</span><br /><span className="font-medium text-slate-800">{r.ownerName}</span></div>
                                          <div><span className="text-slate-500">Wallet</span><br /><span className="font-mono text-slate-800 break-all">{r.walletAddress}</span></div>
                                          <div><span className="text-slate-500">District</span><br /><span className="text-slate-800">{r.location?.district || '—'}</span></div>
                                          <div><span className="text-slate-500">Municipality</span><br /><span className="text-slate-800">{r.location?.municipality || '—'}</span></div>
                                          <div><span className="text-slate-500">Ward</span><br /><span className="text-slate-800">{r.location?.ward ?? '—'}</span></div>
                                          <div><span className="text-slate-500">Tole</span><br /><span className="text-slate-800">{r.location?.tole || '—'}</span></div>
                                          <div><span className="text-slate-500">Size</span><br /><span className="text-slate-800">{formatSize(r.size)}</span></div>
                                          <div><span className="text-slate-500">Submitted</span><br /><span className="text-slate-800">{new Date(r.createdAt).toLocaleString()}</span></div>
                                        </div>
                                        {r.paymentTxSignature && !r.paymentTxSignature.startsWith('dev-') && (
                                          <div>
                                            <span className="text-slate-500">Payment (proof)</span><br />
                                            <a href={`https://explorer.solana.com/tx/${r.paymentTxSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1">
                                              {truncateHash(r.paymentTxSignature)} <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                          <div><span className="text-slate-500">From (you)</span><br /><span className="font-medium text-slate-800">{r.ownerName}</span></div>
                                          <div><span className="text-slate-500">Your wallet</span><br /><span className="font-mono text-slate-800 break-all">{r.walletAddress}</span></div>
                                          <div><span className="text-slate-500">To (recipient)</span><br /><span className="text-slate-800">{r.toName}</span></div>
                                          <div><span className="text-slate-500">Recipient wallet</span><br /><span className="font-mono text-slate-800 break-all">{r.toWallet}</span></div>
                                          <div><span className="text-slate-500">Parcel ID</span><br /><span className="font-mono text-slate-800">{r.parcelId || '—'}</span></div>
                                          <div><span className="text-slate-500">Submitted</span><br /><span className="text-slate-800">{new Date(r.createdAt).toLocaleString()}</span></div>
                                        </div>
                                        {r.paymentTxSignature && !r.paymentTxSignature.startsWith('dev-') && (
                                          <div>
                                            <span className="text-slate-500">Payment (proof)</span><br />
                                            <a href={`https://explorer.solana.com/tx/${r.paymentTxSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1">
                                              {truncateHash(r.paymentTxSignature)} <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {myParcels.length === 0 ? (
                      <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                        <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">No parcels yet</h2>
                        <p className="text-slate-500 mb-6">You don’t have any registered parcels. Register your first land to mint an NFT on Solana.</p>
                        <button
                          onClick={() => setShowRegisterModal(true)}
                          className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:translate-y-[-1px] transition-all shadow-lg shadow-primary/20"
                        >
                          <FileCheck className="w-5 h-5" /> Start My Registry
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myParcels.map((parcel) => (
                          <div
                            key={parcel._id}
                            className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 card-hover"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="px-3 py-1 bg-slate-800 text-white rounded-lg font-medium">#{parcel.tokenId}</span>
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                  </span>
                                </div>
                                <h3 className="font-semibold text-lg text-slate-800">{parcel.ownerName}</h3>
                                <p className="text-slate-500">
                                  {parcel.location?.municipality}, Ward {parcel.location?.ward}, {parcel.location?.tole}
                                </p>
                                <p className="text-sm text-slate-400 mt-2">Size: {formatSize(parcel.size)}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => {
                                    setTransferForm({ ...transferForm, parcelId: parcel._id })
                                    setShowTransferModal(true)
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition text-sm"
                                >
                                  <Zap className="w-4 h-4" /> Transfer
                                </button>
                                {parcel.transactionHash && !parcel.transactionHash.startsWith('dev-') && (
                                  <a
                                    href={`https://explorer.solana.com/tx/${parcel.transactionHash}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition text-sm"
                                  >
                                    <ExternalLink className="w-4 h-4" /> View on Explorer
                                  </a>
                                )}
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

            {activeTab === 'government' && !isAdmin && connected && (
              <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-16 text-center animate-fadeIn">
                <Landmark className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Admin access required</h2>
                <p className="text-slate-500 mb-6">This area is only available to authorized government wallets.</p>
                <button onClick={() => setActiveTab('explorer')} className="text-red-600 font-medium hover:underline">Go to Explorer</button>
              </div>
            )}

            {activeTab === 'government' && isAdmin && (
              <div className="animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 card-hover">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-red-100">
                        <Mountain className="w-8 h-8 text-red-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-slate-800">{stats.totalParcels}</p>
                        <p className="text-sm text-slate-500">Total registered lands</p>
                      </div>
                    </div>
                  </div>
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 card-hover">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-amber-100">
                        <FileCheck className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-slate-800">{registrationRequests.length}</p>
                        <p className="text-sm text-slate-500">Pending registrations</p>
                      </div>
                    </div>
                  </div>
                  <div className="premium-card rounded-2xl shadow-sm border border-slate-200 p-6 card-hover">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-blue-100">
                        <Zap className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-slate-800">{transferRequests.length}</p>
                        <p className="text-sm text-slate-500">Pending transfers</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="premium-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                  <div className="bg-slate-900 px-6 py-5 border-b border-white/10">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-primary" /> Registration requests
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Review and approve or reject. Action will be recorded on Solana. {feeConfig.adminFeeSol > 0 ? `Fee: ${feeConfig.adminFeeSol} SOL.` : 'Network fee only.'}</p>
                  </div>
                  {registrationRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No pending registration requests.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {registrationRequests.map((item) => (
                        <div key={item._id} className="overflow-hidden">
                          <div
                            className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 transition cursor-pointer"
                            onClick={() => setExpandedRequestId(expandedRequestId === item._id ? null : item._id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedRequestId === item._id ? (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                              )}
                              <div>
                                <h3 className="font-semibold text-slate-800">{item.ownerName}</h3>
                                <p className="text-sm text-slate-500 font-mono">{truncateHash(item.walletAddress)}</p>
                                {item.location && (
                                  <p className="text-sm text-slate-500">
                                    {item.location.district}, {item.location.municipality}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {txLoading === item._id ? (
                                <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl inline-flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Processing
                                </span>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleWhitelistAction(item._id, 'approved')
                                    }}
                                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition text-sm"
                                  >
                                    <CheckCircle2 className="w-4 h-4" /> Approve
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleWhitelistAction(item._id, 'rejected')
                                    }}
                                    className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition text-sm"
                                  >
                                    <XCircle className="w-4 h-4" /> Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {expandedRequestId === item._id && (
                            <div className="px-6 pb-6 pt-0 animate-fadeIn">
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-sm space-y-3">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                  <div><span className="text-slate-500">Owner name</span><br /><span className="font-medium text-slate-800">{item.ownerName}</span></div>
                                  <div><span className="text-slate-500">Wallet</span><br /><span className="font-mono text-slate-800 break-all">{item.walletAddress}</span></div>
                                  <div><span className="text-slate-500">District</span><br /><span className="text-slate-800">{item.location?.district}</span></div>
                                  <div><span className="text-slate-500">Municipality</span><br /><span className="text-slate-800">{item.location?.municipality}</span></div>
                                  <div><span className="text-slate-500">Ward</span><br /><span className="text-slate-800">{item.location?.ward}</span></div>
                                  <div><span className="text-slate-500">Tole</span><br /><span className="text-slate-800">{item.location?.tole}</span></div>
                                  <div><span className="text-slate-500">Size</span><br /><span className="text-slate-800">{formatSize(item.size)}</span></div>
                                  <div><span className="text-slate-500">Submitted</span><br /><span className="text-slate-800">{new Date(item.createdAt).toLocaleString()}</span></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="premium-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 px-6 py-5 border-b border-white/10">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-accent-crimson" /> Transfer requests
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Action will be recorded on Solana. {feeConfig.adminFeeSol > 0 ? `Fee: ${feeConfig.adminFeeSol} SOL.` : 'Network fee only.'}</p>
                  </div>
                  {transferRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No pending transfer requests.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {transferRequests.map((item) => (
                        <div key={item._id} className="overflow-hidden">
                          <div
                            className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 transition cursor-pointer"
                            onClick={() => setExpandedRequestId(expandedRequestId === item._id ? null : item._id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedRequestId === item._id ? (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                              )}
                              <div>
                                <h3 className="font-semibold text-slate-800">{item.ownerName || 'Transfer'}</h3>
                                <p className="text-sm text-slate-500 font-mono">From: {truncateHash(item.walletAddress)}</p>
                                {item.toName && (
                                  <p className="text-sm text-slate-500">
                                    To: {item.toName} ({truncateHash(item.toWallet)})
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {txLoading === item._id ? (
                                <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl inline-flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Processing
                                </span>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleWhitelistAction(item._id, 'approved')
                                    }}
                                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition text-sm"
                                  >
                                    <CheckCircle2 className="w-4 h-4" /> Approve
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleWhitelistAction(item._id, 'rejected')
                                    }}
                                    className="flex items-center gap-1 px-4 py-2 bg-accent-crimson text-white rounded-xl font-bold hover:bg-red-700 transition text-sm"
                                  >
                                    <XCircle className="w-4 h-4" /> Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {expandedRequestId === item._id && (
                            <div className="px-6 pb-6 pt-0 animate-fadeIn">
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-sm space-y-3">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                  <div><span className="text-slate-500">From (owner)</span><br /><span className="font-medium text-slate-800">{item.ownerName}</span></div>
                                  <div><span className="text-slate-500">From wallet</span><br /><span className="font-mono text-slate-800 break-all">{item.walletAddress}</span></div>
                                  <div><span className="text-slate-500">To (recipient)</span><br /><span className="text-slate-800">{item.toName}</span></div>
                                  <div><span className="text-slate-500">To wallet</span><br /><span className="font-mono text-slate-800 break-all">{item.toWallet}</span></div>
                                  <div><span className="text-slate-500">Parcel ID</span><br /><span className="font-mono text-slate-800">{item.parcelId}</span></div>
                                  <div><span className="text-slate-500">Submitted</span><br /><span className="text-slate-800">{new Date(item.createdAt).toLocaleString()}</span></div>
                                  {item.paymentTxSignature && (
                                    <div className="col-span-2">
                                      <span className="text-slate-500">SOL Fee Signature (Proof)</span><br />
                                      <a href={`https://explorer.solana.com/tx/${item.paymentTxSignature}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono text-xs break-all flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> {item.paymentTxSignature}
                                      </a>
                                    </div>
                                  )}
                                  {item.nftTransferSignature && (
                                    <div className="col-span-2">
                                      <span className="text-slate-500">NFT Escrow Signature (Proof)</span><br />
                                      <a href={`https://explorer.solana.com/tx/${item.nftTransferSignature}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono text-xs break-all flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> {item.nftTransferSignature}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
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

      {showRegisterModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRegisterModal(false)}
        >
          <div
            className="premium-card rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-accent-crimson" /> Register new land
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {feeConfig.citizenFeeSol > 0 ? `${feeConfig.citizenFeeSol} SOL (proof)` : 'Network fee only (no protocol fee)'}{!feeConfig.treasuryWallet && feeConfig.citizenFeeSol > 0 && ' — dev: paying to your wallet'}
            </p>
            {!feeConfig.solanaConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                Backend Solana RPC is not configured. Set <strong>SOLANA_RPC_URL</strong> in <strong>backend/.env</strong> and restart the backend so fee payment works.
              </div>
            )}
            {feeConfig.solanaConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                When you submit, <strong>your wallet (e.g. Phantom) will open</strong>. Confirm the transaction there — that is your Solana proof. After government approval, a parcel NFT will be minted to your wallet.
              </div>
            )}
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner name</label>
                <input
                  required
                  type="text"
                  value={registerForm.ownerName}
                  onChange={(e) => setRegisterForm({ ...registerForm, ownerName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                  <input
                    required
                    type="text"
                    value={registerForm.district}
                    onChange={(e) => setRegisterForm({ ...registerForm, district: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Municipality</label>
                  <input
                    required
                    type="text"
                    value={registerForm.municipality}
                    onChange={(e) => setRegisterForm({ ...registerForm, municipality: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward</label>
                  <input
                    required
                    type="number"
                    value={registerForm.ward}
                    onChange={(e) => setRegisterForm({ ...registerForm, ward: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tole</label>
                  <input
                    required
                    type="text"
                    value={registerForm.tole}
                    onChange={(e) => setRegisterForm({ ...registerForm, tole: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bigha</label>
                  <input
                    type="number"
                    value={registerForm.bigha}
                    onChange={(e) => setRegisterForm({ ...registerForm, bigha: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kattha</label>
                  <input
                    type="number"
                    value={registerForm.kattha}
                    onChange={(e) => setRegisterForm({ ...registerForm, kattha: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dhur</label>
                  <input
                    type="number"
                    value={registerForm.dhur}
                    onChange={(e) => setRegisterForm({ ...registerForm, dhur: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 shrink-0" />
                  After government approval, an NFT will be minted on Solana and the record will be visible on Explorer. A small fee may apply.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txLoading === 'registering'}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:translate-y-[-1px] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {txLoading === 'registering' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    'Submit for approval'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="premium-card rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-crimson" /> Transfer parcel
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {feeConfig.citizenFeeSol > 0 ? `${feeConfig.citizenFeeSol} SOL (proof)` : 'Network fee only (no protocol fee)'}{!feeConfig.treasuryWallet && feeConfig.citizenFeeSol > 0 && ' — dev: paying to your wallet'}
            </p>
            {!feeConfig.solanaConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                Backend Solana RPC is not configured. Set <strong>SOLANA_RPC_URL</strong> in <strong>backend/.env</strong> and restart the backend.
              </div>
            )}
            {feeConfig.solanaConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                When you submit, <strong>your wallet will open</strong>. Confirm the transaction — that records your transfer request on Solana.
              </div>
            )}
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient name</label>
                <input
                  required
                  type="text"
                  value={transferForm.toName}
                  onChange={(e) => setTransferForm({ ...transferForm, toName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Solana wallet</label>
                <input
                  required
                  type="text"
                  value={transferForm.toWallet}
                  onChange={(e) => setTransferForm({ ...transferForm, toWallet: e.target.value })}
                  placeholder="Base58 address"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono text-sm"
                />
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                <p className="text-sm text-amber-800">
                  Transfer requires government approval. After approval, an NFT will be minted/updated on Solana.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txLoading === 'transferring'}
                  className="flex-1 px-4 py-2.5 bg-accent-crimson text-white rounded-xl font-bold hover:translate-y-[-1px] transition-all shadow-lg shadow-accent-crimson/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {txLoading === 'transferring' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    'Request transfer'
                  )}
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
