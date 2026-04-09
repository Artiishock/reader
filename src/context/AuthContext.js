import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setUserProfile(null);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const pref = doc(db, 'users', user.uid);
        let snap = await getDoc(pref);
        if (!snap.exists()) {
          await setDoc(pref, {
            role: 'reader',
            email: user.email || '',
            createdAt: serverTimestamp(),
          });
          snap = await getDoc(pref);
        }
        setUserProfile(snap.data() || null);
      } catch (e) {
        console.error(e);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      loading,
      isWriter: userProfile?.role === 'writer',
    }),
    [currentUser, userProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
