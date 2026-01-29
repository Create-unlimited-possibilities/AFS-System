import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/translate', (req, res) => {
  res.json({
    message: "传家之宝翻译服务已就绪（仅 Google 引擎）",
    google_key_configured: !!process.env.GOOGLE_TRANSLATE_API_KEY,
    tip: "前端实时翻译完全可用"
  });
});


router.post('/translate', async (req, res) => {
  try {
    const { text, target = 'zh-CN' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' });
    }

    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();

    if (googleKey && googleKey.length > 10) {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`,
        {
          q: text,
          target: target.toLowerCase(),
          format: 'text'
        }
      );
      const translated = response.data.data.translations[0].translatedText;
      return res.json({ translatedText: translated, engine: 'Google' });
    }

    res.json({ translatedText: text, engine: 'original' });

  } catch (err) {
    console.error('Google 翻译异常:', err.response?.data || err.message);
    res.json({ translatedText: req.body.text || '', engine: 'error' });
  }
});

export default router;