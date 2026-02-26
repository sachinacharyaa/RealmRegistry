/**
 * Solana helpers for RealmRegistry.
 * Authority is DAO-first: backend verifies governance execution proofs instead of using admin keys.
 */

const SOLANA_RPC = process.env.SOLANA_RPC_URL || ''

let connection = null

function init() {
  if (!SOLANA_RPC) return false
  try {
    const { Connection } = require('@solana/web3.js')
    connection = new Connection(SOLANA_RPC)
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
  if (!connection || !SOLANA_RPC) throw new Error('Solana RPC not configured')
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  })
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

/** Build unsigned SPL transfer transaction for client to sign. */
async function buildNFTTransferTx(mintAddress, fromPubkey, toPubkey) {
  if (!connection || !SOLANA_RPC) throw new Error('Solana RPC not configured')
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

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Build registration transaction: fee transfer + memo record. */
async function buildRegistrationTx(fromPubkey, toPubkey, lamports, payload) {
  if (!connection || !SOLANA_RPC) throw new Error('Solana RPC not configured')
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

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Build unsigned fee-transfer transaction for client to sign. */
async function buildFeeTransferTx(fromPubkey, toPubkey, lamports) {
  if (!connection || !SOLANA_RPC) throw new Error('Solana RPC not configured')
  const { Transaction, SystemProgram, PublicKey } = require('@solana/web3.js')
  const from = typeof fromPubkey === 'string' ? new PublicKey(fromPubkey) : fromPubkey
  const to = typeof toPubkey === 'string' ? new PublicKey(toPubkey) : toPubkey
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Number(lamports) })
  )
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = from
  const serialized = tx.serialize({ requireAllSignatures: false })
  return serialized.toString('base64')
}

/** Submit a signed transaction (base64) and return signature. */
async function submitSignedTx(signedTxBase64) {
  if (!connection || !SOLANA_RPC) throw new Error('Solana RPC not configured')
  const buffer = Buffer.from(signedTxBase64, 'base64')
  const sig = await connection.sendRawTransaction(buffer, { skipPreflight: false })
  await connection.confirmTransaction(sig)
  return sig
}

module.exports = {
  buildFeeTransferTx,
  buildRegistrationTx,
  buildNFTTransferTx,
  submitSignedTx,
  verifyGovernanceExecution,
  verifyParcelAction,
  isConfigured: !!initialized
}
