const axios = require('axios');

/**
 * Parses a message template by replacing placeholders like {nama} with actual data.
 */
function parseTemplate(template, data = {}) {
  let msg = template;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    msg = msg.replace(regex, data[key]);
  });
  return msg;
}

/**
 * Send WhatsApp message using Fonnte API Gateway.
 */
async function sendWAMessage(target, message, tokenFallback = null) {
  const token = tokenFallback || process.env.WA_TOKEN;
  if (!token) {
    console.log(`[WA-SKIP] No token. Target: ${target} | Msg: ${message.slice(0, 30)}...`);
    return false;
  }

  if (!target || target.length < 5) return false;

  try {
    const res = await axios.post(
      'https://api.fonnte.com/send',
      { target, message, delay: '1' },
      { headers: { Authorization: token } }
    );
    return res.data.status;
  } catch (err) {
    console.error(`[WA-ERROR] ${target}: ${err.message}`);
    return false;
  }
}

module.exports = { sendWAMessage, parseTemplate };
