const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = 'mongodb+srv://sachinacharya365official_db_user:kEX4fEHa1FNjVyWt@cluster0.k8tooiv.mongodb.net/onChain-Jagga';

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
  createdAt: { type: Date, default: Date.now }
});

const Parcel = mongoose.model('Parcel', parcelSchema);
const Whitelist = mongoose.model('Whitelist', whitelistSchema);

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
    const { walletAddress, ownerName, requestType, location, size, toWallet, toName, parcelId } = req.body;
    const request = new Whitelist({ 
      walletAddress, 
      ownerName,
      requestType: requestType || 'whitelist',
      location,
      size,
      toWallet,
      toName,
      parcelId
    });
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/whitelist/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const request = await Whitelist.findByIdAndUpdate(req.params.id, { status }, { new: true });
    
    if (status === 'approved' && request.requestType === 'registration') {
      const tokenId = await Parcel.countDocuments() + 1;
      const newParcel = new Parcel({
        tokenId,
        ownerName: request.ownerName,
        ownerWallet: request.walletAddress,
        location: request.location,
        size: request.size,
        documentHash: 'Qm' + Date.now(),
        transactionHash: 'TX' + Math.random().toString(36).substring(2, 50),
        status: 'registered'
      });
      await newParcel.save();
    }
    
    res.json(request);
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
    const approvedWhitelist = await Whitelist.countDocuments({ status: 'approved' });
    res.json({ totalParcels, pendingWhitelist, pendingRegistrations, pendingTransfers, approvedWhitelist });
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
        ownerWallet: 'sDHAt4sfn556SXvKddXjCwAeKaMpLHEKKWcfG7hfmoz',
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
        ownerName: 'Gagan Sher Shah',
        ownerWallet: '8b29vHx8ZdAQp9vNSLSgmNxeqgPZbyqE6paPdwVvXYSB',
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

seedData();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
