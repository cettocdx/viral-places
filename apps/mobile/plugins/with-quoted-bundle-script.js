// Expo config plugin: "Bundle React Native code and images" betiğindeki
//   `"$NODE_BINARY" --print "...react-native-xcode.sh"`
// ters tırnaklı komut yerine koymayı tırnak içine alır. Aksi halde proje yolu boşluk
// içerdiğinde (ör. ".../Viral Places/...") sh yolu iki kelimeye böler ve build
// "No such file or directory" ile düşer. Expo SDK 57 şablonu (sdk-57 dalı) hâlâ ters tırnak kullanır.
const { withXcodeProject } = require('expo/config-plugins');

const PHASE_NAME = 'Bundle React Native code and images';
const BARE = /`("\$NODE_BINARY" --print "require\('path'\)\.dirname\(require\.resolve\('react-native\/package\.json'\)\) \+ '\/scripts\/react-native-xcode\.sh'")`/;

function withQuotedBundleScript(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    let patched = 0;
    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase !== 'object') continue;
      const name = String(phase.name ?? '').replace(/^"|"$/g, '');
      if (name !== PHASE_NAME || typeof phase.shellScript !== 'string') continue;
      // xcode paketi shellScript'i JSON-benzeri kaçışlarla saklar; ham metne çevirip düzelt.
      const raw = JSON.parse(phase.shellScript);
      if (!BARE.test(raw)) continue;
      const fixed = raw.replace(BARE, (_m, inner) => `"$(${inner})"`);
      phase.shellScript = JSON.stringify(fixed);
      patched += 1;
    }
    if (patched === 0) {
      console.warn('[with-quoted-bundle-script] Düzeltilecek ters tırnaklı bundle betiği bulunamadı (şablon değişmiş olabilir).');
    }
    return cfg;
  });
}

module.exports = withQuotedBundleScript;
