const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifierToken } = require('../middleware/auth');

// Middleware super admin
const superAdmin = (req, res, next) => {
    if (req.admin.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Accès réservé au Super Admin' });
    next();
};

// Login
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

// Me
router.get('/me', verifierToken, (req, res) => res.json({ success: true, admin: req.admin }));

// Changer mot de passe
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

// Lister tous les utilisateurs (super admin)
router.get('/utilisateurs', verifierToken, superAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id,nom,prenom,email,role,actif,created_at,derniere_connexion FROM admins ORDER BY created_at DESC');
        res.json({ success: true, utilisateurs: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Créer un utilisateur (super admin)
router.post('/utilisateurs', verifierToken, superAdmin, async (req, res) => {
    const { nom, prenom, email, password, role } = req.body;
    if (!nom || !prenom || !email || !password || !role)
        return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    if (!['super_admin', 'admin', 'visiteur'].includes(role))
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
    try {
        const [exist] = await db.execute('SELECT id FROM admins WHERE email=?', [email]);
        if (exist.length) return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
        const hash = await bcrypt.hash(password, 12);
        const [r] = await db.execute(
            'INSERT INTO admins (nom,prenom,email,password_hash,role,actif) VALUES (?,?,?,?,?,1)',
            [nom, prenom, email, hash, role]
        );
        res.status(201).json({ success: true, message: 'Utilisateur créé', id: r.insertId });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Modifier un utilisateur (super admin)
router.put('/utilisateurs/:id', verifierToken, superAdmin, async (req, res) => {
    const { nom, prenom, email, role, actif, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT id FROM admins WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        if (password && password.trim()) {
            const hash = await bcrypt.hash(password, 12);
            await db.execute('UPDATE admins SET nom=?,prenom=?,email=?,role=?,actif=?,password_hash=? WHERE id=?',
                [nom, prenom, email, role, actif ? 1 : 0, hash, req.params.id]);
        } else {
            await db.execute('UPDATE admins SET nom=?,prenom=?,email=?,role=?,actif=? WHERE id=?',
                [nom, prenom, email, role, actif ? 1 : 0, req.params.id]);
        }
        res.json({ success: true, message: 'Utilisateur modifié' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Supprimer un utilisateur (super admin)
router.delete('/utilisateurs/:id', verifierToken, superAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.admin.id)
            return res.status(400).json({ success: false, message: 'Impossible de supprimer votre propre compte' });
        const [rows] = await db.execute('SELECT id FROM admins WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        await db.execute('DELETE FROM admins WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;