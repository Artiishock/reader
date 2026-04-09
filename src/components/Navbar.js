import React from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { currentUser, userProfile } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const roleLabel = userProfile?.role === 'writer' ? 'Писатель' : 'Читатель';

  return (
    <header className="navbar">
      <Link to="/" className="navbar__brand">
        Folio Reader
      </Link>

      <div className="navbar__actions">
        {currentUser ? (
          <>
            <span className="navbar__role" title="Роль в системе">
              {roleLabel}
            </span>
            <span className="navbar__email" title={currentUser.email}>
              {currentUser.email}
            </span>
            <button type="button" className="btn btn--ghost btn--nav" onClick={handleLogout}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Войти</Link>
            <Link to="/register">Регистрация</Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
