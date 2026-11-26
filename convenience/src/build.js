// 번들(three.js 포함)을 템플릿에 끼워 넣어 단일 파일 ../convenience.html 을 만들어요.
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');
const out = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'game.js')], bundle: true, minify: true, write: false,
  format: 'iife', target: 'es2019', legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), tpl.replace('/*__BUNDLE__*/', () => js));
console.log('built index.html', (js.length / 1024).toFixed(0) + 'KB js');
