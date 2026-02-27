# RealmRegistry (Authority-First)

RealmRegistry is a municipal land registry where authority is controlled by a **Realms DAO**, not by admin wallets.

## Governance Model

- DAO name example: `Land Authority DAO`
- Governance mode: `Council`
- Council members: `2` government officers
- Vote threshold: `2/2`
- Voting window: `24-48 hours`
- Token economy: not required


## If you want to try on your Localhost, use your Assigned Wallets

- Wallet A (user (Citizens)): `here`

- Wallet B (Government Officers-Council Members 1): `here`

- Wallet C (Government Officers-Council Members 2): `here`

- Wallet D (The DAO, Real Authority): `here`

And Give command to coding agent, assign roles and permissions to each wallet.


## Core Principle

No centralized admin key can directly approve or mint.

Every sensitive action must follow:

1. Citizen submits request.
2. Council votes in Realms.
3. Proposal passes.
4. Governance execution transaction is submitted.
5. Backend verifies execution proof on-chain, then updates registry state.


## Officer Workflow (Wallet B and C)

Officers can:

1. Review citizen requests.
2. Create governance proposals in Realms.
3. Vote on proposals in Realms.

Transfer example:

1. Citizen submits transfer request.
2. Only `Create Proposal` action is available first.
3. After proposal is created, both council members get `Vote Approve`.
4. Council votes: Officer 1 = Yes, Officer 2 = Yes.
5. Threshold `2/2` passes and request becomes ready for DAO authority.
6. DAO Authority wallet executes the passed proposal path.

## What This Repo Implements

- `frontend/`: React app for explorer, citizen portal, and council execution UI.
- `backend/`: Express + MongoDB API.
- Solana transaction verification in `backend/solana.js`:
  - verifies Realms execution transaction contains configured governance accounts
  - verifies parcel mint/transfer action transactions contain required accounts

## Required Environment (Backend)

Use `backend/.env.example` and set:

- `SOLANA_RPC_URL`
- `REALMS_REALM_PUBKEY`
- `REALMS_GOVERNANCE_PUBKEY`
- `REALMS_GOVERNANCE_SIGNER_PDA`
- `REALMS_GOVERNANCE_PROGRAM_ID`

Optional:

- `FEE_CITIZEN_SOL`
- `FEE_GOVERNANCE_EXECUTION_SOL`
- `TREASURY_WALLET`
- `ENABLE_DEMO_SEED`

## API Notes

- `POST /api/whitelist`: citizen registration/transfer request submission.
- `POST /api/freeze-requests`: create a freeze request for DAO vote/execution.
- `POST /api/council/proposals/:id/create`: council member creates proposal step.
- `POST /api/council/votes/:id`: council member vote step (`approved`/`rejected`).
- `POST /api/governance/execute/:id`: DAO-only execution path (requires proposal + execution proof).
- `POST /api/solana/build-registration-mint-tx` (alias: `/api/solana/build-mint-tx`): builds an NFT mint tx for Wallet D to sign in-app.
- `PUT /api/whitelist/:id`: disabled intentionally (returns 410).
- `GET /api/governance/config`: returns DAO/governance configuration for UI.

If `REALMS_*` is not configured, Wallet D fallback is allowed after `2/2` council approvals:

1. Wallet D clicks approve.
2. App builds mint tx on backend and opens Wallet D for signing.
3. Signed tx is submitted to Solana and saved as execution proof.

## Run Locally

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Authority Guarantees

- No hardcoded admin wallet allowlist is used for approvals.
- Direct approval endpoint is disabled.
- Council action requires Realms execution proof.
- Parcel mint, transfer, and freeze state updates require governance-linked transaction evidence.
- Program upgrade authority must be set on-chain to the Realms Governance PDA.
