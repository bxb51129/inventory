const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'logo' + path.extname(file.originalname));
  }
});

// 商品图片上传配置
const itemImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/items';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('只允许上传jpg、png、gif格式的图片'));
    }
    cb(null, true);
  }
});

const uploadItemImage = multer({ 
  storage: itemImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('只允许上传jpg、png、gif格式的图片'));
    }
    cb(null, true);
  }
});

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-cache');
    res.set('Content-Type', 'image/jpeg');
  }
}));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.url.startsWith('/uploads/')) {
    console.log('Static file request:', req.url);
  }
  next();
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  next();
});

// 上传logo
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    const logoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    res.json({ url: logoUrl });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取logo
app.get('/api/logo', (req, res) => {
  try {
    const logoPath = path.join(__dirname, 'uploads', 'logo');
    const files = fs.readdirSync(path.join(__dirname, 'uploads'));
    const logoFile = files.find(file => file.startsWith('logo'));
    
    if (logoFile) {
      const logoUrl = `http://localhost:5000/uploads/${logoFile}`;
      res.json({ url: logoUrl });
    } else {
      res.json({ url: null });
    }
  } catch (error) {
    console.error('Error getting logo:', error);
    res.status(500).json({ error: error.message });
  }
});

// 上传商品图片
app.post('/api/upload-item-image', uploadItemImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: '没有上传文件' });
    }
    console.log('File uploaded:', req.file);
    const imageUrl = `http://localhost:5000/uploads/items/${req.file.filename}`;
    console.log('Generated image URL:', imageUrl);
    
    // 验证文件是否存在
    const filePath = path.join(__dirname, 'uploads', 'items', req.file.filename);
    if (!fs.existsSync(filePath)) {
      console.error('File not found after upload:', filePath);
      return res.status(500).json({ error: '文件上传失败' });
    }
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading item image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Connect to local MongoDB instance
mongoose.connect('mongodb://localhost:27017/inventory', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // 如果数据库连接失败，终止程序
});

// 添加数据库连接状态监听
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  latestPrice: { type: Number, required: true },
  reorderLevel: { type: Number, default: 0 },
  purchaseHistory: [{
    price: Number,
    quantity: Number,
    date: Date,
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String
  }],
  // 添加供应商信息
  vendor: {
    name: { type: String },
    contact: String,
    phone: String,
    email: String,
    address: String,
    notes: String
  },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);

// 出库单模型
const packingSlipSchema = new mongoose.Schema({
  slipNumber: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    name: String,
    quantity: Number,
    price: Number,
    backorderQuantity: {
      type: Number,
      default: 0
    }
  }],
  totalAmount: Number,
  customerName: String,
  customerContact: String,
  customerPhone: String,
  customerEmail: String,
  customerAddress: String,
  customerCompany: String,
  notes: String,
  isCompleted: {
    type: Boolean,
    default: false
  }
});

const PackingSlip = mongoose.model('PackingSlip', packingSlipSchema);

// 生成出库单号
const generateSlipNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // 获取当天的最后一个出库单号
  const lastSlip = await PackingSlip.findOne({
    slipNumber: new RegExp(`^PS${year}${month}${day}`)
  }).sort({ slipNumber: -1 });

  let sequence = '001';
  if (lastSlip) {
    const lastSequence = parseInt(lastSlip.slipNumber.slice(-3));
    sequence = String(lastSequence + 1).padStart(3, '0');
  }

  return `PS${year}${month}${day}${sequence}`;
};

