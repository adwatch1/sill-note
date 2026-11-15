// GitHub sürümüne yüklenecek dosyaları SABİT adlarla hazırlar (dist/release/):
//   SillNote-Setup.exe     kurulum
//   SillNote-Setup.zip     aynı kurulum, ZIP içinde (.exe indirmeyi engelleyen tarayıcı / e-posta için)
//   SillNote-Portable.zip  kurulumsuz sürüm: aç, Sill.exe'yi çalıştır
//   latest.yml             otomatik güncellemenin okuduğu sürüm bilgisi (sürüm, dosya adı, SHA-512)
// Sabit ad şart: sitedeki indirme linkleri ".../releases/latest/download/<ad>" ile hep son sürümü alır.
// Kullanım: npm run dist → npm run release-files
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const out = join('dist', 'release')
const setup = join('dist', `SillNote-Setup-${version}.exe`)
// Taşınabilir sürüm = electron-builder'ın zaten ürettiği kurulumsuz klasör (dist/win-unpacked).
const unpacked = join('dist', 'win-unpacked')
for (const f of [setup, join(unpacked, 'Sill.exe')]) {
  if (!existsSync(f)) throw new Error(`${f} yok — önce "npm run dist"`)
}
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

copyFileSync(setup, join(out, 'SillNote-Setup.exe'))
// Otomatik güncelleme: kurulu program yeni sürümü ".../releases/latest/download/latest.yml"den öğrenir.
// electron-builder bu dosyayı sürüm numaralı kurulum adıyla yazar; biz sabit adla yüklediğimiz için
// içindeki adı düzeltiyoruz. Dosyanın SHA-512 özeti içerikten hesaplandığı için ad değişikliği onu bozmaz.
const yml = join('dist', 'latest.yml')
if (!existsSync(yml)) throw new Error(`${yml} yok — package.json → build.publish ayarı silinmiş olabilir`)
const fixed = readFileSync(yml, 'utf8').split(`SillNote-Setup-${version}.exe`).join('SillNote-Setup.exe')
if (!fixed.includes(`version: ${version}`)) throw new Error('latest.yml sürümü package.json ile uyuşmuyor')
writeFileSync(join(out, 'latest.yml'), fixed)
// Windows'un kendi ZIP'leyicisi (ek paket gerekmesin)
const zip = (path, dest) =>
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${path}' -DestinationPath '${dest}' -Force`])
zip(join(out, 'SillNote-Setup.exe'), join(out, 'SillNote-Setup.zip'))
// Taşınabilir: 89 dosya ZIP'in köküne dağılmasın, tek bir "Sill Note" klasöründe dursun.
const stage = join(out, 'stage', 'Sill Note')
cpSync(unpacked, stage, { recursive: true })
zip(stage, join(out, 'SillNote-Portable.zip'))
rmSync(join(out, 'stage'), { recursive: true, force: true })
console.log(`hazır: ${out} (sürüm ${version})`)
