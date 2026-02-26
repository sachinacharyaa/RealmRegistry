/**
 * Solana helpers for RealmRegistry.
 * Authority is DAO-first: backend verifies governance execution proofs instead of using admin keys.
 */

const SOLANA_RPC = process.env.SOLANA_RPC_URL || ''
const SOLANA_RPC_FALLBACK_URLS = (process.env.SOLANA_RPC_FALLBACK_URLS || 'https://api.devnet.solana.com,https://api.devnet.solana.org,https://rpc.ankr.com/solana_devnet')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean)
const RPC_ENDPOINTS = Array.from(new Set([SOLANA_RPC, ...SOLANA_RPC_FALLBACK_URLS].filter(Boolean)))

let connection = null
let currentRpcIndex = 0

function currentRpcUrl() {
  return RPC_ENDPOINTS[currentRpcIndex] || ''
}

function useRpcAt(index) {
  const { Connection } = require('@solana/web3.js')
  currentRpcIndex = index
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex])
}

function rotateRpc() {
  if (RPC_ENDPOINTS.length <= 1) return false
  const nextIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length
  useRpcAt(nextIndex)
  return true
}

function isRpcTransientError(err) {
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('network')
  )
}

function normalizeRpcError(err) {
  const msg = String(err?.message || '')
  if (isRpcTransientError(err)) {
    return new Error(`Solana RPC request failed on all endpoints. Checked: ${RPC_ENDPOINTS.join(', ')}`)
  }
  return new Error(msg || 'Solana RPC request failed')
}

async function withRpcRetry(fn) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  let lastErr = null
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt += 1) {
    try {
      return await fn(connection)
    } catch (err) {
      lastErr = err
      if (!isRpcTransientError(err) || attempt === RPC_ENDPOINTS.length - 1) {
        throw normalizeRpcError(err)
      }
      rotateRpc()
    }
  }
  throw normalizeRpcError(lastErr)
}

function init() {
  if (!RPC_ENDPOINTS.length) return false
  try {
    useRpcAt(0)
    return true
  } catch (e) {
    console.warn('Solana init skipped:', e.message)
    return false
  }
}

const initialized = init()
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

function getAccountAddressesFromTx(tx) {
  const addresses = new Set()
  const message = tx.transaction.message

  if (Array.isArray(message.staticAccountKeys)) {
    message.staticAccountKeys.forEach((k) => addresses.add(k.toBase58()))
  } else if (Array.isArray(message.accountKeys)) {
    message.accountKeys.forEach((k) => {
      const value = typeof k === 'string' ? k : (k.pubkey ? k.pubkey.toBase58() : k.toBase58())
      addresses.add(value)
    })
  }

  if (tx.meta?.loadedAddresses?.writable) {
    tx.meta.loadedAddresses.writable.forEach((k) => addresses.add(k))
  }
  if (tx.meta?.loadedAddresses?.readonly) {
    tx.meta.loadedAddresses.readonly.forEach((k) => addresses.add(k))
  }

  return addresses
}

function getProgramIdsFromTx(tx) {
  const ids = new Set()
  const message = tx.transaction.message

  if (Array.isArray(message.compiledInstructions) && Array.isArray(message.staticAccountKeys)) {
    message.compiledInstructions.forEach((ix) => {
      const pk = message.staticAccountKeys[ix.programIdIndex]
      if (pk) ids.add(pk.toBase58())
    })
  } else if (Array.isArray(message.instructions)) {
    message.instructions.forEach((ix) => {
      if (ix.programId) ids.add(ix.programId.toBase58 ? ix.programId.toBase58() : String(ix.programId))
    })
  }

  return ids
}

async function getConfirmedTx(signature) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const tx = await withRpcRetry((conn) => conn.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  }))
  if (!tx) return { ok: false, reason: 'transaction not found' }
  if (tx.meta?.err) return { ok: false, reason: 'transaction failed on-chain' }
  return { ok: true, tx }
}