// 获取所有出库单
app.get('/api/packing-slips', async (req, res) => {
  try {
    const slips = await PackingSlip.find().sort({ date: -1 });
    res.json(slips);
  } catch (error) {
    console.error('Error fetching packing slips:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建新出库单
app.post('/api/packing-slips', async (req, res) => {
  try {
    const { items, customerName, customerContact, customerPhone, customerEmail, customerAddress, customerCompany, notes } = req.body;
    
    // 生成出库单号
    const slipNumber = await generateSlipNumber();
    
    // 计算总金额
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // 创建出库单
    const newSlip = new PackingSlip({
      slipNumber,
      items: items.map(item => ({
        ...item,
        backorderQuantity: item.backorderQuantity || 0
      })),
      totalAmount,
      customerName,
      customerContact,
      customerPhone,
      customerEmail,
      customerAddress,
      customerCompany,
      notes
    });

    // 更新库存
    for (const item of items) {
      const inventoryItem = await Item.findById(item.itemId);
      if (!inventoryItem) {
        throw new Error(`Item not found: ${item.itemId}`);
      }
      
      // 只减少实际可提供的数量
      const actualQuantity = Math.min(item.quantity, inventoryItem.quantity);
      inventoryItem.quantity -= actualQuantity;
      await inventoryItem.save();
    }

    await newSlip.save();
    res.json(newSlip);
  } catch (error) {
    console.error('Error creating packing slip:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个出库单
app.get('/api/packing-slips/:id', async (req, res) => {
  try {
    const slip = await PackingSlip.findById(req.params.id);
    if (!slip) {
      return res.status(404).json({ error: 'Packing slip not found' });
    }
    res.json(slip);
  } catch (error) {
    console.error('Error fetching packing slip:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除出库单
app.delete('/api/packing-slips/:id', async (req, res) => {
  try {
    console.log('Attempting to delete packing slip with ID:', req.params.id);
    
    const slip = await PackingSlip.findById(req.params.id);
    if (!slip) {
      console.log('Packing slip not found with ID:', req.params.id);
      return res.status(404).json({ error: 'Packing slip not found' });
    }

    console.log('Found packing slip:', slip);

    // 恢复库存数量
    for (const item of slip.items) {
      const inventoryItem = await Item.findById(item.itemId);
      if (inventoryItem) {
        console.log('Restoring quantity for item:', inventoryItem.name);
        inventoryItem.quantity += item.quantity;
        await inventoryItem.save();
      } else {
        console.log('Item not found:', item.itemId);
      }
    }

    // 删除出库单
    const result = await PackingSlip.findByIdAndDelete(req.params.id);
    console.log('Delete result:', result);
    
    res.json({ message: 'Packing slip cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling packing slip:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新出库单状态
app.put('/api/packing-slips/:id', async (req, res) => {
  try {
    console.log('Attempting to update packing slip with ID:', req.params.id);
    console.log('Update data:', req.body);

    const slip = await PackingSlip.findById(req.params.id);
    if (!slip) {
      console.log('Packing slip not found with ID:', req.params.id);
      return res.status(404).json({ error: 'Packing slip not found' });
    }

    // 如果请求只包含 isCompleted 字段，说明是标记完成操作
    if (Object.keys(req.body).length === 1 && 'isCompleted' in req.body) {
      const updatedSlip = await PackingSlip.findByIdAndUpdate(
        req.params.id,
        { isCompleted: true },
        { new: true }
      );
      console.log('Updated packing slip status:', updatedSlip);
      return res.json(updatedSlip);
    }

    // 否则是完整的出库单更新
    const { items, customerName, customerContact, customerPhone, customerEmail, customerAddress, customerCompany, notes, isCompleted } = req.body;
    
    // 计算总金额
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 更新出库单
    const updatedSlip = await PackingSlip.findByIdAndUpdate(
      req.params.id,
      {
        items: items.map(item => ({
          ...item,
          backorderQuantity: item.backorderQuantity || 0
        })),
        totalAmount,
        customerName,
        customerContact,
        customerPhone,
        customerEmail,
        customerAddress,
        customerCompany,
        notes,
        isCompleted
      },
      { new: true }
    );

    console.log('Updated packing slip:', updatedSlip);
    res.json(updatedSlip);
  } catch (error) {
    console.error('Error updating packing slip:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query = { name: { $regex: search, $options: 'i' } }; // 不区分大小写的模糊搜索
    }
    
    const items = await Item.find(query);
    console.log('Found items:', items);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const {
      name, quantity, price, sellingPrice, latestPrice, reorderLevel,
      purchaseHistory, vendor, imageUrl
    } = req.body;

    console.log('Adding item:', { name, quantity, price, sellingPrice, latestPrice });

    // 检查是否存在同名商品
    const existingItem = await Item.findOne({ name: name });
    console.log('Existing item:', existingItem);
    
    if (existingItem) {
      // 如果存在同名商品，更新数量和价格
      const oldQuantity = existingItem.quantity;
      existingItem.quantity += Number(quantity);
      console.log('Updating quantity:', { oldQuantity, newQuantity: existingItem.quantity, addedQuantity: Number(quantity) });
      
      existingItem.price = Number(price);
      existingItem.sellingPrice = Number(sellingPrice);
      existingItem.latestPrice = Number(latestPrice);
      existingItem.reorderLevel = Number(reorderLevel) || existingItem.reorderLevel;
      
      // 添加新的进货记录
      if (purchaseHistory && purchaseHistory.length > 0) {
        existingItem.purchaseHistory.push(...purchaseHistory);
      } else {
        existingItem.purchaseHistory.push({
          price: Number(price),
          quantity: Number(quantity),
          date: new Date(),
          vendorId: vendor?._id,
          vendorName: vendor?.name
        });
      }

      // 更新供应商信息
      if (vendor) {
        existingItem.vendor = vendor;
      }

      // 更新图片
      if (imageUrl) {
        existingItem.imageUrl = imageUrl;
      }

      await existingItem.save();
      console.log('Updated item:', existingItem);
      res.json(existingItem);
    } else {
      // 如果不存在同名商品，创建新商品
      const newItem = new Item({
        name,
        quantity: Number(quantity),
        price: Number(price),
        sellingPrice: Number(sellingPrice),
        latestPrice: Number(latestPrice),
        reorderLevel: Number(reorderLevel) || 0,
        purchaseHistory: purchaseHistory || [{
          price: Number(price),
          quantity: Number(quantity),
          date: new Date(),
          vendorId: vendor?._id,
          vendorName: vendor?.name
        }],
        vendor: vendor || {},
        imageUrl
      });
      await newItem.save();
      console.log('Created new item:', newItem);
      res.json(newItem);
    }
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Delete request received for ID:', id);
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    
    // First check if the item exists
    const item = await Item.findById(id);
    console.log('Found item:', item);
    
    if (!item) {
      console.log('Item not found with ID:', id);
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const result = await Item.findByIdAndDelete(id);
    console.log('Delete result:', result);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add PUT endpoint for updating items
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, price, sellingPrice, latestPrice, reorderLevel, purchaseHistory, imageUrl, vendor } = req.body;
    console.log('Update request received for ID:', id);
    console.log('Update data:', { name, quantity, price, sellingPrice, latestPrice, reorderLevel, purchaseHistory, imageUrl, vendor });

    const updatedItem = await Item.findByIdAndUpdate(
      id,
      { 
        name, 
        quantity: Number(quantity), 
        price: Number(price),
        sellingPrice: Number(sellingPrice),
        latestPrice: Number(latestPrice),
        reorderLevel: Number(reorderLevel) || 0,
        purchaseHistory,
        imageUrl,
        vendor
      },
      { new: true }
    );

    if (!updatedItem) {
      console.log('Item not found with ID:', id);
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log('Updated item:', updatedItem);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 添加库存
app.put('/api/items/:id/add-stock', async (req, res) => {
  try {
    const { quantity, price, vendorId } = req.body;
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: '商品不存在' });
    }

    // 获取供应商信息
    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: '供应商不存在' });
      }
    }

    // 更新库存数量
    item.quantity += Number(quantity);
    
    // 更新最新价格
    item.latestPrice = Number(price);
    
    // 添加进货记录
    if (!item.purchaseHistory) {
      item.purchaseHistory = [];
    }
    
    item.purchaseHistory.push({
      date: new Date(),
      quantity: Number(quantity),
      price: Number(price),
      vendorId: vendor?._id,
      vendorName: vendor?.name
    });

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: '添加库存失败' });
  }
});

// 客户模型
const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  phone: String,
  email: String,
  address: String,
  creditLimit: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Customer = mongoose.model('Customer', customerSchema);

// 客户相关API
// 获取所有客户
app.get('/api/customers', async (req, res) => {
  try {
    console.log('Handling GET /api/customers request');
    
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Current state:', mongoose.connection.readyState);
      return res.status(500).json({ error: 'Database connection error' });
    }
    
    const { search } = req.query;
    let query = {};
    
    if (search) {
      console.log('Search query:', search);
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { contact: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    console.log('MongoDB query:', JSON.stringify(query));
    
    // 使用 lean() 来获取普通 JavaScript 对象而不是 Mongoose 文档
    const customers = await Customer.find(query)
      .lean()
      .sort({ createdAt: -1 });
    
    console.log(`Found ${customers.length} customers`);
    console.log('Customers:', JSON.stringify(customers, null, 2));
    
    res.json(customers);
  } catch (error) {
    console.error('Error in GET /api/customers:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack,
      code: error.code
    });
  }
});

// 创建新客户
app.post('/api/customers', async (req, res) => {
  try {
    const { name, contact, phone, email, address, creditLimit, notes } = req.body;
    const newCustomer = new Customer({
      name,
      contact,
      phone,
      email,
      address,
      creditLimit: Number(creditLimit) || 0,
      notes
    });
    await newCustomer.save();
    res.json(newCustomer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新客户信息
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, phone, email, address, creditLimit, notes } = req.body;
    
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        name,
        contact,
        phone,
        email,
        address,
        creditLimit: Number(creditLimit) || 0,
        notes,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除客户
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndDelete(id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个客户详情
app.get('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 用户模型
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: String
});
const User = mongoose.model('User', userSchema);

// 注册接口
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码必填' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, email });
    res.json({ message: '注册成功' });
  } catch (err) {
    res.status(400).json({ message: '注册失败', error: err.message });
  }
});

// 登录接口
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码必填' });
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: '用户不存在' });
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: '密码错误' });
  // 生成token
  const token = jwt.sign({ userId: user._id, username: user.username }, 'your_jwt_secret', { expiresIn: '2h' });
  res.json({ token, username: user.username });
});

// 认证中间件
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未登录' });
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'token无效' });
  }
}

// 示例受保护接口
app.get('/api/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  res.json(user);
});

// 1. 引入 mongoose 并定义 Vendor schema
const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: String,
  phone: String,
  email: String,
  address: String,
  notes: String,
  creditLimit: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});
