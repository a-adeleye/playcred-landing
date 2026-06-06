const fs = require('node:fs');
const path = require('node:path');

const firebaseDefaults = {
  apiKey: 'AIzaSyBqD9T84q9bRWvzrLE1P5nZiwMsezyT2eI',
  authDomain: 'playcred-1a24f.firebaseapp.com',
  projectId: 'playcred-1a24f',
  appId: '1:777843113601:web:5b66623e1fa0a620b55780',
};

const appCheckSiteKeyDefaults = {
  local: '6LcOOqYsAAAAABEKzNsx_ZGYMibPgbpLbRfEeRql',
  staging: '6LcOOqYsAAAAABEKzNsx_ZGYMibPgbpLbRfEeRql',
  production: '6LeROxAtAAAAAO9E3Ce-4-Xl1chH5_CI1sTvSnIQ',
};

const environments = {
  local: {
    playerBaseUrl: 'http://localhost:4300',
    advertiserBaseUrl: 'http://localhost:4302',
    contactApiBaseUrl: 'http://localhost:8081',
  },
  staging: {
    playerBaseUrl: 'https://playcred-player.web.app',
    advertiserBaseUrl: 'https://playcred-advertiser.web.app',
    contactApiBaseUrl: 'https://api-dev.playcred.ae',
  },
  production: {
    playerBaseUrl: 'https://app.playcred.ae',
    advertiserBaseUrl: 'https://advertiser.playcred.ae',
    contactApiBaseUrl: 'https://api.playcred.ae',
  },
};

const knownPlayerBaseUrls = Object.values(environments).map((environment) => environment.playerBaseUrl);
const knownAdvertiserBaseUrls = Object.values(environments).map(
  (environment) => environment.advertiserBaseUrl,
);
const knownContactApiBaseUrls = Object.values(environments).map(
  (environment) => environment.contactApiBaseUrl,
);
const placeholders = {
  CONTACT_API_URL: '__CONTACT_API_URL__',
  PLAYCRED_CONTACT_CONFIG_JSON: '__PLAYCRED_CONTACT_CONFIG_JSON__',
};

const requestedEnvironment = process.argv[2];
const targetRoot = path.resolve(process.argv[3] || process.cwd());
const targetEnvironment = environments[requestedEnvironment];

if (!targetEnvironment) {
  const validEnvironments = Object.keys(environments).join(', ');
  throw new Error(`Expected one of: ${validEnvironments}`);
}

function replaceAll(content, fromValues, toValue) {
  return fromValues.reduce((updatedContent, fromValue) => {
    return updatedContent.split(fromValue).join(toValue);
  }, content);
}

function pickEnvValue(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function getContactConfig(environment) {
  const contactApiUrl = pickEnvValue('CONTACT_API_URL', `${environment.contactApiBaseUrl}/api/v1/contact`);

  return {
    contactApiUrl,
    firebase: {
      apiKey: pickEnvValue('FIREBASE_API_KEY', firebaseDefaults.apiKey),
      authDomain: pickEnvValue('FIREBASE_AUTH_DOMAIN', firebaseDefaults.authDomain),
      projectId: pickEnvValue('FIREBASE_PROJECT_ID', firebaseDefaults.projectId),
      appId: pickEnvValue('FIREBASE_APP_ID', firebaseDefaults.appId),
    },
    appCheckSiteKey: pickEnvValue(
      'FIREBASE_APP_CHECK_SITE_KEY',
      appCheckSiteKeyDefaults[requestedEnvironment] || appCheckSiteKeyDefaults.production,
    ),
  };
}

function listHtmlFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }

  return files;
}

const htmlFiles = listHtmlFiles(targetRoot);
const contactConfig = getContactConfig(targetEnvironment);
const contactConfigJson = JSON.stringify(contactConfig);

for (const filePath of htmlFiles) {
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const nextContent = replaceAll(
    replaceAll(originalContent, knownPlayerBaseUrls, targetEnvironment.playerBaseUrl),
    knownAdvertiserBaseUrls,
    targetEnvironment.advertiserBaseUrl,
  );
  const nextContentWithContactApi = replaceAll(
    nextContent,
    knownContactApiBaseUrls,
    targetEnvironment.contactApiBaseUrl,
  );
  const nextContentWithContactConfigUrl = replaceAll(
    nextContentWithContactApi,
    [placeholders.CONTACT_API_URL],
    contactConfig.contactApiUrl,
  );
  const nextContentWithContactConfigJson = replaceAll(
    nextContentWithContactConfigUrl,
    [placeholders.PLAYCRED_CONTACT_CONFIG_JSON],
    contactConfigJson,
  );

  if (nextContentWithContactConfigJson !== originalContent) {
    fs.writeFileSync(filePath, nextContentWithContactConfigJson);
  }
}

console.log(
  `Configured public app links for ${requestedEnvironment}: ${targetEnvironment.playerBaseUrl}, ${targetEnvironment.advertiserBaseUrl}, ${contactConfig.contactApiUrl}`,
);
