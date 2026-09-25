const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// `eas update` exports into ./dist and it gets cleared between publishes.
// Keep Metro from crawling/watching it, otherwise the watcher crashes with
// ENOENT when the folder disappears mid-walk.
const distDir = path.resolve(__dirname, 'dist').replace(/[\\/]/g, '[\\\\/]');
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  new RegExp(`^${distDir}[\\\\/].*`),
];

module.exports = config;
