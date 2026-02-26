/**
 * One-time cleanup: remove only parcels #1 and #5 of Sachin Acharya (and related whitelist).
 * Run from backend folder: node scripts/cleanup-dummy.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sachinacharya365official_db_user:kEX4fEHa1FNjVyWt@cluster0.k8tooiv.mongodb.net/onChain-RealmRegistry';

const parcelSchema = new mongoose.Schema({
  tokenId: Number,
  ownerName: String,
  ownerWallet: String,
  location: Object,
  size: Object,
  documentHash: String,
  transactionHash: String,
  mintAddress: String,
  status: String,
  createdAt: Date,
  updatedAt: Date
}, { strict: false });

const whitelistSchema = new mongoose.Schema({
  walletAddress: String,
  ownerName: String,
  requestType: String,
  status: String,
  location: Object,
  size: Object,
  toWallet: String,
  toName: String,
  parcelId: String,
  paymentTxSignature: String,
  adminPaymentTxSignature: String,
  nftTransferSignature: String,
  createdAt: Date
}, { strict: false });

const Parcel = mongoose.model('Parcel', parcelSchema);
const Whitelist = mongoose.model('Whitelist', whitelistSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected.');

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

  console.log('Cleanup done:');
  console.log('  Parcels deleted:', parcelResult.deletedCount);
  console.log('  Whitelist entries deleted:', whitelistResult.deletedCount);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
