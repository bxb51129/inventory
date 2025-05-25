import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import AddItem from './components/AddItem';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

function calculateAverageCost(purchaseHistory) {
  if (!purchaseHistory || purchaseHistory.length === 0) return 0;
  const totalCost = purchaseHistory.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0);
  const totalQty = purchaseHistory.reduce((sum, p) => sum + Number(p.quantity), 0);
  return totalQty === 0 ? 0 : (totalCost / totalQty);
}

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [tab, setTab] = useState('inventory');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');

  // 获取logo
  useEffect(() => {
    axios.get('http://localhost:5000/api/logo').then(res => {
      setLogoUrl(res.data.url);
    }).catch(err => {
      console.error('Error fetching logo:', err);
    });
  }, []);

  // 拉取供货商列表
  useEffect(() => {
    axios.get('http://localhost:5000/api/vendors').then(res => {
      setVendors(res.data);
    });
  }, []);

  // 上传logo
  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    setUploading(true);
    try {
      await axios.post('http://localhost:5000/api/upload-logo', formData, {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'multipart/form-data'
        }
      });
      // 上传成功后刷新logo
      const res = await axios.get('http://localhost:5000/api/logo');
      setLogoUrl(res.data.url);
    } catch (err) {
      alert('上传logo失败');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  function MainContent() {
    if (tab === 'inventory') {
      return <InventoryCard />;
    } else if (tab === 'customer') {
      return <CustomerCard />;
    } else if (tab === 'slip') {
      return <SlipCard />;
    } else if (tab === 'vendor') {
      return <VendorCard />;
    } else if (tab === 'analysis') {
      return <AnalysisCard />;
    }
    return null;
  }

  function InventoryCard() {
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showAddItemForm, setShowAddItemForm] = useState(false);
    const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
    const [selectedItemHistory, setSelectedItemHistory] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [selectedItemForStock, setSelectedItemForStock] = useState(null);
    const [stockQuantity, setStockQuantity] = useState('');
    const [stockPrice, setStockPrice] = useState('');
    const [vendors, setVendors] = useState([]);
    const [selectedVendor, setSelectedVendor] = useState('');

    // 获取商品列表
    useEffect(() => {
      fetchItems();
    }, []);

    // 获取供应商列表
    useEffect(() => {
      const fetchVendors = async () => {
        try {
          const response = await axios.get('http://localhost:5000/api/vendors');
          setVendors(response.data);
        } catch (error) {
          console.error('Error fetching vendors:', error);
        }
      };
      fetchVendors();
    }, []);

    const calculateSellingPrice = (price) => {
      if (!price || isNaN(price)) return 0;
      return (Number(price) * 1.67).toFixed(2);
    };

    const fetchItems = async (search = '') => {
      try {
        setIsLoading(true);
        const url = search 
          ? `http://localhost:5000/api/items?search=${encodeURIComponent(search)}`
          : 'http://localhost:5000/api/items';
        const res = await axios.get(url);
        const itemsArray = Array.isArray(res.data) ? res.data : [res.data];
        const processedItems = itemsArray.map(item => {
          if (!item.purchaseHistory) {
            item.purchaseHistory = [{
              price: item.price,
              quantity: item.quantity,
              date: new Date()
            }];
          }
          return {
            ...item,
            sellingPrice: item.sellingPrice || calculateSellingPrice(item.latestPrice || item.price),
            latestPrice: item.latestPrice || item.price,
            reorderLevel: Number(item.reorderLevel) || 0
          };
        });
        setItems(processedItems);
      } catch (error) {
        console.error('Error fetching items:', error);
        alert('获取数据失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    const handleSearch = () => {
      fetchItems(searchTerm);
    };

    const handleItemAdded = (newItem) => {
      if (editingItem) {
        setItems(items.map(item => item._id === editingItem._id ? newItem : item));
      } else {
        setItems([...items, newItem]);
      }
      setShowAddItemForm(false);
      setEditingItem(null);
    };

    const startEdit = (item) => {
      setEditingItem(item);
      setShowAddItemForm(true);
    };

    const deleteItem = (id) => {
      if (window.confirm('确定要删除这个商品吗？')) {
        axios.delete(`http://localhost:5000/api/items/${id}`)
          .then(() => {
            setItems(items.filter(item => item._id !== id));
          })
          .catch(err => {
            alert(err.response?.data?.error || '删除失败，请重试');
          });
      }
    };

    const viewPurchaseHistory = (item) => {
      setSelectedItemHistory(item);
      setShowPurchaseHistory(true);
    };

    // 添加库存
    const handleAddStock = async () => {
      if (!stockQuantity || !stockPrice || !selectedVendor) {
        alert('请填写所有必填字段');
        return;
      }

      try {
        const response = await fetch(`http://localhost:5000/api/items/${selectedItemForStock._id}/add-stock`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: Number(stockQuantity),
            price: Number(stockPrice),
            vendorId: selectedVendor
          }),
        });

        if (!response.ok) {
          throw new Error('添加库存失败');
        }

        const updatedItem = await response.json();
        setItems(items.map(item => 
          item._id === updatedItem._id ? updatedItem : item
        ));
        setShowAddStockModal(false);
        setSelectedItemForStock(null);
        setStockQuantity('');
        setStockPrice('');
        setSelectedVendor('');
      } catch (error) {
        console.error('Error adding stock:', error);
        alert('添加库存失败');
      }
    };

    if (showAddItemForm) {
      return (
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h2 style={{margin:0}}>{editingItem ? '编辑商品' : '添加商品'}</h2>
            <button 
              className="add-item-button"
              onClick={() => {
                setShowAddItemForm(false);
                setEditingItem(null);
              }}
            >
              返回商品列表
            </button>
          </div>
          <AddItem 
            onItemAdded={handleItemAdded}
            onCancel={() => {
              setShowAddItemForm(false);
              setEditingItem(null);
            }}
            editingItem={editingItem}
          />
        </div>
      );
    }

    return (
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <h2 style={{margin:0}}>库存管理</h2>
            <button 
              className="add-item-button"
              style={{marginLeft:0}}
              onClick={() => {
                setEditingItem(null);
                setShowAddItemForm(true);
              }}
            >
              添加商品
            </button>
          </div>
        </div>

        <div className="search-box" style={{marginBottom:24}}>
          <input
            type="text"
            placeholder="搜索商品名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? '搜索中...' : '搜索'}
          </button>
          {searchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                fetchItems();
              }}
              style={{
                background: '#f5f5f5',
                color: '#666',
                marginLeft: 8
              }}
            >
              返回商品列表
            </button>
          )}
        </div>

        <div className="items-list">
          <h2>商品列表 ({items.length})</h2>
          <ul className={isLoading ? 'loading' : ''}>
            {items && items.length > 0 ? (
              items.map(item => {
                const latestPrice = item.latestPrice || item.price;
                const sellingPrice = item.sellingPrice || calculateSellingPrice(latestPrice);
                const isLowStock = item.quantity <= (Number(item.reorderLevel) || 0);
                return (
                  <li key={item._id} className={`item-card ${isLowStock ? 'low-stock' : ''}`}>
                    <div style={{
                      display: 'flex',
                      width: '100%',
                      padding: 0,
                      margin: 0,
                      alignItems: 'flex-start'
                    }}>
                      <div style={{
                        width: 120,
                        height: 120,
                        flexShrink: 0,
                        marginRight: 24
                      }}>
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt="商品图片" 
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: 8,
                              background: '#f5f5f5'
                            }} 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/no-img.png';
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            background: '#f5f5f5',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#999',
                            fontSize: 14
                          }}>
                            无图片
                          </div>
                        )}
                      </div>
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 120
                      }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            gap: 16,
                            alignItems: 'center',
                            marginBottom: 8
                          }}>
                            <span className="item-name">商品名：{item.name}</span>
                            <span className={`item-quantity ${isLowStock ? 'warning' : ''}`}>现库存数量: {item.quantity}{isLowStock && <span className="low-stock-warning"> (需要补货)</span>}</span>
                          </div>
                          <span style={{color:'#888',fontSize:'0.95rem'}}>
                            平均成本: ${calculateAverageCost(item.purchaseHistory).toFixed(2)} | 最新进货价: ${Number(latestPrice).toFixed(2)} | 销售价: ${Number(sellingPrice).toFixed(2)} | 补货点: {Number(item.reorderLevel) || 0} | 供货商: {item.vendor?.name || '-'}
                          </span>
                        </div>
                        <div className="item-actions" style={{
                          display: 'flex',
                          gap: 8,
                          justifyContent: 'flex-end',
                          marginTop: 8
                        }}>
                          <button 
                            style={{fontSize:'0.85rem',padding:'2px 8px'}} 
                            onClick={() => {
                              setSelectedItemForStock(item);
                              setStockPrice(item.latestPrice || item.price);
                              setShowAddStockModal(true);
                            }}
                          >
                            添加库存
                          </button>
                          <button style={{fontSize:'0.85rem',padding:'2px 8px'}} onClick={() => startEdit(item)}>编辑</button>
                          <button style={{fontSize:'0.85rem',padding:'2px 8px'}} onClick={() => deleteItem(item._id)}>删除</button>
                          <button style={{fontSize:'0.85rem',padding:'2px 8px'}} onClick={() => viewPurchaseHistory(item)}>查看进货历史</button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="no-items">
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <p style={{marginBottom:16,color:'#666'}}>没有找到商品</p>
                  <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                    <button 
                      className="add-item-button"
                      onClick={() => {
                        setEditingItem(null);
                        setShowAddItemForm(true);
                      }}
                    >
                      添加新商品
                    </button>
                    <button 
                      className="add-item-button"
                      style={{background:'#f5f5f5',color:'#666'}}
                      onClick={() => {
                        setSearchTerm('');
                        fetchItems();
                      }}
                    >
                      取消搜索
                    </button>
                  </div>
                </div>
              </li>
            )}
          </ul>
        </div>

        {/* 进货历史弹窗 */}
        {showPurchaseHistory && selectedItemHistory && (
          <div className="modal">
            <div className="modal-content">
              <h2>{selectedItemHistory.name} 的进货历史</h2>
              <div className="purchase-history">
                {selectedItemHistory.purchaseHistory && selectedItemHistory.purchaseHistory.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>数量</th>
                        <th>单价</th>
                        <th>总价</th>
                        <th>供货商</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItemHistory.purchaseHistory
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((purchase, index) => (
                          <tr key={index}>
                            <td>{new Date(purchase.date).toLocaleString()}</td>
                            <td>{purchase.quantity}</td>
                            <td>${Number(purchase.price).toFixed(2)}</td>
                            <td>${(Number(purchase.price) * Number(purchase.quantity)).toFixed(2)}</td>
                            <td>{purchase.vendorName || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p>暂无进货记录</p>
                )}
              </div>
              <button onClick={() => setShowPurchaseHistory(false)}>关闭</button>
            </div>
          </div>
        )}

        {/* 添加库存模态框 */}
        {showAddStockModal && selectedItemForStock && (
          <div className="modal">
            <div className="modal-content">
              <h2>添加库存</h2>
              <p>商品名称: {selectedItemForStock.name}</p>
              <p>当前库存: {selectedItemForStock.quantity}</p>
              <div className="form-group">
                <label>添加数量:</label>
                <input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>进货价格:</label>
                <input
                  type="number"
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label>选择供应商:</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  required
                >
                  <option value="">请选择供应商</option>
                  {vendors.map(vendor => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-buttons">
                <button onClick={handleAddStock}>确认</button>
                <button onClick={() => {
                  setShowAddStockModal(false);
                  setSelectedItemForStock(null);
                  setStockQuantity('');
                  setStockPrice('');
                  setSelectedVendor('');
                }}>取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function CustomerCard() {
    const [customers, setCustomers] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [customerCompany, setCustomerCompany] = useState('');
    const [useCompanyAddress, setUseCompanyAddress] = useState(false);
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [showCustomerList, setShowCustomerList] = useState(false);

    // 获取所有客户
    const fetchCustomers = async (search = '', retryCount = 0) => {
      try {
        const url = search 
          ? `http://localhost:5000/api/customers?search=${encodeURIComponent(search)}`
          : 'http://localhost:5000/api/customers';
        const res = await axios.get(url, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        if (Array.isArray(res.data)) {
          setCustomers(res.data);
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (error) {
        if ((error.code === 'ECONNABORTED' || !error.response) && retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchCustomers(search, retryCount + 1);
        }
        alert('获取客户数据失败，请重试');
      }
    };

    useEffect(() => {
      fetchCustomers();
    }, []);

    // 添加新客户
    const addCustomer = () => {
      const customerData = {
        name: customerName,
        contact: customerContact,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress,
        notes: customerNotes,
        company: customerCompany
      };
      axios.post('http://localhost:5000/api/customers', customerData)
        .then(res => {
          setCustomers([...customers, res.data]);
          setCustomerName('');
          setCustomerContact('');
          setCustomerPhone('');
          setCustomerEmail('');
          setCustomerAddress('');
          setCustomerNotes('');
          setCustomerCompany('');
        })
        .catch(err => {
          alert(err.response?.data?.error || '添加客户失败，请重试');
        });
    };

    // 更新客户信息
    const updateCustomer = () => {
      if (!editingCustomerId) return;
      const customerData = {
        name: customerName,
        contact: customerContact,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress,
        notes: customerNotes,
        company: customerCompany
      };
      axios.put(`http://localhost:5000/api/customers/${editingCustomerId}`, customerData)
        .then(res => {
          setCustomers(customers.map(customer => 
            customer._id === editingCustomerId ? res.data : customer
          ));
          setEditingCustomerId(null);
          setCustomerName('');
          setCustomerContact('');
          setCustomerPhone('');
          setCustomerEmail('');
          setCustomerAddress('');
          setCustomerNotes('');
          setCustomerCompany('');
          alert('更新客户资料成功！');
        })
        .catch(err => {
          alert(err.response?.data?.error || '更新客户失败，请重试');
        });
    };

    // 删除客户
    const deleteCustomer = (id) => {
      if (window.confirm('确定要删除这个客户吗？')) {
        axios.delete(`http://localhost:5000/api/customers/${id}`)
          .then(() => {
            setCustomers(customers.filter(customer => customer._id !== id));
          })
          .catch(err => {
            alert(err.response?.data?.error || '删除客户失败，请重试');
          });
      }
    };

    // 开始编辑客户
    const startEditCustomer = (customer) => {
      setEditingCustomerId(customer._id);
      setCustomerName(customer.name);
      setCustomerContact(customer.contact || '');
      setCustomerPhone(customer.phone || '');
      setCustomerEmail(customer.email || '');
      setCustomerAddress(customer.address || '');
      setCustomerNotes(customer.notes || '');
      setCustomerCompany(customer.company || '');
    };

    // 处理客户表单提交
    const handleCustomerSubmit = (e) => {
      e.preventDefault();
      if (editingCustomerId) {
        updateCustomer();
      } else {
        addCustomer();
      }
    };

    // 处理客户搜索
    const handleCustomerSearch = () => {
      fetchCustomers(customerSearchTerm);
    };

    // 处理公司地址复选框变化
    const handleUseCompanyAddressChange = (e) => {
      setUseCompanyAddress(e.target.checked);
      if (e.target.checked) {
        setCustomerAddress(customerCompany);
      }
    };

    // 选择客户
    const selectCustomer = (customer) => {
      setCustomerName(customer.name);
      setCustomerAddress(customer.address || '');
      setShowCustomerList(false);
    };

    return (
      <div className="card">
        {showCustomerForm ? (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{margin:0}}>{editingCustomerId ? '编辑客户' : '添加客户'}</h2>
              <button 
                className="add-item-button"
                onClick={() => {
                  setShowCustomerForm(false);
                  setEditingCustomerId(null);
                  setCustomerName('');
                  setCustomerContact('');
                  setCustomerPhone('');
                  setCustomerEmail('');
                  setCustomerAddress('');
                  setCustomerNotes('');
                  setCustomerCompany('');
                }}
              >
                返回客户列表
              </button>
            </div>
            <form onSubmit={handleCustomerSubmit} className="customer-form">
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>公司名（可选）</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="请输入公司名"
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>联系人</label>
                <input
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="请输入联系人姓名"
                  required
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>公司地址（可选）</label>
                <input
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  placeholder="请输入公司地址"
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>电话</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="请输入电话号码"
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>邮箱</label>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                  type="email"
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem'}}>收货地址</label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="请输入收货地址"
                  style={{marginBottom:8}}
                />
                <div style={{
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  padding:'4px 8px',
                  background:'#f5f5f5',
                  borderRadius:4,
                  width:'fit-content',
                  whiteSpace:'nowrap'
                }}>
                  <input
                    type="checkbox"
                    id="useCompanyAddress"
                    checked={useCompanyAddress}
                    onChange={handleUseCompanyAddressChange}
                    style={{margin:0}}
                  />
                  <label htmlFor="useCompanyAddress" style={{
                    fontSize:'0.9rem',
                    color:'#666',
                    margin:0,
                    cursor:'pointer',
                    whiteSpace:'nowrap'
                  }}>
                    与公司地址相同
                  </label>
                </div>
              </div>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="备注"
              />
              <button type="submit">
                {editingCustomerId ? '更新' : '添加'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <h2 style={{margin:0}}>客户管理</h2>
                <button 
                  className="add-item-button"
                  style={{marginLeft:0}}
                  onClick={() => {
                    setEditingCustomerId(null);
                    setShowCustomerForm(true);
                  }}
                >
                  添加客户
                </button>
              </div>
            </div>

            <div className="search-box" style={{marginBottom:24}}>
              <input
                type="text"
                placeholder="搜索客户名称、联系人、电话..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomerSearch();
                  }
                }}
              />
              <button onClick={handleCustomerSearch}>搜索</button>
              {customerSearchTerm && (
                <button 
                  onClick={() => {
                    setCustomerSearchTerm('');
                    fetchCustomers();
                  }}
                  style={{
                    background: '#f5f5f5',
                    color: '#666',
                    marginLeft: 8
                  }}
                >
                  返回客户列表
                </button>
              )}
            </div>

            <div className="customers-list">
              <h3>客户列表 ({customers.length})</h3>
              <ul>
                {customers.length > 0 ? (
                  customers.map(customer => (
                    <li key={customer._id} className="customer-card">
                      <div className="customer-info">
                        <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:8}}>
                          <span className="customer-name">{customer.name}</span>
                          <span className="customer-contact">联系人: {customer.contact}</span>
                          {customer.company && (
                            <span style={{color:'#2196F3',fontSize:'0.95rem'}}>公司: {customer.company}</span>
                          )}
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:16,color:'#666',fontSize:'0.95rem'}}>
                          {customer.phone && <span className="customer-phone">电话: {customer.phone}</span>}
                          {customer.email && <span className="customer-email">邮箱: {customer.email}</span>}
                          {customer.address && <span className="customer-address">地址: {customer.address}</span>}
                          {customer.notes && <span className="customer-notes">备注: {customer.notes}</span>}
                        </div>
                      </div>
                      <div className="customer-actions">
                        <button onClick={() => {
                          startEditCustomer(customer);
                          setShowCustomerForm(true);
                        }}>编辑</button>
                        <button onClick={() => deleteCustomer(customer._id)}>删除</button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="no-items">
                    <div style={{textAlign:'center',padding:'32px 0'}}>
                      <p style={{marginBottom:16,color:'#666'}}>没有找到客户</p>
                      <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                        <button 
                          className="add-item-button"
                          onClick={() => {
                            setEditingCustomerId(null);
                            setShowCustomerForm(true);
                          }}
                        >
                          添加新客户
                        </button>
                        <button 
                          className="add-item-button"
                          style={{background:'#f5f5f5',color:'#666'}}
                          onClick={() => {
                            setCustomerSearchTerm('');
                            fetchCustomers();
                          }}
                        >
                          取消搜索
                        </button>
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  function SlipCard() {
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [customerCompany, setCustomerCompany] = useState('');
    const [useCompanyAddress, setUseCompanyAddress] = useState(false);
    const [notes, setNotes] = useState('');
    const [packingSlips, setPackingSlips] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemPrice, setItemPrice] = useState('');
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [editingSlip, setEditingSlip] = useState(null);

    // 获取所有客户
    const fetchCustomers = async (search = '') => {
      try {
        const url = search 
          ? `http://localhost:5000/api/customers?search=${encodeURIComponent(search)}`
          : 'http://localhost:5000/api/customers';
        const res = await axios.get(url);
        setCustomers(res.data);
      } catch (error) {
        alert('获取客户数据失败，请重试');
      }
    };

    // 选择客户
    const selectCustomer = (customer) => {
      setCustomerName(customer.name);
      setCustomerAddress(customer.address || '');
      setShowCustomerList(false);
    };

    // 处理客户搜索
    const handleCustomerSearch = () => {
      fetchCustomers(customerSearchTerm);
    };

    useEffect(() => {
      if (showCustomerList) {
        fetchCustomers();
      }
    }, [showCustomerList]);

    // 获取商品
    const fetchItems = async (search = '') => {
      try {
        setIsLoading(true);
        const url = search 
          ? `http://localhost:5000/api/items?search=${encodeURIComponent(search)}`
          : 'http://localhost:5000/api/items';
        const res = await axios.get(url);
        const itemsArray = Array.isArray(res.data) ? res.data : [res.data];
        setItems(itemsArray);
      } catch (error) {
        alert('获取商品失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    // 获取所有出库单
    const fetchPackingSlips = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/packing-slips');
        setPackingSlips(res.data);
      } catch (error) {
        alert('获取出库单失败，请重试');
      }
    };

    useEffect(() => {
      fetchItems();
      fetchPackingSlips();
    }, []);

    // 搜索商品
    const handleSearch = () => {
      fetchItems(searchTerm);
    };

    // 添加商品到出库单
    const addToPackingSlip = (item) => {
      setSelectedItem(item);
      setItemQuantity(1);
      setItemPrice(item.sellingPrice || (item.price * 1.67).toFixed(2));
      setShowQuantityModal(true);
    };

    // 确认添加商品
    const confirmAddItem = () => {
      if (!selectedItem) return;
      const quantity = Number(itemQuantity);
      const backorderQuantity = Math.max(0, quantity - selectedItem.quantity);
      const actualQuantity = Math.min(quantity, selectedItem.quantity);

      const existingItem = selectedItems.find(i => i.itemId === selectedItem._id);
      if (existingItem) {
        setSelectedItems(selectedItems.map(i => 
          i.itemId === selectedItem._id 
            ? { 
                ...i, 
                quantity: i.quantity + actualQuantity,
                backorderQuantity: (i.backorderQuantity || 0) + backorderQuantity,
                price: Number(itemPrice) 
              }
            : i
        ));
      } else {
        setSelectedItems([...selectedItems, {
          itemId: selectedItem._id,
          name: selectedItem.name,
          quantity: actualQuantity,
          backorderQuantity: backorderQuantity,
          price: Number(itemPrice)
        }]);
      }
      setShowQuantityModal(false);
      setSelectedItem(null);
    };

    // 从出库单中移除商品
    const removeFromPackingSlip = (itemId) => {
      setSelectedItems(selectedItems.filter(item => item.itemId !== itemId));
    };

    // 更新出库单中商品数量
    const updatePackingSlipItemQuantity = (itemId, newQuantity) => {
      if (newQuantity < 1) return;
      const item = items.find(i => i._id === itemId);
      if (!item) return;

      const currentItem = selectedItems.find(i => i.itemId === itemId);
      if (!currentItem) return;

      // 计算新的数量
      const backorderQuantity = Math.max(0, newQuantity - item.quantity);
      const actualQuantity = Math.min(newQuantity, item.quantity);

      // 如果是编辑模式，需要考虑已有的补货数量
      if (editingSlip) {
        const originalItem = editingSlip.items.find(i => i.itemId === itemId);
        if (originalItem) {
          // 如果新数量小于等于库存，则没有补货
          if (newQuantity <= item.quantity) {
            setSelectedItems(selectedItems.map(item =>
              item.itemId === itemId
                ? { 
                    ...item, 
                    quantity: newQuantity,
                    backorderQuantity: 0
                  }
                : item
            ));
          } else {
            // 如果新数量大于库存，则计算补货数量
            setSelectedItems(selectedItems.map(item =>
              item.itemId === itemId
                ? { 
                    ...item, 
                    quantity: item.quantity,
                    backorderQuantity: newQuantity - item.quantity
                  }
                : item
            ));
          }
          return;
        }
      }

      // 非编辑模式下的处理
      setSelectedItems(selectedItems.map(item =>
        item.itemId === itemId
          ? { 
              ...item, 
              quantity: actualQuantity,
              backorderQuantity: backorderQuantity
            }
          : item
      ));
    };

    // 创建出库单
    const createPackingSlip = async () => {
      try {
        const slipData = {
          items: selectedItems.map(item => ({
            ...item,
            backorderQuantity: item.backorderQuantity || 0
          })),
          customerName,
          customerContact,
          customerPhone,
          customerEmail,
          customerAddress,
          customerCompany,
          notes,
          isCompleted: editingSlip ? editingSlip.isCompleted : false
        };

        if (editingSlip) {
          // 如果是编辑模式，发送 PUT 请求
          await axios.put(`http://localhost:5000/api/packing-slips/${editingSlip._id}`, slipData);
          alert('出库单更新成功！');
        } else {
          // 如果是新建模式，发送 POST 请求
          await axios.post('http://localhost:5000/api/packing-slips', slipData);
          alert('出库单创建成功！');
        }

        // 重置表单
        setSelectedItems([]);
        setCustomerName('');
        setCustomerContact('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerAddress('');
        setCustomerCompany('');
        setNotes('');
        setEditingSlip(null);
        setShowCreateForm(false);
        fetchItems();
        fetchPackingSlips();
      } catch (error) {
        alert(error.response?.data?.error || '操作失败，请重试');
      }
    };

    // 标记出库单为已完成
    const markAsCompleted = async (slipId) => {
      try {
        console.log('Marking packing slip as completed:', slipId);
        const response = await axios.put(`http://localhost:5000/api/packing-slips/${slipId}`, {
          isCompleted: true
        }, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        console.log('Update response:', response.data);
        await fetchPackingSlips();
      } catch (error) {
        console.error('Error marking packing slip as completed:', error);
        if (error.code === 'ECONNABORTED' || !error.response) {
          // 如果是网络错误，尝试重试
          try {
            console.log('Retrying...');
            const retryResponse = await axios.put(`http://localhost:5000/api/packing-slips/${slipId}`, {
              isCompleted: true
            }, {
              timeout: 5000,
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            console.log('Retry successful:', retryResponse.data);
            await fetchPackingSlips();
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            alert('网络连接失败，请检查网络连接后重试');
          }
        } else {
          alert(error.response?.data?.error || '更新出库单状态失败，请重试');
        }
      }
    };

    // 取消出库单
    const cancelPackingSlip = async (slipId) => {
      if (!window.confirm('确定要取消这个出库单吗？此操作不可恢复。')) {
        return;
      }
      try {
        await axios.delete(`http://localhost:5000/api/packing-slips/${slipId}`);
        await fetchPackingSlips();
        await fetchItems(); // 添加这行来刷新商品列表
      } catch (error) {
        alert(error.response?.data?.error || '取消出库单失败，请重试');
      }
    };

    // 导出PDF
    const exportToPDF = async (slip) => {
      try {
        const element = document.createElement('div');
        element.className = 'pdf-content';
        element.innerHTML = `
          <div class="pdf-header">
            <h2>出库单</h2>
            <div class="pdf-info">
              <p>出库单号: ${slip.slipNumber}</p>
              <p>日期: ${new Date(slip.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="pdf-customer">
            <h3>客户信息</h3>
            <p>客户名称: ${slip.customerName}</p>
            ${slip.customerAddress ? `<p>地址: ${slip.customerAddress}</p>` : ''}
          </div>
          <div class="pdf-items">
            <h3>商品清单</h3>
            <table>
              <thead>
                <tr>
                  <th>商品名称</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>小计</th>
                </tr>
              </thead>
              <tbody>
                ${slip.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.price).toFixed(2)}</td>
                    <td>$${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="pdf-total">
            <h3>总金额: $${Number(slip.totalAmount).toFixed(2)}</h3>
          </div>
          ${slip.notes ? `
            <div class="pdf-notes">
              <h3>备注</h3>
              <p>${slip.notes}</p>
            </div>
          ` : ''}
        `;
        document.body.appendChild(element);

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 30;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        pdf.save(`出库单_${slip.slipNumber}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('生成PDF失败，请重试');
      } finally {
        const element = document.querySelector('.pdf-content');
        if (element) {
          document.body.removeChild(element);
        }
      }
    };

    // 打印出库单
    const printPackingSlip = (slip) => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>出库单 - ${slip.slipNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .info { margin-bottom: 20px; }
              .customer-info { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; }
              .customer-info p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; }
              .total { text-align: right; font-weight: bold; margin-top: 20px; }
              .notes { margin-top: 20px; padding: 10px; border: 1px solid #ddd; }
              @media print { body { margin: 0; padding: 20px; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>出库单</h1>
              <div class="info">
                <p>出库单号: ${slip.slipNumber}</p>
                <p>日期: ${new Date(slip.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div class="customer-info">
              <h3>客户信息</h3>
              <p><strong>客户名称:</strong> ${slip.customerName || '-'}</p>
              <p><strong>联系人:</strong> ${slip.customerContact || '-'}</p>
              <p><strong>电话:</strong> ${slip.customerPhone || '-'}</p>
              <p><strong>邮箱:</strong> ${slip.customerEmail || '-'}</p>
              <p><strong>公司:</strong> ${slip.customerCompany || '-'}</p>
              <p><strong>地址:</strong> ${slip.customerAddress || '-'}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>商品名称</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>小计</th>
                </tr>
              </thead>
              <tbody>
                ${slip.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.price).toFixed(2)}</td>
                    <td>$${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              总金额: $${Number(slip.totalAmount).toFixed(2)}
            </div>
            ${slip.notes ? `
              <div class="notes">
                <h3>备注</h3>
                <p>${slip.notes}</p>
              </div>
            ` : ''}
            <div style="margin-top: 40px; display: flex; justify-content: space-between; padding: 0 40px;">
              <div style="text-align: center;">
                <div style="margin-bottom: 8px;">收货人签字</div>
                <div style="width: 200px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
                <div style="font-size: 12px; color: #666;">日期：${new Date().toLocaleDateString()}</div>
              </div>
              <div style="text-align: center;">
                <div style="margin-bottom: 8px;">发货人签字</div>
                <div style="width: 200px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
                <div style="font-size: 12px; color: #666;">日期：${new Date().toLocaleDateString()}</div>
              </div>
            </div>
            <div class="no-print" style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()">打印</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    // 添加新客户
    const addCustomer = () => {
      const customerData = {
        name: customerName,
        contact: customerContact,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress,
        notes: customerNotes,
        company: customerCompany
      };
      axios.post('http://localhost:5000/api/customers', customerData)
        .then(res => {
          setCustomers([...customers, res.data]);
          setShowCustomerForm(false);
          setShowCustomerList(true);
          // 重置表单
          setCustomerName('');
          setCustomerContact('');
          setCustomerPhone('');
          setCustomerEmail('');
          setCustomerAddress('');
          setCustomerNotes('');
          setCustomerCompany('');
          setUseCompanyAddress(false);
        })
        .catch(err => {
          alert(err.response?.data?.error || '添加客户失败，请重试');
        });
    };

    // 处理客户表单提交
    const handleCustomerSubmit = (e) => {
      e.preventDefault();
      addCustomer();
    };

    // 处理公司地址复选框变化
    const handleUseCompanyAddressChange = (e) => {
      setUseCompanyAddress(e.target.checked);
      if (e.target.checked) {
        setCustomerAddress(customerCompany);
      }
    };

    // 在 SlipCard 组件内添加编辑出库单的函数
    const editPackingSlip = async (slip) => {
      setEditingSlip(slip);
      setShowCreateForm(true);
      setCustomerName(slip.customerName || '');
      setCustomerContact(slip.customerContact || '');
      setCustomerPhone(slip.customerPhone || '');
      setCustomerEmail(slip.customerEmail || '');
      setCustomerAddress(slip.customerAddress || '');
      setCustomerCompany(slip.customerCompany || '');
      setCustomerSearchTerm(slip.customerName || '');
      setNotes(slip.notes || '');
      setSelectedItems(slip.items.map(item => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity || 0,
        backorderQuantity: item.backorderQuantity || 0,
        price: item.price
      })));
    };

    return (
      <div className="card">
        {showCustomerForm ? (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{margin:0}}>添加新客户</h2>
              <button 
                className="add-item-button"
                onClick={() => {
                  setShowCustomerForm(false);
                  setShowCustomerList(true);
                }}
              >
                返回客户列表
              </button>
            </div>
            <form onSubmit={handleCustomerSubmit} className="customer-form" style={{maxWidth: '600px'}}>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>公司名（可选）</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="请输入公司名"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>联系人</label>
                <input
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="请输入联系人姓名"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>公司地址（可选）</label>
                <input
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  placeholder="请输入公司地址"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>电话</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="请输入电话号码"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>邮箱</label>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                  type="email"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>收货地址</label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="请输入收货地址"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem',
                    marginBottom: 8
                  }}
                />
                <div style={{
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  padding:'4px 8px',
                  background:'#f5f5f5',
                  borderRadius:4,
                  width:'fit-content',
                  whiteSpace:'nowrap'
                }}>
                  <input
                    type="checkbox"
                    id="useCompanyAddress"
                    checked={useCompanyAddress}
                    onChange={handleUseCompanyAddressChange}
                    style={{margin:0}}
                  />
                  <label htmlFor="useCompanyAddress" style={{
                    fontSize:'0.9rem',
                    color:'#666',
                    margin:0,
                    cursor:'pointer',
                    whiteSpace:'nowrap'
                  }}>
                    与公司地址相同
                  </label>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',marginBottom:8,color:'#333',fontSize:'0.95rem',fontWeight:500}}>备注</label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="请输入备注信息"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.95rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              <button type="submit" style={{
                padding: '8px 16px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}>
                添加客户
              </button>
            </form>
          </>
        ) : showCreateForm ? (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{margin:0}}>创建出库单</h2>
              <button 
                className="add-item-button"
                onClick={() => {
                  setShowCreateForm(false);
        setSelectedItems([]);
        setCustomerName('');
        setCustomerContact('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerAddress('');
        setCustomerCompany('');
        setNotes('');
        setEditingSlip(null);
                }}
              >
                返回出库单列表
              </button>
            </div>
            <div className="packing-slip">
              <div className="customer-info" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                maxWidth: '800px',
                marginBottom: '32px',
                background: '#fff',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '24px'
                }}>
                  <div style={{position:'relative'}}>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>选择或搜索客户</label>
                    <div style={{
                      position:'relative',
                      width:'100%'
                    }}>
                      <div style={{display:'flex',gap:8}}>
                        <input
                          type="text"
                          placeholder="搜索客户..."
                          value={customerSearchTerm}
                          onChange={(e) => {
                            setCustomerSearchTerm(e.target.value);
                            setCustomerName(e.target.value);
                          }}
                          onFocus={() => setShowCustomerList(true)}
                          style={{
                            flex:1,
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.95rem'
                          }}
                        />
                        <button
                          onClick={handleCustomerSearch}
                          style={{
                            padding: '8px 16px',
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          搜索
                        </button>
                      </div>
                      {showCustomerList && (
                        <div style={{
                          position:'absolute',
                          top:'100%',
                          left:0,
                          right:0,
                          background:'white',
                          border:'1px solid #ddd',
                          borderRadius:4,
                          boxShadow:'0 2px 4px rgba(0,0,0,0.1)',
                          zIndex:1000,
                          maxHeight:300,
                          overflow:'auto',
                          marginTop:4
                        }}>
                          <ul style={{margin:0,padding:0,listStyle:'none'}}>
                            {customers.length > 0 ? (
                              customers.map(customer => (
                                <li 
                                  key={customer._id}
                                  onClick={() => {
                                    selectCustomer(customer);
                                    setCustomerContact(customer.contact || '');
                                    setCustomerPhone(customer.phone || '');
                                    setCustomerEmail(customer.email || '');
                                    setCustomerCompany(customer.company || '');
                                    setCustomerAddress(customer.address || '');
                                    setCustomerSearchTerm(customer.name);
                                    setShowCustomerList(false);
                                  }}
                                  style={{
                                    padding:8,
                                    cursor:'pointer',
                                    borderBottom:'1px solid #eee',
                                    ':hover':{background:'#f5f5f5'}
                                  }}
                                >
                                  <div style={{fontWeight:'bold'}}>{customer.name}</div>
                                  {customer.company && (
                                    <div style={{color:'#2196F3',fontSize:'0.9rem'}}>公司: {customer.company}</div>
                                  )}
                                  {customer.contact && (
                                    <div style={{color:'#666',fontSize:'0.9rem'}}>联系人: {customer.contact}</div>
                                  )}
                                </li>
                              ))
                            ) : (
                              <li style={{
                                padding: '16px',
                                textAlign: 'center',
                                color: '#666',
                                borderBottom: '1px solid #eee'
                              }}>
                                <div style={{marginBottom: '8px'}}>
                                  {customerSearchTerm ? '没有找到匹配的客户' : '暂无客户数据'}
                                </div>
                                <button
                                  onClick={() => {
                                    setShowCustomerList(false);
                                    setShowCustomerForm(true);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  添加新客户
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>联系人</label>
                    <input
                      type="text"
                      placeholder="请输入联系人姓名"
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>电话</label>
                    <input
                      type="tel"
                      placeholder="请输入联系电话"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>邮箱</label>
                    <input
                      type="email"
                      placeholder="请输入电子邮箱"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>公司地址</label>
                    <input
                      type="text"
                      placeholder="请输入公司地址"
                      value={customerCompany}
                      onChange={(e) => setCustomerCompany(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display:'block',
                      marginBottom:8,
                      color:'#333',
                      fontSize:'0.95rem',
                      fontWeight:500
                    }}>收货地址</label>
                    <input
                      type="text"
                      placeholder="请输入收货地址"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{
                    display:'block',
                    marginBottom:8,
                    color:'#333',
                    fontSize:'0.95rem',
                    fontWeight:500
                  }}>备注</label>
                  <textarea
                    placeholder="请输入备注信息"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
              <div className="packing-slip-content">
                <div className="available-items">
                  <h3>可选商品</h3>
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="搜索商品..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        padding: '8px',
                        width: '200px',
                        marginRight: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      搜索
                    </button>
                    {searchTerm && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          fetchItems();
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#f5f5f5',
                          color: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          marginLeft: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        取消搜索
                      </button>
                    )}
                  </div>
                  <ul className="items-list">
                    {items && items.length > 0 ? (
                      items.map(item => (
                        <li key={item._id} className="item-card" style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 120px',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'white',
                          borderRadius: '8px',
                          border: '1px solid #eee',
                          marginBottom: '8px',
                          gap: '24px'
                        }}>
                          <span style={{
                            fontWeight: 500,
                            fontSize: '0.95rem'
                          }}>{item.name}</span>
                          <span style={{
                            color: '#666',
                            fontSize: '0.95rem'
                          }}>库存: {item.quantity}</span>
                          <span style={{
                            color: '#2196F3',
                            fontSize: '0.95rem'
                          }}>建议售价: ${item.sellingPrice || (item.price * 1.67).toFixed(2)}</span>
                          <button 
                            onClick={() => addToPackingSlip(item)}
                            disabled={item.quantity <= 0}
                            style={{
                              padding: '6px 16px',
                              background: item.quantity <= 0 ? '#f5f5f5' : '#4CAF50',
                              color: item.quantity <= 0 ? '#999' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: item.quantity <= 0 ? 'not-allowed' : 'pointer',
                              fontSize: '0.9rem',
                              whiteSpace: 'nowrap',
                              justifySelf: 'end'
                            }}
                          >
                            {item.quantity <= 0 ? '库存不足' : '添加到出库单'}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="no-items" style={{
                        textAlign: 'center',
                        padding: '32px',
                        background: '#f5f5f5',
                        borderRadius: '8px',
                        color: '#666'
                      }}>没有找到商品</li>
                    )}
                  </ul>
                </div>
                <div className="selected-items">
                  <h3>已选商品</h3>
                  {selectedItems.length > 0 ? (
                    <div style={{
                      background:'#fff',
                      borderRadius:8,
                      border:'1px solid #eee',
                      overflow:'hidden'
                    }}>
                      <div style={{
                        display:'grid',
                        gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 80px',
                        padding:'12px 16px',
                        background:'#f5f5f5',
                        borderBottom:'1px solid #eee',
                        fontWeight:'bold',
                        color:'#666'
                      }}>
                        <div>商品名称</div>
                        <div>供货数量</div>
                        <div>单价</div>
                        <div>小计</div>
                        <div>缺货数量</div>
                        <div>操作</div>
                        <div></div>
                      </div>
                      {selectedItems.map(item => (
                        <div key={item.itemId} style={{
                          display:'grid',
                          gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 80px',
                          padding:'12px 16px',
                          borderBottom:'1px solid #eee',
                          alignItems:'center'
                        }}>
                          <div style={{fontWeight:500}}>{item.name}</div>
                          <div>
                            <div style={{
                              display:'inline-flex',
                              alignItems:'center',
                              border:'1px solid #ddd',
                              borderRadius:4,
                              overflow:'hidden'
                            }}>
                              <button 
                                onClick={() => updatePackingSlipItemQuantity(item.itemId, (item.quantity + item.backorderQuantity) - 1)}
                                style={{
                                  padding:'4px 12px',
                                  border:'none',
                                  background:'#f5f5f5',
                                  cursor:'pointer',
                                  fontSize:'16px',
                                  fontWeight:'bold',
                                  color:'#666',
                                  display:'flex',
                                  alignItems:'center',
                                  justifyContent:'center',
                                  minWidth:32,
                                  ':hover':{background:'#eee'}
                                }}
                              >
                                −
                              </button>
                              <span style={{
                                padding:'4px 12px',
                                minWidth:40,
                                textAlign:'center',
                                borderLeft:'1px solid #ddd',
                                borderRight:'1px solid #ddd',
                                background:'white'
                              }}>
                                {item.quantity + item.backorderQuantity}
                              </span>
                              <button 
                                onClick={() => updatePackingSlipItemQuantity(item.itemId, (item.quantity + item.backorderQuantity) + 1)}
                                style={{
                                  padding:'4px 12px',
                                  border:'none',
                                  background:'#f5f5f5',
                                  cursor:'pointer',
                                  fontSize:'16px',
                                  fontWeight:'bold',
                                  color:'#666',
                                  display:'flex',
                                  alignItems:'center',
                                  justifyContent:'center',
                                  minWidth:32,
                                  ':hover':{background:'#eee'}
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div>${Number(item.price).toFixed(2)}</div>
                          <div style={{color:'#2196F3',fontWeight:500}}>
                            ${(item.price * (item.quantity + item.backorderQuantity)).toFixed(2)}
                          </div>
                          <div style={{color:'#f44336',fontWeight:500}}>
                            {item.backorderQuantity || 0}
                          </div>
                          <div>
                            <button 
                              onClick={() => removeFromPackingSlip(item.itemId)}
                              style={{
                                padding:'4px 8px',
                                border:'none',
                                background:'#f44336',
                                color:'white',
                                borderRadius:4,
                                cursor:'pointer',
                                fontSize:'0.9rem'
                              }}
                            >
                              移除
                            </button>
                          </div>
                          <div></div>
                        </div>
                      ))}
                      <div style={{
                        display:'flex',
                        justifyContent:'flex-end',
                        padding:'16px',
                        background:'#f5f5f5',
                        borderTop:'1px solid #eee'
                      }}>
                        <div style={{
                          fontSize:'1.1rem',
                          fontWeight:'bold'
                        }}>
                          总计: <span style={{color:'#2196F3'}}>
                            ${selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      textAlign:'center',
                      padding:'32px',
                      background:'#f5f5f5',
                      borderRadius:8,
                      color:'#666'
                    }}>
                      请从商品列表中选择商品
                    </div>
                  )}
                </div>
              </div>
              <div className="packing-slip-actions">
                <button onClick={() => {
                  if (selectedItems.length === 0) {
                    alert('请至少添加一个商品');
                    return;
                  }
                  if (!customerName) {
                    alert('请选择或输入客户名称');
                    return;
                  }
                  createPackingSlip();
                }}>{editingSlip ? '更新出库单' : '创建出库单'}</button>
              </div>
            </div>

            {/* 数量选择弹窗 */}
            {showQuantityModal && selectedItem && (
              <div className="modal">
                <div className="modal-content" style={{maxWidth:400}}>
                  <h3>设置数量和价格</h3>
                  <div style={{marginBottom:16}}>
                    <label style={{display:'block',marginBottom:8}}>商品名称</label>
                    <div style={{padding:8,background:'#f5f5f5',borderRadius:4}}>
                      {selectedItem.name}
                    </div>
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{display:'block',marginBottom:8}}>客户需求数量</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      style={{width:'100%',padding:8}}
                    />
                    <div style={{color:'#666',fontSize:'0.9rem',marginTop:4}}>
                      可用库存: {selectedItem.quantity}
                    </div>
                    {Number(itemQuantity) > selectedItem.quantity && (
                      <div style={{color:'#f44336',fontSize:'0.9rem',marginTop:4}}>
                        超出库存: {Number(itemQuantity) - selectedItem.quantity} 个
                        <br/>
                        将自动计入缺货数量
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{display:'block',marginBottom:8}}>销售价格</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      style={{width:'100%',padding:8}}
                    />
                    <div style={{color:'#666',fontSize:'0.9rem',marginTop:4}}>
                      建议售价: ${selectedItem.sellingPrice || (selectedItem.price * 1.67).toFixed(2)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button 
                      onClick={() => {
                        setShowQuantityModal(false);
                        setSelectedItem(null);
                      }}
                      style={{background:'#f5f5f5',color:'#666'}}
                    >
                      取消
                    </button>
                    <button onClick={confirmAddItem}>
                      确认添加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{margin:0}}>出库单管理</h2>
              <button 
                className="add-item-button"
                onClick={() => {
                  setShowCreateForm(true);
                  setSelectedItems([]);
                  setCustomerName('');
                  setCustomerContact('');
                  setCustomerPhone('');
                  setCustomerEmail('');
                  setCustomerAddress('');
                  setCustomerCompany('');
                  setNotes('');
                  setEditingSlip(null);
                }}
              >
                创建出库单
              </button>
            </div>

            <div className="packing-slips-list">
              <h3>等待提货的出库单</h3>
              {packingSlips.filter(slip => !slip.isCompleted).map(slip => (
                <div key={slip._id} style={{
                  background:'white',
                  borderRadius:8,
                  border:'1px solid #eee',
                  marginBottom:16,
                  overflow:'hidden'
                }}>
                  <div style={{
                    padding:'16px',
                    background:'#fff3e0',
                    borderBottom:'1px solid #eee',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center'
                  }}>
                    <div style={{display:'flex',gap:24,alignItems:'center'}}>
                      <div style={{fontWeight:'bold',fontSize:'1.1rem'}}>
                        出库单号: {slip.slipNumber}
                      </div>
                      <div style={{color:'#666'}}>
                        日期: {new Date(slip.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button 
                        onClick={() => exportToPDF(slip)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#2196F3',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        导出PDF
                      </button>
                      <button 
                        onClick={() => printPackingSlip(slip)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#4CAF50',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        打印
                      </button>
                      <button 
                        onClick={() => editPackingSlip(slip)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#ffc107',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => markAsCompleted(slip._id)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#ff9800',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        标记为已完成
                      </button>
                      <button 
                        onClick={() => cancelPackingSlip(slip._id)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#f44336',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        取消订单
                      </button>
                    </div>
                  </div>
                  <div style={{
                    padding:'16px',
                    background:'white'
                  }}>
                    <div style={{
                      display:'grid',
                      gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                      padding:'12px 16px',
                      background:'#f5f5f5',
                      borderBottom:'1px solid #eee',
                      fontWeight:500
                    }}>
                      <div>商品名称</div>
                      <div>供货数量</div>
                      <div>单价</div>
                      <div>小计</div>
                      <div>缺货数量</div>
                    </div>
                    {slip.items.map(item => {
                      const quantity = item.quantity || 0;
                      const backorderQuantity = item.backorderQuantity || 0;
                      const price = Number(item.price) || 0;
                      const subtotal = quantity * price;
                      
                      return (
                        <div key={item.itemId} style={{
                          display:'grid',
                          gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                          padding:'12px 16px',
                          borderBottom:'1px solid #eee',
                          fontSize:'0.95rem'
                        }}>
                          <div>{item.name}</div>
                          <div>{quantity}</div>
                          <div>${price.toFixed(2)}</div>
                          <div style={{color:'#2196F3',fontWeight:500}}>
                            ${subtotal.toFixed(2)}
                          </div>
                          <div style={{color:'#f44336'}}>
                            {backorderQuantity}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    padding:'16px',
                    background:'#f5f5f5',
                    borderRadius:4
                  }}>
                    <div style={{fontWeight:500}}>
                      总金额: <span style={{color:'#2196F3',fontSize:'1.1rem'}}>
                        ${slip.items.reduce((sum, item) => sum + (item.quantity || 0) * (Number(item.price) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    {slip.notes && (
                      <div style={{color:'#666',fontSize:'0.95rem'}}>
                        备注: {slip.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {packingSlips.filter(slip => !slip.isCompleted).length === 0 && (
                <div style={{
                  textAlign:'center',
                  padding:'32px',
                  background:'#f5f5f5',
                  borderRadius:8,
                  color:'#666'
                }}>
                  暂无等待提货的出库单
                </div>
              )}

              <h3 style={{marginTop:32}}>历史已完成出库单</h3>
              {packingSlips.filter(slip => slip.isCompleted).map(slip => (
                <div key={slip._id} style={{
                  background:'white',
                  borderRadius:8,
                  border:'1px solid #eee',
                  marginBottom:16,
                  overflow:'hidden'
                }}>
                  <div style={{
                    padding:'16px',
                    background:'#f5f5f5',
                    borderBottom:'1px solid #eee',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center'
                  }}>
                    <div style={{display:'flex',gap:24,alignItems:'center'}}>
                      <div style={{fontWeight:'bold',fontSize:'1.1rem'}}>
                        出库单号: {slip.slipNumber}
                      </div>
                      <div style={{color:'#666'}}>
                        日期: {new Date(slip.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button 
                        onClick={() => exportToPDF(slip)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#2196F3',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        导出PDF
                      </button>
                      <button 
                        onClick={() => printPackingSlip(slip)}
                        style={{
                          padding:'6px 12px',
                          border:'none',
                          background:'#4CAF50',
                          color:'white',
                          borderRadius:4,
                          cursor:'pointer',
                          fontSize:'0.9rem'
                        }}
                      >
                        打印
                      </button>
                    </div>
                  </div>
                  <div style={{padding:'16px'}}>
                    <div style={{marginBottom:16}}>
                      <div style={{fontWeight:500,marginBottom:8}}>客户信息</div>
                      <div style={{color:'#666',fontSize:'0.95rem'}}>
                        <div>客户名称: {slip.customerName}</div>
                        {slip.customerAddress && <div>地址: {slip.customerAddress}</div>}
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontWeight:500,marginBottom:8}}>商品清单</div>
                      <div style={{
                        background:'#f5f5f5',
                        borderRadius:4,
                        overflow:'hidden'
                      }}>
                        <div style={{
                          display:'grid',
                          gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                          padding:'12px 16px',
                          background:'#eee',
                          fontWeight:'bold',
                          color:'#666',
                          fontSize:'0.9rem'
                        }}>
                          <div>商品名称</div>
                          <div>供货数量</div>
                          <div>单价</div>
                          <div>小计</div>
                          <div>缺货数量</div>
                        </div>
                        {slip.items.map(item => (
                          <div key={item.itemId} style={{
                            display:'grid',
                            gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                            padding:'12px 16px',
                            borderTop:'1px solid #eee',
                            fontSize:'0.95rem'
                          }}>
                            <div>{item.name}</div>
                            <div>{item.quantity}</div>
                            <div>${Number(item.price).toFixed(2)}</div>
                            <div style={{color:'#2196F3',fontWeight:500}}>
                              ${(item.price * item.quantity).toFixed(2)}
                            </div>
                            <div style={{color:'#f44336'}}>
                              {item.backorderQuantity || 0}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center',
                      padding:'16px',
                      background:'#f5f5f5',
                      borderRadius:4
                    }}>
                      <div style={{fontWeight:500}}>
                        总金额: <span style={{color:'#2196F3',fontSize:'1.1rem'}}>
                          ${Number(slip.totalAmount).toFixed(2)}
                        </span>
                      </div>
                      {slip.notes && (
                        <div style={{color:'#666',fontSize:'0.95rem'}}>
                          备注: {slip.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {packingSlips.filter(slip => slip.isCompleted).length === 0 && (
                <div style={{
                  textAlign:'center',
                  padding:'32px',
                  background:'#f5f5f5',
                  borderRadius:8,
                  color:'#666'
                }}>
                  暂无历史已完成出库单
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function VendorCard() {
    const [vendors, setVendors] = useState([]);
    const [vendorName, setVendorName] = useState('');
    const [vendorContact, setVendorContact] = useState('');
    const [vendorPhone, setVendorPhone] = useState('');
    const [vendorEmail, setVendorEmail] = useState('');
    const [vendorAddress, setVendorAddress] = useState('');
    const [vendorNotes, setVendorNotes] = useState('');
    const [vendorStatus, setVendorStatus] = useState('active');
    const [editingVendorId, setEditingVendorId] = useState(null);
    const [vendorSearchTerm, setVendorSearchTerm] = useState('');
    const [showVendorForm, setShowVendorForm] = useState(false);

    // 获取所有供货商
    const fetchVendors = async (search = '', retryCount = 0) => {
      try {
        const url = search
          ? `http://localhost:5000/api/vendors?search=${encodeURIComponent(search)}`
          : 'http://localhost:5000/api/vendors';
        const res = await axios.get(url, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        if (Array.isArray(res.data)) {
          setVendors(res.data);
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (error) {
        if ((error.code === 'ECONNABORTED' || !error.response) && retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchVendors(search, retryCount + 1);
        }
        alert('获取供货商数据失败，请重试');
      }
    };

    useEffect(() => {
      fetchVendors();
    }, []);

    // 添加新供货商
    const addVendor = () => {
      const vendorData = {
        name: vendorName,
        contact: vendorContact,
        phone: vendorPhone,
        email: vendorEmail,
        address: vendorAddress,
        notes: vendorNotes,
        status: vendorStatus
      };
      axios.post('http://localhost:5000/api/vendors', vendorData)
        .then(res => {
          setVendors([...vendors, res.data]);
          resetForm();
        })
        .catch(err => {
          alert(err.response?.data?.error || '添加供货商失败，请重试');
        });
    };

    // 更新供货商
    const updateVendor = () => {
      if (!editingVendorId) return;
      const vendorData = {
        name: vendorName,
        contact: vendorContact,
        phone: vendorPhone,
        email: vendorEmail,
        address: vendorAddress,
        notes: vendorNotes,
        status: vendorStatus
      };
      axios.put(`http://localhost:5000/api/vendors/${editingVendorId}`, vendorData)
        .then(res => {
          setVendors(vendors.map(vendor =>
            vendor._id === editingVendorId ? res.data : vendor
          ));
          setEditingVendorId(null);
          resetForm();
        })
        .catch(err => {
          alert(err.response?.data?.error || '更新供货商失败，请重试');
        });
    };

    // 删除供货商
    const deleteVendor = (id) => {
      if (window.confirm('确定要删除这个供货商吗？')) {
        axios.delete(`http://localhost:5000/api/vendors/${id}`)
          .then(() => {
            setVendors(vendors.filter(vendor => vendor._id !== id));
          })
          .catch(err => {
            alert(err.response?.data?.error || '删除供货商失败，请重试');
          });
      }
    };

    // 编辑供货商
    const startEditVendor = (vendor) => {
      setEditingVendorId(vendor._id);
      setVendorName(vendor.name);
      setVendorContact(vendor.contact || '');
      setVendorPhone(vendor.phone || '');
      setVendorEmail(vendor.email || '');
      setVendorAddress(vendor.address || '');
      setVendorNotes(vendor.notes || '');
      setVendorStatus(vendor.status || 'active');
    };

    // 表单重置
    const resetForm = () => {
      setVendorName('');
      setVendorContact('');
      setVendorPhone('');
      setVendorEmail('');
      setVendorAddress('');
      setVendorNotes('');
      setVendorStatus('active');
    };

    // 表单提交
    const handleVendorSubmit = (e) => {
      e.preventDefault();
      if (editingVendorId) {
        updateVendor();
      } else {
        addVendor();
      }
    };

    // 搜索
    const handleVendorSearch = () => {
      fetchVendors(vendorSearchTerm);
    };

    // 状态切换
    const toggleVendorStatus = (vendor) => {
      const newStatus = vendor.status === 'active' ? 'inactive' : 'active';
      axios.put(`http://localhost:5000/api/vendors/${vendor._id}`, { ...vendor, status: newStatus })
        .then(res => {
          setVendors(vendors.map(v => v._id === vendor._id ? res.data : v));
        });
    };

    const handleVendorSelect = (e) => {
      const vendorId = e.target.value;
      const selectedVendor = vendors.find(v => v._id === vendorId);
      setSelectedVendorId(vendorId);
      setSelectedVendorName(selectedVendor ? selectedVendor.name : '');
    };

    return (
      <div className="card">
        {showVendorForm ? (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{margin:0}}>{editingVendorId ? '编辑供应商' : '添加供应商'}</h2>
              <button 
                className="add-item-button"
                onClick={() => {
                  setShowVendorForm(false);
                  setEditingVendorId(null);
                  resetForm();
                }}
              >
                返回供应商列表
              </button>
            </div>
            <form onSubmit={handleVendorSubmit} className="customer-form">
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="供应商名称"
                required
              />
              <input
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                placeholder="联系人"
              />
              <input
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="电话"
              />
              <input
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="邮箱"
                type="email"
              />
              <input
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                placeholder="地址"
              />
              <textarea
                value={vendorNotes}
                onChange={(e) => setVendorNotes(e.target.value)}
                placeholder="备注"
              />
              <select value={vendorStatus} onChange={e => setVendorStatus(e.target.value)}>
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
              <button type="submit">
                {editingVendorId ? '更新' : '添加'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <h2 style={{margin:0}}>供应商管理</h2>
                <button 
                  className="add-item-button"
                  style={{marginLeft:0}}
                  onClick={() => {
                    setEditingVendorId(null);
                    setShowVendorForm(true);
                  }}
                >
                  添加供应商
                </button>
              </div>
            </div>

            <div className="search-box" style={{marginBottom:24}}>
              <input
                type="text"
                placeholder="搜索供应商名称、联系人、电话..."
                value={vendorSearchTerm}
                onChange={(e) => setVendorSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleVendorSearch();
                  }
                }}
              />
              <button onClick={handleVendorSearch}>搜索</button>
            </div>

            <div className="customers-list">
              <h3>供应商列表 ({vendors.length})</h3>
              <ul>
                {vendors.map(vendor => (
                  <li key={vendor._id} style={{
                    background:'white',
                    borderRadius:8,
                    border:'1px solid #eee',
                    marginBottom:16,
                    padding:16,
                    listStyle:'none'
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:8}}>
                          <span style={{fontSize:'1.1rem',fontWeight:500}}>{vendor.name}</span>
                          <span style={{
                            padding:'2px 8px',
                            borderRadius:4,
                            fontSize:'0.9rem',
                            background:vendor.status==='active'?'#e3f2fd':'#ffebee',
                            color:vendor.status==='active'?'#1976d2':'#d32f2f'
                          }}>
                            {vendor.status==='active'?'启用':'禁用'}
                          </span>
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:16,color:'#666',fontSize:'0.95rem'}}>
                          {vendor.contact && <span>联系人: {vendor.contact}</span>}
                          {vendor.phone && <span>电话: {vendor.phone}</span>}
                          {vendor.email && <span>邮箱: {vendor.email}</span>}
                          {vendor.address && <span>地址: {vendor.address}</span>}
                          {vendor.notes && <span>备注: {vendor.notes}</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button 
                          onClick={() => {
                            startEditVendor(vendor);
                            setShowVendorForm(true);
                          }}
                          style={{
                            padding:'6px 12px',
                            border:'none',
                            background:'#2196F3',
                            color:'white',
                            borderRadius:4,
                            cursor:'pointer',
                            fontSize:'0.9rem'
                          }}
                        >
                          编辑
                        </button>
                        <button 
                          onClick={() => deleteVendor(vendor._id)}
                          style={{
                            padding:'6px 12px',
                            border:'none',
                            background:'#f44336',
                            color:'white',
                            borderRadius:4,
                            cursor:'pointer',
                            fontSize:'0.9rem'
                          }}
                        >
                          删除
                        </button>
                        <button 
                          onClick={() => toggleVendorStatus(vendor)}
                          style={{
                            padding:'6px 12px',
                            border:'none',
                            background:vendor.status==='active'?'#f44336':'#4CAF50',
                            color:'white',
                            borderRadius:4,
                            cursor:'pointer',
                            fontSize:'0.9rem'
                          }}
                        >
                          {vendor.status==='active'?'禁用':'启用'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  function AnalysisCard() {
    const [items, setItems] = useState([]);
    const [packingSlips, setPackingSlips] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [tab, setTab] = useState('stock'); // stock/ vendor

    // 供货商分析相关
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [vendorStats, setVendorStats] = useState(null);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleVendorSelect = (e) => {
      const vendorId = e.target.value;
      setSelectedVendorId(vendorId);
    };

    useEffect(() => {
      const fetchData = async () => {
        const [itemsRes, slipsRes, vendorsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/items'),
          axios.get('http://localhost:5000/api/packing-slips'),
          axios.get('http://localhost:5000/api/vendors')
        ]);
        setItems(itemsRes.data);
        setPackingSlips(slipsRes.data);
        setVendors(vendorsRes.data);
      };
      fetchData();
    }, []);

    useEffect(() => {
      if (!items.length) return;
      setLoading(true);
      const slipMap = {};
      packingSlips.forEach(slip => {
        slip.items.forEach(i => {
          if (!slipMap[i.itemId]) slipMap[i.itemId] = 0;
          slipMap[i.itemId] += i.quantity;
        });
      });
      const result = items.map(item => {
        const inQty = (item.purchaseHistory || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
        const outQty = slipMap[item._id] || 0;
        const stock = item.quantity;
        return {
          name: item.name,
          inQty,
          outQty,
          stock
        };
      });
      setData(result);
      setLoading(false);
    }, [items, packingSlips]);

    // 供货商分析统计逻辑
    const handleVendorAnalysis = () => {
      if (!selectedVendorId || !dateStart || !dateEnd) {
        alert('请选择供货商和时间范围');
        return;
      }
      const start = new Date(dateStart);
      const end = new Date(dateEnd);
      end.setHours(23,59,59,999);
      // 1. 统计消费额（进货总金额）
      let purchaseDetails = [];
      let purchaseTotal = 0;
      items.forEach(item => {
        (item.purchaseHistory||[]).forEach(ph => {
          if (ph.vendorId === selectedVendorId && ph.date && new Date(ph.date) >= start && new Date(ph.date) <= end) {
            purchaseTotal += (ph.price||0) * (ph.quantity||0);
            purchaseDetails.push({
              itemName: item.name,
              date: ph.date,
              price: ph.price,
              quantity: ph.quantity,
              amount: (ph.price||0)*(ph.quantity||0)
            });
          }
        });
      });
      // 2. 统计卖出额（卖出总金额）
      let sellDetails = [];
      let sellTotal = 0;
      packingSlips.forEach(slip => {
        const slipDate = new Date(slip.date);
        if (slipDate < start || slipDate > end) return;
        slip.items.forEach(slipItem => {
          // 找到该商品的purchaseHistory中最近一次属于该vendorId的进货
          const item = items.find(i => i._id === slipItem.itemId);
          if (!item) return;
          // 找到最接近出库时间的、属于该vendorId的进货记录
          const vendorPurchases = (item.purchaseHistory||[]).filter(ph => ph.vendorId === selectedVendorId && new Date(ph.date) <= slipDate);
          let lastVendorPurchase = null;
          if (vendorPurchases.length > 0) {
            lastVendorPurchase = vendorPurchases.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
          }
          if (lastVendorPurchase) {
            const amount = (slipItem.price||0) * (slipItem.quantity||0);
            sellTotal += amount;
            sellDetails.push({
              itemName: item.name,
              date: slip.date,
              price: slipItem.price,
              quantity: slipItem.quantity,
              amount
            });
          }
        });
      });
      setVendorStats({ purchaseTotal, purchaseDetails, sellTotal, sellDetails });
    };

    return (
      <div className="card">
        <h2>库存分析</h2>
        <div style={{display:'flex',gap:16,marginBottom:24}}>
          <button className={tab==='stock'?'active':''} onClick={()=>setTab('stock')}>库存总览</button>
          <button className={tab==='vendor'?'active':''} onClick={()=>setTab('vendor')}>供货商分析</button>
        </div>
        {tab==='stock' && (
          <>
            <table style={{width:'100%',borderCollapse:'collapse',marginTop:16}}>
              <thead>
                <tr style={{background:'#f5f5f5'}}>
                  <th style={{padding:8,border:'1px solid #eee'}}>商品名称</th>
                  <th style={{padding:8,border:'1px solid #eee'}}>进货总量</th>
                  <th style={{padding:8,border:'1px solid #eee'}}>出库总量</th>
                  <th style={{padding:8,border:'1px solid #eee'}}>当前库存</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.name}>
                    <td style={{padding:8,border:'1px solid #eee'}}>{row.name}</td>
                    <td style={{padding:8,border:'1px solid #eee'}}>{row.inQty}</td>
                    <td style={{padding:8,border:'1px solid #eee'}}>{row.outQty}</td>
                    <td style={{padding:8,border:'1px solid #eee'}}>{row.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab==='vendor' && (
          <div style={{marginTop:16}}>
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
              <select value={selectedVendorId} onChange={handleVendorSelect} style={{padding:8}}>
                <option value="">选择供货商</option>
                {vendors.map(v=> <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
              <input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
              <span>至</span>
              <input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
              <button onClick={handleVendorAnalysis}>分析</button>
            </div>
            {vendorStats && (
              <div>
                <div style={{marginBottom:16}}>
                  <b>消费额：</b><span style={{color:'#2196F3',fontWeight:600}}>{vendorStats.purchaseTotal.toFixed(2)}</span> 元
                  <span style={{marginLeft:32}}></span>
                  <b>卖出额：</b><span style={{color:'#f44336',fontWeight:600}}>{vendorStats.sellTotal.toFixed(2)}</span> 元
                </div>
                <div style={{display:'flex',gap:32}}>
                  <div style={{flex:1}}>
                    <h4>进货明细</h4>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                      <thead>
                        <tr style={{background:'#f5f5f5'}}>
                          <th style={{padding:6,border:'1px solid #eee'}}>商品</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>日期</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>单价</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>数量</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorStats.purchaseDetails.map((row,i)=>(
                          <tr key={i}>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.itemName}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{new Date(row.date).toLocaleDateString()}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.price}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.quantity}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{flex:1}}>
                    <h4>卖出明细</h4>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                      <thead>
                        <tr style={{background:'#f5f5f5'}}>
                          <th style={{padding:6,border:'1px solid #eee'}}>商品</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>日期</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>单价</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>数量</th>
                          <th style={{padding:6,border:'1px solid #eee'}}>金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorStats.sellDetails.map((row,i)=>(
                          <tr key={i}>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.itemName}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{new Date(row.date).toLocaleDateString()}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.price}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.quantity}</td>
                            <td style={{padding:6,border:'1px solid #eee'}}>{row.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Router>
      <Routes future={{ v7_relativeSplatPath: true }}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={
          <RequireAuth>
            <div>
              {/* 顶部导航栏 */}
              <div className="top-navbar">
                <div className="logo" style={{display:'flex',alignItems:'center',gap:8}}>
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="logo" 
                      style={{height:32, borderRadius:6, background:'#fff'}} 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/no-img.png';
                      }}
                    />
                  ) : (
                    <span>InventoryApp</span>
                  )}
                  <label style={{cursor:'pointer', fontSize:12, color:'#e3eafc', marginLeft:8}}>
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoChange} disabled={uploading} />
                    <span style={{color:'#fff', textDecoration:'underline'}}>{uploading ? '上传中...' : '上传logo'}</span>
                  </label>
                </div>
                <div className="user-info">
                  <span className="username">{username}</span>
                  <button className="logout-btn" onClick={handleLogout}>退出</button>
                </div>
              </div>
              {/* 主布局 */}
              <div className="layout">
                {/* 侧边栏 */}
                <aside className="sidebar">
                  <div className={tab==='inventory' ? 'active' : ''} onClick={()=>setTab('inventory')}>库存管理</div>
                  <div className={tab==='customer' ? 'active' : ''} onClick={()=>setTab('customer')}>客户管理</div>
                  <div className={tab==='slip' ? 'active' : ''} onClick={()=>setTab('slip')}>出库单管理</div>
                  <div className={tab==='vendor' ? 'active' : ''} onClick={()=>setTab('vendor')}>供货商管理</div>
                  <div className={tab==='analysis' ? 'active' : ''} onClick={()=>setTab('analysis')}>库存分析</div>
                </aside>
                {/* 主内容区 */}
                <main className="main-content">
                  <MainContent />
                </main>
              </div>
            </div>
          </RequireAuth>
        } />
      </Routes>
    </Router>
  );
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default App;
