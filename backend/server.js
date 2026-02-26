require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const solana = require('./solana');

const app = express();
app.use(cors());
app.use(express.json());

// Fee config: citizen pays when submitting; DAO execution can optionally include a governance fee.
const FEE_CITIZEN_SOL = parseFloat(process.env.FEE_CITIZEN_SOL || '0');
const FEE_GOVERNANCE_EXECUTION_SOL = parseFloat(process.env.FEE_GOVERNANCE_EXECUTION_SOL || process.env.FEE_ADMIN_SOL || '0');
const ENABLE_DEMO_SEED = process.env.ENABLE_DEMO_SEED === 'true';
const REALMS_REALM_PUBKEY = process.env.REALMS_REALM_PUBKEY || '';
const REALMS_GOVERNANCE_PUBKEY = process.env.REALMS_GOVERNANCE_PUBKEY || '';
const REALMS_GOVERNANCE_SIGNER_PDA = process.env.REALMS_GOVERNANCE_SIGNER_PDA || '';
const REALMS_GOVERNANCE_PROGRAM_ID = process.env.REALMS_GOVERNANCE_PROGRAM_ID || '';
const ASSIGNED_WALLET_A = process.env.EXAMPLE_CITIZEN_WALLET || 'G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw';
const ASSIGNED_WALLET_B = process.env.COUNCIL_MEMBER_1_WALLET || 'sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz';
const ASSIGNED_WALLET_C = process.env.COUNCIL_MEMBER_2_WALLET || '6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH';
const ASSIGNED_WALLET_D = process.env.DAO_AUTHORITY_WALLET || '8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB';
const DAO_AUTHORITY_WALLET = ASSIGNED_WALLET_D;
const TREASURY_WALLET = process.env.TREASURY_WALLET || DAO_AUTHORITY_WALLET;
const EXAMPLE_CITIZEN_WALLET = ASSIGNED_WALLET_A;
const COUNCIL_MEMBER_WALLETS = (process.env.REALMS_COUNCIL_WALLETS || `${ASSIGNED_WALLET_B},${ASSIGNED_WALLET_C}`)
  .split(',')
  .map((w) => w.trim())
  .filter(Boolean);
const REQUIRED_COUNCIL_APPROVALS = COUNCIL_MEMBER_WALLETS.length || 2;
const ASSIGNED_WALLETS = [
  {
    key: 'A',
    label: 'Wallet A - Citizen',
    name: '',
    role: 'citizen',
    address: ASSIGNED_WALLET_A
  },
  {
    key: 'B',
    label: 'Wallet B - Council Member 1',
    name: '',
    role: 'council_member',
    address: ASSIGNED_WALLET_B
  },
  {
    key: 'C',
    label: 'Wallet C - Council Member 2',
    name: '',
    role: 'council_member',
    address: ASSIGNED_WALLET_C
  },
  {
    key: 'D',
    label: 'Wallet D - DAO Authority',
    name: '',
    role: 'dao_authority',
    address: ASSIGNED_WALLET_D
  }
];
const GOVERNANCE_DAO_NAME = process.env.GOVERNANCE_DAO_NAME || 'Land Authority DAO';
const GOVERNANCE_MODEL = process.env.GOVERNANCE_MODEL || 'council';
const GOVERNANCE_COUNCIL_MEMBERS = process.env.GOVERNANCE_COUNCIL_MEMBERS || '2';
const GOVERNANCE_VOTING_THRESHOLD = process.env.GOVERNANCE_VOTING_THRESHOLD || '2/2';
const GOVERNANCE_VOTING_WINDOW_HOURS = parseInt(process.env.GOVERNANCE_VOTING_WINDOW_HOURS || '48', 10);

