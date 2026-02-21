# JaggaChain - Land Registry Platform Specification

## Project Overview
- **Project Name**: JaggaChain
- **Type**: Web3 Blockchain Land Registry DApp
- **Core Functionality**: Decentralized land ownership management on Solana blockchain, tokenizing land parcels as NFTs
- **Target Users**: Citizens, Government Authorities, General Public

## Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: MongoDB (mongodb+srv://sachinacharya365official_db_user:kEX4fEHa1FNjVyWt@cluster0.k8tooiv.mongodb.net/onChain-Jagga)

## UI/UX Specification

### Color Palette
- **Primary**: #DC2626 (Nepal Red)
- **Secondary**: #1E3A8A (Deep Blue)
- **Accent**: #F59E0B (Golden Yellow)
- **Background**: #F8FAFC (Light Gray)
- **Card Background**: #FFFFFF
- **Text Primary**: #1F2937
- **Text Secondary**: #6B7280
- **Success**: #10B981
- **Warning**: #F59E0B

### Typography
- **Headings**: 'Madhura', serif (Nepalese style) - fallback to 'Noto Sans', sans-serif
- **Body**: 'Noto Sans', sans-serif
- **Sizes**: H1: 2.5rem, H2: 2rem, H3: 1.5rem, Body: 1rem

### Layout Structure
- **Header**: Fixed top, red background with waving Nepal flag, logo, navigation
- **Sidebar**: Left side navigation (desktop), bottom nav (mobile)
- **Main Content**: Fluid width with max-width 1400px
- **Footer**: Government-style footer with links

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Visual Effects
- Waving Nepal flag animation in header
- Card hover elevation: translateY(-4px), shadow-lg
- Smooth transitions: 300ms ease
- Government-style crisp borders and structured layout

## Pages & Components

### 1. Explorer Page
- Search bar with input for owner name or location
- Grid display of land parcels
- Each parcel card shows:
  - Land ID/Plot Number
  - Owner Name
  - Location (District, Municipality)
  - Size (in Anna/Dhur)
  - Status badge
  - Transaction hash (truncated)

### 2. My Parcel Page (Citizen Dashboard)
- Connected wallet display
- List of owned parcels
- Each parcel shows:
  - Parcel ID
  - Land details
  - Current owner
  - Transfer history
- Transfer button to initiate transfer

### 3. Government Page (Admin Dashboard)
- Total registered lands counter
- Pending whitelist requests list
- Approve/Reject buttons for whitelist
- Statistics cards

### 4. Navigation
- Tabs: Explorer | My Parcels | Government
- Current wallet address display (truncated)

## Functionality Specification

### Backend API Endpoints
1. `GET /api/parcels` - Get all parcels
2. `GET /api/parcels/search?q=` - Search parcels by name/location
3. `GET /api/parcels/:id` - Get single parcel
4. `GET /api/parcels/owner/:wallet` - Get parcels by owner
5. `GET /api/whitelist` - Get whitelist requests
6. `POST /api/whitelist` - Add to whitelist
7. `PUT /api/whitelist/:id` - Approve/reject whitelist
8. `GET /api/stats` - Get statistics

### Data Models

#### Parcel
```javascript
{
  id: String,
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
  status: "registered" | "transferred",
  createdAt: Date,
  updatedAt: Date
}
```

#### Whitelist
```javascript
{
  walletAddress: String,
  ownerName: String,
  status: "pending" | "approved" | "rejected",
  createdAt: Date
}
```

### Dummy Data
- 3 parcels minted by admin
- Wallet A: Sachin Acharya (G6DKYcQnySUk1ZYYuR1HMovVscWjAtyDQb6GhqrvJYnw)
- Wallet B: Hari Prasad Shah (sDHAt4sfn556SXvKddXwCwAeKaMpLHEKKWcfG7hfmoz)
- Wallet C (Admin): Gagan Sher shah (8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB)

## Acceptance Criteria

### Visual Checkpoints
- [ ] Nepal flag animates in header
- [ ] Red/Blue theme matches Nepal colors
- [ ] Government-style structured layout
- [ ] Cards have proper shadows and hover effects
- [ ] Responsive on all devices

### Functional Checkpoints
- [ ] Explorer shows all parcels
- [ ] Search filters parcels by name/location
- [ ] My Parcels shows connected wallet's parcels
- [ ] Government shows stats and whitelist
- [ ] API endpoints return correct data

### Data Checkpoints
- [ ] 3 parcels exist in database
- [ ] 2 user wallets and 1 admin wallet
- [ ] Whitelist has pending requests
