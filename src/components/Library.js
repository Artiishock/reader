import React from 'react';
import { List, ListItem, ListItemText, Button } from '@mui/material';

const Library = () => {
  const books = [
    {
      id: 'ВАШ_ID_КНИГИ_1',
      title: 'Название книги 1',
      author: 'Автор 1'
    },
    {
      id: 'ВАШ_ID_КНИГИ_2',
      title: 'Название книги 2',
      author: 'Автор 2'
    }
  ];

  return (
    <div>
      <h2>Библиотека</h2>
      <List>
        {books.map(book => (
          <ListItem key={book.id} divider>
            <ListItemText 
              primary={book.title} 
              secondary={book.author} 
            />
            <Button 
              variant="contained" 
              href={`/read/${book.id}`}
            >
              Читать
            </Button>
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default Library;