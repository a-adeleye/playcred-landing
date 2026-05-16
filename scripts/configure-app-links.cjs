const fs = require('node:fs');
const path = require('node:path');

const environments = {
  local: {
    playerBaseUrl: 'http://localhost:4300',
    advertiserBaseUrl: 'http://localhost:4302',
  },
  staging: {
    playerBaseUrl: 'https://playcred-player.web.app',
    advertiserBaseUrl: 'https://playcred-advertiser.web.app',
  },
  production: {
    playerBaseUrl: 'https://app.playcred.ae',
    advertiserBaseUrl: 'https://advertiser.playcred.ae',
  },
};

const knownPlayerBaseUrls = Object.values(environments).map((environment) => environment.playerBaseUrl);
const knownAdvertiserBaseUrls = Object.values(environments).map(
  (environment) => environment.advertiserBaseUrl,
);

const publicPages = [
  'players/index.html',
  'advertisers/index.html',
  'pricing/index.html',
];

const requestedEnvironment = process.argv[2];
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

for (const publicPage of publicPages) {
  const filePath = path.resolve(publicPage);
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const nextContent = replaceAll(
    replaceAll(originalContent, knownPlayerBaseUrls, targetEnvironment.playerBaseUrl),
    knownAdvertiserBaseUrls,
    targetEnvironment.advertiserBaseUrl,
  );

  if (nextContent !== originalContent) {
    fs.writeFileSync(filePath, nextContent);
  }
}

console.log(
  `Configured public app links for ${requestedEnvironment}: ${targetEnvironment.playerBaseUrl}, ${targetEnvironment.advertiserBaseUrl}`,
);
