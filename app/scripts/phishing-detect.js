import querystring from 'querystring';
import PortStream from 'extension-port-stream';
import browser from 'webextension-polyfill';
import createRandomId from '../../shared/modules/random-id';
import { setupMultiplex } from './lib/stream-utils';
import { getEnvironmentType } from './lib/util';
import ExtensionPlatform from './platforms/extension';

document.addEventListener('DOMContentLoaded', start);

function start() {
  const hash = window.location.hash.substring(1);
  const suspect = querystring.parse(hash);

  const newIssueLink = document.getElementById('new-issue-link');
  const newIssueUrl = `https://github.com/MetaMask/eth-phishing-detect/issues/new`;
  const newIssueParams = `?title=[Legitimate%20Site%20Blocked]%20${encodeURIComponent(
    suspect.hostname,
  )}&body=${encodeURIComponent(suspect.href)}`;
  newIssueLink.href = `${newIssueUrl}${newIssueParams}`;

  global.platform = new ExtensionPlatform();

  const extensionPort = browser.runtime.connect({
    name: getEnvironmentType(),
  });
  const connectionStream = new PortStream(extensionPort);
  const mx = setupMultiplex(connectionStream);
  const backgroundConnection = mx.createStream('controller');
  const continueLink = document.getElementById('unsafe-continue');
  continueLink.addEventListener('click', () => {
    backgroundConnection.write({
      jsonrpc: '2.0',
      method: 'safelistPhishingDomain',
      params: [suspect.hostname],
      id: createRandomId(),
    });
    const redirectTarget = new URL(suspect.href, window.location.href);
    // validate redirect url
    const invalidProtocol = !(['https:', 'http:'].includes(redirectTarget.protocol));
    // if in valid, show warning and abort
    if (invalidProtocol) {
      // we intentionally dont display to the user any potential attacker-written content here
      console.error(`Invalid redirect url.`);
      return;
    };
    // use the validated url instance
    window.location.href = redirectTarget.href;
  });
}
