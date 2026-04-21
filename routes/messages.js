const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../middleware/upload');
const { verifierToken } = require('../middleware/auth');
const { envoyerConfirmationClient, envoyerEmailCloture, notifierAdmin } = require('../config/email');

const genRef = async (type_message) => {
    const annee = new Date().getFullYear();
    const prefixes = { reclamation: 'RE', suggestion: 'SU', satisfaction: 'SAS' };
    const prefix = prefixes[type_message] || 'GEN';
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('INSERT INTO compteur_references (annee,compteur) VALUES (?,1) ON DUPLICATE KEY UPDATE compteur=compteur+1', [annee]);
        const [r] = await conn.execute('SELECT compteur FROM compteur_references WHERE annee=?', [annee]);
        await conn.commit();
        return `CSF-${prefix}${annee}-${String(r[0].compteur).padStart(4, '0')}`;
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
};

// Soumettre un message (public)
router.post('/', upload.single('fichier'), async (req, res) => {
    const { nom, prenom, email, telephone, type_message, objet, message, consentement, origine_canal } = req.body;
    if (!nom || !prenom || !email || !type_message || !objet || !message || consentement !== 'true')
        return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    try {
        const reference = await genRef(type_message);
        const fichier = req.file ? { nom: req.file.originalname, chemin: req.file.path, type: req.file.mimetype } : {};
        await db.execute(
            `INSERT INTO messages (reference,nom,prenom,email,telephone,type_message,objet,message,fichier_nom,fichier_chemin,fichier_type,consentement,ip_address,origine_canal)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
            [reference, nom, prenom, email, telephone || null, type_message, objet, message,
                fichier.nom || null, fichier.chemin || null, fichier.type || null,
                req.ip, origine_canal || 'formulaire']
        );
        envoyerConfirmationClient(email, reference, `${prenom} ${nom}`).catch(e => console.warn(e.message));
        notifierAdmin({ reference, nom, prenom, email, type_message, objet, message }).catch(e => console.warn(e.message));
        res.status(201).json({ success: true, message: 'Votre message a bien été reçu. Il sera traité sous 72 heures.', reference });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur envoi' }); }
});

// Stats (admin)
router.get('/stats', verifierToken, async (req, res) => {
    try {
        const [r] = await db.execute(`
            SELECT COUNT(*) as total,
            SUM(statut='en_attente') as en_attente,
            SUM(statut='en_cours') as en_cours,
            SUM(statut='traite') as traite,
            SUM(type_message='reclamation') as reclamations,
            SUM(type_message='suggestion') as suggestions,
            SUM(type_message='satisfaction') as satisfactions
            FROM messages`);
        res.json({ success: true, stats: r[0] });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Export Excel (admin)
router.get('/export/excel', verifierToken, async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const [msgs] = await db.execute('SELECT * FROM messages ORDER BY created_at DESC');
        const graviteLabels = { risque_faible: 'Risque faible', risque_moyen: 'Risque moyen', risque_grand: 'Risque grand' };
        const typeLabels = { reclamation: 'Réclamation', suggestion: 'Suggestion', satisfaction: 'Satisfaction' };
        const statutLabels = { en_attente: 'En attente', en_cours: 'En cours', traite: 'Traité', ferme: 'Fermé' };
        const canalLabels = { oral: 'Oral', appel: 'Appel', mail: 'Mail', message: 'Message', formulaire: 'Formulaire' };
        const data = msgs.map(m => ({
            'Référence': m.reference,
            'Date réception': new Date(m.created_at).toLocaleDateString('fr-FR') + ' ' + new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            'Origine / Canal': canalLabels[m.origine_canal] || m.origine_canal || '',
            'Type': typeLabels[m.type_message] || m.type_message,
            'Nom': m.nom,
            'Prénom': m.prenom,
            'Email': m.email,
            'Téléphone': m.telephone || '',
            'Objet': m.objet,
            'Message': m.message,
            'Impact / Gravité': graviteLabels[m.impact_gravite] || '',
            'Responsable': m.responsable || '',
            'Cause analysée': m.cause_analysee || '',
            'Action corrective': m.action_corrective || '',
            'Date de début': m.date_debut ? new Date(m.date_debut).toLocaleDateString('fr-FR') : '',
            'Date cible': m.date_cible ? new Date(m.date_cible).toLocaleDateString('fr-FR') : '',
            'Statut': statutLabels[m.statut] || m.statut,
            'Résultat attendu / KPI': m.resultat_attendu || '',
            'Résultat réel / Retour': m.resultat_reel || '',
            'Amélioration continue': m.amelioration_continue || '',
            'Date traitement': m.traite_at ? new Date(m.traite_at).toLocaleDateString('fr-FR') : '',
            'Pièce jointe': m.fichier_nom || '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Messages');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="csform_${Date.now()}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur export' }); }
});

// Liste messages (admin)
router.get('/', verifierToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        let conds = [], params = [];
        if (req.query.statut) { conds.push('statut=?'); params.push(req.query.statut); }
        if (req.query.type) { conds.push('type_message=?'); params.push(req.query.type); }
        if (req.query.recherche) {
            conds.push('(nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR reference LIKE ? OR objet LIKE ?)');
            const s = `%${req.query.recherche}%`;
            params.push(s, s, s, s, s);
        }
        const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
        const [msgs] = await db.execute(`SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const [cnt] = await db.execute(`SELECT COUNT(*) as total FROM messages ${where}`, params);
        res.json({ success: true, messages: msgs, pagination: { total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) } });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Détail message (admin)
router.get('/:id', verifierToken, async (req, res) => {
    try {
        const [msgs] = await db.execute('SELECT * FROM messages WHERE id=?', [req.params.id]);
        if (!msgs.length) return res.status(404).json({ success: false, message: 'Non trouvé' });
        const [notes] = await db.execute(
            'SELECT n.*,CONCAT(a.prenom," ",a.nom) as admin_nom FROM notes_internes n JOIN admins a ON n.admin_id=a.id WHERE n.message_id=? ORDER BY n.created_at DESC',
            [req.params.id]
        );
        const [reps] = await db.execute(
            'SELECT r.*,CONCAT(a.prenom," ",a.nom) as admin_nom FROM reponses r JOIN admins a ON r.admin_id=a.id WHERE r.message_id=? ORDER BY r.created_at ASC',
            [req.params.id]
        );
        res.json({ success: true, message: msgs[0], notes, reponses: reps });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Changer statut (admin)
router.patch('/:id/statut', verifierToken, async (req, res) => {
    const { statut } = req.body;
    if (!['en_attente', 'en_cours', 'traite', 'ferme'].includes(statut))
        return res.status(400).json({ success: false, message: 'Statut invalide' });
    try {
        const [msgs] = await db.execute('SELECT * FROM messages WHERE id=?', [req.params.id]);
        if (!msgs.length) return res.status(404).json({ success: false, message: 'Non trouvé' });
        await db.execute('UPDATE messages SET statut=?,traite_at=? WHERE id=?',
            [statut, statut === 'traite' ? new Date() : msgs[0].traite_at, req.params.id]);
        await db.execute('INSERT INTO historique_statuts (message_id,admin_id,ancien_statut,nouveau_statut) VALUES (?,?,?,?)',
            [req.params.id, req.admin.id, msgs[0].statut, statut]);
        if (statut === 'traite' && !msgs[0].email_cloture_envoye) {
            const [rep] = await db.execute('SELECT contenu FROM reponses WHERE message_id=? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
            envoyerEmailCloture(msgs[0].email, msgs[0].reference, `${msgs[0].prenom} ${msgs[0].nom}`, rep[0]?.contenu || null).catch(e => console.warn(e.message));
            await db.execute('UPDATE messages SET email_cloture_envoye=1 WHERE id=?', [req.params.id]);
        }
        res.json({ success: true, message: 'Statut mis à jour' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Mettre à jour champs admin (impact, responsable, cause, etc.)
router.patch('/:id/analyse', verifierToken, async (req, res) => {
    const { impact_gravite, responsable, cause_analysee, action_corrective, date_debut, date_cible, resultat_attendu, resultat_reel, amelioration_continue } = req.body;
    try {
        await db.execute(
            `UPDATE messages SET impact_gravite=?,responsable=?,cause_analysee=?,action_corrective=?,
             date_debut=?,date_cible=?,resultat_attendu=?,resultat_reel=?,amelioration_continue=?
             WHERE id=?`,
            [impact_gravite || null, responsable || null, cause_analysee || null, action_corrective || null,
            date_debut || null, date_cible || null, resultat_attendu || null, resultat_reel || null,
            amelioration_continue || null, req.params.id]
        );
        res.json({ success: true, message: 'Analyse mise à jour' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Répondre (admin)
router.post('/:id/reponse', verifierToken, async (req, res) => {
    if (!req.body.contenu?.trim()) return res.status(400).json({ success: false, message: 'Contenu requis' });
    try {
        const [r] = await db.execute('INSERT INTO reponses (message_id,admin_id,contenu,email_envoye) VALUES (?,?,?,1)',
            [req.params.id, req.admin.id, req.body.contenu]);
        res.status(201).json({ success: true, id: r.insertId });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

// Note interne (admin)
router.post('/:id/note', verifierToken, async (req, res) => {
    if (!req.body.contenu?.trim()) return res.status(400).json({ success: false, message: 'Contenu requis' });
    try {
        const [r] = await db.execute('INSERT INTO notes_internes (message_id,admin_id,contenu) VALUES (?,?,?)',
            [req.params.id, req.admin.id, req.body.contenu]);
        res.status(201).json({ success: true, id: r.insertId });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur' }); }
});

module.exports = router;