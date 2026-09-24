import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const port=Number(process.env.VITE_PORT||5173),api=process.env.STUDIO_API||'http://127.0.0.1:8787';
export default defineConfig({root:resolve('web'),base:process.env.BASE_PATH || '/',build:{outDir:resolve(process.env.BUILD_DIR||'dist'),emptyOutDir:true,target:'es2022'},server:{port,strictPort:true,proxy:{'/api':{target:api,changeOrigin:true,configure(proxy){proxy.on('proxyReq',req=>{const origin=req.getHeader('origin');if(origin===`http://127.0.0.1:${port}`||origin===`http://localhost:${port}`)req.setHeader('origin',api);});}}}},define:{__TEST__:JSON.stringify(process.env.TEST_BUILD==='1')}});
