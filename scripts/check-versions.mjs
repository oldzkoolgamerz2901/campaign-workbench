import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const catalog = readFileSync(new URL('docs/versions.toml', root), 'utf8').split('[libraries]')[0];
const versions = Object.fromEntries([...catalog.matchAll(/^([\w-]+) = "([^"]+)"/gm)].map(m => [m[1], m[2]]));
const pkg = JSON.parse(readFileSync(new URL('frontend/package.json', root)));
const lock = JSON.parse(readFileSync(new URL('frontend/package-lock.json', root)));
for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
  const key = name === '@types/qrcode' ? 'qrcode-types' : name === '@angular/material' || name === '@angular/cdk' ? 'angular-material'
    : name.startsWith('@angular/') ? (name === '@angular/cli' ? 'angular-cli' : 'angular')
    : name === '@playwright/test' ? 'playwright' : name;
  if (versions[key]) assert.equal(version, versions[key], `${name}: catalog drift`);
  assert.equal(lock.packages[`node_modules/${name}`].version, version, `${name}: lockfile drift`);
}
const wrapper = readFileSync(new URL('backend/gradle/wrapper/gradle-wrapper.properties', root), 'utf8');
assert.ok(wrapper.includes(`gradle-${versions.gradle}-bin.zip`), 'Gradle wrapper drift');
const compose = readFileSync(new URL('compose.yaml', root), 'utf8');
assert.ok(compose.includes(`postgres:${versions.postgresql}`), 'PostgreSQL Compose drift');
assert.equal(process.versions.node, versions.node, 'Node runtime drift');
console.log('Catalog, direct npm dependencies, lockfile, Node, Gradle wrapper and Compose versions agree.');
