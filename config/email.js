const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: false },
});

const envoyerConfirmationClient = async (email, reference, nom) => {
    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `[${reference}] Confirmation - CS FORM`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f2744;padding:30px;text-align:center">
        <h1 style="color:white;margin:0">CS FORM</h1>
      </div>
      <div style="padding:30px;background:white">
        <h2 style="color:#0f2744">Bonjour ${nom},</h2>
        <p>Votre message a bien été reçu.</p>
        <div style="background:#dbeafe;border-left:4px solid #1e6fe0;padding:15px;border-radius:6px;margin:20px 0">
          <span style="color:#64748b;font-size:13px">Votre référence :</span>
          <strong style="color:#1e6fe0;font-size:22px;display:block">${reference}</strong>
        </div>
        <p style="background:#f8fafc;padding:14px;border-radius:6px">⏱️ <strong>Délai de traitement : 72 heures ouvrables</strong></p>
      </div>
      <div style="background:#f8fafc;padding:16px;text-align:center">
        <p style="color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} CS FORM</p>
      </div>
    </div>`,
    });
};

const envoyerEmailCloture = async (email, reference, nom, reponse) => {
    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `[${reference}] Votre demande est traitée - CS FORM`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#065f46;padding:30px;text-align:center">
        <h1 style="color:white;margin:0">CS FORM</h1>
      </div>
      <div style="padding:30px;background:white;text-align:center">
        <div style="font-size:48px">✅</div>
        <h2 style="color:#065f46">Demande traitée</h2>
        <p>Bonjour <strong>${nom}</strong>, votre demande <strong>${reference}</strong> a été traitée.</p>
        ${reponse ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:left;margin:16px 0"><p style="margin:0">${reponse}</p></div>` : ''}
        <p style="color:#64748b">Merci pour votre confiance en CS FORM.</p>
      </div>
    </div>`,
    });
};

const notifierAdmin = async (msg) => {
    if (!process.env.ADMIN_EMAIL) return;
    const types = { reclamation: '🔴 Réclamation', suggestion: '💡 Suggestion', satisfaction: '⭐ Satisfaction' };
    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `[${msg.reference}] Nouveau message - ${types[msg.type_message]}`,
        html: `<h2>Nouveau message</h2><p><strong>Réf:</strong> ${msg.reference}</p><p><strong>De:</strong> ${msg.prenom} ${msg.nom} (${msg.email})</p><p><strong>Type:</strong> ${types[msg.type_message]}</p><p><strong>Objet:</strong> ${msg.objet}</p><p>${msg.message}</p>`,
    });
};

module.exports = { envoyerConfirmationClient, envoyerEmailCloture, notifierAdmin };