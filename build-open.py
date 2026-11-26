#!/usr/bin/env python3
"""Bundle brain-cut-rpg-open.dev.html (CDN importmap version) into a single self-contained brain-cut-rpg-open.html.
Needs: npm i three@0.160.0 esbuild  (in a scratch dir; set DIR below)."""
import re,subprocess,sys,os
DIR=sys.argv[1] if len(sys.argv)>1 else '.'
src=open('brain-cut-rpg-open.dev.html').read()
m=re.search(r'<script type="module">([\s\S]*)</script>\s*</body>',src)
js=m.group(1).replace("from 'three/addons/","from 'three/examples/jsm/")
open(os.path.join(DIR,'entry.js'),'w').write(js)
subprocess.check_call(['npx','esbuild','entry.js','--bundle','--format=iife','--minify','--target=es2020','--outfile=bundle.js'],cwd=DIR)
bundle=open(os.path.join(DIR,'bundle.js')).read().replace('</script>','<\\/script>')
head=src[:m.start()]
head=re.sub(r'<script type="importmap">[\s\S]*?</script>\s*','',head)
err='''<script>window.addEventListener('error',function(e){var l=document.getElementById('load');if(l){l.style.opacity=1;l.style.flexDirection='column';l.style.padding='20px';l.style.textAlign='center';l.innerHTML='⚠️ 실행 중 오류가 발생했어요<br><small style="color:#fff;opacity:.8">'+(e.message||'')+'<br>크롬/사파리 등 최신 브라우저에서 열어 주세요 (WebGL 필요)</small>'}});</script>
'''
head=head.replace('</head>',err+'</head>',1)
out=head+'<script>'+bundle+'</script>\n</body>\n</html>\n'
open('brain-cut-rpg-open.html','w').write(out)
# hosted main copy + version file (auto-update checker reads play/version.json)
import json,datetime
os.makedirs('play',exist_ok=True)
open('play/index.html','w').write(out)
tag=re.search(r"TAG='([^']*)'",src).group(1)
json.dump({'tag':tag,'t':datetime.datetime.utcnow().isoformat()+'Z'},open('play/version.json','w'),ensure_ascii=False)
print('built',tag)
