import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Box, Typography, Button, CircularProgress } from '@mui/material';

const BookReader = ({ bookId }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  // Загрузить прогресс чтения
  useEffect(() => {
    const loadProgress = async () => {
      if (user) {
        const progressRef = doc(db, 'readingProgress', `${user.uid}_${bookId}`);
        const docSnap = await getDoc(progressRef);
        
        if (docSnap.exists()) {
          setCurrentPage(docSnap.data().page);
        }
      }
      setLoading(false);
    };

    loadProgress();
  }, [bookId, user]);

  // Сохранить прогресс чтения
  const saveProgress = async (page) => {
    if (user) {
      await setDoc(doc(db, 'readingProgress', `${user.uid}_${bookId}`), {
        page,
        timestamp: new Date(),
        bookId,
        userId: user.uid
      });
    }
  };

  const handlePageChange = (direction) => {
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    setCurrentPage(newPage);
    saveProgress(newPage);
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h6">
          Страница: {currentPage}
        </Typography>
        <Box>
          <Button 
            variant="contained" 
            onClick={() => handlePageChange('prev')}
            disabled={currentPage <= 1}
          >
            Назад
          </Button>
          <Button 
            variant="contained" 
            sx={{ ml: 2 }}
            onClick={() => handlePageChange('next')}
          >
            Вперед
          </Button>
        </Box>
      </Box>

      <iframe
        title="book-reader"
        src={`https://drive.google.com/file/d/${bookId}/preview#page=${currentPage}`}
        width="100%"
        height="100%"
        frameBorder="0"
      />
    </Box>
  );
};

export default BookReader;