import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
    
    setLoading(false);
  };

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Вход</h2>
        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="login-email">
              Email (логин)
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="login-password">
              Пароль
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn--block" disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </button>

          <p className="muted" style={{ marginTop: '1.25rem' }}>
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;