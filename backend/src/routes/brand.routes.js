const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Saverly',
      tagline: 'See Where You Save.',
      service: 'saverly-api',
      colors: {
        primary: '#1C9A76',
        primaryLight: '#39B58F',
        primaryDark: '#14765A',
        secondary: '#FFA11A',
        secondaryLight: '#FFC15C',
        background: '#F8FBFA',
        surface: '#FFFFFF',
        text: '#2F3136',
        mutedText: '#5F6772'
      },
      assets: {
        logo: '/brand/saverly-logo.svg'
      }
    }
  });
});

module.exports = router;
