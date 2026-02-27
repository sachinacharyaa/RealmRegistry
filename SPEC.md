# RealmRegistry Authority-First Specification

## Project Overview

- **Project Name**: RealmRegistry
- **Type**: Municipality land registry (Web3 + DAO governance)
- **Core Rule**: No centralized admin keys
- **Authority Source**: Realms DAO governance execution only

## DAO Requirements

- DAO name: `Nepal Land Authority DAO`
- Governance mode: `Council`
- Council members: `2` government officers
- Vote threshold: `2/2`
- Voting window: `24-48 hours`
- Token economy: not required

## Authority Architecture

### Before (disallowed)

Admin wallet -> officer approval -> state mutation

### After (required)

Realms DAO proposal -> council vote passes -> governance execution tx -> verified backend state mutation

## Authority Targets

1. Land NFT mint authority must be governance-controlled.
2. Transfer approval must be governance execution only.
3. Parcel freeze authority must be governance execution only.
4. Program upgrade authority must be Realms Governance PDA.

## Assigned Wallets

- Wallet A (user (Citizens)) Sachin Acharya: `G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw`

- Wallet B (Government Officers-Council Members 1) Hari Prasad Shah: `sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz`

- Wallet C (Government Officers-Council Members 2) Ram Shakya: `6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH`

- Wallet D (The DAO, Real Authority) Gagan Sher Shah: `8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB`

## Council Member Workflow (Wallet B and C)

Officers can:

1. Review citizen requests.
2. Create governance proposals in Realms.
3. Vote on proposals.

Transfer example (built-in governance flow):

1. Citizen (Sachin Acharya, Wallet A) submits transfer request — only Solana network fee required.
2. Council Member 1 (Hari Prasad Shah, Wallet B) clicks **Create Proposal** in the portal.
3. Wallet B clicks **Vote Approve**.
4. Council Member 2 (Ram Shakya, Wallet C) clicks **Vote Approve**.
5. Threshold `2/2` is met — request is ready for DAO Authority.
6. DAO Authority (Gagan Sher Shah, Wallet D) clicks **Approve** — backend mints/executes on Solana.

## Backend Rules

- `PUT /api/whitelist/:id` is disabled.
- `POST /api/governance/execute/:id` is the only approval/rejection path.
- `POST /api/freeze-requests` creates pending freeze requests for DAO workflow.
- `POST /api/council/proposals/:id/create` creates council proposal state for a request.
- `POST /api/council/votes/:id` records council votes.
- `POST /api/solana/build-registration-mint-tx` (alias `/api/solana/build-mint-tx`) builds unsigned NFT mint tx for Wallet D.
- Backend verifies:
  - proposal execution transaction exists and is confirmed
  - transaction includes configured `realm`, `governance`, `governance signer PDA`, `proposal`
  - transaction calls configured `REALMS_GOVERNANCE_PROGRAM_ID`
- For approved registration/transfer/freeze:
  - governance action transaction proof is required
  - required parcel accounts must appear in that action transaction

## MongoDB Model Additions (`whitelist`)

- `governanceProposal`
- `governanceRealm`
- `governanceAccount`
- `governanceSigner`
- `governanceExecutionTxSignature`
- `governanceActionTxSignature`
- `governanceParcelMintAddress`
- `governanceVerifiedSlot`
- `governanceVerifiedAt`
- `governancePaymentTxSignature`

## Environment Requirements

- `REALMS_REALM_PUBKEY`
- `REALMS_GOVERNANCE_PUBKEY`
- `REALMS_GOVERNANCE_SIGNER_PDA`
- `REALMS_GOVERNANCE_PROGRAM_ID`
- `SOLANA_RPC_URL`

## Frontend Rules

- No hardcoded admin wallet allowlist for approvals.
- Council panel is shown to configured council wallets for workflow UX.
- Wallet B (Hari Prasad Shah) and C (Ram Shakya) UI is officer-flow only (review/propose/vote).
- At first only `Create Proposal` is shown for council member flow.
- Voting action appears only after proposal is created.
- DAO Authority execution unlocks only after `2/2` council approvals.
- Wallet D (Gagan Sher Shah) UI is DAO authority execution flow only.
- Citizen submission (Wallet A) requires no protocol fee — only Solana network fee (~0.000005 SOL).
- Council proposal creation and voting is done entirely within the built-in portal — no external Realms.today dependency.
- Names are surfaced in the navbar when the respective wallet is connected.