const MONGO_URI = 'mongodb+srv://sachinacharya365official_db_user:kEX4fEHa1FNjVyWt@cluster0.k8tooiv.mongodb.net/onChain-RealmRegistry';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const parcelSchema = new mongoose.Schema({
  tokenId: Number,
  ownerName: String,
  ownerWallet: String,
  location: {
    province: String,
    district: String,
    municipality: String,
    ward: Number,
    tole: String
  },
  size: {
    bigha: Number,
    kattha: Number,
    dhur: Number
  },
  documentHash: String,
  transactionHash: String,
  mintAddress: String,
  status: { type: String, default: 'registered' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const whitelistSchema = new mongoose.Schema({
  walletAddress: String,
  ownerName: String,
  requestType: { type: String, default: 'whitelist' },
  status: { type: String, default: 'pending' },
  location: {
    district: String,
    municipality: String,
    ward: Number,
    tole: String
  },
  size: {
    bigha: Number,
    kattha: Number,
    dhur: Number
  },
  toWallet: String,
  toName: String,
  parcelId: String,
  freezeReason: String,
  paymentTxSignature: String,      // citizen SOL fee tx (proof of payment)
  governancePaymentTxSignature: String, // optional governance execution fee tx
  governanceProposal: String,
  governanceRealm: String,
  governanceAccount: String,
  governanceSigner: String,
  governanceExecutionTxSignature: String,
  governanceActionTxSignature: String, // mint/transfer tx executed after proposal passes
  governanceParcelMintAddress: String, // required for approved registration
  governanceVerifiedSlot: Number,
  governanceVerifiedAt: Date,
  councilWorkflow: {
    proposalCreated: { type: Boolean, default: false },
    proposalCreatedBy: String,
    proposalCreatedAt: Date,
    proposalAddress: String,
    proposalState: { type: String, default: 'pending' },
    requiredApprovals: { type: Number, default: REQUIRED_COUNCIL_APPROVALS },
    votes: [
      {
        walletAddress: String,
        vote: String,
        votedAt: Date
      }
    ],
    approvalCount: { type: Number, default: 0 },
    readyForDaoAuthority: { type: Boolean, default: false }
  },
  adminPaymentTxSignature: String, // legacy field kept for backward compatibility
  nftTransferSignature: String,    // legacy field kept for backward compatibility
  createdAt: { type: Date, default: Date.now }
});

const Parcel = mongoose.model('Parcel', parcelSchema);
const Whitelist = mongoose.model('Whitelist', whitelistSchema);

const resolveParcelByIdOrToken = async (parcelId) => {
  if (!parcelId) return null;
  let parcel = null;
  const idText = String(parcelId).trim();
  if (mongoose.Types.ObjectId.isValid(idText)) {
    parcel = await Parcel.findById(idText);
  }
  if (!parcel) {
    const tokenId = Number(idText);
    if (Number.isFinite(tokenId)) {
      parcel = await Parcel.findOne({ tokenId });
    }
  }
  return parcel;
};

const governanceConfigured = Boolean(
  REALMS_REALM_PUBKEY &&
  REALMS_GOVERNANCE_PUBKEY &&
  REALMS_GOVERNANCE_SIGNER_PDA &&
  REALMS_GOVERNANCE_PROGRAM_ID
);

const requireGovernanceConfig = (res) => {
  if (!governanceConfigured) {
    res.status(503).json({
      error: 'Realms governance is not configured. Set REALMS_REALM_PUBKEY, REALMS_GOVERNANCE_PUBKEY, REALMS_GOVERNANCE_SIGNER_PDA, and REALMS_GOVERNANCE_PROGRAM_ID.'
    });
    return false;
  }
  if (!solana.isConfigured) {
    res.status(503).json({ error: 'Solana RPC is not configured. Set SOLANA_RPC_URL to verify governance execution.' });
    return false;
  }
  return true;
};

const createInitialCouncilWorkflow = () => ({
  proposalCreated: false,
  proposalCreatedBy: '',
  proposalCreatedAt: null,
  proposalAddress: '',
  proposalState: 'pending',
  requiredApprovals: REQUIRED_COUNCIL_APPROVALS,
  votes: [],
  approvalCount: 0,
  readyForDaoAuthority: false
});

const normalizeCouncilWorkflow = (request) => {
  const current = request.councilWorkflow || {};
  const votes = Array.isArray(current.votes)
    ? current.votes
      .filter((v) => v && typeof v.walletAddress === 'string')
      .map((v) => ({
        walletAddress: v.walletAddress,
        vote: v.vote === 'approved' ? 'approved' : 'rejected',
        votedAt: v.votedAt ? new Date(v.votedAt) : new Date()
      }))
    : [];

  const uniqueVotes = [];
  const seen = new Set();
  for (const vote of votes) {
    if (!seen.has(vote.walletAddress)) {
      seen.add(vote.walletAddress);
      uniqueVotes.push(vote);
    }
  }

  const approvalCount = uniqueVotes.filter((v) => v.vote === 'approved').length;
  const requiredApprovals = Number(current.requiredApprovals) > 0
    ? Number(current.requiredApprovals)
    : REQUIRED_COUNCIL_APPROVALS;
  const readyForDaoAuthority = Boolean(current.proposalCreated) && approvalCount >= requiredApprovals;

  request.councilWorkflow = {
    proposalCreated: Boolean(current.proposalCreated),
    proposalCreatedBy: current.proposalCreatedBy || '',
    proposalCreatedAt: current.proposalCreatedAt || null,
    proposalAddress: current.proposalAddress || '',
    proposalState: current.proposalState || 'pending',
    requiredApprovals,
    votes: uniqueVotes,
    approvalCount,
    readyForDaoAuthority
  };

  return request.councilWorkflow;
};

app.get('/api/parcels', async (req, res) => {
  try {
    const parcels = await Parcel.find().sort({ createdAt: -1 });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parcels/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }
    const regex = new RegExp(q, 'i');
    const parcels = await Parcel.find({
      $or: [
        { ownerName: regex },
        { 'location.district': regex },
        { 'location.municipality': regex },
        { 'location.tole': regex }
      ]
    }).sort({ createdAt: -1 });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parcels/:id', async (req, res) => {
  try {
    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
    res.json(parcel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parcels/owner/:wallet', async (req, res) => {
  try {
    const parcels = await Parcel.find({ ownerWallet: req.params.wallet }).sort({ createdAt: -1 });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fee-config', (req, res) => {
  res.json({
    citizenFeeSol: FEE_CITIZEN_SOL,
    governanceExecutionFeeSol: FEE_GOVERNANCE_EXECUTION_SOL,
    adminFeeSol: FEE_GOVERNANCE_EXECUTION_SOL, // legacy alias for existing frontend
    treasuryWallet: TREASURY_WALLET,
    solanaConfigured: solana.isConfigured,
    governanceConfigured
  });
});

app.get('/api/governance/config', (req, res) => {
  res.json({
    daoName: GOVERNANCE_DAO_NAME,
    model: GOVERNANCE_MODEL,
    councilMembers: GOVERNANCE_COUNCIL_MEMBERS,
    votingThreshold: GOVERNANCE_VOTING_THRESHOLD,
    votingWindowHours: GOVERNANCE_VOTING_WINDOW_HOURS,
    councilWallets: COUNCIL_MEMBER_WALLETS,
    realm: REALMS_REALM_PUBKEY || null,
    governance: REALMS_GOVERNANCE_PUBKEY || null,
    governanceSigner: REALMS_GOVERNANCE_SIGNER_PDA || null,
    governanceProgramId: REALMS_GOVERNANCE_PROGRAM_ID || null,
    authorityWallet: DAO_AUTHORITY_WALLET,
    treasuryWallet: TREASURY_WALLET,
    exampleCitizenWallet: EXAMPLE_CITIZEN_WALLET,
    assignedWallets: ASSIGNED_WALLETS,
    governanceConfigured
  });
});

// Fee tx via backend so frontend does not need Solana RPC (avoids "network unreachable" in browser)
app.post('/api/solana/build-registration-tx', async (req, res) => {
  try {
    const { fromPubkey, toPubkey, lamports, payload } = req.body;
    if (!fromPubkey || !toPubkey || lamports == null || !payload) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const transaction = await solana.buildRegistrationTx(fromPubkey, toPubkey, lamports, payload);
    res.json({ transaction });
  } catch (err) {
    if (err.message && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Solana RPC not configured. Set SOLANA_RPC_URL in backend .env' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/solana/build-fee-tx', async (req, res) => {
  try {
    const { fromPubkey, toPubkey, lamports } = req.body;
    if (!fromPubkey || !toPubkey || lamports == null) {
      return res.status(400).json({ error: 'Missing fromPubkey, toPubkey, or lamports' });
    }
    const transaction = await solana.buildFeeTransferTx(fromPubkey, toPubkey, lamports);
    res.json({ transaction });
  } catch (err) {
    if (err.message && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Solana RPC not configured. Set SOLANA_RPC_URL in backend .env' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/solana/build-nft-transfer-tx', async (req, res) => {
  try {
    const { mintAddress, fromPubkey, toPubkey } = req.body;
    if (!mintAddress || !fromPubkey || !toPubkey) {
      return res.status(400).json({ error: 'Missing mintAddress, fromPubkey, or toPubkey' });
    }
    const transaction = await solana.buildNFTTransferTx(mintAddress, fromPubkey, toPubkey);
    res.json({ transaction });
  } catch (err) {
    if (err.message && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Solana RPC not configured. Set SOLANA_RPC_URL in backend .env' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/solana/build-registration-mint-tx', '/api/solana/build-mint-tx'], async (req, res) => {
  try {
    const fromPubkey = req.body?.fromPubkey ? String(req.body.fromPubkey).trim() : '';
    const toPubkey = req.body?.toPubkey ? String(req.body.toPubkey).trim() : '';
    if (!fromPubkey || !toPubkey) {
      return res.status(400).json({ error: 'Missing fromPubkey or toPubkey' });
    }
    const data = await solana.buildRegistrationMintTx(fromPubkey, toPubkey);
    res.json(data);
  } catch (err) {
    if (err.message && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Solana RPC not configured. Set SOLANA_RPC_URL in backend .env' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/solana/submit-signed-tx', async (req, res) => {
  try {
    const { signedTransaction } = req.body;
    if (!signedTransaction) return res.status(400).json({ error: 'Missing signedTransaction (base64)' });
    const signature = await solana.submitSignedTx(signedTransaction);
    res.json({ signature });
  } catch (err) {
    if (err.message && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Solana RPC not configured' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whitelist', async (req, res) => {
  try {
    const requests = await Whitelist.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whitelist', async (req, res) => {
  try {
    const { walletAddress, ownerName, requestType, location, size, toWallet, toName, parcelId, freezeReason, paymentTxSignature, nftTransferSignature } = req.body;
    const normalizedType = requestType || 'whitelist';

    if ((normalizedType === 'registration' || normalizedType === 'transfer') && !paymentTxSignature) {
      return res.status(400).json({ error: 'Payment required. Send SOL fee first and include paymentTxSignature.' });
    }

    let resolvedParcel = null;

    if (normalizedType === 'transfer') {
      if (!parcelId || !toWallet || !toName) {
        return res.status(400).json({ error: 'Transfer requests require parcelId, toWallet, and toName.' });
      }
      resolvedParcel = await resolveParcelByIdOrToken(parcelId);
      if (!resolvedParcel) return res.status(404).json({ error: 'Parcel not found.' });
      if (resolvedParcel.status === 'frozen') {
        return res.status(400).json({ error: 'Parcel is frozen and cannot be transferred.' });
      }
      if (walletAddress && resolvedParcel.ownerWallet && resolvedParcel.ownerWallet !== walletAddress) {
        return res.status(403).json({ error: 'Only the current parcel owner can submit transfer requests.' });
      }
    }

    if (normalizedType === 'freeze') {
      if (!parcelId) return res.status(400).json({ error: 'Freeze requests require parcelId.' });
      resolvedParcel = await resolveParcelByIdOrToken(parcelId);
      if (!resolvedParcel) return res.status(404).json({ error: 'Parcel not found.' });
    }

    const request = new Whitelist({
      walletAddress,
      ownerName,
      requestType: normalizedType,
      location,
      size,
      toWallet,
      toName,
      parcelId: normalizedType === 'transfer' || normalizedType === 'freeze'
        ? (resolvedParcel?._id?.toString() || parcelId)
        : parcelId,
      freezeReason,
      paymentTxSignature,
      councilWorkflow: createInitialCouncilWorkflow(),
      nftTransferSignature // Real NFT transfer to escrow (optional if dev-mode)
    });
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freeze-requests', async (req, res) => {
  try {
    const { walletAddress, parcelId, freezeReason } = req.body;
    if (!walletAddress || !parcelId) {
      return res.status(400).json({ error: 'walletAddress and parcelId are required' });
    }
    const parcel = await resolveParcelByIdOrToken(parcelId);
    if (!parcel) return res.status(404).json({ error: 'Parcel not found.' });

    const request = new Whitelist({
      walletAddress,
      ownerName: parcel.ownerName,
      requestType: 'freeze',
      location: parcel.location,
      size: parcel.size,
      parcelId: parcel._id.toString(),
      freezeReason: freezeReason || 'Freeze requested by council for review.',
      councilWorkflow: createInitialCouncilWorkflow()
    });

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/council/proposals/:id/create', async (req, res) => {
  try {
    const { walletAddress, proposalAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    if (!COUNCIL_MEMBER_WALLETS.includes(walletAddress)) {
      return res.status(403).json({ error: 'Only assigned council member wallets can create proposals.' });
    }

    const request = await Whitelist.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const workflow = normalizeCouncilWorkflow(request);
    if (workflow.proposalCreated) {
      return res.status(400).json({ error: 'Proposal already created for this request.' });
    }

    request.councilWorkflow = {
      ...workflow,
      proposalCreated: true,
      proposalCreatedBy: walletAddress,
      proposalCreatedAt: new Date(),
      proposalAddress: proposalAddress ? String(proposalAddress).trim() : workflow.proposalAddress || '',
      approvalCount: 0,
      votes: [],
      readyForDaoAuthority: false
    };

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link an existing Realms proposal to a whitelist request after it has been created in Realms.
app.post('/api/council/proposals/:id/link-proposal', async (req, res) => {
  try {
    const { walletAddress, proposalAddress } = req.body;
    if (!walletAddress || !proposalAddress) {
      return res.status(400).json({ error: 'walletAddress and proposalAddress are required' });
    }
    if (!COUNCIL_MEMBER_WALLETS.includes(walletAddress)) {
      return res.status(403).json({ error: 'Only assigned council member wallets can link proposals.' });
    }
    if (!requireGovernanceConfig(res)) {
      return;
    }

    const request = await Whitelist.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const trimmedProposal = String(proposalAddress).trim();
    if (!trimmedProposal) {
      return res.status(400).json({ error: 'Proposal public key is required.' });
    }

    const verification = await solana.verifyGovernanceProposal({
      proposal: trimmedProposal,
      governance: REALMS_GOVERNANCE_PUBKEY,
      governanceProgramId: REALMS_GOVERNANCE_PROGRAM_ID
    });

    if (!verification.ok) {
      return res.status(400).json({ error: verification.reason || 'Invalid proposal address' });
    }

    const workflow = normalizeCouncilWorkflow(request);
    request.councilWorkflow = {
      ...workflow,
      proposalCreated: true,
      proposalCreatedBy: walletAddress,
      proposalCreatedAt: new Date(),
      proposalAddress: trimmedProposal,
      proposalState: verification.isVoting ? 'voting' : 'pending',
      // keep votes and readiness unchanged
      votes: workflow.votes,
      approvalCount: workflow.approvalCount,
      readyForDaoAuthority: workflow.readyForDaoAuthority
    };

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/council/votes/:id', async (req, res) => {
  try {
    const { walletAddress, vote } = req.body;
    if (!walletAddress || !vote) {
      return res.status(400).json({ error: 'walletAddress and vote are required' });
    }
    if (!COUNCIL_MEMBER_WALLETS.includes(walletAddress)) {
      return res.status(403).json({ error: 'Only assigned council member wallets can vote.' });
    }
    if (!['approved', 'rejected'].includes(vote)) {
      return res.status(400).json({ error: 'vote must be approved or rejected' });
    }

    const request = await Whitelist.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const workflow = normalizeCouncilWorkflow(request);
    if (!workflow.proposalCreated) {
      return res.status(400).json({ error: 'Create proposal first.' });
    }
    if (workflow.votes.some((v) => v.walletAddress === walletAddress)) {
      return res.status(400).json({ error: 'This council member has already voted.' });
    }

    const nextVotes = [
      ...workflow.votes,
      { walletAddress, vote, votedAt: new Date() }
    ];
    const approvalCount = nextVotes.filter((v) => v.vote === 'approved').length;
    const readyForDaoAuthority = approvalCount >= workflow.requiredApprovals;

    request.councilWorkflow = {
      ...workflow,
      votes: nextVotes,
      approvalCount,
      readyForDaoAuthority
    };

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const applyGovernanceDecision = async (request, status, governanceMeta) => {
  request.status = status;
  request.governanceProposal = governanceMeta.proposalAddress;
  request.governanceRealm = REALMS_REALM_PUBKEY;
  request.governanceAccount = REALMS_GOVERNANCE_PUBKEY;
  request.governanceSigner = REALMS_GOVERNANCE_SIGNER_PDA;
  request.governanceExecutionTxSignature = governanceMeta.executionTxSignature;
  request.governanceActionTxSignature = governanceMeta.governanceActionTxSignature || undefined;
  request.governanceParcelMintAddress = governanceMeta.parcelMintAddress || undefined;
  request.governanceVerifiedSlot = governanceMeta.verifiedSlot;
  request.governanceVerifiedAt = new Date();
  if (governanceMeta.paymentTxSignature) {
    request.governancePaymentTxSignature = governanceMeta.paymentTxSignature;
    request.adminPaymentTxSignature = governanceMeta.paymentTxSignature; // legacy alias
  }

  if (status === 'approved' && request.requestType === 'registration') {
    if (!governanceMeta.governanceActionTxSignature || !governanceMeta.parcelMintAddress) {
      throw new Error('Approved registration requires governanceActionTxSignature and parcelMintAddress.');
    }

    const actionCheck = await solana.verifyParcelAction({
      signature: governanceMeta.governanceActionTxSignature,
      requiredAccounts: [request.walletAddress, governanceMeta.parcelMintAddress, REALMS_GOVERNANCE_SIGNER_PDA]
    });

    if (!actionCheck.ok) {
      throw new Error(`Mint action verification failed: ${actionCheck.reason}`);
    }

    const tokenId = (await Parcel.countDocuments()) + 1;
    const newParcel = new Parcel({
      tokenId,
      ownerName: request.ownerName,
      ownerWallet: request.walletAddress,
      location: request.location,
      size: request.size,
      documentHash: 'Qm' + Date.now(),
      transactionHash: governanceMeta.governanceActionTxSignature,
      mintAddress: governanceMeta.parcelMintAddress,
      status: 'registered',
      updatedAt: new Date()
    });
    await newParcel.save();
  }

  if (status === 'approved' && request.requestType === 'transfer' && request.parcelId) {
    if (!governanceMeta.governanceActionTxSignature) {
      throw new Error('Approved transfer requires governanceActionTxSignature.');
    }

    const parcel = await resolveParcelByIdOrToken(request.parcelId);
    if (!parcel) throw new Error('Parcel not found for transfer request.');
    if (parcel.status === 'frozen') throw new Error('Parcel is frozen and cannot be transferred.');

    const requiredAccounts = [request.walletAddress, request.toWallet, REALMS_GOVERNANCE_SIGNER_PDA];
    if (parcel.mintAddress) requiredAccounts.push(parcel.mintAddress);

    const actionCheck = await solana.verifyParcelAction({
      signature: governanceMeta.governanceActionTxSignature,
      requiredAccounts
    });

    if (!actionCheck.ok) {
      throw new Error(`Transfer action verification failed: ${actionCheck.reason}`);
    }

    parcel.ownerWallet = request.toWallet;
    parcel.ownerName = request.toName;
    parcel.transactionHash = governanceMeta.governanceActionTxSignature;
    parcel.updatedAt = new Date();
    await parcel.save();
  }

  if (status === 'approved' && request.requestType === 'freeze' && request.parcelId) {
    if (!governanceMeta.governanceActionTxSignature) {
      throw new Error('Approved freeze requires governanceActionTxSignature.');
    }
    const parcel = await resolveParcelByIdOrToken(request.parcelId);
    if (!parcel) throw new Error('Parcel not found for freeze request.');

    const requiredAccounts = [parcel.ownerWallet, REALMS_GOVERNANCE_SIGNER_PDA];
    if (parcel.mintAddress) requiredAccounts.push(parcel.mintAddress);

    const actionCheck = await solana.verifyParcelAction({
      signature: governanceMeta.governanceActionTxSignature,
      requiredAccounts
    });
    if (!actionCheck.ok) {
      throw new Error(`Freeze action verification failed: ${actionCheck.reason}`);
    }

    parcel.status = 'frozen';
    parcel.updatedAt = new Date();
    await parcel.save();
  }

  await request.save();
  return request;
};

app.put('/api/whitelist/:id', async (req, res) => {
  res.status(410).json({
    error: 'Direct admin approvals are disabled. Use /api/governance/execute/:id with Realms DAO execution proof.'
  });
});

app.post('/api/governance/execute/:id', async (req, res) => {
  try {
    if (!solana.isConfigured) {
      return res.status(503).json({ error: 'Solana RPC is not configured. Set SOLANA_RPC_URL to execute DAO actions.' });
    }

    const {
      status,
      proposalAddress,
      executionTxSignature,
      governanceActionTxSignature,
      parcelMintAddress,
      paymentTxSignature,
      executorWalletAddress
    } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }
    if (!executorWalletAddress) {
      return res.status(400).json({ error: 'executorWalletAddress is required' });
    }
    if (executorWalletAddress !== DAO_AUTHORITY_WALLET) {
      return res.status(403).json({ error: 'Only DAO authority wallet can execute governance approvals.' });
    }
    if (FEE_GOVERNANCE_EXECUTION_SOL > 0 && !paymentTxSignature) {
      return res.status(400).json({ error: 'Governance execution fee required. Include paymentTxSignature.' });
    }

    const request = await Whitelist.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }
    const workflow = normalizeCouncilWorkflow(request);
    if (!workflow.readyForDaoAuthority) {
      return res.status(400).json({ error: `Council approvals incomplete (${workflow.approvalCount}/${workflow.requiredApprovals}).` });
    }
    let verifiedSlot = 0;
    let resolvedProposalAddress = (proposalAddress || '').trim();
    let resolvedExecutionTxSignature = (executionTxSignature || '').trim();

    if (governanceConfigured) {
      if (!resolvedProposalAddress || !resolvedExecutionTxSignature) {
        return res.status(400).json({ error: 'proposalAddress and executionTxSignature are required' });
      }
      const governanceCheck = await solana.verifyGovernanceExecution({
        signature: resolvedExecutionTxSignature,
        realm: REALMS_REALM_PUBKEY,
        governance: REALMS_GOVERNANCE_PUBKEY,
        governanceSigner: REALMS_GOVERNANCE_SIGNER_PDA,
        proposal: resolvedProposalAddress,
        governanceProgramId: REALMS_GOVERNANCE_PROGRAM_ID
      });

      if (!governanceCheck.ok) {
        return res.status(403).json({ error: `Governance execution verification failed: ${governanceCheck.reason}` });
      }
      verifiedSlot = governanceCheck.slot;
    } else {
      resolvedProposalAddress = resolvedProposalAddress || request.councilWorkflow?.proposalAddress || `dao-fallback-${request._id}`;
      resolvedExecutionTxSignature = resolvedExecutionTxSignature || governanceActionTxSignature || paymentTxSignature || `dao-fallback-${Date.now()}`;
    }

    const updated = await applyGovernanceDecision(request, status, {
      proposalAddress: resolvedProposalAddress,
      executionTxSignature: resolvedExecutionTxSignature,
      governanceActionTxSignature,
      parcelMintAddress,
      paymentTxSignature,
      verifiedSlot
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const totalParcels = await Parcel.countDocuments();
    const pendingWhitelist = await Whitelist.countDocuments({ status: 'pending', requestType: 'whitelist' });
    const pendingRegistrations = await Whitelist.countDocuments({ status: 'pending', requestType: 'registration' });
    const pendingTransfers = await Whitelist.countDocuments({ status: 'pending', requestType: 'transfer' });
    const pendingFreezes = await Whitelist.countDocuments({ status: 'pending', requestType: 'freeze' });
    const approvedWhitelist = await Whitelist.countDocuments({ status: 'approved' });
    res.json({ totalParcels, pendingWhitelist, pendingRegistrations, pendingTransfers, pendingFreezes, approvedWhitelist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove only parcels #1 and #5 of Sachin Acharya (and related whitelist entries).
app.post(['/api/governance/cleanup-dummy', '/api/admin/cleanup-dummy'], async (req, res) => {
  try {
    const parcelCondition = {
      ownerName: /sachin acharya/i,
      tokenId: { $in: [1, 5] }
    };
    const parcelsToRemove = await Parcel.find(parcelCondition).select('_id');
    const parcelIds = parcelsToRemove.map((p) => p._id.toString());

    const parcelResult = await Parcel.deleteMany(parcelCondition);
    const whitelistResult = await Whitelist.deleteMany({
      parcelId: { $in: parcelIds }
    });

    res.json({
      ok: true,
      parcelsDeleted: parcelResult.deletedCount,
      whitelistDeleted: whitelistResult.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const seedData = async () => {
  const count = await Parcel.countDocuments();
  if (count === 0) {
    const parcels = [
      {
        tokenId: 1,
        ownerName: 'Sachin Acharya',
        ownerWallet: 'G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw',
        location: {
          province: 'Bagmati',
          district: 'Kathmandu',
          municipality: 'Kathmandu Metropolitan',
          ward: 10,
          tole: 'Thamel'
        },
        size: { bigha: 0, kattha: 5, dhur: 2 },
        documentHash: 'Qm1234567890abcdef',
        transactionHash: '5J4rQqyX9z1L3m5n7p2q8r4t6y8u0i1o2p3a4s5d6f7g8h9j0k1l2m3n4o5p6',
        status: 'registered'
      },
      {
        tokenId: 2,
        ownerName: 'Hari Prasad Shah',
        ownerWallet: 'sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz',
        location: {
          province: 'Bagmati',
          district: 'Lalitpur',
          municipality: 'Lalitpur Metropolitan',
          ward: 5,
          tole: 'Patan'
        },
        size: { bigha: 1, kattha: 2, dhur: 5 },
        documentHash: 'Qm0987654321fedcba',
        transactionHash: '6K5sR0z2A4m6n8o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6',
        status: 'registered'
      },
      {
        tokenId: 3,
        ownerName: 'Ram Shakya',
        ownerWallet: '6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH',
        location: {
          province: 'Province 1',
          district: 'Birtamode',
          municipality: 'Birtamode Municipality',
          ward: 8,
          tole: 'Mahendra Chowk'
        },
        size: { bigha: 2, kattha: 0, dhur: 0 },
        documentHash: 'Qmabcdef1234567890',
        transactionHash: '7L6tS1a3B5n7o9p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7',
        status: 'registered'
      }
    ];

    await Parcel.insertMany(parcels);
    console.log('Parcels seeded');

    await Whitelist.deleteMany({});
    console.log('Whitelist cleared');
  }
};

if (ENABLE_DEMO_SEED) {
  seedData();
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
