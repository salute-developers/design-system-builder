const { createRequire } = require("node:module");
const fs = require("node:fs");
// Только изолированный тестовый HTTP-хост с trusted-заголовками; не запускать против dev.
const path = require("node:path");
const root = path.resolve(process.argv[2]);
const baselineRoot = path.resolve(process.argv[3]);
const output = path.resolve(process.argv[4]);
fs.mkdirSync(output, { recursive: true });
const req = createRequire(root + "/package.json");
const esbuild = req("esbuild");
(async () => {
  for (const variant of ["baseline", "current"]) {
    const source =
      variant === "baseline" ? path.join(baselineRoot, "js/apps/client") : root;
    await esbuild.build({
      stdin: {
        contents: `export {EditorSectionData} from '${source}/src/features/themeEditor/EditorSectionData.ts'; export {loadThemeShell} from '${source}/src/api/themeEditorRepository.ts'; export {readEditor,invalidateEditorReads} from '${source}/src/api/editorReads.ts';`,
        resolveDir: root,
      },
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: path.join(output, "editor-accept-" + variant + ".cjs"),
      nodePaths: [root + "/node_modules"],
      define: {
        "import.meta.env.VITE_PALETTE_SOURCE": '"api"',
        "import.meta.env.VITE_PALETTE_REPOSITORY": '"api"',
        "import.meta.env": "{}",
      },
      plugins: [
        {
          name: "acceptance-transport",
          setup(b) {
            b.onResolve({ filter: /^styled-components$/ }, () => ({
              path: "styles",
              namespace: "acceptance",
            }));
            b.onResolve(
              { filter: /\/(authService|http|constants)$/ },
              (args) => {
                const p = require("node:path").resolve(
                  args.resolveDir,
                  args.path,
                );
                if (
                  !p.endsWith("/api/authService") &&
                  !p.endsWith("/api/http") &&
                  !p.endsWith("/api/constants")
                )
                  return;
                return { path: p.split("/").pop(), namespace: "acceptance" };
              },
            );
            b.onResolve({ filter: /paletteSession$/ }, () => ({
              path: "paletteSession",
              namespace: "acceptance",
            }));
            b.onLoad({ filter: /.*/, namespace: "acceptance" }, (args) => {
              if (args.path === "styles")
                return {
                  contents: `const styled=new Proxy(()=>styled,{get:()=>styled,apply:()=>styled});export default styled;export const css=()=>'',keyframes=()=>'',createGlobalStyle=()=>styled,ThemeProvider=()=>null;`,
                  loader: "js",
                };
              if (args.path === "authService")
                return {
                  contents: `export const authService={getCurrentUser:()=>({id:'performance-user'}),onSessionReset:()=>()=>{}};`,
                  loader: "js",
                };
              if (args.path === "constants")
                return {
                  contents: `export const API_GATEWAY_URL='http://127.0.0.1:'+process.env.DS_ACCEPT_PORT; export const PROJECTS_URL='/api/projects'; export const API_URL=API_GATEWAY_URL; export const AUTH_URL=''; export const CLIENT_ID=''; export const LOGOUT_URL=''; export const ACCESS_KEY='access'; export const EXPIRES_AT_KEY='expiry'; export const REFRESH_KEY='refresh';`,
                  loader: "js",
                };
              if (args.path === "paletteSession")
                return {
                  contents: `export {createHttpPaletteRepository} from '${source}/src/modules/palette/data/httpPaletteRepository.ts'; import {createHttpPaletteRepository} from '${source}/src/modules/palette/data/httpPaletteRepository.ts'; export const paletteRepository=createHttpPaletteRepository();`,
                  loader: "js",
                  resolveDir: root,
                };
              return {
                contents: `import axios from 'axios'; export const http=axios.create({baseURL:'http://127.0.0.1:'+process.env.DS_ACCEPT_PORT,headers:{'X-Actor-Type':'user','X-User-Id':'performance-user','X-Project-Id':'performance-project','X-Project-Role':'owner'}});http.interceptors.request.use(c=>{if(c.url==='/api/projects/performance-project'){c.adapter=async()=>({data:{id:'performance-project',name:'Performance',effectiveRole:'owner',status:'active'},status:200,statusText:'OK',headers:{},config:c});}c.url=c.url.replace('/api/projects/performance-project/design-systems','/api/design-systems');return c;});`,
                loader: "js",
                resolveDir: root,
              };
            });
          },
        },
      ],
    });
    console.log("built", variant);
  }
})();
