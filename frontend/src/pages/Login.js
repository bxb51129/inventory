import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.token;
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '登录失败');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>用户登录</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label>用户名</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        {error && <div style={{ color: '#d32f2f', marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ width: '100%', padding: 12, background: '#1976D2', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>登录</button>
      </form>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        没有账号？<Link to="/register">去注册</Link>
      </div>
    </div>
  );
}

export default Login; 