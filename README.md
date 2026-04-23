# event-discovery-platform-backend-cpe3c

## Hostinger deployment

Deploy this repository as a separate Node.js Web App.

- Framework: `Express.js` or `Other`
- Entry file: `src/server.js`
- Node.js version: `24.x`
- Install command: `npm install`
- Start command: `npm start`

Set environment variables in Hostinger instead of committing a real `.env` file.
Use `.env.sample` in this repository as the template.

## OTP email delivery

Verification OTP email will not send until an email provider is configured.

- Recommended sender address: `noreply@eventcinity.com`
- Frontend origin: `https://eventcinity.com`
- Backend origin: `https://api.eventcinity.com`
- Recommended cookie domain: `.eventcinity.com`

To make delivery work in production:

- Set `EMAIL_PROVIDER` to `resend` or `brevo`
- Set the matching API key in Hostinger
- Verify the `eventcinity.com` sending domain with your provider
- Add SPF and DKIM DNS records for that provider
- Use `noreply@eventcinity.com` as the sender address
