import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('reader');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        role,
        email: cred.user.email || email,
        createdAt: serverTimestamp(),
      });
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
        <h2>Регистрация</h2>
        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="reg-email">
              Email (логин)
            </label>
            <input
              id="reg-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="reg-password">
              Пароль
            </label>
            <input
              id="reg-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="reg-password2">
              Подтвердите пароль
            </label>
            <input
              id="reg-password2"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <fieldset className="role-fieldset">
            <legend className="label">Роль</legend>
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="reader"
                checked={role === 'reader'}
                onChange={() => setRole('reader')}
              />
              <span>Читатель — просматривать все книги в каталоге</span>
            </label>
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="writer"
                checked={role === 'writer'}
                onChange={() => setRole('writer')}
              />
              <span>Писатель — добавлять свои книги в каталог</span>
            </label>
          </fieldset>

          <button type="submit" className="btn btn--block" disabled={loading}>
            {loading ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
          </button>

          <p className="muted" style={{ marginTop: '1.25rem' }}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
