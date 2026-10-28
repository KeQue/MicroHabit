import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as callback from './callback.ts';
import * as flow from './pkce-flow.ts';

// Execute the installed Expo createURL/Schemes implementations. Mock only
// native manifest/platform dependencies, not the URL builder being verified.
function fixture(expoGo = false) {
  const constants = {
    executionEnvironment: expoGo ? 'store' : 'bare',
    expoConfig: { scheme: 'microhabit', ios: { bundleIdentifier: 'com.sadik.microhabit' }, ...(expoGo ? { hostUri: '192.0.2.1:8082' } : {}) },
    ...(expoGo ? { expoGoConfig: { developer: {} } } : {}),
    linkingUri: 'microhabit://',
  };
  const calls = [];
  const supabase = { AUTH_STORAGE_KEY: 'synthetic', authStorage: {
    async getItem() { return JSON.stringify('synthetic-verifier'); },
    async removeItem() {},
  }, supabase: { auth: { async exchangeCodeForSession(code) { calls.push(code); return { error: null }; } } } };
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, __DEV__: false, URL, URLSearchParams, console,
      require(name) {
        if (name === 'expo-constants') return { __esModule: true, default: constants, ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'store' } };
        if (name === 'expo-modules-core') return { Platform: { OS: 'ios', select: values => values.ios } };
        if (name === './Schemes') return load('node_modules/expo-linking/src/Schemes.ts');
        if (name === './validateURL') return { validateURL() {} };
        if (name === 'expo-linking') return load('node_modules/expo-linking/src/createURL.ts');
        if (name === '../../lib/supabase') return supabase;
        if (name === './callback') return callback;
        if (name === './pkce-flow') return flow;
        throw Error('Unexpected dependency: ' + name);
      },
    });
    return module.exports;
  }
  return { links: load('features/auth/links.ts'), calls };
}

// These exact forms are recorded in the deployed allowlist after the Oct 28
// targeted correction. This fixture does not replace fresh server inspection.
const deployedRedirects = new Set([
  'microhabit://sign-in', 'microhabit://update-password',
  'microhabit:///sign-in', 'microhabit:///update-password',
]);

test('actual Expo standalone return addresses match the exact deployed allowlist', () => {
  const { links } = fixture();
  for (const path of ['/sign-in', '/update-password']) {
    const address = links.buildAuthRedirectUrl(path);
    assert.equal(address, 'microhabit:///' + path.slice(1));
    assert.ok(deployedRedirects.has(address));
    assert.equal(links.isAuthCallbackUrl(address + '?code=synthetic-code'), true);
  }
});

test('actual standalone builder and callback consumer complete a synthetic exchange', async () => {
  const { links, calls } = fixture();
  const address = links.buildAuthRedirectUrl('/sign-in');
  const result = await links.consumeAuthCallbackUrl(address + '?code=synthetic-code');
  assert.equal(result.kind, 'signed-in');
  assert.deepEqual(calls, ['synthetic-code']);
});

test('server fallback shape reproduces build 29 rejection; unrelated origins remain rejected', () => {
  const { links } = fixture();
  assert.equal(links.buildAuthRedirectUrl('/sign-in'), 'microhabit:///sign-in');
  assert.equal(links.isAuthCallbackUrl('microhabit://sign-in?code=synthetic-code'), false);
  for (const address of ['https://unrelated.example/sign-in', 'otherapp:///sign-in', 'microhabit://attacker/sign-in']) {
    assert.equal(links.isAuthCallbackUrl(address + '?code=synthetic-code'), false);
  }
});

test('actual Expo Go builder remains limited to its configured host and port', () => {
  const { links } = fixture(true);
  const address = links.buildAuthRedirectUrl('/sign-in');
  assert.equal(address, 'exp://192.0.2.1:8082/--/sign-in');
  assert.equal(links.isAuthCallbackUrl(address + '?code=synthetic-code'), true);
  assert.equal(links.isAuthCallbackUrl('exp://192.0.2.2:8082/--/sign-in?code=synthetic-code'), false);
});
