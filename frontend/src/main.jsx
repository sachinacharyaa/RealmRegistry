import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { useMemo } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import App from './App.jsx'

// Use a public RPC that works from browser (CORS). Override with VITE_SOLANA_RPC in .env
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC || 'https://rpc.ankr.com/solana_devnet'

// eslint-disable-next-line react-refresh/only-export-components
function WalletWrapper() {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <WalletWrapper />
    </ErrorBoundary>
  </StrictMode>,
)