const Vendor = mongoose.model('Vendor', vendorSchema);

// 2. 供货商API
const vendorRouter = express.Router();

// GET /api/vendors?search=xxx
vendorRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query = {
        $or: [
          { name: regex },
          { contact: regex },
          { phone: regex },
          { email: regex },
          { address: regex }
        ]
      };
    }
    const vendors = await Vendor.find(query).sort({ name: 1 });
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vendors
vendorRouter.post('/', async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/vendors/:id
vendorRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndUpdate(id, req.body, { new: true });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/vendors/:id
vendorRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndDelete(id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vendors/:id/items  获取该供货商供货的商品
vendorRouter.get('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await Item.find({ 'purchaseHistory.vendorId': id });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vendors/:id/purchase-history  获取该供货商所有进货历史
vendorRouter.get('/:id/purchase-history', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await Item.find({ 'purchaseHistory.vendorId': id });
    // 聚合所有purchaseHistory中属于该vendorId的记录
    let history = [];
    items.forEach(item => {
      if (Array.isArray(item.purchaseHistory)) {
        item.purchaseHistory.forEach(ph => {
          if (ph.vendorId && ph.vendorId.toString() === id) {
            history.push({
              itemId: item._id,
              itemName: item.name,
              ...ph
            });
          }
        });
      }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. 挂载路由
app.use('/api/vendors', vendorRouter);

// 直接重置密码（开发/测试用，生产环境请加权限校验！）
app.post('/api/reset-password-direct', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ message: '用户名和新密码必填' });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();
    res.json({ message: '密码重置成功' });
  } catch (err) {
    res.status(500).json({ message: '重置失败', error: err.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000')); 