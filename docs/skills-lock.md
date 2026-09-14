# Skill kaynak/sürüm kilidi

Dış skill'ler hedef ajana **kurulmadı**; aşağıdaki Expo skill'leri 11 Eylül 2026'da resmi depodan salt-okunur çekildi ve okundu. Kurulum yapıldığında commit/hash tekrar kaydedilir.

| Skill | Durum | Kaynak | Commit/sürüm | Hash | Okuma/test kaydı |
|---|---|---|---|---|---|
| vp-* proje skill'leri (12) | Pakette mevcut, tamamı okundu | .agents/skills | Paket 1.0 | docs/pack-manifest.json | 11.09.2026, M0/M1 görevlerinde uygulandı |
| expo-overview 1.1.0 | OKUNDU (fetch), kurulmadı | github.com/expo/skills `plugins/expo/skills/expo-overview/SKILL.md` | main @ `ea892a7d1421fea5ecdf8c00a4550867fdf8c423` (2026-09-10) | — | 11.09.2026; shared setup rules uygulandı (`create-expo-app`, `expo install`) |
| expo-project-structure 1.0.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | `src/app` routes-only, `screens/`, `components/`, kebab-case |
| expo-router 1.0.1 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Stack `_layout`, formSheet modaller, `expo-router/js-tabs` |
| expo-design-system 1.0.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Tek tema kaynağı, component contract, native-slop kontrol |
| expo-native-ui 1.1.1 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | boxShadow, borderCurve, expo-symbols, safe area, Expo Go önce |
| expo-ui 1.0.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Değerlendirildi; onaylı referans (dock'lu kart) nedeniyle M1'de `@expo/ui` BottomSheet kullanılmadı, formSheet route tercih edildi |
| expo-animation 1.0.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Tab animation none; press scale 0.97/120ms CSS transition; layout FadeInDown; reduce-motion sistem |
| expo-dev-client 1.1.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Google Maps için dev build gerekir; anahtar yok → BLOCKED |
| expo-data-fetching 1.0.0 | OKUNDU (fetch), kurulmadı | aynı depo | aynı commit | — | Dört durum (loading/error/empty/content), TanStack Query |
| vercel-react-best-practices | Makinede kurulu (`~/.agents/skills`) | vercel-labs/agent-skills | — | — | Bu teslimde web işi yok; uygulanmadı |
| web-design-guidelines | Makinede kurulu (`~/.agents/skills`) | vercel-labs/agent-skills | — | — | Uygulanmadı (mobil DOM kopyası için kullanılmaz) |
| supabase 0.1.2 | KURULDU (proje düzeyi, kopya) `npx skills add supabase/agent-skills` | github supabase/agent-skills | skills-lock.json | sha256 583344c20e90… | 11.09.2026 okundu; RLS/SECURITY DEFINER/grant kuralları VP-006'da uygulandı |
| supabase-postgres-best-practices 1.1.1 | KURULDU (proje düzeyi, kopya) | aynı depo | skills-lock.json | sha256 e14e27624180… | 11.09.2026 security-* referansları okundu; (select auth.uid()) kalıbı ve RLS indeksleri uygulandı |
| ios-hig-design 1.5.1 (wondelai) | KURULDU (proje düzeyi) `npx skills add wondelai/skills -s ios-hig-design` | github wondelai/skills | skills-lock.json | — | 11.09.2026; topluluk özeti, resmi HIG metni öncelikli |
| apple-hig (nexu-io/open-design) | KURULDU (proje düzeyi) | github nexu-io/open-design (upstream raintree-technology/apple-hig-skills) | skills-lock.json | — | Katalog girişi; içerik yok, yalnız yönlendirme |
| Apple HIG resmi metin (Maps/Sheets/Tab bars/Searching) | OKUNDU (developer.apple.com JSON verisi → docs/research/apple-hig/*.md) | Apple | 11.09.2026 | — | patterns.md tablosunda uygulanan kurallar |
| apple-design (kullanıcı skill'i) | Makinede kurulu (`~/.claude/skills/apple-design`), Skill tool ile okundu | Apple WWDC tasarım konuşmalarının özeti | — | — | 11.09.2026; kart sürükleme (hız devri, projeksiyon 0.998, lastik bant, damping 0.8), materyal (GlassView), tipografi izleme uygulandı |
| appllama-app-design-skill 1.3.0 | KURULDU (proje düzeyi, kopya) — kullanıcı talimatı ile `npx skills@latest add appllama/appllama-skills -y -a claude-code -s '*'` | github appllama/appllama-skills `skills/appllama-app-design-skill/SKILL.md` | skills-lock.json | sha256 `023b25559a5e9a4ab85ccffc9612d0d0f650608eb7f281dce8408a32649b2340` | 11.09.2026 okundu; native fidelity/anti-slop/motion/simulator-loop kuralları M1 bileşen cilasında uygulandı. Global kopya da `~/.agents/skills` altında (7 Eylül) mevcuttu. |
| appllama-usage 1.1.0 | KURULDU (proje düzeyi, kopya) | aynı depo `skills/appllama-usage/SKILL.md` | skills-lock.json | sha256 `9b9ecf34e1585ad0e77d749e5e5178270ea1b73147459ef53db7340aa16eb4e2` | 11.09.2026 okundu; **Appllama MCP bu oturumda bağlı değil** (ToolSearch: `search_apps`/`list_app_screens` yok) → referans-ekran araştırma playbook'u UNAVAILABLE, yalnız tasarım kuralları uygulandı. |

| nextjs-app-router-patterns (wshobson/agents) | KURULDU (proje düzeyi) `npx skills add wshobson/agents -s nextjs-app-router-patterns -y -a claude-code` | github wshobson/agents | skills-lock.json | — | 12.09.2026; route.ts/`Promise` params sözleşmesi, Server Component yokluğu kararı (yalnız API) VP-007'de uygulandı. `vercel-labs/agent-skills` içinde `nextjs` skill'i YOK (liste doğrulandı: composition-patterns, react-best-practices, web-design-guidelines…) |

Bir skill güncellemesi çalışan projeye sessiz uygulanmaz. Eksik plugin için URL uydurulmaz.
