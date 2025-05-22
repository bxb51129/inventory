import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await axios.post('http://localhost:5000/api/register', { username, password, email });
      setSuccess('注册成功，请登录');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || '注册失败');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>用户注册</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label>用户名</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label>邮箱（可选）</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        {error && <div style={{ color: '#d32f2f', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: '#2e7d32', marginBottom: 12 }}>{success}</div>}
        <button type="submit" style={{ width: '100%', padding: 12, background: '#1976D2', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>注册</button>
      </form>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        已有账号？<Link to="/login">去登录</Link>
      </div>
    </div>
  );
}

export default Register; 