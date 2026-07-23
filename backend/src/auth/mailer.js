const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendPasswordResetEmail(toEmail, resetLink) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Forense App" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Recuperacion de contrasena - Forense App',
    text: `Recibimos una solicitud para restablecer tu contrasena.\n\nUsa el siguiente link (valido por 1 hora):\n${resetLink}\n\nSi no solicitaste esto, ignora este correo.`,
    html: `
      <p>Recibimos una solicitud para restablecer tu contrasena.</p>
      <p><a href="${resetLink}">Restablecer contrasena</a> (valido por 1 hora)</p>
      <p>Si no solicitaste esto, ignora este correo.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
