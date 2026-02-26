# RealmRegistry Authority-First Specification

## Project Overview

- **Project Name**: RealmRegistry
- **Type**: Municipality land registry (Web3 + DAO governance)
- **Core Rule**: No centralized admin keys
- **Authority Source**: Realms DAO governance execution only

## DAO Requirements

- DAO name example: `Ward-12 Land Authority DAO`
- Governance mode: `Council`
- Council members: `3-5` government officers
- Vote threshold: `2/3`
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

- Citizen (Wallet A): `G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw`
- Council Member 1: `sDHAt4Sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz`
- Council Member 2: `6jaM7rGsMgk81pogFqMAGj7K8AByW8tQTTEnmDYFQpbH`
- DAO Authority (Wallet D): `8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB`

## Backend Rules

- `PUT /api/whitelist/:id` is disabled.
- `POST /api/governance/execute/:id` is the only approval/rejection path.
- `POST /api/freeze-requests` creates pending freeze requests for DAO workflow.
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
- Council execution flow prompts for:
  - Realms proposal address
  - governance execution tx signature
  - governance action tx signature (and mint address for registration approvals)
- UI copy must reflect DAO council governance flow.
