import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.token;
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleRememberMeChange = (e) => {
    const checked = e.target.checked;
    setRememberMe(checked);
    if (!checked) {
      setUsername('');
      localStorage.removeItem('rememberedUsername');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1976D2 0%, #2196F3 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#fff',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '32px',
          color: '#1976D2',
          fontSize: '28px',
          fontWeight: '600'
        }}>欢迎登录</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontSize: '14px',
              fontWeight: '500'
            }}>用户名</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '15px',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              placeholder="请输入用户名"
            />
          </div>
          
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontSize: '14px',
              fontWeight: '500'
            }}>密码</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 40px 12px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '15px',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              placeholder="请输入密码"
            />
            <span
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '38px',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#888',
                userSelect: 'none'
              }}
              title={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? '🙈' : '👁️'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '24px',
            justifyContent: 'space-between'
          }}>
            <label htmlFor="rememberMe" style={{
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={handleRememberMeChange}
                style={{
                  marginRight: '8px',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              记住用户名
            </label>
            <div>
              <Link to="/reset-password-direct" style={{
                color: '#1976D2',
                fontSize: '14px',
                textDecoration: 'none'
              }}>
                重置密码
              </Link>
            </div>
          </div>

          {error && (
            <div style={{
              color: '#d32f2f',
              marginBottom: '16px',
              padding: '12px',
              background: '#ffebee',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#90caf9' : '#1976D2',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px'
        }}>
          还没有账号？
          <Link to="/register" style={{
            color: '#1976D2',
            textDecoration: 'none',
            fontWeight: '500',
            marginLeft: '4px'
          }}>
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login; 