# RealmRegistry (Authority-First)

RealmRegistry is a municipal land registry where authority is controlled by a **Realms DAO**, not by admin wallets.

## Governance Model

- Municipality DAO example: `Ward-12 Land Authority DAO`
- Governance style: `Council`
- Council size: `3-5 officers`
- Vote threshold: `2/3`
- Voting window: `24-48 hours`
- Token economy: `not required` (council governance only)

## Core Principle

No centralized admin key can directly approve or mint.

Every sensitive action must follow:

1. Citizen submits request.
2. Council votes in Realms.
3. Proposal passes.
4. Governance execution transaction is submitted.
5. Backend verifies execution proof on-chain, then updates registry state.

## Assigned Wallets

- Citizen (Wallet A): `G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw`
- Council Member 1: `sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz`
- Council Member 2: `6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH`
- DAO Authority (Wallet D): `8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB`

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
- `POST /api/governance/execute/:id`: DAO-only execution path (requires proposal + execution proof).
- `PUT /api/whitelist/:id`: disabled intentionally (returns 410).
- `GET /api/governance/config`: returns DAO/governance configuration for UI.

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
