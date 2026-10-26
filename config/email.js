const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: false },
});

// Emails des admins à notifier
const ADMIN_EMAILS = [
    'asmi.adjaho@csform.fr',
    'administratif@csform.fr',
    'elvis.quenum@csform.fr',
    'alexandre.hodonou@csform.fr',
].join(',');

const envoyerConfirmationClient = async (email, reference, nom) => {
    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `[${reference}] Confirmation de réception - CS FORM`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc">
            <div style="background:linear-gradient(135deg,#0f2744,#1e6fe0);padding:35px;text-align:center;border-radius:0 0 0 0">
                <div style="width:60px;height:60px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
                    <span style="color:white;font-size:22px;font-weight:900">CS</span>
                </div>
                <h1 style="color:white;margin:0;font-size:22px">CS FORM</h1>
                <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px">École de Commerce, du Numérique et de l'Industrie</p>
            </div>
            <div style="padding:36px;background:white">
                <h2 style="color:#0f2744;margin:0 0 16px">Bonjour ${nom},</h2>
                <p style="color:#475569;line-height:1.7">Nous avons bien reçu votre message. Notre équipe va l'examiner et vous répondra dans les meilleurs délais.</p>
                <div style="background:#dbeafe;border-left:4px solid #1e6fe0;padding:20px;border-radius:8px;margin:24px 0;text-align:center">
                    <span style="color:#64748b;font-size:13px;display:block;margin-bottom:6px">Votre référence de suivi</span>
                    <strong style="color:#1e6fe0;font-size:26px;font-family:monospace;letter-spacing:2px">${reference}</strong>
                </div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;text-align:center">
                    <p style="margin:0;color:#065f46;font-size:14px">⏱️ <strong>Délai de traitement : 72 heures ouvrables</strong></p>
                </div>
                <p style="color:#475569;margin-top:24px;line-height:1.7">Conservez précieusement cette référence pour suivre l'avancement de votre demande. Nous vous contacterons à l'adresse email que vous nous avez fournie.</p>
            </div>
            <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0">
                <p style="color:#94a3b8;font-size:12px;margin:0">© ${new Date().getFullYear()} CS FORM — École de Commerce, du Numérique et de l'Industrie</p>
            </div>
        </div>`,
    });
};

const envoyerEmailCloture = async (email, reference, nom, reponse) => {
    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `[${reference}] Votre demande a été traitée - CS FORM`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc">
            <div style="background:linear-gradient(135deg,#065f46,#059669);padding:35px;text-align:center">
                <div style="width:60px;height:60px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
                    <span style="color:white;font-size:22px;font-weight:900">CS</span>
                </div>
                <h1 style="color:white;margin:0;font-size:22px">CS FORM</h1>
                <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px">École de Commerce, du Numérique et de l'Industrie</p>
            </div>
            <div style="padding:36px;background:white;text-align:center">
                <div style="font-size:52px;margin-bottom:16px">✅</div>
                <h2 style="color:#065f46;margin:0 0 12px">Demande traitée avec succès</h2>
                <p style="color:#475569;line-height:1.7">Bonjour <strong>${nom}</strong>, votre demande <strong style="color:#1e6fe0;font-family:monospace">${reference}</strong> a été traitée par notre équipe.</p>
                ${reponse ? `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;text-align:left;margin:20px 0">
                    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#065f46;margin:0 0 10px">Réponse de notre équipe</p>
                    <p style="margin:0;color:#1e293b;line-height:1.7">${reponse}</p>
                </div>` : ''}
                <p style="color:#475569;margin-top:20px;line-height:1.7">Merci pour votre confiance. N'hésitez pas à nous recontacter si vous avez d'autres questions.</p>
            </div>
            <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0">
                <p style="color:#94a3b8;font-size:12px;margin:0">© ${new Date().getFullYear()} CS FORM — École de Commerce, du Numérique et de l'Industrie</p>
            </div>
        </div>`,
    });
};

const notifierAdmin = async (msg) => {
    const types = {
        reclamation: '🔴 Réclamation',
        suggestion: '💡 Suggestion',
        satisfaction: '⭐ Satisfaction'
    };
    const canaux = {
        oral: '🗣️ Oral',
        appel: '📞 Appel',
        mail: '📧 Mail',
        message: '💬 Message',
        formulaire: '🌐 Formulaire'
    };
    const typeColor = {
        reclamation: '#dc2626',
        suggestion: '#1e6fe0',
        satisfaction: '#059669'
    };
    const color = typeColor[msg.type_message] || '#1e6fe0';

    return transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: ADMIN_EMAILS,
        subject: `[${msg.reference}] Nouveau message reçu — ${types[msg.type_message]}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc">
            <div style="background:linear-gradient(135deg,#0f2744,#1e6fe0);padding:30px;text-align:center">
                <h1 style="color:white;margin:0;font-size:20px">CS FORM — Nouveau message</h1>
                <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">Notification automatique</p>
            </div>
            <div style="padding:30px;background:white">
                <div style="background:${color}15;border-left:4px solid ${color};border-radius:8px;padding:16px;margin-bottom:24px">
                    <div style="font-size:20px;font-weight:900;color:${color};font-family:monospace">${msg.reference}</div>
                    <div style="font-size:14px;color:${color};margin-top:4px;font-weight:600">${types[msg.type_message]}</div>
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;width:35%">👤 Expéditeur</td>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:13px"><strong>${msg.prenom} ${msg.nom}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600">📧 Email</td>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e6fe0;font-size:13px">${msg.email}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600">📡 Canal</td>
                        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:13px">${canaux[msg.origine_canal] || msg.origine_canal || '—'}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:13px;font-weight:600">📌 Objet</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:13px;font-weight:600">${msg.objet}</td>
                    </tr>
                </table>
                <div style="background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0">
                    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:0 0 10px">Message</p>
                    <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.7">${msg.message}</p>
                </div>
                <div style="margin-top:24px;text-align:center">
                    <a href="https://suggestionsreclamations.csform.fr/admin" style="background:linear-gradient(135deg,#0f2744,#1e6fe0);color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
                        🔐 Accéder à l'espace admin
                    </a>
                </div>
            </div>
            <div style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0">
                <p style="color:#94a3b8;font-size:12px;margin:0">© ${new Date().getFullYear()} CS FORM — Notification automatique</p>
            </div>
        </div>`,
    });
};

module.exports = { envoyerConfirmationClient, envoyerEmailCloture, notifierAdmin };