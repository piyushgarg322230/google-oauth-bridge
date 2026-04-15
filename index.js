require('dotenv').config();

const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ DEV ONLY SSL BYPASS
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

app.get('/api/v1/auth/google', async (req, res) => {
  console.log('================ GOOGLE OAUTH DEBUG START ================');

  try {
    // 🔎 STEP 0 — LOG QUERY PARAMS
    console.log('Incoming Query Params:', req.query);

    const code = req.query.code;
    if (!code) {
      console.error('❌ Missing authorization code');
      return res.status(400).send('Missing code');
    }

    console.log('✅ Authorization Code:', code);

    // 🔎 STEP 1 — LOG ENV VALUES
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET EXISTS:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

    // 🔎 STEP 2 — PREPARE TOKEN REQUEST
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', process.env.GOOGLE_CLIENT_ID);
    tokenParams.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    tokenParams.append('code', code);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('redirect_uri', process.env.GOOGLE_REDIRECT_URI);

    console.log('Token Request Body:', tokenParams.toString());

    // 🔎 STEP 3 — TOKEN EXCHANGE
    let tokenRes;
    try {
      tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        tokenParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (e) {
      console.error('❌ TOKEN EXCHANGE FAILED');
      console.error('Error Message:', e.message);
      console.error('Google Response:', e.response?.data);
      console.error('Status:', e.response?.status);
      console.error('Full Error:', e);
      throw e;
    }

    console.log('✅ Token Exchange Success:', tokenRes.data);

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('No access token returned');

    // 🔎 STEP 4 — FETCH GOOGLE PROFILE
    const userRes = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ Google User Profile:', userRes.data);

    const googleUser = userRes.data;

    // 🔎 STEP 5 — BACKEND LOGIN REQUEST
    const formData = new URLSearchParams();
    formData.append('login_type', 'social');
    formData.append('provider', 'google');
    formData.append('provider_id', googleUser.id);
    formData.append('email', googleUser.email || '');
    formData.append('name', googleUser.name || '');
    formData.append('profile_image', googleUser.picture || '');
    formData.append('device_type', 'android');

    console.log('Backend Login Payload:', formData.toString());

    const loginRes = await axios.post(
      'https://mutants.assertinfotech.com/api/v1/login',
      formData.toString(),
      {
        httpsAgent, // DEV ONLY
        headers: {
          'Accept': 'application/json',
          'System-Key': 'iis-postman',
          'App-Language': 'hi',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Backend Login Response:', loginRes.data);

    const appToken =
      loginRes.data.token ||
      loginRes.data.data?.token;

    if (!appToken) {
      console.error('❌ Token missing in backend response');
      return res.status(500).json({ error: 'Token missing' });
    }

    console.log('✅ FINAL APP TOKEN:', appToken);
    console.log('================ GOOGLE OAUTH DEBUG END =================');

    res.redirect(
      `mutants://login?token=${encodeURIComponent(appToken)}`
    );

  } catch (err) {
    console.error('🔥 GOOGLE OAUTH DEBUG ERROR');
    console.error(err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Google login failed', 
      message: err.message,
      details: err.response?.data 
    });
  }
});

app.listen(PORT, () => {
  console.log(`OAuth DEBUG server running on port ${PORT}`);
});