async function verifyGovernanceExecution({ signature, realm, governance, governanceSigner, proposal, governanceProgramId }) {
  if (!signature || !realm || !governance || !governanceSigner || !proposal || !governanceProgramId) {
    return { ok: false, reason: 'missing governance verification fields' }
  }

  const txResult = await getConfirmedTx(signature)
  if (!txResult.ok) return txResult

  const accountSet = getAccountAddressesFromTx(txResult.tx)
  const required = [realm, governance, governanceSigner, proposal]
  const missing = required.filter((a) => !accountSet.has(a))
  if (missing.length) {
    return { ok: false, reason: `missing required governance accounts in execution tx: ${missing.join(', ')}` }
  }

  const programIds = getProgramIdsFromTx(txResult.tx)
  if (!programIds.has(governanceProgramId)) {
    return { ok: false, reason: 'execution tx does not call the configured Realms governance program' }
  }

  return { ok: true, slot: txResult.tx.slot }
}

async function verifyParcelAction({ signature, requiredAccounts = [] }) {
  if (!signature) return { ok: false, reason: 'missing action signature' }
  const txResult = await getConfirmedTx(signature)
  if (!txResult.ok) return txResult

  const accountSet = getAccountAddressesFromTx(txResult.tx)
  const missing = requiredAccounts.filter((a) => a && !accountSet.has(a))
  if (missing.length) {
    return { ok: false, reason: `missing required action accounts in tx: ${missing.join(', ')}` }
  }

  return { ok: true, slot: txResult.tx.slot }
}

/** Verify a Realms governance proposal account belongs to this DAO and check its state. */
async function verifyGovernanceProposal({ proposal, governance, governanceProgramId }) {
  if (!proposal || !governance || !governanceProgramId) {
    return { ok: false, reason: 'missing governance proposal verification fields' }
  }
  if (!connection || !RPC_ENDPOINTS.length) {
    return { ok: false, reason: 'Solana RPC not configured' }
  }

  const { PublicKey } = require('@solana/web3.js')
  let proposalPk
  try {
    proposalPk = new PublicKey(String(proposal).trim())
  } catch {
    return { ok: false, reason: 'invalid proposal public key' }
  }

  let account
  try {
    account = await withRpcRetry((conn) => conn.getAccountInfo(proposalPk))
  } catch (err) {
    return { ok: false, reason: normalizeRpcError(err).message }
  }

  if (!account) {
    return { ok: false, reason: 'proposal account not found' }
  }
  const owner = account.owner?.toBase58()
  if (!owner || owner !== governanceProgramId) {
    return { ok: false, reason: 'proposal account is not owned by the configured governance program' }
  }

  const data = account.data
  if (!data || data.length < 1 + 32 + 32 + 1) {
    return { ok: false, reason: 'proposal account data is too short' }
  }

  const accountType = data[0]
  // 14 = GovernanceAccountType::ProposalV2, 5 = ProposalV1 (legacy) – accept both.
  if (accountType !== 14 && accountType !== 5) {
    return { ok: false, reason: 'account is not a governance proposal' }
  }

  const governancePkFromAccount = new PublicKey(data.slice(1, 33)).toBase58()
  if (governancePkFromAccount !== governance) {
    return { ok: false, reason: 'proposal does not belong to configured governance' }
  }

  // account_type (1) + governance (32) + governing_token_mint (32)
  const stateOffset = 1 + 32 + 32
  const stateByte = data[stateOffset]
  // ProposalState::Voting (see enums.rs) has discriminant 2
  const PROPOSAL_STATE_VOTING = 2
  const isVoting = stateByte === PROPOSAL_STATE_VOTING

  return {
    ok: true,
    isVoting,
    governance: governancePkFromAccount,
    accountType
  }
}

