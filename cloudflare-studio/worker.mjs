// Bundle assets in the Worker: Static Assets routes through an internal Worker
// which does not forward ctx.access. Direct invocation is required to fail closed.
import app from './app.mjs';
import html from './public/index.html';
import preview from './public/preview.html';
import css from './public/style.css';
import js from './public/app.js';
const assets={'/preview.html':{content:preview,type:'text/html; charset=utf-8',preview:true},'/index.html':{content:html,type:'text/html; charset=utf-8'},'/style.css':{content:css,type:'text/css; charset=utf-8'},'/app.js':{content:js,type:'text/javascript; charset=utf-8'}};
export default {fetch(request,env,ctx){return app.fetch(request,env,ctx,assets);}};
