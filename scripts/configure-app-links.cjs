const fs = require('node:fs');
const path = require('node:path');

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

  if (nextContentWithContactApi !== originalContent) {
    fs.writeFileSync(filePath, nextContentWithContactApi);
  }
}

console.log(
  `Configured public app links for ${requestedEnvironment}: ${targetEnvironment.playerBaseUrl}, ${targetEnvironment.advertiserBaseUrl}, ${targetEnvironment.contactApiBaseUrl}`,
);
