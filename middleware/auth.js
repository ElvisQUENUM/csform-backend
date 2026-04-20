const jwt = require('jsonwebtoken');
const db = require('../config/database');

const verifierToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await db.execute('SELECT id,nom,prenom,email,role,actif FROM admins WHERE id=?', [decoded.id]);
        if (!rows.length || !rows[0].actif) return res.status(401).json({ success: false, message: 'Compte invalide' });
        req.admin = rows[0];
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }
};

module.exports = { verifierToken };