# RealmRegistry (Authority-First)

RealmRegistry is a municipal land registry where authority is controlled by a **Realms DAO**, not by admin wallets.

## Governance Model

- DAO name example: `Ward-12 Land Authority DAO`
- Governance mode: `Council`
- Council members: `2` government officers
- Vote threshold: `2/2`
- Voting window: `24-48 hours`
- Token economy: not required

## Core Principle

No centralized admin key can directly approve or mint.

Every sensitive action must follow:

1. Citizen submits request.
2. Council votes in Realms.
3. Proposal passes.
4. Governance execution transaction is submitted.
5. Backend verifies execution proof on-chain, then updates registry state.

## Assigned Wallets

- Wallet A (user (Citizens)) Sachin Acharya: `G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw`

- Wallet B (Government Officers-Council Members 1) Hari Prasad Shah: `sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz`

- Wallet C (Government Officers-Council Members 2) Ram Shakya: `6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH`

- Wallet D (The DAO, Real Authority) Gagan Sher shah: `8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB`

## Officer Workflow (Wallet B and C)

Officers can:

1. Review citizen requests.
2. Create governance proposals in Realms.
3. Vote on proposals in Realms.

Transfer example:

1. Citizen submits transfer request.
2. Any officer creates proposal in Realms: `Approve transfer of Parcel #123 from A -> B`.
3. Council votes: Officer 1 = Yes, Officer 2 = Yes.
4. Threshold `2/2` passes.
5. DAO Authority wallet executes the passed proposal path.

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
