const https = require('https');

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

function notify(message, type = 'info') {
  if (!SLACK_WEBHOOK) return;

  const emoji = type === 'question' ? '❓' : type === 'error' ? '🔴' : type === 'done' ? '✅' : '🔨';
  const payload = JSON.stringify({
    text: `${emoji} *WanderWell Build*\n\n${message}`
  });

  const url = new URL(SLACK_WEBHOOK);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, () => {});

  req.write(payload);
  req.end();
}

module.exports = { notify };