/** Build unsigned SPL transfer transaction for client to sign. */
async function buildNFTTransferTx(mintAddress, fromPubkey, toPubkey) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const { Transaction, PublicKey } = require('@solana/web3.js')
  const spl = require('@solana/spl-token')
  const from = new PublicKey(fromPubkey)
  const to = new PublicKey(toPubkey)
  const mint = new PublicKey(mintAddress)

  const fromAta = await spl.getAssociatedTokenAddress(mint, from)
  const toAta = await spl.getAssociatedTokenAddress(mint, to)

  const tx = new Transaction().add(
    spl.createAssociatedTokenAccountInstruction(
      from,
      toAta,
      to,
      mint
    ),
    spl.createTransferInstruction(fromAta, toAta, from, 1)
  )

  const { blockhash } = await withRpcRetry((conn) => conn.getLatestBlockhash())
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Build unsigned registration mint transaction (NFT supply=1) for DAO authority wallet to sign. */
async function buildRegistrationMintTx(fromPubkey, toPubkey) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const { Transaction, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js')
  const spl = require('@solana/spl-token')

  let from
  let to
  try {
    from = new PublicKey(String(fromPubkey).trim())
    to = new PublicKey(String(toPubkey).trim())
  } catch {
    throw new Error('Invalid wallet address for mint transaction.')
  }
  const mint = Keypair.generate()
  const rent = await withRpcRetry((conn) => spl.getMinimumBalanceForRentExemptMint(conn))
  const toAta = await spl.getAssociatedTokenAddress(mint.publicKey, to)

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: from,
      newAccountPubkey: mint.publicKey,
      space: spl.MINT_SIZE,
      lamports: rent,
      programId: spl.TOKEN_PROGRAM_ID
    }),
    spl.createInitializeMintInstruction(
      mint.publicKey,
      0,
      from,
      from
    ),
    spl.createAssociatedTokenAccountInstruction(
      from,
      toAta,
      to,
      mint.publicKey
    ),
    spl.createMintToInstruction(
      mint.publicKey,
      toAta,
      from,
      1
    )
  )

  const { blockhash } = await withRpcRetry((conn) => conn.getLatestBlockhash())
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  tx.partialSign(mint)

  const serialized = tx.serialize({ requireAllSignatures: false })
  return {
    transaction: serialized.toString('base64'),
    mintAddress: mint.publicKey.toBase58()
  }
}

/** Build registration transaction: fee transfer + memo record. */
async function buildRegistrationTx(fromPubkey, toPubkey, lamports, payload) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const { Transaction, SystemProgram, PublicKey, TransactionInstruction } = require('@solana/web3.js')
  const from = new PublicKey(fromPubkey)
  const to = new PublicKey(toPubkey)

  const tx = new Transaction()
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Number(lamports) }))

  const text = `RealmRegistry:REGISTRATION_REQUEST:${payload.ownerName}:${payload.district}:${payload.municipality}:${payload.ward}:${payload.tole}`
  tx.add(new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(text, 'utf8')
  }))

  const { blockhash } = await withRpcRetry((conn) => conn.getLatestBlockhash())
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Build unsigned fee-transfer transaction for client to sign. */
async function buildFeeTransferTx(fromPubkey, toPubkey, lamports) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const { Transaction, SystemProgram, PublicKey } = require('@solana/web3.js')
  const from = typeof fromPubkey === 'string' ? new PublicKey(fromPubkey) : fromPubkey
  const to = typeof toPubkey === 'string' ? new PublicKey(toPubkey) : toPubkey
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Number(lamports) })
  )
  const { blockhash } = await withRpcRetry((conn) => conn.getLatestBlockhash())
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Submit a signed transaction (base64) and return signature. */
async function submitSignedTx(signedTxBase64) {
  if (!connection || !RPC_ENDPOINTS.length) throw new Error('Solana RPC not configured')
  const buffer = Buffer.from(signedTxBase64, 'base64')
  const sig = await withRpcRetry((conn) => conn.sendRawTransaction(buffer, { skipPreflight: false }))
  await withRpcRetry((conn) => conn.confirmTransaction(sig))
  return sig
}

module.exports = {
  buildFeeTransferTx,
  buildRegistrationTx,
  buildNFTTransferTx,
  buildRegistrationMintTx,
  submitSignedTx,
  verifyGovernanceExecution,
  verifyGovernanceProposal,
  verifyParcelAction,
  isConfigured: !!initialized
}
