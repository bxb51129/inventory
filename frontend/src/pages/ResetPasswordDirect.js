import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function ResetPasswordDirect() {
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/reset-password-direct', { username, newPassword });
      setSuccess('密码重置成功，请返回登录');
    } catch (err) {
      setError(err.response?.data?.message || '重置失败');
    } finally {
      setLoading(false);
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
        }}>重置密码</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontSize: '14px', fontWeight: '500' }}>用户名</label>
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
            <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontSize: '14px', fontWeight: '500' }}>新密码</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
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
              placeholder="请输入新密码"
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
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontSize: '14px', fontWeight: '500' }}>确认新密码</label>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
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
              placeholder="请再次输入新密码"
            />
            <span
              onClick={() => setShowConfirmPassword(v => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '38px',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#888',
                userSelect: 'none'
              }}
              title={showConfirmPassword ? '隐藏密码' : '显示密码'}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </span>
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
          {success && (
            <div style={{
              color: '#2e7d32',
              marginBottom: '16px',
              padding: '12px',
              background: '#e8f5e9',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {success}
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
            {loading ? '提交中...' : '重置密码'}
          </button>
        </form>
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px'
        }}>
          <Link to="/login" style={{
            color: '#1976D2',
            textDecoration: 'none',
            fontWeight: '500'
          }}>
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordDirect; 