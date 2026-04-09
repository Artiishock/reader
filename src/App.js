import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BookReader from './components/BookReader';
import Library from './components/Library';
import Login from './components/Login';
import Register from './components/Register';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import './index.css';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Library />
                </PrivateRoute>
              }
            />
            <Route
              path="/read/:bookId"
              element={
                <PrivateRoute>
                  <BookReader />
                </PrivateRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;