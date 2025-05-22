import { useState, useEffect } from 'react';
import axios from 'axios';

function AddItem({ onItemAdded, onCancel, editingItem = null }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    // 获取供货商列表
    axios.get('http://localhost:5000/api/vendors').then(res => {
      setVendors(res.data);
    });

    // 如果是编辑模式，填充表单
    if (editingItem) {
      setName(editingItem.name);
      setPrice(editingItem.latestPrice?.toString() || editingItem.price?.toString() || '');
      setSellingPrice(editingItem.sellingPrice?.toString() || '');
      setReorderLevel(editingItem.reorderLevel?.toString() || '');
      setImageUrl(editingItem.imageUrl || '');
      
      // 设置最近一次进货的供货商
      if (editingItem.purchaseHistory && editingItem.purchaseHistory.length > 0) {
        const lastPurchase = editingItem.purchaseHistory[editingItem.purchaseHistory.length - 1];
        setSelectedVendorId(lastPurchase.vendorId || '');
        setSelectedVendorName(lastPurchase.vendorName || '');
      }
    }
  }, [editingItem]);

  const calculateSellingPrice = (price) => {
    if (!price || isNaN(price)) return 0;
    return (Number(price) * 1.67).toFixed(2);
  };

  const handlePriceChange = (e) => {
    const costPrice = parseFloat(e.target.value);
    setPrice(e.target.value);
    if (!isNaN(costPrice) && costPrice > 0) {
      const newSellingPrice = calculateSellingPrice(costPrice);
      setSellingPrice(newSellingPrice);
    } else {
      setSellingPrice('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVendorId) {
      alert('请选择供货商');
      return;
    }

    const newPurchase = {
      price: Number(price),
      quantity: Number(quantity),
      date: new Date(),
      vendorId: selectedVendorId,
      vendorName: selectedVendorName
    };

    const selectedVendor = vendors.find(v => v._id === selectedVendorId);
    const itemData = {
      name,
      quantity: editingItem ? editingItem.quantity : Number(quantity),
      price: Number(price),
      sellingPrice: Number(sellingPrice),
      latestPrice: Number(price),
      reorderLevel: Number(reorderLevel) || 0,
      purchaseHistory: editingItem ? [...editingItem.purchaseHistory, newPurchase] : [newPurchase],
      imageUrl: imageUrl || editingItem?.imageUrl,
      vendor: selectedVendor ? {
        name: selectedVendor.name,
        contact: selectedVendor.contact,
        phone: selectedVendor.phone,
        email: selectedVendor.email,
        address: selectedVendor.address,
        notes: selectedVendor.notes
      } : {}
    };

    try {
      console.log('Submitting item data:', itemData);
      if (editingItem) {
        const res = await axios.put(`http://localhost:5000/api/items/${editingItem._id}`, itemData);
        console.log('Update response:', res.data);
        onItemAdded(res.data);
      } else {
        const res = await axios.post('http://localhost:5000/api/items', itemData);
        console.log('Create response:', res.data);
        onItemAdded(res.data);
      }
      onCancel(); // 关闭表单
    } catch (err) {
      console.error('Error saving item:', err);
      alert(err.response?.data?.error || '保存失败，请重试');
    }
  };

  return (
    <div className="add-item-container">
      <h2>{editingItem ? '编辑商品' : '添加商品'}</h2>
      <form onSubmit={handleSubmit} className="add-item-form">
        <div className="form-group">
          <label>商品图片</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              setImageUploading(true);
              const data = new FormData();
              data.append('image', file);
              try {
                console.log('Uploading image:', file.name);
                const res = await axios.post('http://localhost:5000/api/upload-item-image', data);
                console.log('Upload response:', res.data);
                if (res.data.imageUrl) {
                  // 验证图片URL是否可访问
                  const img = new Image();
                  img.onload = () => {
                    console.log('Image loaded successfully:', res.data.imageUrl);
                    setImageUrl(res.data.imageUrl);
                  };
                  img.onerror = () => {
                    console.error('Failed to load image:', res.data.imageUrl);
                    setImageUrl(''); // 清除无效的图片URL
                    alert('图片上传成功但无法显示，请检查图片URL是否正确');
                  };
                  img.src = res.data.imageUrl;
                } else {
                  throw new Error('No image URL in response');
                }
              } catch (err) {
                console.error('Image upload error:', err);
                setImageUrl(''); // 清除无效的图片URL
                alert('图片上传失败: ' + (err.response?.data?.error || err.message));
              } finally {
                setImageUploading(false);
              }
            }} 
            disabled={imageUploading} 
          />
          {imageUploading && <div style={{fontSize:12,color:'#888'}}>图片上传中...</div>}
          {imageUrl && (
            <div style={{marginTop:8}}>
              <img 
                key={imageUrl} // 添加key属性，强制重新渲染
                src={imageUrl} 
                alt="商品图片" 
                style={{
                  width: 80,
                  height: 80,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid #ddd'
                }} 
                onError={(e) => {
                  console.error('Image load error for URL:', imageUrl);
                  e.target.onerror = null;
                  setImageUrl(''); // 清除无效的图片URL
                }}
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="item-name">商品名称</label>
          <input 
            id="item-name"
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="名称" 
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="item-quantity">{editingItem ? '现库存数量' : '新进数量'}</label>
          <input 
            id="item-quantity"
            value={editingItem ? editingItem.quantity : quantity} 
            onChange={e => setQuantity(e.target.value)} 
            placeholder={editingItem ? "当前库存数量" : "本次进货数量"} 
            type="number"
            required
            readOnly={editingItem}
          />
        </div>

        <div className="form-group">
          <label htmlFor="item-price">进货价</label>
          <input 
            id="item-price"
            value={price} 
            onChange={handlePriceChange} 
            placeholder="成本价" 
            type="number"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="item-selling-price">销售价</label>
          <input 
            id="item-selling-price"
            value={sellingPrice}
            readOnly
            placeholder="销售价"
            type="number"
          />
        </div>

        <div className="form-group">
          <label htmlFor="item-vendor">供货商</label>
          <select
            id="item-vendor"
            value={selectedVendorId}
            onChange={(e) => {
              const vendorId = e.target.value;
              const selectedVendor = vendors.find(v => v._id === vendorId);
              setSelectedVendorId(vendorId);
              setSelectedVendorName(selectedVendor ? selectedVendor.name : '');
            }}
            required
          >
            <option value="">请选择供货商</option>
            {vendors.map(vendor => (
              <option key={vendor._id} value={vendor._id}>{vendor.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="item-reorder-level">补货点</label>
          <input 
            id="item-reorder-level"
            value={reorderLevel}
            onChange={e => setReorderLevel(e.target.value)}
            placeholder="补货点"
            type="number"
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit">
            {editingItem ? '更新' : '添加'}
          </button>
          <button type="button" onClick={onCancel}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddItem; 