const fs = require('fs');
const path = require('path');

// Estos son los nombres exactos que debes poner en Cloudflare Dashboard
const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');

const envConfigFile = `export const environment = {
  production: true,
  firebaseConfig: {
    apiKey: "${process.env.FIREBASE_API_KEY || 'AIzaSyC406CGatwZDsFwza-HXzcUzj3zKJIkAp4'}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || 'prodeusproject.firebaseapp.com'}",
    projectId: "${process.env.FIREBASE_PROJECT_ID || 'prodeusproject'}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || 'prodeusproject.firebasestorage.app'}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || '89910398541'}",
    appId: "${process.env.FIREBASE_APP_ID || '1:89910398541:web:00fd374f7be30d64fa5604'}"
  }
};
`;

console.log('👷 Generando environment.prod.ts...');
fs.writeFile(targetPath, envConfigFile, function (err) {
   if (err) {
       console.error('❌ Error fatal al generar environment.prod.ts:', err);
       process.exit(1);
   }
   console.log(`✅ environment.prod.ts generado con éxito en ${targetPath}`);
});
