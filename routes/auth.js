const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifierToken } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    try {
        const [rows] = await db.execute('SELECT * FROM admins WHERE email=? AND actif=1', [email]);
        if (!rows.length) return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        const ok = await bcrypt.compare(password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        await db.execute('UPDATE admins SET derniere_connexion=NOW() WHERE id=?', [rows[0].id]);
        const token = jwt.sign({ id: rows[0].id, email: rows[0].email, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, token, admin: { id: rows[0].id, nom: rows[0].nom, prenom: rows[0].prenom, email: rows[0].email, role: rows[0].role } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.get('/me', verifierToken, (req, res) => res.json({ success: true, admin: req.admin }));

router.post('/change-password', verifierToken, async (req, res) => {
    const { ancien_password, nouveau_password } = req.body;
    try {
        const [rows] = await db.execute('SELECT password_hash FROM admins WHERE id=?', [req.admin.id]);
        const ok = await bcrypt.compare(ancien_password, rows[0].password_hash);
        if (!ok) return res.status(400).json({ success: false, message: 'Ancien mot de passe incorrect' });
        const hash = await bcrypt.hash(nouveau_password, 12);
        await db.execute('UPDATE admins SET password_hash=? WHERE id=?', [hash, req.admin.id]);
        res.json({ success: true, message: 'Mot de passe modifié' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;