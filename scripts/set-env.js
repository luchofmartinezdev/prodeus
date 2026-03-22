const fs = require('fs');
const path = require('path');

// Estos son los nombres exactos que debes poner en Cloudflare Dashboard
const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');

const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyC406CGatwZDsFwza-HXzcUzj3zKJIkAp4';
const projectId = process.env.FIREBASE_PROJECT_ID || 'prodeusproject';

console.log('👷 Generando environment.prod.ts...');
console.log(`🔑 API Key detected: ${apiKey.substring(0, 5)}***${apiKey.substring(apiKey.length - 4)}`);
console.log(`🆔 Project ID detected: ${projectId}`);

const envConfigFile = `export const environment = {
  production: true,
  firebaseConfig: {
    apiKey: "${apiKey}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || 'prodeusproject.firebaseapp.com'}",
    projectId: "${projectId}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || 'prodeusproject.firebasestorage.app'}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || '89910398541'}",
    appId: "${process.env.FIREBASE_APP_ID || '1:89910398541:web:00fd374f7be30d64fa5604'}"
  }
};
`;

fs.writeFile(targetPath, envConfigFile, function (err) {
   if (err) {
       console.error('❌ Error fatal al generar environment.prod.ts:', err);
       process.exit(1);
   }
   console.log('✅ environment.prod.ts generado con éxito.');
});

